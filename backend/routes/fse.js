const express = require('express');
const router = express.Router();
const { cacheGet, cacheSet, cacheKey } = require('../utils/cache');

// GET /api/fse - Get all FSEs with Tide BT access
router.get('/', async (req, res) => {
  try {
    const db = req.db; // Use ConnectionManager db from middleware
    
    console.log('🔍 Fetching FSEs from TideBT_Access...');
    
    // Get all unique FSEs from TideBT_Access collection (fseName field)
    const accessList = await db.collection('TideBT_Access').find({ 
      hasTideBTAccess: true 
    }).toArray();
    
    // Get unique FSE names
    const uniqueFSEs = [...new Set(accessList.map(a => a.fseName))].filter(Boolean);
    console.log(`✅ Found ${uniqueFSEs.length} unique FSEs in TideBT_Access:`, uniqueFSEs);
    
    // Get employee details from Employees collection (case-insensitive match)
    const employees = await db.collection('Employees').find({}).toArray();
    
    // Build FSE list with details - use newJoinerName from Employees as primary name
    const fseList = uniqueFSEs.map(fseName => {
      // Case-insensitive match between TideBT_Access.fseName and Employees.newJoinerName
      const emp = employees.find(e => 
        e.newJoinerName?.toLowerCase().trim() === fseName?.toLowerCase().trim()
      );
      const accessRecord = accessList.find(a => a.fseName === fseName);
      
      return {
        name: emp?.newJoinerName || fseName, // Use Employees name as primary (matches FSE panel)
        phone: emp?.newJoinerPhone || '',
        email: emp?.newJoinerEmailId || '',
        reportingManager: accessRecord?.tlName || emp?.reportingManager || '',
        status: 'active',
        createdAt: accessRecord?.createdAt || null
      };
    });
    
    res.json({ success: true, fses: fseList, total: fseList.length });
  } catch (error) {
    console.error('❌ Error fetching FSEs:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/fse/merchants/all - FSE summary + BT metrics (fast, no merchant details)
router.get('/merchants/all', async (req, res) => {
  try {
    const db = req.db;
    const { selectedMonth, selectedYear } = req.query;
    const escape = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Cache check
    const ck = cacheKey('FSE_MERCHANTS_ALL', selectedMonth, selectedYear);
    const cached = await cacheGet(ck);
    if (cached) {
      console.log(`[Cache HIT] ${ck}`);
      return res.json(cached);
    }
    console.log(`[Cache MISS] ${ck}`);

    // Step 1: FSE names + TL mapping
    const accessList = await db.collection('TideBT_Access').find(
      { hasTideBTAccess: true },
      { projection: { fseName: 1, tlName: 1, _id: 0 } }
    ).toArray();
    const fseNames = [...new Set(accessList.map(a => a.fseName).filter(Boolean))];
    if (fseNames.length === 0) return res.json({ success: true, data: [], btCollection: null });

    const tlMap = {};
    accessList.forEach(a => { if (a.fseName) tlMap[a.fseName] = a.tlName || '–'; });

    // Step 2: BT collection
    const allCollections = (await db.listCollections().toArray()).map(c => c.name);
    const btCollections = allCollections.filter(c => c.toUpperCase().startsWith('BT_TL_CONNECT'));
    let btCollectionName = null;
    if (selectedMonth) {
      const mu = selectedMonth.toUpperCase();
      if (selectedYear) {
        const yr = String(selectedYear); const sy = yr.slice(-2);
        btCollectionName = btCollections.find(c => { const cu = c.toUpperCase(); return cu.includes(mu) && (cu.includes(yr) || cu.includes(sy)); }) || null;
      }
      if (!btCollectionName) btCollectionName = btCollections.find(c => c.toUpperCase().includes(mu)) || null;
    }

    // Step 3: bt_master — count merchants per FSE + get all numbers
    const masterDocs = await db.collection('bt_master').find(
      {}, { projection: { merchantNumber: 1, fseName: 1, _id: 0 } }
    ).toArray();

    const fseMerchantNums = {};
    fseNames.forEach(n => { fseMerchantNums[n] = []; });
    masterDocs.forEach(m => {
      const num = (m.merchantNumber || '').trim();
      if (!num) return;
      const matchedFSE = fseNames.find(n => new RegExp(`^\\s*${escape(n)}\\s*\\d*\\s*$`, 'i').test(m.fseName || ''));
      if (matchedFSE) fseMerchantNums[matchedFSE].push(num);
    });

    const allNums = [...new Set(masterDocs.map(m => (m.merchantNumber || '').trim()).filter(Boolean))];

    // Step 4: BT metrics from BT_TL_CONNECT — aggregate by merchantNumber
    const btMetrics = {}; // fseName → {totalBT, btDone, rpDone, passLive}
    if (btCollectionName && allNums.length > 0) {
      const btDocs = await db.collection(btCollectionName).find(
        { merchantNumber: { $in: allNums } },
        { projection: { merchantNumber: 1, stage3: 1, rewardPassPro: 1, passLive: 1, priorityPassPro: 1, _id: 0 } }
      ).toArray();

      // Build num→fse map
      const numToFse = {};
      masterDocs.forEach(m => { numToFse[(m.merchantNumber||'').trim()] = m.fseName; });

      btDocs.forEach(r => {
        const num = (r.merchantNumber || '').trim();
        const rawFse = numToFse[num];
        const fseName = fseNames.find(n => new RegExp(`^\\s*${escape(n)}\\s*\\d*\\s*$`, 'i').test(rawFse || ''));
        if (!fseName) return;
        if (!btMetrics[fseName]) btMetrics[fseName] = { totalBT: 0, btDone: 0, rpDone: 0, passLive: 0 };
        const s3 = parseFloat(String(r.stage3 || '0').replace(/,/g,'')) || 0;
        const rp = (r.rewardPassPro || r.priorityPassPro || '').toLowerCase() === 'active';
        const pl = (r.passLive || '').toLowerCase() === 'live';
        btMetrics[fseName].totalBT += s3;
        if (s3 > 0) btMetrics[fseName].btDone++;
        if (rp) btMetrics[fseName].rpDone++;
        if (pl) btMetrics[fseName].passLive++;
      });
    }

    const collectionMonth = btCollectionName ? (() => { const p = btCollectionName.split(' '); const m = p[p.length-1]; return m ? m.charAt(0)+m.slice(1).toLowerCase() : null; })() : null;

    // Step 5: Build summary per FSE (no merchant details)
    const data = fseNames.map(fseName => {
      const total = (fseMerchantNums[fseName] || []).length;
      const bm = btMetrics[fseName] || { totalBT: 0, btDone: 0, rpDone: 0, passLive: 0 };
      return {
        fseName,
        tlName: tlMap[fseName] || '–',
        metrics: {
          total,
          btDone:   bm.btDone,
          rpDone:   bm.rpDone,
          passLive: bm.passLive,
          pending:  total - bm.passLive,
          totalBT:  Math.round(bm.totalBT),
          verified: bm.btDone,
          onboarded: bm.passLive,
        }
      };
    }).filter(d => d.metrics.total > 0);

    const result = { success: true, data, btCollection: btCollectionName, collectionMonth };
    await cacheSet(ck, result, 600); // cache 10 min
    res.json(result);
  } catch (err) {
    console.error('FSE merchants summary error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/fse/merchants/all-details - ALL FSEs full merchant data in ONE call (for KPI drill-down)
router.get('/merchants/all-details', async (req, res) => {
  try {
    const db = req.db;
    const { selectedMonth, selectedYear } = req.query;
    const escape = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Cache check
    const ck = cacheKey('FSE_ALL_DETAILS', selectedMonth, selectedYear);
    const cached = await cacheGet(ck);
    if (cached) {
      console.log(`[Cache HIT] ${ck}`);
      return res.json(cached);
    }
    console.log(`[Cache MISS] ${ck}`);

    // BT collection
    const allCollections = (await db.listCollections().toArray()).map(c => c.name);
    const btCollections = allCollections.filter(c => c.toUpperCase().startsWith('BT_TL_CONNECT'));
    let btCollectionName = null;
    if (selectedMonth) {
      const mu = selectedMonth.toUpperCase();
      if (selectedYear) { const yr = String(selectedYear); const sy = yr.slice(-2); btCollectionName = btCollections.find(c => { const cu = c.toUpperCase(); return cu.includes(mu) && (cu.includes(yr)||cu.includes(sy)); }) || null; }
      if (!btCollectionName) btCollectionName = btCollections.find(c => c.toUpperCase().includes(mu)) || null;
    }

    // Get ALL merchants from bt_master in ONE query
    const masterDocs = await db.collection('bt_master').find(
      {}, { projection: { merchantNumber: 1, merchantName: 1, fseName: 1, tl: 1, _id: 0 } }
    ).toArray();

    const merchantNums = masterDocs.map(m => (m.merchantNumber||'').trim()).filter(Boolean);

    // Build merchant map
    const merchantMap = {};
    masterDocs.forEach(m => {
      const key = (m.merchantNumber||'').trim();
      if (!key) return;
      merchantMap[key] = {
        merchantNumber: key, merchantName: (m.merchantName||'').trim()||'–',
        fseName: (m.fseName||'').trim(), tl: (m.tl||'').trim(),
        tlName: (m.tl||'').trim() || '–',  // explicit tlName field for TL Overview
        onboardingStatus: 'Pending', lastActivity: null,
        stage3: 0, stage3Gap: 0, passLive: '–', rewardPassPro: '–',
        upiTxnCount: 0, btVerified: false, merchantCategory: '–'
      };
    });

    // Enrich from TideBT Form Responses (latest per merchant)
    const formDocs = await db.collection('TideBT Form Responses').find(
      { merchantNumber: { $in: merchantNums } },
      { projection: { merchantNumber: 1, createdAt: 1, merchantOpinion: 1, onboardingStatus: 1, merchantCategory: 1, _id: 0 } }
    ).sort({ createdAt: -1 }).toArray();

    formDocs.forEach(f => {
      const m = merchantMap[(f.merchantNumber||'').trim()];
      if (!m) return;
      const d = f.createdAt ? new Date(f.createdAt) : null;
      if (d && !isNaN(d) && (!m.lastActivity || d > new Date(m.lastActivity))) {
        m.lastActivity = f.createdAt;
        m.onboardingStatus = (f.onboardingStatus || f.merchantOpinion || '').trim() || 'Pending';
        m.merchantCategory = (f.merchantCategory || '').trim();
      }
    });

    // Enrich from BT_TL_CONNECT
    if (btCollectionName) {
      const parseNum = v => { const n = parseFloat(String(v||'0').replace(/,/g,'')); return isNaN(n)?0:n; };
      const getStr = (r, keys) => { for (const k of keys) { if (r[k]!==undefined&&r[k]!==null) return String(r[k]).trim(); } return '–'; };
      const btDocs = await db.collection(btCollectionName).find(
        { merchantNumber: { $in: merchantNums } },
        { projection: { merchantNumber: 1, stage3: 1, stage3Gap: 1, passLive: 1, pass_live: 1, Pass_Live: 1, rewardPassPro: 1, reward_pass_pro: 1, priorityPassPro: 1, upiTxnCount: 1, upi_txn_count: 1, Upi_Txn_Count: 1, withdrawAmount: 1, UPI_Amount: 1, upiAmount: 1, _id: 0 } }
      ).toArray();
      btDocs.forEach(r => {
        const m = merchantMap[(r.merchantNumber||'').trim()];
        if (!m) return;
        m.stage3    = parseNum(r.stage3 || r.Stage_3 || r['Stage-3']);
        m.stage3Gap = parseNum(r.stage3Gap || r['Stage-3_GAP']);
        m.passLive  = getStr(r, ['passLive','pass_live','Pass_Live']);
        m.rewardPassPro = getStr(r, ['rewardPassPro','reward_pass_pro','priorityPassPro']);
        m.upiTxnCount = parseNum(r.upiTxnCount || r.upi_txn_count || r.Upi_Txn_Count);
        m.upiAmount   = parseNum(r.withdrawAmount || r.UPI_Amount || r.upiAmount);
        const isLive = m.passLive.toLowerCase()==='live';
        const isActive = m.rewardPassPro.toLowerCase()==='active';
        m.btVerified = isLive || isActive || m.stage3 > 0;
        if (isLive || isActive) m.onboardingStatus = 'Onboarded';
        else if (m.stage3 > 0) m.onboardingStatus = 'BT Active';
      });
    }

    const merchants = Object.values(merchantMap).map(m => ({
      merchantNumber: m.merchantNumber,
      merchantName:   m.merchantName,
      fseName:        m.fseName,
      tl:             m.tl,
      tlName:         m.tlName || m.tl || '–',
      onboardingStatus: m.onboardingStatus,
      lastActivity:   m.lastActivity,
      stage3:         m.stage3,
      stage3Gap:      m.stage3Gap,
      passLive:       m.passLive,
      rewardPassPro:  m.rewardPassPro,
      upiTxnCount:    m.upiTxnCount,
      upiAmount:      m.upiAmount || 0,
      btVerified:     m.btVerified,
      merchantCategory: m.merchantCategory
    }));
    const result = { success: true, merchants, btCollection: btCollectionName };
    await cacheSet(ck, result, 600);
    res.json(result);
  } catch (err) {
    console.error('FSE all-details error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/fse/merchants/:fseName - Get merchants for ONE FSE (called on expand)
router.get('/merchants/:fseName', async (req, res) => {
  try {
    const db = req.db;
    const fseName = decodeURIComponent(req.params.fseName);
    const { selectedMonth, selectedYear } = req.query;
    const escape = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Cache check — per FSE per month
    const ck = cacheKey('FSE_MERCHANTS', fseName, selectedMonth, selectedYear);
    const cached = await cacheGet(ck);
    if (cached) {
      console.log(`[Cache HIT] ${ck}`);
      return res.json(cached);
    }
    console.log(`[Cache MISS] ${ck}`);

    // BT collection
    const allCollections = (await db.listCollections().toArray()).map(c => c.name);
    const btCollections = allCollections.filter(c => c.toUpperCase().startsWith('BT_TL_CONNECT'));
    let btCollectionName = null;
    if (selectedMonth) {
      const mu = selectedMonth.toUpperCase();
      if (selectedYear) { const yr = String(selectedYear); const sy = yr.slice(-2); btCollectionName = btCollections.find(c => { const cu = c.toUpperCase(); return cu.includes(mu) && (cu.includes(yr)||cu.includes(sy)); }) || null; }
      if (!btCollectionName) btCollectionName = btCollections.find(c => c.toUpperCase().includes(mu)) || null;
    }

    // Get merchants for this FSE from bt_master
    const masterDocs = await db.collection('bt_master').find(
      { fseName: { $regex: new RegExp(`^\\s*${escape(fseName)}\\s*\\d*\\s*$`, 'i') } },
      { projection: { merchantNumber: 1, merchantName: 1, fseName: 1, tl: 1, _id: 0 } }
    ).toArray();

    if (masterDocs.length === 0) return res.json({ success: true, merchants: [] });

    const merchantNums = masterDocs.map(m => (m.merchantNumber || '').trim()).filter(Boolean);

    // Build merchant map
    const merchantMap = {};
    masterDocs.forEach(m => {
      const key = (m.merchantNumber || '').trim();
      if (!key) return;
      merchantMap[key] = {
        merchantNumber: key, merchantName: (m.merchantName||'').trim()||'–',
        tl: (m.tl||'').trim(), fseName,
        onboardingStatus: 'Pending', submissionDate: null, lastActivity: null,
        btVerified: false, stage3: 0, stage3Gap: 0, passLive: '–',
        rewardPassPro: '–', upiActive: '–', upiTxnCount: 0, upiAmount: 0,
        priorityPassStatus: '–', msmegstStatus: '–', insuranceStatus: '–',
        rewardsPassProActiveDate: '–', latestOpinion: '–', merchantCategory: '–', visitCount: 0
      };
    });

    // Enrich from TideBT Form Responses — only latest per merchant
    const formDocs = await db.collection('TideBT Form Responses').find(
      { merchantNumber: { $in: merchantNums } },
      { projection: { merchantNumber: 1, createdAt: 1, onboardingStatus: 1, merchantOpinion: 1, merchantCategory: 1, _id: 0 } }
    ).sort({ createdAt: -1 }).toArray();

    formDocs.forEach(f => {
      const m = merchantMap[(f.merchantNumber||'').trim()];
      if (!m) return;
      const d = f.createdAt ? new Date(f.createdAt) : null;
      if (d && !isNaN(d)) {
        if (!m.submissionDate || d < new Date(m.submissionDate)) m.submissionDate = f.createdAt;
        if (!m.lastActivity  || d > new Date(m.lastActivity)) {
          m.lastActivity = f.createdAt;
          m.onboardingStatus = (f.onboardingStatus || f.merchantOpinion || '').trim() || 'Pending';
          m.merchantCategory = (f.merchantCategory || '').trim();
          m.latestOpinion    = (f.merchantOpinion  || '').trim();
        }
      }
      m.visitCount++;
    });

    // Enrich from BT_TL_CONNECT
    if (btCollectionName) {
      const parseNum = v => { const n = parseFloat(String(v||'0').replace(/,/g,'')); return isNaN(n)?0:n; };
      const getStr = (r, keys) => { for (const k of keys) { if (r[k]!==undefined&&r[k]!==null) return String(r[k]).trim(); } return '–'; };
      const btDocs = await db.collection(btCollectionName).find({ merchantNumber: { $in: merchantNums } }).toArray();
      btDocs.forEach(r => {
        const m = merchantMap[(r.merchantNumber||'').trim()];
        if (!m) return;
        m.stage3      = parseNum(r.stage3 || r.Stage_3 || r['Stage-3']);
        m.stage3Gap   = parseNum(r.stage3Gap || r['Stage-3_GAP']);
        m.passLive    = getStr(r, ['passLive','pass_live','Pass_Live']);
        m.rewardPassPro = getStr(r, ['rewardPassPro','reward_pass_pro','priorityPassPro']);
        m.upiActive   = getStr(r, ['upiActive','upi_active','UPI_Active']);
        m.upiTxnCount = parseNum(r.upiTxnCount || r.upi_txn_count || r.Upi_Txn_Count);
        m.upiAmount   = parseNum(r.withdrawAmount || r.UPI_Amount || r.upiAmount);
        m.priorityPassStatus = getStr(r, ['priorityPassStatus','Priority_Pass_Status']);
        m.msmegstStatus      = getStr(r, ['msmegstStatus','MSME/GST_Status','MSME_GST_Status']);
        m.insuranceStatus    = getStr(r, ['insuranceStatus','Insurance_Status']);
        m.rewardsPassProActiveDate = getStr(r, ['rewardsPassProActiveDate','Rewards_Pass_Pro_Active_Date','priority_pass_active_date']);
        const isLive   = m.passLive.toLowerCase() === 'live';
        const isActive = m.rewardPassPro.toLowerCase() === 'active';
        m.btVerified = isLive || isActive || m.stage3 > 0;
        if (isLive || isActive) m.onboardingStatus = 'Onboarded';
        else if (m.stage3 > 0)  m.onboardingStatus = 'BT Active';
      });
    }

    const merchants = Object.values(merchantMap).sort((a,b) => {
      if (a.lastActivity&&b.lastActivity) return new Date(b.lastActivity)-new Date(a.lastActivity);
      if (a.lastActivity) return -1; if (b.lastActivity) return 1;
      return (a.merchantName||'').localeCompare(b.merchantName||'');
    });

    const result = { success: true, merchants };
    await cacheSet(ck, result, 600); // cache 10 min
    res.json(result);
  } catch (err) {
    console.error('FSE merchants detail error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});
// GET /api/fse/:name - Get single FSE details
router.get('/:name', async (req, res) => {
  try {
    const db = req.db;
    const fseName = req.params.name;
    
    // Get FSE from access list
    const access = await db.collection('TideBT_Access').findOne({ 
      name: fseName, 
      role: 'FSE' 
    });
    
    if (!access) {
      return res.status(404).json({ success: false, error: 'FSE not found' });
    }
    
    // Get employee details
    const employee = await db.collection('Employees').findOne({ 
      newJoinerName: fseName 
    });
    
    // Get form count
    const formCount = await db.collection('TideBT Form Responses').countDocuments({ 
      employeeName: fseName 
    });
    
    const fseDetails = {
      name: access.name,
      phone: employee?.newJoinerPhone || '',
      email: employee?.newJoinerEmailId || '',
      reportingManager: employee?.reportingManager || '',
      status: access.status || 'active',
      createdAt: access.createdAt,
      totalForms: formCount
    };
    
    res.json({ success: true, fse: fseDetails });
  } catch (error) {
    console.error('Error fetching FSE details:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

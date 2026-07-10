const express = require('express');
const router = express.Router();

// GET /api/tl - Get all TLs with Tide BT access
router.get('/', async (req, res) => {
  try {
    const db = req.db; // Use ConnectionManager db from middleware
    
    console.log('🔍 Fetching TLs from TideBT_Access...');
    
    // Get all unique TLs from TideBT_Access collection (tlName field)
    const accessList = await db.collection('TideBT_Access').find({ 
      hasTideBTAccess: true 
    }).toArray();
    
    // Get unique TL names
    const uniqueTLs = [...new Set(accessList.map(a => a.tlName))].filter(Boolean);
    console.log(`✅ Found ${uniqueTLs.length} unique TLs in TideBT_Access:`, uniqueTLs);
    
    // Get TL details from Employees collection
    console.log('🔍 Looking for employees with names:', uniqueTLs);
    
    const employees = await db.collection('Employees').find({ 
      newJoinerName: { $in: uniqueTLs } 
    }).toArray();
    console.log(`✅ Found ${employees.length} matching employees`);
    
    // Build TL list with FSE counts
    const tlList = await Promise.all(uniqueTLs.map(async (tlName) => {
      const emp = employees.find(e => e.newJoinerName === tlName);
      console.log(`Matching ${tlName}:`, emp ? 'Found' : 'Not found');
      
      // Count FSEs under this TL from TideBT_Access
      const fseCount = accessList.filter(a => a.tlName === tlName).length;
      console.log(`FSE count for ${tlName}: ${fseCount}`);
      
      return {
        name: tlName,
        phone: emp?.newJoinerPhone || '',
        email: emp?.newJoinerEmailId || '',
        status: 'active',
        fseCount: fseCount,
        createdAt: null
      };
    }));
    
    res.json({ success: true, tls: tlList, total: tlList.length });
  } catch (error) {
    console.error('❌ Error fetching TLs:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/tl/:name - Get single TL details with FSEs
router.get('/:name', async (req, res) => {
  try {
    const db = req.db;
    const tlName = decodeURIComponent(req.params.name);
    
    // Get FSEs under this TL from TideBT_Access
    const accessList = await db.collection('TideBT_Access').find({ 
      tlName: tlName,
      hasTideBTAccess: true 
    }).toArray();
    
    const fseNames = [...new Set(accessList.map(a => a.fseName))].filter(Boolean);
    
    // Get employee details
    const employees = await db.collection('Employees').find({ 
      newJoinerName: { $in: fseNames } 
    }).toArray();
    
    // Get forms for all FSEs under this TL
    const forms = await db.collection('TideBT Form Responses')
      .find({
        $or: [
          { employeeName: { $in: fseNames } },
          { fse: { $in: fseNames } }
        ]
      })
      .sort({ createdAt: -1 })
      .toArray();
    
    // Build FSE list
    const fses = fseNames.map(fseName => {
      const emp = employees.find(e => e.newJoinerName === fseName);
      const fseFormCount = forms.filter(f => (f.employeeName || f.fse) === fseName).length;
      return {
        name: fseName,
        phone: emp?.newJoinerPhone || '',
        email: emp?.newJoinerEmailId || '',
        formCount: fseFormCount
      };
    });
    
    res.json({ 
      success: true, 
      tlName,
      fses,
      forms,
      totalFSEs: fses.length,
      totalForms: forms.length
    });
  } catch (error) {
    console.error('Error fetching TL details:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

const { cacheGet, cacheSet, cacheKey, cacheInvalidate } = require('../utils/cache');

// Helper: find BT_TL_CONNECT collection for month/year
async function findBTCollection(db, selectedMonth, selectedYear) {
  if (!selectedMonth) return null;
  const all = (await db.listCollections().toArray()).map(c => c.name);
  // Only use BT_TL_CONNECT* collections — never tl_connect_*
  const btCols  = all.filter(c => c.toUpperCase().startsWith('BT_TL_CONNECT'));
  const mu  = selectedMonth.toUpperCase();
  if (selectedYear) {
    const yr = String(selectedYear); const sy = yr.slice(-2);
    const m = btCols.find(c => { const cu = c.toUpperCase(); return cu.includes(mu) && (cu.includes(yr)||cu.includes(sy)); });
    if (m) return m;
  }
  return btCols.find(c => c.toUpperCase().includes(mu)) || null;
}

// Helper: enrich merchants with BT/RP data
async function enrichWithBT(db, merchantMap, btCollectionName) {
  if (!btCollectionName) return;
  const nums = Object.keys(merchantMap);
  if (nums.length === 0) return;
  const parseNum = v => { const n = parseFloat(String(v||'0').replace(/,/g,'')); return isNaN(n)?0:n; };
  const getStr  = (r,keys) => { for (const k of keys) { if (r[k]!==undefined&&r[k]!==null) return String(r[k]).trim(); } return '–'; };
  const btDocs = await db.collection(btCollectionName).find(
    { merchantNumber: { $in: nums } },
    { projection: { merchantNumber:1, stage3:1, stage3Gap:1, passLive:1, pass_live:1, Pass_Live:1, rewardPassPro:1, reward_pass_pro:1, priorityPassPro:1, upiTxnCount:1, upi_txn_count:1, _id:0 } }
  ).toArray();
  btDocs.forEach(r => {
    const m = merchantMap[(r.merchantNumber||'').trim()];
    if (!m) return;
    m.stage3      = parseNum(r.stage3 || r.Stage_3 || r['Stage-3']);
    m.stage3Gap   = parseNum(r.stage3Gap || r['Stage-3_GAP']);
    m.passLive    = getStr(r, ['passLive','pass_live','Pass_Live']);
    m.rewardPassPro = getStr(r, ['rewardPassPro','reward_pass_pro','priorityPassPro']);
    m.upiTxnCount = parseNum(r.upiTxnCount || r.upi_txn_count || r.Upi_Txn_Count);
    const isLive = m.passLive.toLowerCase()==='live';
    const isAct  = m.rewardPassPro.toLowerCase()==='active';
    m.btVerified = isLive || isAct || m.stage3 > 0;
    if (isLive || isAct) m.onboardingStatus = 'Onboarded';
    else if (m.stage3 > 0) m.onboardingStatus = 'BT Active';
  });
}

// GET /api/tl/:tlName/own-merchants — TL's personally assigned merchants
router.get('/:tlName/own-merchants', async (req, res) => {
  try {
    const db = req.db;
    const tlName = decodeURIComponent(req.params.tlName).trim();
    const { selectedMonth, selectedYear } = req.query;
    const escape = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const ck = cacheKey('TL_OWN_MERCHANTS', tlName, selectedMonth, selectedYear);
    const cached = await cacheGet(db, ck);
    if (cached) return res.json(cached);

    const btCollectionName = await findBTCollection(db, selectedMonth, selectedYear);

    const masterDocs = await db.collection('bt_master').find(
      { fseName: { $regex: new RegExp(`^\\s*${escape(tlName)}\\s*\\d*\\s*$`, 'i') } },
      { projection: { merchantNumber:1, merchantName:1, fseName:1, tl:1, _id:0 } }
    ).toArray();

    if (masterDocs.length === 0) {
      const r = { success: true, merchants: [] };
      await cacheSet(db, ck, r, 0); // permanent
      return res.json(r);
    }

    const merchantMap = {};
    masterDocs.forEach(m => {
      const key = (m.merchantNumber||'').trim();
      if (!key) return;
      merchantMap[key] = { merchantNumber: key, merchantName: (m.merchantName||'').trim()||'–',
        fseName: tlName, tl: (m.tl||'').trim(),
        onboardingStatus: 'Pending', lastActivity: null, stage3: 0, stage3Gap: 0,
        passLive: '–', rewardPassPro: '–', upiTxnCount: 0, btVerified: false, merchantCategory: '–' };
    });

    // Enrich from forms
    const nums = Object.keys(merchantMap);
    const formDocs = await db.collection('TideBT Form Responses').find(
      { merchantNumber: { $in: nums } },
      { projection: { merchantNumber:1, createdAt:1, onboardingStatus:1, merchantOpinion:1, merchantCategory:1, _id:0 } }
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

    await enrichWithBT(db, merchantMap, btCollectionName);

    const merchants = Object.values(merchantMap).sort((a,b) => (b.stage3||0)-(a.stage3||0));
    const result = { success: true, merchants };
    await cacheSet(db, ck, result, 0); // permanent — busted on sync/write
    res.json(result);
  } catch (err) {
    console.error('TL own-merchants error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/tl/:tlName/team-merchants — All merchants under TL's FSEs
router.get('/:tlName/team-merchants', async (req, res) => {
  try {
    const db = req.db;
    const tlName = decodeURIComponent(req.params.tlName).trim();
    const { selectedMonth, selectedYear } = req.query;
    const escape = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const ck = cacheKey('TL_TEAM_MERCHANTS', tlName, selectedMonth, selectedYear);
    const cached = await cacheGet(db, ck);
    if (cached) return res.json(cached);

    const btCollectionName = await findBTCollection(db, selectedMonth, selectedYear);

    // Get FSE names under this TL
    let accessRecs = await db.collection('TideBT_Access').find({
      tlName: { $regex: new RegExp(`^\\s*${escape(tlName)}\\s*$`, 'i') },
      hasTideBTAccess: true
    }, { projection: { fseName:1, _id:0 } }).toArray();
    if (accessRecs.length === 0) {
      const fw = tlName.split(' ')[0];
      accessRecs = await db.collection('TideBT_Access').find({
        tlName: { $regex: new RegExp(`^\\s*${escape(fw)}\\s*$`, 'i') },
        hasTideBTAccess: true
      }, { projection: { fseName:1, _id:0 } }).toArray();
    }
    const fseNames = [...new Set(accessRecs.map(r => r.fseName).filter(Boolean))];

    if (fseNames.length === 0) {
      const r = { success: true, merchants: [] };
      await cacheSet(db, ck, r, 0); // permanent
      return res.json(r);
    }

    const masterDocs = await db.collection('bt_master').find(
      { $or: fseNames.map(n => ({ fseName: { $regex: new RegExp(`^\\s*${escape(n)}\\s*\\d*\\s*$`, 'i') } })) },
      { projection: { merchantNumber:1, merchantName:1, fseName:1, tl:1, _id:0 } }
    ).toArray();

    const merchantMap = {};
    masterDocs.forEach(m => {
      const key = (m.merchantNumber||'').trim();
      if (!key) return;
      const matchedFSE = fseNames.find(n => new RegExp(`^\\s*${escape(n)}\\s*\\d*\\s*$`, 'i').test(m.fseName||''));
      merchantMap[key] = { merchantNumber: key, merchantName: (m.merchantName||'').trim()||'–',
        fseName: matchedFSE || (m.fseName||'').trim(), tl: tlName,
        onboardingStatus: 'Pending', lastActivity: null, stage3: 0, stage3Gap: 0,
        passLive: '–', rewardPassPro: '–', upiTxnCount: 0, btVerified: false, merchantCategory: '–' };
    });

    const nums = Object.keys(merchantMap);
    if (nums.length > 0) {
      const formDocs = await db.collection('TideBT Form Responses').find(
        { merchantNumber: { $in: nums } },
        { projection: { merchantNumber:1, createdAt:1, onboardingStatus:1, merchantOpinion:1, merchantCategory:1, _id:0 } }
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
      await enrichWithBT(db, merchantMap, btCollectionName);
    }

    const merchants = Object.values(merchantMap).sort((a,b) => (b.stage3||0)-(a.stage3||0));
    const result = { success: true, merchants };
    await cacheSet(db, ck, result, 0); // permanent — busted on sync/write
    res.json(result);
  } catch (err) {
    console.error('TL team-merchants error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/tl/cache/bust — manually clear all TL/FSE overview caches
// Call this after running any sync script that updates bt_master or BT_TL_CONNECT
router.post('/cache/bust', async (req, res) => {
  try {
    const db = req.db;
    await cacheInvalidate(db, '*');
    res.json({ success: true, message: 'All overview caches cleared' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

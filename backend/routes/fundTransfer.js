const express = require('express');
const router = express.Router();

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'];

// ── Permanent Cache (invalidate-on-write) ──────────────────────────────────
// Cache lives forever. Cleared only when a payment is added/updated/deleted.
// Past months (e.g. June when current month is July) are cached once and never expire.
// Current month cache is cleared every time a new payment is posted.
const CACHE_COLLECTION = 'TideBT_SummaryCache';

const getCacheKey = (query) => {
  const { selectedYear, selectedMonth, dateFilter, fromDate, toDate } = query;
  return `usage:${selectedMonth || 'all'}:${selectedYear || 'all'}:${dateFilter || 'all'}:${fromDate || ''}:${toDate || ''}`;
};

const readCache = async (db, cacheKey) => {
  try {
    const doc = await db.collection(CACHE_COLLECTION).findOne({ cacheKey });
    return doc ? doc.data : null;
  } catch (e) {
    console.warn('⚠️ Cache read failed (non-fatal):', e.message);
    return null;
  }
};

const writeCache = async (db, cacheKey, data) => {
  try {
    await db.collection(CACHE_COLLECTION).updateOne(
      { cacheKey },
      { $set: { cacheKey, data, updatedAt: new Date() } },
      { upsert: true }
    );
    console.log('💾 Cache written:', cacheKey);
  } catch (e) {
    console.warn('⚠️ Cache write failed (non-fatal):', e.message);
  }
};

const bustCache = async (db) => {
  try {
    const result = await db.collection(CACHE_COLLECTION).deleteMany({});
    console.log(`🗑️ Cache busted — ${result.deletedCount} entries cleared`);
  } catch (e) {
    console.warn('⚠️ Cache bust failed (non-fatal):', e.message);
  }
};
// ──────────────────────────────────────────────────────────────────────────

const MONTH_ABBR = {
  'JANUARY': 'JAN', 'FEBRUARY': 'FEB', 'MARCH': 'MAR', 'APRIL': 'APR',
  'MAY': 'MAY', 'JUNE': 'JUN', 'JULY': 'JUL', 'AUGUST': 'AUG',
  'SEPTEMBER': 'SEP', 'OCTOBER': 'OCT', 'NOVEMBER': 'NOV', 'DECEMBER': 'DEC'
};

// Helper: find BT_TL_CONNECT collection for a given month+year
const findBTCollection = (allCollections, monthName, yearStr) => {
  const mu    = monthName.toUpperCase();
  const abbr  = MONTH_ABBR[mu] || mu;
  const sy    = yearStr ? yearStr.slice(-2) : null;
  // Only use BT_TL_CONNECT* collections — never tl_connect_*
  const btCols = allCollections.filter(c => c.toUpperCase().startsWith('BT_TL_CONNECT'));
  const matchesMonth = cu => cu.includes(mu) || cu.includes(abbr);
  if (yearStr) {
    const m = btCols.find(c => { const cu = c.toUpperCase(); return matchesMonth(cu) && (cu.includes(yearStr) || (sy && cu.includes(sy))); });
    if (m) return m;
  }
  return btCols.find(c => matchesMonth(c.toUpperCase())) || null;
};

// Helper: compute cumulative carry-forward per person for all months before curMonth
// OPTIMISED: loads each unique BT collection ONCE (not once per month) then slices in memory
// Returns a map: { personName (lowercase) → carryForward amount }
const computeCarryForward = async (db, allCollections, allPayments, numToFSE, isTLMap, curMonth, curYear) => {
  const curMonthIdx = MONTHS.indexOf(curMonth);
  if (curMonthIdx <= 0) return {}; // January — no prior months

  const pastMonths = MONTHS.slice(0, curMonthIdx); // e.g. for June → [Jan,Feb,Mar,Apr,May]
  const allNums    = Object.keys(numToFSE);

  // ── Step 1: Find unique BT collections for all past months ───────────────
  // Multiple months can share the same collection — deduplicate to avoid repeat queries
  const colForMonth = {}; // monthName → collectionName | null
  const uniqueCols  = new Set();
  pastMonths.forEach(m => {
    const col = findBTCollection(allCollections, m, String(curYear));
    colForMonth[m] = col;
    if (col) uniqueCols.add(col);
  });

  // ── Step 2: Load each unique collection ONCE in parallel ─────────────────
  const colDataMap = {}; // collectionName → { [merchantNumber]: { stage3, rp } }
  if (allNums.length > 0) {
    await Promise.all([...uniqueCols].map(async col => {
      const docs = await db.collection(col).find(
        { merchantNumber: { $in: allNums } },
        { projection: { merchantNumber: 1, stage3: 1, rewardPassPro: 1, priorityPassPro: 1 } }
      ).toArray();
      const lookup = {};
      docs.forEach(r => {
        const num = (r.merchantNumber || '').trim();
        if (!num) return;
        const s3 = parseFloat(String(r.stage3 || '0').replace(/,/g, '')) || 0;
        const rp = (r.rewardPassPro || r.priorityPassPro || '').toLowerCase() === 'active';
        lookup[num] = { stage3: s3, rp };
      });
      colDataMap[col] = lookup;
    }));
  }

  // ── Step 3: Pre-slice payments by month in memory (single pass) ───────────
  // monthPayments[monthName] = { received: {nameLower→amt}, sent: {nameLower→amt} }
  const monthPayments = {};
  pastMonths.forEach(m => { monthPayments[m] = { received: {}, sent: {} }; });

  allPayments.forEach(p => {
    if (!p.createdAt) return;
    const d = new Date(p.createdAt);
    if (d.getFullYear() !== curYear) return;
    const monthName = MONTHS[d.getMonth()];
    if (!monthPayments[monthName]) return;

    const receiver = (p.transferTo     || '').trim().toLowerCase();
    const sender   = (p.senderName     || '').trim().toLowerCase();
    const whom     = (p.transferToWhom || '').trim();
    const amount   = p.amount || 0;

    // Received: negative amounts (returns) always count regardless of whom type —
    // admins often enter wrong transferToWhom when recording a fund return.
    // Positive amounts: match role to whom type as usual.
    if (receiver) {
      const isTLReceiver = isTLMap[receiver] === true;
      if (amount < 0) {
        // Always count returns — wrong whom type is common
        monthPayments[monthName].received[receiver] = (monthPayments[monthName].received[receiver] || 0) + amount;
      } else if ((isTLReceiver && whom === "TL's & Managers") ||
                 (!isTLReceiver && whom === "FSE Ground Team") ||
                 !whom) {
        monthPayments[monthName].received[receiver] = (monthPayments[monthName].received[receiver] || 0) + amount;
      }
    }

    // Sent: TL outgoing to others — count ALL outgoing (positive + negative recoveries)
    // NOT just "FSE Ground Team" type — TLs also distribute to sub-TLs with "TL's & Managers" type
    // Skip: VV/Admin sender, self-transfers
    // The isTLMap check ensures only TL senders are tracked here
    if (sender && sender !== 'admin' && sender !== 'accountant' && sender !== 'vv' &&
        receiver && receiver !== sender &&
        isTLMap[sender] === true) {
      // Count all outgoing by TL senders (includes FSE distribution + sub-TL distribution)
      monthPayments[monthName].sent[sender] = (monthPayments[monthName].sent[sender] || 0) + amount;
    }
  });

  // ── Step 4: Aggregate BT/RP per FSE per month from preloaded collection data ──
  const carryMap = {};

  pastMonths.forEach(monthName => {
    const col     = colForMonth[monthName];
    const lookup  = col ? (colDataMap[col] || {}) : {};

    // Build BT/RP per fseName for this month
    const monthBTMap = {}, monthRPMap = {};
    allNums.forEach(num => {
      const entry   = lookup[num];
      if (!entry) return;
      const fseName = (numToFSE[num] || '').toLowerCase();
      if (!fseName) return;
      monthBTMap[fseName] = (monthBTMap[fseName] || 0) + entry.stage3;
      if (entry.rp) monthRPMap[fseName] = (monthRPMap[fseName] || 0) + 1;
    });

    const { received: monthReceivedMap, sent: monthSentMap } = monthPayments[monthName];
    const allNames = new Set([...Object.keys(monthReceivedMap), ...Object.keys(monthSentMap), ...Object.keys(monthBTMap)]);

    allNames.forEach(nameLower => {
      const received   = monthReceivedMap[nameLower] || 0;
      const usedBT     = monthBTMap[nameLower] || 0;
      const rpCount    = monthRPMap[nameLower] || 0;
      const usedRP     = rpCount * 2500;
      const fee        = Math.round((usedBT > 10000 ? usedBT * 0.015 : 0) * 100) / 100;
      const isTL       = isTLMap[nameLower] === true;
      const sentToFSEs = isTL ? (monthSentMap[nameLower] || 0) : 0;

      // Net = received - sent to FSEs - BT/RP costs
      // For TL: net = received - distributed_to_FSEs - personal_BT_costs
      // Running balance accumulates across months (can go negative then recover)
      const netThisMonth = received - sentToFSEs - usedRP - fee;
      const prevBalance  = carryMap[nameLower] || 0;
      const newBalance   = prevBalance + netThisMonth;

      // Only carry positive balance — negative means TL is in "debt" which clears when they receive more
      carryMap[nameLower] = Math.max(0, newBalance);
    });
  });

  return carryMap;
};

// GET /api/fund-transfer - Get all fund transfers
router.get('/', async (req, res) => {
  try {
    const db = req.db;
    const transfers = await db.collection('TideBT_Payments')
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    res.json({ success: true, transfers });
  } catch (error) {
    console.error('Error fetching fund transfers:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/fund-transfer/usage-summary - Get fund usage for each person who received fund
router.get('/usage-summary', async (req, res) => {
  try {
    const db = req.db;
    const { selectedYear, selectedMonth, dateFilter, fromDate, toDate } = req.query;

    // ── Cache check — return instantly if already computed ─────────────────
    const cacheKey = getCacheKey(req.query);
    const cached = await readCache(db, cacheKey);
    if (cached) {
      console.log('⚡ Cache HIT:', cacheKey);
      return res.json({ ...cached, fromCache: true });
    }
    console.log('🔄 Cache MISS — computing:', cacheKey);
    // ──────────────────────────────────────────────────────────────────────

    const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
                    'July', 'August', 'September', 'October', 'November', 'December'];
    const now = new Date();

    // ── Reporting period label ─────────────────────────────────────────────
    let reportingPeriod;
    if (dateFilter === 'today') {
      reportingPeriod = now.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
    } else if (dateFilter === 'month') {
      reportingPeriod = `${MONTHS[now.getMonth()]} ${now.getFullYear()} (Current Month)`;
    } else if (dateFilter === 'custom' && fromDate && toDate) {
      reportingPeriod = `${new Date(fromDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} – ${new Date(toDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    } else if (selectedMonth && selectedYear) {
      reportingPeriod = `${selectedMonth} ${selectedYear}`;
    } else if (selectedMonth) {
      reportingPeriod = `${selectedMonth} (All Years)`;
    } else if (selectedYear) {
      reportingPeriod = `Full Year ${selectedYear}`;
    } else {
      reportingPeriod = 'All Time';
    }

    // ── Date filter helper ─────────────────────────────────────────────────
    const isFilterActive = !!(dateFilter && dateFilter !== 'all') || !!selectedYear || !!selectedMonth;

    const filterByDate = (items, dateField = 'createdAt') => {
      if (!isFilterActive) return items;
      const today      = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      return items.filter(item => {
        if (!item[dateField]) return false;
        const d = new Date(item[dateField]);
        if (isNaN(d.getTime())) return false;
        if (dateFilter === 'today')  return d >= today && d < new Date(today.getTime() + 86400000);
        if (dateFilter === 'month')  return d >= monthStart && d <= monthEnd;
        if (dateFilter === 'custom') {
          if (fromDate) {
            const from = new Date(fromDate);
            if (!isNaN(from.getTime()) && d < from) return false;
          }
          if (toDate) {
            const to = new Date(toDate + 'T23:59:59');
            if (!isNaN(to.getTime()) && d > to) return false;
          }
          return true;
        }
        if (selectedYear  && d.getFullYear() !== parseInt(selectedYear)) return false;
        if (selectedMonth && MONTHS[d.getMonth()] !== selectedMonth) return false;
        return true;
      });
    };

    // ── Load raw data ──────────────────────────────────────────────────────
    const allPayments      = await db.collection('TideBT_Payments').find({}).toArray();
    const filteredPayments = filterByDate(allPayments, 'createdAt');

    const accessList = await db.collection('TideBT_Access').find({ hasTideBTAccess: true }).toArray();

    // ── Role classification — source of truth: transferToWhom field in payments ──
    //
    // transferToWhom = "TL's & Managers" → receiver is a TL
    // transferToWhom = "FSE Ground Team" → receiver is an FSE
    //
    // If a name received BOTH types (edge case like Niteesh Kumar Saroj who is an FSE
    // but also got TL-type payments by mistake) — FSE Ground Team wins.
    //
    // TideBT_Access.fseName is used as tiebreaker: if name is in fseName → always FSE.

    const fseNameSet = new Set(accessList.map(a => (a.fseName || '').trim()).filter(Boolean));
    const tlNameSet  = new Set(accessList.map(a => (a.tlName  || '').trim()).filter(Boolean));

    const nameRoleMap = {};

    // Step 1: Classify from filteredPayments using transferToWhom
    // Use TideBT_Access as PRIMARY source — transferToWhom in payments is unreliable
    // (admins sometimes enter wrong type, self-transfers create false FSE classification)
    // transferToWhom is only used for names NOT in TideBT_Access at all
    filteredPayments.forEach(p => {
      const n     = (p.transferTo    || '').trim();
      const whom  = (p.transferToWhom || '').trim();
      if (!n || !whom) return;

      // Skip if already classified by TideBT_Access (will be set in Step 2)
      if (fseNameSet.has(n) || tlNameSet.has(n)) return;

      // For unknown names — use transferToWhom
      if (whom === "FSE Ground Team") {
        if (nameRoleMap[n] !== "TL's & Managers") nameRoleMap[n] = "FSE Ground Team";
      } else if (whom === "TL's & Managers") {
        nameRoleMap[n] = "TL's & Managers";
      }
    });

    // Step 2: TideBT_Access is authoritative — always overrides payment-based classification
    // fseName → FSE Ground Team (unconditional)
    // tlName → TL's & Managers (only if NOT also an fseName)
    for (const name of fseNameSet) {
      nameRoleMap[name] = "FSE Ground Team";
    }
    for (const name of tlNameSet) {
      if (!fseNameSet.has(name)) {
        nameRoleMap[name] = "TL's & Managers";
      }
    }

    // Step 2b: Behavioral TL detection — anyone who sends fund to others (not VV/Admin) is a TL/distributor
    // This catches cases like Niteesh Kumar Saroj who appears as fseName in TideBT_Access
    // but also distributes fund to FSEs acting as a TL.
    // Rule: if a person sends fund AND receives "TL's & Managers" type payments → they are a TL
    const ADMIN_SENDERS = new Set(['admin', 'accountant', 'vv']);
    const tlReceivers = new Set(
      allPayments
        .filter(p => (p.transferToWhom || '').trim() === "TL's & Managers")
        .map(p => (p.transferTo || '').trim())
        .filter(Boolean)
    );
    const distributors = new Set(
      allPayments
        .filter(p => {
          const sender   = (p.senderName || '').trim();
          const receiver = (p.transferTo || '').trim();
          return sender && receiver && sender !== receiver && !ADMIN_SENDERS.has(sender.toLowerCase());
        })
        .map(p => (p.senderName || '').trim())
    );
    // Anyone who both receives TL-type payments AND distributes → classify as TL
    for (const name of distributors) {
      if (tlReceivers.has(name) && nameRoleMap[name] !== "TL's & Managers") {
        nameRoleMap[name] = "TL's & Managers";
      }
    }

    // Step 3: Remove names with no activity in selected period
    if (isFilterActive) {
      const filteredReceiverNames = new Set(filteredPayments.map(p => (p.transferTo || '').trim()).filter(Boolean));
      const filteredSenderNames   = new Set(filteredPayments.map(p => (p.senderName || '').trim()).filter(Boolean));
      Object.keys(nameRoleMap).forEach(name => {
        // Keep if received OR sent payments in period
        if (!filteredReceiverNames.has(name) && !filteredSenderNames.has(name)) {
          delete nameRoleMap[name];
        }
      });
    }

    const names = Object.keys(nameRoleMap);
    if (names.length === 0) return res.json({ success: true, summary: [], reportingPeriod });

    // ── Load BT data from BT_TL_CONNECT {MONTH} ───────────────────────────
    // Pick collection based on selectedMonth filter — if no month selected, no BT data
    const allCollections = (await db.listCollections().toArray()).map(c => c.name);

    // Use findBTCollection helper which also matches abbreviations (JAN, FEB etc)
    const btCollectionName = selectedMonth
      ? findBTCollection(allCollections, selectedMonth, selectedYear || String(new Date().getFullYear()))
      : null;
    // If no month selected — don't fall back to latest, show ₹0

    const btAmountMap   = {}; // fseName → total stage3 BT done
    const rpCountMap    = {}; // fseName → count of merchants with rewardPassPro=Active
    const withdrawMap   = {}; // fseName → total withdraw amount from TideBT Form Responses

    // Build numToFSE ALWAYS (needed for carry-forward even when no current month collection)
    const masterDocsAll = await db.collection('bt_master').find(
      {}, { projection: { merchantNumber: 1, fseName: 1, _id: 0 } }
    ).toArray();
    const numToFSE = {};
    masterDocsAll.forEach(m => {
      const num = (m.merchantNumber || '').trim();
      const fse = (m.fseName || '').trim();
      if (num && fse) numToFSE[num] = fse;
    });
    const merchantDocsAll = await db.collection('TideBT_Merchants').find(
      {}, { projection: { merchantNumber: 1, employeeName: 1, _id: 0 } }
    ).toArray();
    merchantDocsAll.forEach(m => {
      const num = (m.merchantNumber || '').trim();
      const fse = (m.employeeName  || '').trim();
      if (num && fse && !numToFSE[num]) numToFSE[num] = fse;
    });

    if (btCollectionName) {
      const allMerchantNums = Object.keys(numToFSE);

      // Get BT data from BT_TL_CONNECT — only for known merchant numbers
      const btDocs = allMerchantNums.length > 0
        ? await db.collection(btCollectionName).find(
            { merchantNumber: { $in: allMerchantNums } },
            { projection: { merchantNumber: 1, stage3: 1, rewardPassPro: 1, priorityPassPro: 1, _id: 0 } }
          ).toArray()
        : [];

      btDocs.forEach(r => {
        const num     = (r.merchantNumber || '').trim();
        const fseName = numToFSE[num];
        if (!fseName) return;
        const stage3Raw = r.stage3 || r.Stage_3 || r['Stage-3'] || '0';
        const stage3 = parseFloat(String(stage3Raw).replace(/,/g, '')) || 0;
        const rpPro  = (r.rewardPassPro || r.Reward_Pass_Pro || r.priorityPassPro || '').toLowerCase() === 'active';
        // Store with lowercase key for case-insensitive lookup
        const key = fseName.toLowerCase();
        btAmountMap[key] = (btAmountMap[key] || 0) + stage3;
        if (rpPro) rpCountMap[key] = (rpCountMap[key] || 0) + 1;
      });
    }

    // ── Load withdraw data from TideBT_Mobikwik, filtered by date ───
    let withdrawData = await db.collection('TideBT_Mobikwik')
      .find({ formType: 'mobikwik-withdraw' })
      .toArray();
    withdrawData = filterByDate(withdrawData, 'createdAt');
    withdrawData.forEach(f => {
      const fseName = (f.employeeName || '').trim().toLowerCase(); // lowercase key
      if (!fseName) return;
      withdrawMap[fseName] = (withdrawMap[fseName] || 0) + (f.withdrawAmount || 0);
    });

    // ── Build received map and sent map — both from filteredPayments (month-scoped) ──
    // receivedMap: net received per person in the filtered period
    // For TLs: count TL's & Managers type payments (positive and negative/reversals)
    // For FSEs: count FSE Ground Team type payments
    //
    // IMPORTANT: For NEGATIVE amounts (fund returns), always count them regardless of
    // transferToWhom — admins often enter wrong type when recording a fund return.
    // e.g. Niteesh returning ₹50k might have transferToWhom: "FSE Ground Team" by mistake.
    const receivedMap = {};
    filteredPayments.forEach(p => {
      const n      = (p.transferTo    || '').trim();
      const whom   = (p.transferToWhom || '').trim();
      const amount = p.amount || 0;
      if (!n || !whom) return;
      const role = nameRoleMap[n];
      if (!role) return;

      if (amount < 0) {
        // Negative = fund return — always count for the person regardless of whom type
        // (wrong whom type is common when recording returns)
        receivedMap[n] = (receivedMap[n] || 0) + amount;
      } else {
        // Positive = normal payment — match role to whom type
        if ((role === "TL's & Managers" && whom === "TL's & Managers") ||
            (role === "FSE Ground Team"  && whom === "FSE Ground Team")) {
          receivedMap[n] = (receivedMap[n] || 0) + amount;
        }
      }
    });

    // sentMap: payments sent OUT by each TL — month-scoped
    // Count ALL TL outgoing (to FSEs + to sub-TLs), not just "FSE Ground Team" type
    // This fixes TLs like Ravi Kumar who distribute via "TL's & Managers" type entries too
    const sentMap = {};
    filteredPayments.forEach(p => {
      const sender   = (p.senderName  || '').trim();
      const receiver = (p.transferTo  || '').trim();
      const amount   = p.amount || 0;
      if (!sender || !receiver) return;
      // Skip VV/Admin originating payments
      if (['Admin', 'Accountant', 'VV', 'admin', 'accountant', 'vv'].includes(sender)) return;
      // Skip self-transfers
      if (receiver.toLowerCase() === sender.toLowerCase()) return;
      // Only TL senders (authoritative from nameRoleMap)
      if (nameRoleMap[sender] !== "TL's & Managers") return;
      // Count all outgoing (positive = distributed, negative = recovered back)
      sentMap[sender] = (sentMap[sender] || 0) + amount;
    });

    // Also build a carryForward-aware net balance per TL using ALL payments (not just filtered)
    // This ensures carryForward reflects the real cumulative balance across all months

    // ── Compute cumulative carry-forward for months before selectedMonth ───
    // isTLMap: anyone who has distributed fund to others (senderName in payments, excluding VV/Admin).
    // This catches TLs not in TideBT_Access.tlName (like Niteesh Kumar Saroj who appears only as fseName).
    const SKIP_SENDERS = new Set(['admin', 'accountant', 'vv']);
    const isTLMap = {};

    // Add from TideBT_Access tlNameSet
    for (const name of tlNameSet) {
      isTLMap[name.toLowerCase()] = true;
    }
    // Add from payment behavior — anyone who sent fund to someone else is acting as a TL/distributor
    allPayments.forEach(p => {
      const sender   = (p.senderName || '').trim().toLowerCase();
      const receiver = (p.transferTo || '').trim().toLowerCase();
      if (!sender || !receiver || sender === receiver) return;
      if (SKIP_SENDERS.has(sender)) return;
      isTLMap[sender] = true;
    });
    // Also add from current nameRoleMap
    names.forEach(n => {
      if (nameRoleMap[n] === "TL's & Managers") isTLMap[n.toLowerCase()] = true;
    });

    // Active members for carry-forward filtering — includes anyone in TideBT_Access (fseName OR tlName)
    // PLUS anyone who is currently distributing payments (behavioral TLs like Niteesh)
    const activeNames = new Set([
      ...[...fseNameSet].map(n => n.toLowerCase()),
      ...[...tlNameSet].map(n => n.toLowerCase())
    ]);
    // Also add behavioral TLs who are in current period's payments
    allPayments.forEach(p => {
      const sender = (p.senderName || '').trim().toLowerCase();
      if (!sender || SKIP_SENDERS.has(sender)) return;
      if (fseNameSet.has(sender) || tlNameSet.has(sender)) return; // already in set
      // Check if they appear as receiver too — only keep as active if they receive from Admin/VV
      const receivesFromAdmin = allPayments.some(q =>
        (q.transferTo || '').trim().toLowerCase() === sender &&
        SKIP_SENDERS.has((q.senderName || '').trim().toLowerCase())
      );
      if (receivesFromAdmin) activeNames.add(sender);
    });

    let carryMap = {};
    if (selectedMonth && selectedYear) {
      carryMap = await computeCarryForward(
        db, allCollections, allPayments, numToFSE, isTLMap,
        selectedMonth, parseInt(selectedYear)
      );
      // Only keep carry-forward for active members
      Object.keys(carryMap).forEach(k => {
        if (!activeNames.has(k)) delete carryMap[k];
      });
    }

    // ── Calculate usage per person ─────────────────────────────────────────
    const summary = names.map(name => {
      const isTL      = nameRoleMap[name] === "TL's & Managers";
      const nameLower = name.toLowerCase().trim();

      // BT amount and RP count from BT_TL_CONNECT via bt_master (case-insensitive lookup)
      const usedBT  = btAmountMap[nameLower] || 0;
      const rpCount = rpCountMap[nameLower]  || 0;
      const usedRP  = rpCount * 2500;
      const btFee   = Math.round((usedBT > 10000 ? usedBT * 0.015 : 0) * 100) / 100;

      // Mobikwik withdrawals — case-insensitive lookup
      const withdrawAmount = withdrawMap[nameLower] || 0;
      const withdrawFee    = Math.round(withdrawAmount * 0.03 * 100) / 100;

      const received    = receivedMap[name] || 0;
      const sentToFSEs  = isTL ? (sentMap[name] || 0) : 0;
      const carryFwd    = carryMap[nameLower] || 0;

      const totalUsed = usedRP + btFee + withdrawFee;
      const effectiveReceived = isTL ? Math.max(0, received - sentToFSEs) : received;
      const totalAvailable = effectiveReceived + carryFwd;
      const fundLeft  = totalAvailable - totalUsed;

      return {
        name,
        type: nameRoleMap[name],
        received,
        carryForward: carryFwd,
        totalAvailable,
        sentToFSEs,
        usedBT,
        usedRP,
        rpCount,
        btFee,
        withdrawAmount,
        withdrawFee,
        totalUsed,
        fundLeft
      };
    });

    // When a filter is active, hide rows with zero activity
    // Include if: received anything, OR sent anything, OR has carry-forward, OR has BT/RP
    const activeSummary = isFilterActive
      ? summary.filter(item =>
          item.received !== 0 ||
          item.sentToFSEs > 0 ||
          item.carryForward > 0 ||
          item.usedBT > 0 ||
          item.rpCount > 0 ||
          item.withdrawAmount > 0
        )
      : summary;

    // ── Save to cache before responding ───────────────────────────────────
    const result = { success: true, summary: activeSummary, reportingPeriod };
    await writeCache(db, cacheKey, result);

    res.json(result);
  } catch (error) {
    console.error('Error fetching usage summary:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/fund-transfer - Record a new fund transfer
router.post('/', async (req, res) => {
  try {
    const db = req.db;
    console.log('📝 Fund transfer POST received:', req.body);
    const { transferToWhom, senderName, transferTo, amount, paymentDoneOn } = req.body;

    if (!transferToWhom || !senderName || !transferTo || !amount || !paymentDoneOn) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    const payment = {
      transferToWhom,
      senderName,
      transferTo,
      amount: parseFloat(amount),
      paymentDoneOn,
      source: 'admin-panel',
      createdAt: new Date()
    };

    const result = await db.collection('TideBT_Payments').insertOne(payment);
    console.log('✅ Payment saved:', result.insertedId);

    // ── New payment → all cached summaries are stale, clear them ──────────
    await bustCache(db);

    res.json({ success: true, message: 'Payment recorded successfully', payment });
  } catch (error) {
    console.error('❌ Error recording fund transfer:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

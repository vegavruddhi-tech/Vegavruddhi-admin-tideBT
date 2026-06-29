const express = require('express');
const router = express.Router();

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'];

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
  const btCols = allCollections.filter(c => c.toUpperCase().startsWith('BT_TL_CONNECT'));
  const tlCols = allCollections.filter(c => c.toUpperCase().includes('TL_CONNECT') && !c.toUpperCase().startsWith('BT_TL_CONNECT'));
  const candidates = [...btCols, ...tlCols];
  const matchesMonth = cu => cu.includes(mu) || cu.includes(abbr);
  if (yearStr) {
    const m = candidates.find(c => { const cu = c.toUpperCase(); return matchesMonth(cu) && (cu.includes(yearStr) || (sy && cu.includes(sy))); });
    if (m) return m;
  }
  return candidates.find(c => matchesMonth(c.toUpperCase())) || null;
};

// Helper: compute cumulative carry-forward per person for all months before curMonth
// Returns a map: { personName (lowercase) → carryForward amount }
const computeCarryForward = async (db, allCollections, allPayments, numToFSE, isTLMap, curMonth, curYear) => {
  const curMonthIdx = MONTHS.indexOf(curMonth);
  if (curMonthIdx <= 0) return {}; // January or no month — no carry

  const carryMap = {}; // name.toLowerCase() → total carry

  for (let i = 0; i < curMonthIdx; i++) {
    const monthName = MONTHS[i];
    const colName   = findBTCollection(allCollections, monthName, String(curYear));

    // Payments received this month per person
    const monthReceivedMap = {};
    allPayments.forEach(p => {
      if (!p.createdAt) return;
      const d = new Date(p.createdAt);
      if (d.getFullYear() !== curYear || MONTHS[d.getMonth()] !== monthName) return;
      const n = (p.transferTo || '').trim().toLowerCase();
      if (n) monthReceivedMap[n] = (monthReceivedMap[n] || 0) + (p.amount || 0);
    });

    // Sent by TLs this month
    const monthSentMap = {};
    allPayments.forEach(p => {
      if (!p.createdAt) return;
      const d = new Date(p.createdAt);
      if (d.getFullYear() !== curYear || MONTHS[d.getMonth()] !== monthName) return;
      const sender = (p.senderName || '').trim().toLowerCase();
      if (sender && sender !== 'admin' && sender !== 'accountant') {
        monthSentMap[sender] = (monthSentMap[sender] || 0) + (p.amount || 0);
      }
    });

    // BT/RP per FSE from this month's collection (via bt_master merchant → FSE mapping)
    const monthBTMap = {}, monthRPMap = {};
    if (colName && Object.keys(numToFSE).length > 0) {
      const allNums = Object.keys(numToFSE);
      const btDocs = await db.collection(colName).find(
        { merchantNumber: { $in: allNums } },
        { projection: { merchantNumber: 1, stage3: 1, rewardPassPro: 1, priorityPassPro: 1, lead: 1 } }
      ).toArray();

      btDocs.forEach(r => {
        const num = (r.merchantNumber || '').trim();
        let fseName = (numToFSE[num] || '').toLowerCase();
        if (!fseName && r.lead) fseName = r.lead.toLowerCase().trim();
        if (!fseName) return;
        const s3 = parseFloat(String(r.stage3 || '0').replace(/,/g, '')) || 0;
        monthBTMap[fseName] = (monthBTMap[fseName] || 0) + s3;
        const rp = (r.rewardPassPro || r.priorityPassPro || '').toLowerCase();
        if (rp === 'active') monthRPMap[fseName] = (monthRPMap[fseName] || 0) + 1;
      });
    }

    // Compute fundLeft for each person this month and accumulate carry
    const allNames = new Set([
      ...Object.keys(monthReceivedMap),
      ...Object.keys(monthBTMap)
    ]);
    allNames.forEach(nameLower => {
      const received    = monthReceivedMap[nameLower] || 0;
      if (received === 0) return; // no fund received → no carry
      const usedBT      = monthBTMap[nameLower]  || 0;
      const rpCount     = monthRPMap[nameLower]   || 0;
      const usedRP      = rpCount * 2500;
      const fee         = Math.round((usedBT > 10000 ? usedBT * 0.015 : 0) * 100) / 100;
      const isTL        = isTLMap[nameLower] === true;
      const sentToFSEs  = isTL ? (monthSentMap[nameLower] || 0) : 0;
      const effectiveReceived = isTL ? Math.max(0, received - sentToFSEs) : received;
      const monthLeft   = effectiveReceived - (usedRP + fee);
      if (monthLeft > 0) {
        carryMap[nameLower] = (carryMap[nameLower] || 0) + monthLeft;
      }
    });
  }

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

    // ── Role classification — source of truth: TideBT_Access only ────────────
    //
    // TideBT_Access.tlName  → "TL's & Managers"
    // TideBT_Access.fseName → "FSE Ground Team"
    //
    // If a name appears in BOTH columns (edge case), fseName wins → FSE Ground Team
    // TL rows are only added if that tlName actually received a payment

    const fseNameSet = new Set(accessList.map(a => (a.fseName || '').trim()).filter(Boolean));
    const tlNameSet  = new Set(accessList.map(a => (a.tlName  || '').trim()).filter(Boolean));

    const nameRoleMap = {};

    // All fseNames → FSE Ground Team (unconditional)
    for (const name of fseNameSet) {
      nameRoleMap[name] = "FSE Ground Team";
    }

    // tlNames → TL's & Managers
    // BUT only if the tlName is NOT also an fseName (fseName always wins)
    for (const name of tlNameSet) {
      if (!fseNameSet.has(name)) {
        nameRoleMap[name] = "TL's & Managers";
      }
    }

    // Anyone who received a payment but isn't in TideBT_Access at all
    allPayments.forEach(p => {
      const n = (p.transferTo || '').trim();
      if (!n || nameRoleMap[n]) return;
      nameRoleMap[n] = tlNameSet.has(n) ? "TL's & Managers" : "FSE Ground Team";
    });

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
        btAmountMap[fseName] = (btAmountMap[fseName] || 0) + stage3;
        if (rpPro) rpCountMap[fseName] = (rpCountMap[fseName] || 0) + 1;
      });
    }

    // ── Load withdraw data from TideBT_Mobikwik, filtered by date ───
    let withdrawData = await db.collection('TideBT_Mobikwik')
      .find({ formType: 'mobikwik-withdraw' })
      .toArray();
    withdrawData = filterByDate(withdrawData, 'createdAt');
    withdrawData.forEach(f => {
      // Match by employeeName (exact)
      const fseName = (f.employeeName || '').trim();
      if (!fseName) return;
      if (!withdrawMap[fseName]) withdrawMap[fseName] = 0;
      withdrawMap[fseName] += (f.withdrawAmount || 0);
    });

    // ── Build received map (filtered) and sent map (all-time) ─────────────
    const receivedMap = {};
    filteredPayments.forEach(p => {
      const n = (p.transferTo || '').trim();
      if (!n) return;
      receivedMap[n] = (receivedMap[n] || 0) + (p.amount || 0);
    });

    const sentMap = {};
    allPayments.forEach(p => {
      const sender = (p.senderName || '').trim();
      if (!sender || sender === 'Admin' || sender === 'Accountant') return;
      sentMap[sender] = (sentMap[sender] || 0) + (p.amount || 0);
    });

    // ── Compute cumulative carry-forward for months before selectedMonth ───
    const isTLMap = {};
    names.forEach(n => { isTLMap[n.toLowerCase()] = nameRoleMap[n] === "TL's & Managers"; });

    let carryMap = {};
    if (selectedMonth && selectedYear) {
      carryMap = await computeCarryForward(
        db, allCollections, allPayments, numToFSE, isTLMap,
        selectedMonth, parseInt(selectedYear)
      );
    }

    // ── Calculate usage per person ─────────────────────────────────────────
    const summary = names.map(name => {
      const isTL      = nameRoleMap[name] === "TL's & Managers";
      const nameLower = name.toLowerCase().trim();

      // BT amount and RP count from BT_TL_CONNECT via TideBT_Merchants
      const usedBT  = btAmountMap[name] || 0;
      const rpCount = rpCountMap[name]  || 0;
      const usedRP  = rpCount * 2500;
      const btFee   = Math.round((usedBT > 10000 ? usedBT * 0.015 : 0) * 100) / 100;

      // Mobikwik withdrawals — matched by employeeName
      const withdrawAmount = withdrawMap[name] || 0;
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
    const activeSummary = isFilterActive
      ? summary.filter(item => item.received > 0 || item.usedBT > 0 || item.rpCount > 0 || item.withdrawAmount > 0)
      : summary;

    res.json({ success: true, summary: activeSummary, reportingPeriod });
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

    res.json({ success: true, message: 'Payment recorded successfully', payment });
  } catch (error) {
    console.error('❌ Error recording fund transfer:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

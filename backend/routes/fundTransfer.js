const express = require('express');
const router = express.Router();

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
    const btCollections  = allCollections.filter(c => c.toUpperCase().startsWith('BT_TL_CONNECT'));

    let btCollectionName = null;
    if (selectedMonth) {
      const monthUpper = selectedMonth.toUpperCase();
      btCollectionName = btCollections.find(c => c.toUpperCase().includes(monthUpper)) || null;
    }
    // If no month selected — don't fall back to latest, show ₹0

    const btAmountMap   = {}; // fseName → total stage3 BT done
    const rpCountMap    = {}; // fseName → count of merchants with rewardPassPro=Active
    const withdrawMap   = {}; // fseName → total withdraw amount from TideBT Form Responses

    if (btCollectionName) {
      // PRIMARY: bt_master — has all merchants with fseName mapping
      // Only fetch fields we need
      const masterDocs = await db.collection('bt_master').find(
        {}, { projection: { merchantNumber: 1, fseName: 1, _id: 0 } }
      ).toArray();
      const numToFSE = {};
      masterDocs.forEach(m => {
        const num = (m.merchantNumber || '').trim();
        const fse = (m.fseName || '').trim();
        if (num && fse) numToFSE[num] = fse;
      });

      // FALLBACK: also include TideBT_Merchants if bt_master doesn't cover all
      const merchantDocs = await db.collection('TideBT_Merchants').find(
        {}, { projection: { merchantNumber: 1, employeeName: 1, _id: 0 } }
      ).toArray();
      merchantDocs.forEach(m => {
        const num = (m.merchantNumber || '').trim();
        const fse = (m.employeeName  || '').trim();
        if (num && fse && !numToFSE[num]) numToFSE[num] = fse;
      });

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

      const received   = receivedMap[name] || 0;
      const sentToFSEs = isTL ? (sentMap[name] || 0) : 0;

      const totalUsed = usedRP + btFee + withdrawFee;
      const fundLeft  = isTL
        ? (received - sentToFSEs) - totalUsed
        : received - totalUsed;

      return {
        name,
        type: nameRoleMap[name],
        received,
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

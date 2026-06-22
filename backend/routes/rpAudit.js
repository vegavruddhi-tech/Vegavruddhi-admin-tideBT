const express = require('express');
const router = express.Router();

// GET /api/rp-audit - RP Audit using per-month TideBT_OfficialData_<Month> collections
router.get('/', async (req, res) => {
  try {
    const db = req.db;
    const { dateFilter, fromDate, toDate, selectedYear, selectedMonth } = req.query;

    // ─── 1. Build date range for RP submissions filter ───────────────────────
    let dateStart = null;
    let dateEnd   = null;
    const now = new Date();

    if (dateFilter === 'today') {
      dateStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      dateEnd   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    } else if (dateFilter === 'month') {
      dateStart = new Date(now.getFullYear(), now.getMonth(), 1);
      dateEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    } else if (dateFilter === 'custom' && fromDate && toDate) {
      dateStart = new Date(fromDate);
      dateEnd   = new Date(toDate + 'T23:59:59');
    } else if (selectedYear && selectedMonth && selectedMonth !== 'all') {
      const monthIndex = new Date(`${selectedMonth} 1, ${selectedYear}`).getMonth();
      dateStart = new Date(parseInt(selectedYear), monthIndex, 1);
      dateEnd   = new Date(parseInt(selectedYear), monthIndex + 1, 0, 23, 59, 59);
    }

    // ─── 2. Determine which official collection to use ───────────────────────
    // Collection name: TideBT_OfficialData_May, TideBT_OfficialData_June, etc.
    // If no specific month selected, derive from current month
    let officialMonth = selectedMonth;
    if (!officialMonth || officialMonth === 'all') {
      officialMonth = now.toLocaleString('en-US', { month: 'long' });
    }
    const officialCollectionName = `TideBT_OfficialData_${officialMonth}`;

    // ─── 3. Build RP query ───────────────────────────────────────────────────
    const rpQuery = {};
    if (dateStart && dateEnd) {
      rpQuery.$or = [
        { dateOfWorking: { $gte: dateStart, $lte: dateEnd } },
        { createdAt:     { $gte: dateStart, $lte: dateEnd } }
      ];
    }

    // ─── 4. Fetch all data in parallel ──────────────────────────────────────
    let officialData = [];
    try {
      officialData = await db.collection(officialCollectionName).find({}).toArray();
      console.log(`✅ Loaded ${officialData.length} records from ${officialCollectionName}`);
    } catch (e) {
      // Collection may not exist yet for this month — that's fine, audit shows 0 actual
      console.warn(`⚠️ Collection ${officialCollectionName} not found or empty:`, e.message);
      officialData = [];
    }

    const [rewardPassData, accessList] = await Promise.all([
      db.collection('TideBT_RewardPass').find(rpQuery).sort({ createdAt: -1 }).toArray(),
      db.collection('TideBT_Access').find({}, { projection: { tlName: 1 } }).toArray()
    ]);

    // ─── 5. Build TL name set for role identification ────────────────────────
    const norm = (s) => (s || '').toLowerCase().trim().replace(/\s+/g, ' ');

    const tlNameSet = new Set(
      accessList.map(a => norm(a.tlName)).filter(Boolean)
    );

    // ─── 6. Build FSE actual RP map from official data ───────────────────────
    // Key: normalized verifiedPartner name → array of official rows
    const fseActualMap = {};
    officialData.forEach(row => {
      // Try multiple possible field names the sync script might have used
      const partner = row.verifiedPartner || row.verified_partner || row.fse || row.fseName || row['Verified Partner'] || '';
      const key = norm(partner);
      if (!key) return;
      if (!fseActualMap[key]) fseActualMap[key] = [];
      fseActualMap[key].push(row);
    });

    // ─── 7. Build TL actual RP map from official data ────────────────────────
    // Key: normalized tlName → array of official rows
    const tlActualMap = {};
    officialData.forEach(row => {
      const tl = row.tlName || row.tl_name || row.tl || row['TL Name'] || '';
      const key = norm(tl);
      if (!key) return;
      if (!tlActualMap[key]) tlActualMap[key] = [];
      tlActualMap[key].push(row);
    });

    // ─── 8. Split RP submissions into FSE and TL ────────────────────────────
    const isTLRecord = (rp) => {
      if (rp.role && rp.role.toUpperCase() === 'TL') return true;
      return tlNameSet.has(norm(rp.employeeName));
    };

    const fseRP = rewardPassData.filter(r => !isTLRecord(r));
    const tlRP  = rewardPassData.filter(r => isTLRecord(r));

    // ─── 9. Build FSE audit ──────────────────────────────────────────────────
    const fseByEmployee = {};
    fseRP.forEach(rp => {
      if (!rp.employeeName) return;
      if (!fseByEmployee[rp.employeeName]) fseByEmployee[rp.employeeName] = [];
      fseByEmployee[rp.employeeName].push(rp);
    });

    const fseAudit = Object.entries(fseByEmployee).map(([empName, rpEntries]) => {
      const totalClaimedRP  = rpEntries.reduce((s, r) => s + (r.totalRPCount || 0), 0);
      const totalClaimedBT  = rpEntries.reduce((s, r) => s + (r.totalBTAmount || 0), 0);
      const actualRows      = fseActualMap[norm(empName)] || [];
      const actualOnboarded = actualRows.length;
      const difference      = totalClaimedRP - actualOnboarded;
      const mismatch        = difference > 0;

      return {
        employeeName: empName,
        role: 'FSE',
        totalClaimedRP,
        totalClaimedBT,
        actualOnboarded,
        mismatch,
        difference,
        lastSubmission: rpEntries[0]?.createdAt,
        actualMerchants: actualRows.map(r => ({
          lead:          r.leadName   || r.lead   || r['Lead']            || r.merchantName || '',
          mobile:        r.mobileNo   || r.mobile || r['Mobile No.']      || '',
          passProActive: r.passProActive || r['Pass Pro Active']          || '',
          tlName:        r.tlName     || r.tl     || r['TL Name']         || ''
        })),
        entries: rpEntries.map(r => ({
          date:          r.dateOfWorking,
          workingUpdate: r.workingUpdate,
          claimedRP:     r.totalRPCount,
          btAmount:      r.totalBTAmount,
          createdAt:     r.createdAt
        }))
      };
    });

    // ─── 10. Build TL audit ──────────────────────────────────────────────────
    const tlByEmployee = {};
    tlRP.forEach(rp => {
      if (!rp.employeeName) return;
      if (!tlByEmployee[rp.employeeName]) tlByEmployee[rp.employeeName] = [];
      tlByEmployee[rp.employeeName].push(rp);
    });

    // Also show TLs that have official data but haven't submitted RP forms
    Object.keys(tlActualMap).forEach(tlKey => {
      const originalName = tlActualMap[tlKey][0]?.tlName || tlActualMap[tlKey][0]?.tl || tlActualMap[tlKey][0]?.['TL Name'] || '';
      if (originalName && !Object.keys(tlByEmployee).some(k => norm(k) === tlKey)) {
        tlByEmployee[originalName] = [];
      }
    });

    const tlAudit = Object.entries(tlByEmployee).map(([tlName, rpEntries]) => {
      const totalClaimedRP  = rpEntries.reduce((s, r) => s + (r.totalRPCount || 0), 0);
      const totalClaimedBT  = rpEntries.reduce((s, r) => s + (r.totalBTAmount || 0), 0);
      const actualRows      = tlActualMap[norm(tlName)] || [];
      const actualOnboarded = actualRows.length;
      const difference      = totalClaimedRP - actualOnboarded;
      const mismatch        = difference > 0;

      // FSE breakdown under this TL
      const fseBreakdown = {};
      actualRows.forEach(r => {
        const fseName = norm(r.verifiedPartner || r.fse || r['Verified Partner'] || 'Unknown');
        fseBreakdown[fseName] = (fseBreakdown[fseName] || 0) + 1;
      });

      return {
        employeeName: tlName,
        role: 'TL',
        totalClaimedRP,
        totalClaimedBT,
        actualOnboarded,
        mismatch,
        difference,
        lastSubmission: rpEntries[0]?.createdAt || null,
        fseBreakdown: Object.entries(fseBreakdown).map(([name, count]) => ({ name, count })),
        entries: rpEntries.map(r => ({
          date:          r.dateOfWorking,
          workingUpdate: r.workingUpdate,
          claimedRP:     r.totalRPCount,
          btAmount:      r.totalBTAmount,
          createdAt:     r.createdAt
        }))
      };
    });

    // ─── 11. Sort: mismatches first, then by difference desc ─────────────────
    const sortAudit = arr => arr.sort((a, b) => {
      if (a.mismatch && !b.mismatch) return -1;
      if (!a.mismatch && b.mismatch) return 1;
      return b.difference - a.difference;
    });
    sortAudit(fseAudit);
    sortAudit(tlAudit);

    const allAudit = [...fseAudit, ...tlAudit];

    res.json({
      success: true,
      audit:          fseAudit,
      tlAudit:        tlAudit,
      rawSubmissions: rewardPassData,
      officialCollection: officialCollectionName,   // useful for debugging
      officialRecordsLoaded: officialData.length,
      summary: {
        totalEmployees:      allAudit.length,
        totalMismatches:     allAudit.filter(a => a.mismatch).length,
        totalClaimedRP:      allAudit.reduce((s, a) => s + a.totalClaimedRP, 0),
        totalActualOnboarded: allAudit.reduce((s, a) => s + a.actualOnboarded, 0)
      }
    });

  } catch (error) {
    console.error('Error in RP audit:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

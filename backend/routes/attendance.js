const express = require('express');
const router = express.Router();

// GET /api/attendance/admin/all?date=2026-07-09
// Returns attendance ONLY for FSEs/TLs in TideBT_Access
router.get('/admin/all', async (req, res) => {
  try {
    const db = req.db;
    const { date } = req.query;

    // Step 1: Get all TideBT FSE and TL names
    const accessList = await db.collection('TideBT_Access').find({ hasTideBTAccess: true }).toArray();
    const fseNames = [...new Set(accessList.map(a => (a.fseName || '').trim()).filter(Boolean))];
    const tlNames  = [...new Set(accessList.map(a => (a.tlName  || '').trim()).filter(Boolean))];
    const allNames = [...new Set([...fseNames, ...tlNames])];

    // Step 2: Fetch attendance for those names on that date — ONLY from TideBT logins
    const query = { source: { $in: ['tidebt-employee', 'tidebt-tl'] } };
    if (date) query.date = date;
    if (allNames.length > 0) {
      query.userName = { $in: allNames.map(n => new RegExp(`^\\s*${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'i')) };
    }

    const attendanceRecords = await db.collection('Attendance').find(query).sort({ firstLoginTime: 1 }).toArray();

    // Step 3: For absent members — create absent records for those not in attendance
    const presentNames = new Set(attendanceRecords.map(r => (r.userName || '').trim().toLowerCase()));

    const absentRecords = [];
    for (const name of allNames) {
      if (!presentNames.has(name.toLowerCase())) {
        // Check if they are FSE or TL
        const isTL = tlNames.some(t => t.toLowerCase() === name.toLowerCase()) && !fseNames.some(f => f.toLowerCase() === name.toLowerCase());
        const accessRecord = accessList.find(a =>
          (a.fseName || '').trim().toLowerCase() === name.toLowerCase() ||
          (a.tlName  || '').trim().toLowerCase() === name.toLowerCase()
        );
        absentRecords.push({
          userName: name,
          userType: isTL ? 'teamlead' : 'employee',
          status: 'absent',
          date: date || new Date().toISOString().split('T')[0],
          tlName: accessRecord?.tlName || '',
          reportingManager: accessRecord?.tlName || '',
        });
      }
    }

    const allRecords = [...attendanceRecords, ...absentRecords];

    res.json({ success: true, attendance: allRecords, total: allRecords.length });
  } catch (err) {
    console.error('Attendance all error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/attendance/admin/summary?date=2026-07-09
router.get('/admin/summary', async (req, res) => {
  try {
    const db = req.db;
    const { date } = req.query;

    const accessList = await db.collection('TideBT_Access').find({ hasTideBTAccess: true }).toArray();
    const fseNames = [...new Set(accessList.map(a => (a.fseName || '').trim()).filter(Boolean))];
    const tlNames  = [...new Set(accessList.map(a => (a.tlName  || '').trim()).filter(Boolean))];
    const allNames = [...new Set([...fseNames, ...tlNames])];

    const query = { source: { $in: ['tidebt-employee', 'tidebt-tl'] } };
    if (date) query.date = date;
    if (allNames.length > 0) {
      query.userName = { $in: allNames.map(n => new RegExp(`^\\s*${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'i')) };
    }

    const records = await db.collection('Attendance').find(query).toArray();
    const present = records.filter(r => r.status === 'present' || r.firstLoginTime).length;
    const absent  = allNames.length - present;
    const relogins = records.reduce((s, r) => s + (r.reloginCount || 0), 0);

    res.json({
      success: true,
      date,
      totalPresent: present,
      totalAbsent: Math.max(0, absent),
      totalRelogins: relogins,
      total: allNames.length,
    });
  } catch (err) {
    console.error('Attendance summary error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();

// GET /api/attendance/admin/all?date=2026-07-09
router.get('/admin/all', async (req, res) => {
  try {
    const db = req.db;
    const { date } = req.query;

    const query = {};
    if (date) query.date = date;

    const attendance = await db.collection('Attendance')
      .find(query)
      .sort({ firstLoginTime: 1 })
      .toArray();

    res.json({ success: true, attendance, total: attendance.length });
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

    const query = {};
    if (date) query.date = date;

    const records = await db.collection('Attendance').find(query).toArray();

    const present = records.filter(r => r.status === 'present').length;
    const absent  = records.filter(r => r.status === 'absent').length;
    const relogins = records.reduce((s, r) => s + (r.reloginCount || 0), 0);

    res.json({
      success: true,
      date,
      total: records.length,
      present,
      absent,
      relogins,
    });
  } catch (err) {
    console.error('Attendance summary error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

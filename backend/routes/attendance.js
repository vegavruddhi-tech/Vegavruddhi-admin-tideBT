const express = require('express');
const router = express.Router();

// GET /api/attendance/admin/all?date=2026-07-09
// Returns attendance ONLY for FSEs/TLs in TideBT_Access
router.get('/admin/all', async (req, res) => {
  try {
    const db = req.db;
    const { date } = req.query;

    // Step 1: Get all TideBT FSE and TL names from TideBT_Access
    const accessList = await db.collection('TideBT_Access').find({ hasTideBTAccess: true }).toArray();

    const personMap = {}; // nameLower → { name, userType, tlName, reportingManager }

    // Add FSEs
    accessList.forEach(a => {
      const fseName = (a.fseName || '').trim();
      if (!fseName) return;
      const key = fseName.toLowerCase();
      if (!personMap[key]) {
        personMap[key] = {
          name: fseName,
          userType: 'employee',
          tlName: (a.tlName || '').trim(),
          reportingManager: (a.tlName || '').trim(),
        };
      }
    });

    // Add/upgrade TLs
    accessList.forEach(a => {
      const tlName = (a.tlName || '').trim();
      if (!tlName) return;
      const key = tlName.toLowerCase();
      personMap[key] = {
        name: personMap[key]?.name || tlName,
        userType: 'teamlead',
        tlName: tlName,
        reportingManager: '',
      };
    });

    const allPersons = Object.values(personMap);
    const queryDate = date || new Date().toISOString().split('T')[0];

    // Fetch attendance records for the date
    const rawRecords = await db.collection('Attendance')
      .find({ date: queryDate })
      .sort({ firstLoginTime: 1 })
      .toArray();

    // Filter in JS for TideBT members only
    const attendanceRecords = rawRecords.filter(r => {
      const key = (r.userName || '').trim().toLowerCase();
      return personMap[key] !== undefined;
    });

    const presentNames = new Set(attendanceRecords.map(r => (r.userName || '').trim().toLowerCase()));

    const absentRecords = [];
    for (const person of allPersons) {
      if (!presentNames.has(person.name.toLowerCase())) {
        absentRecords.push({
          userName:         person.name,
          userType:         person.userType,
          status:           'absent',
          date:             queryDate,
          tlName:           person.tlName,
          reportingManager: person.reportingManager,
        });
      }
    }

    const enriched = attendanceRecords.map(r => {
      const key = (r.userName || '').trim().toLowerCase();
      const person = personMap[key];
      return {
        ...r,
        userType:         r.userType         || person?.userType         || 'employee',
        tlName:           r.tlName           || person?.tlName           || '',
        reportingManager: r.reportingManager || person?.reportingManager || '',
      };
    });

    const allRecords = [...enriched, ...absentRecords];

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
    const personMap = {};
    accessList.forEach(a => {
      if (a.fseName) personMap[a.fseName.trim().toLowerCase()] = true;
      if (a.tlName)  personMap[a.tlName.trim().toLowerCase()]  = true;
    });

    const totalPersonsCount = Object.keys(personMap).length;
    const query = {};
    if (date) query.date = date;

    const rawRecords = await db.collection('Attendance').find(query).toArray();
    const records = rawRecords.filter(r => {
      const key = (r.userName || '').trim().toLowerCase();
      return personMap[key] === true;
    });

    const present = records.filter(r => r.status === 'present' || r.firstLoginTime).length;
    const absent  = totalPersonsCount - present;
    const relogins = records.reduce((s, r) => s + (r.reloginCount || 0), 0);

    res.json({
      success: true,
      date,
      totalPresent: present,
      totalAbsent: Math.max(0, absent),
      totalRelogins: relogins,
      total: totalPersonsCount,
    });
  } catch (err) {
    console.error('Attendance summary error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/attendance/admin/monthly?year=2026&month=7
router.get('/admin/monthly', async (req, res) => {
  try {
    const db = req.db;
    const { year, month } = req.query;

    const y = parseInt(year  || new Date().getFullYear());
    const m = parseInt(month || (new Date().getMonth() + 1));

    const now          = new Date();
    const todayIST     = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const todayMidnight = new Date(todayIST.getFullYear(), todayIST.getMonth(), todayIST.getDate());
    const monthEnd     = new Date(y, m, 0);
    const isCurrentMonth = y === todayIST.getFullYear() && m === (todayIST.getMonth() + 1);

    const startDay = isCurrentMonth
      ? todayMidnight
      : new Date(y, m - 1, 1);

    const allDates = [];
    for (let d = new Date(startDay); d <= monthEnd; d.setDate(d.getDate() + 1)) {
      allDates.push(new Date(d).toISOString().split('T')[0]);
    }
    const totalWorkingDays = allDates.length;

    const accessList = await db.collection('TideBT_Access').find({ hasTideBTAccess: true }).toArray();
    const personMap = {};
    accessList.forEach(a => {
      const fseName = (a.fseName || '').trim();
      if (!fseName) return;
      const key = fseName.toLowerCase();
      if (!personMap[key]) {
        personMap[key] = { name: fseName, userType: 'employee', tlName: (a.tlName || '').trim() };
      }
    });
    accessList.forEach(a => {
      const tlName = (a.tlName || '').trim();
      if (!tlName) return;
      const key = tlName.toLowerCase();
      personMap[key] = { name: personMap[key]?.name || tlName, userType: 'teamlead', tlName };
    });
    const allPersons = Object.values(personMap);

    // Fetch attendance for date range
    const rawRecords = await db.collection('Attendance').find({
      date: { $gte: allDates[0] || `${y}-${String(m).padStart(2, '0')}-01`, $lte: allDates[allDates.length - 1] || `${y}-${String(m).padStart(2, '0')}-31` }
    }).toArray();

    // Filter in JS for TideBT members
    const records = rawRecords.filter(r => {
      const key = (r.userName || '').trim().toLowerCase();
      return personMap[key] !== undefined;
    });

    const presentDatesMap = {};
    records.forEach(r => {
      if (r.status !== 'present' && !r.firstLoginTime) return;
      const key = (r.userName || '').trim().toLowerCase();
      if (!presentDatesMap[key]) presentDatesMap[key] = new Set();
      presentDatesMap[key].add(r.date);
    });

    const summary = allPersons.map(p => {
      const key          = p.name.toLowerCase();
      const presentDates = presentDatesMap[key] || new Set();
      const daysPresent  = presentDates.size;
      const daysAbsent   = totalWorkingDays - daysPresent;
      return {
        name:             p.name,
        userType:         p.userType,
        tlName:           p.tlName,
        daysPresent,
        daysAbsent:       Math.max(0, daysAbsent),
        totalWorkingDays,
        attendancePercent: totalWorkingDays > 0 ? Math.round((daysPresent / totalWorkingDays) * 100) : 0,
        presentDates:     [...presentDates].sort(),
      };
    });

    summary.sort((a, b) => {
      if (a.userType !== b.userType) return a.userType === 'teamlead' ? -1 : 1;
      return b.daysPresent - a.daysPresent;
    });

    res.json({
      success: true,
      year: y, month: m,
      totalWorkingDays,
      allDates,
      summary,
    });
  } catch (err) {
    console.error('Monthly attendance error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

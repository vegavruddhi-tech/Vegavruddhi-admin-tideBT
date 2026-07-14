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
    const fseNameSet = new Set(accessList.map(a => (a.fseName || '').trim()).filter(Boolean));
    const tlNameSet  = new Set(accessList.map(a => (a.tlName  || '').trim()).filter(Boolean));

    // Build person map — each person with their primary role
    // If someone is BOTH fseName and tlName → show as 'teamlead' (TL takes priority for attendance display)
    // But keep ONE record per person (no duplicates)
    const personMap = {}; // nameLower → { name, userType, tlName, reportingManager }

    // Add FSEs first
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

    // Add/upgrade TLs — if already exists as FSE, upgrade to teamlead
    accessList.forEach(a => {
      const tlName = (a.tlName || '').trim();
      if (!tlName) return;
      const key = tlName.toLowerCase();
      // TL who is also an FSE gets shown as teamlead
      personMap[key] = {
        name: personMap[key]?.name || tlName,
        userType: 'teamlead',
        tlName: tlName,
        reportingManager: '',
      };
    });

    const allPersons = Object.values(personMap);
    const allNames   = allPersons.map(p => p.name);

    // Step 2: Fetch attendance for those names — from any source
    // Note: some records may have source=undefined (from non-TideBT logins on same day)
    const queryDate = date || new Date().toISOString().split('T')[0];
    const query = { date: queryDate };
    if (allNames.length > 0) {
      query.userName = { $in: allNames.map(n => new RegExp(`^\\s*${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'i')) };
    }

    const attendanceRecords = await db.collection('Attendance').find(query).sort({ firstLoginTime: 1 }).toArray();

    // Step 3: For absent members — create absent records for those not in attendance
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

    // Enrich attendance records with userType from personMap (in case it's missing)
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
    const fseNameSet = new Set(accessList.map(a => (a.fseName || '').trim()).filter(Boolean));
    const tlNameSet  = new Set(accessList.map(a => (a.tlName  || '').trim()).filter(Boolean));

    // Unique names — TL takes priority for deduplication
    const allNamesSet = new Set();
    fseNameSet.forEach(n => allNamesSet.add(n));
    tlNameSet.forEach(n => allNamesSet.add(n));
    const allNames = [...allNamesSet];

    const query = {};
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

// GET /api/attendance/admin/monthly?year=2026&month=7
// Returns per-person attendance summary for the whole month:
// { name, userType, tlName, daysPresent, daysAbsent, totalWorkingDays, attendancePercent, dates: ['2026-07-01', ...] }
router.get('/admin/monthly', async (req, res) => {
  try {
    const db = req.db;
    const { year, month } = req.query;

    const y = parseInt(year  || new Date().getFullYear());
    const m = parseInt(month || (new Date().getMonth() + 1));

    // Build date range:
    // - Current month → TODAY to month end inclusive (remaining days including today)
    // - Past/future months → 1st to last day of month (full month)
    const now        = new Date();
    const todayIST   = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    // Normalize to midnight to avoid time-of-day comparison issues
    const todayMidnight = new Date(todayIST.getFullYear(), todayIST.getMonth(), todayIST.getDate());
    const monthEnd   = new Date(y, m, 0); // last day of month at midnight
    const isCurrentMonth = y === todayIST.getFullYear() && m === (todayIST.getMonth() + 1);

    // Start: today (midnight) for current month, 1st for past/future months
    const startDay = isCurrentMonth
      ? todayMidnight
      : new Date(y, m - 1, 1);

    const allDates = [];
    for (let d = new Date(startDay); d <= monthEnd; d.setDate(d.getDate() + 1)) {
      allDates.push(new Date(d).toISOString().split('T')[0]);
    }
    const totalWorkingDays = allDates.length;

    // Get all TideBT persons
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
    const allNames   = allPersons.map(p => p.name);

    // Fetch all attendance records for this month in ONE query
    const records = await db.collection('Attendance').find({
      date:     { $gte: allDates[0], $lte: allDates[allDates.length - 1] },
      userName: { $in: allNames.map(n => new RegExp(`^\\s*${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'i')) }
    }).toArray();

    // Build per-person present dates set
    const presentDatesMap = {}; // nameLower → Set of dates
    records.forEach(r => {
      if (r.status !== 'present' && !r.firstLoginTime) return;
      const key = (r.userName || '').trim().toLowerCase();
      if (!presentDatesMap[key]) presentDatesMap[key] = new Set();
      presentDatesMap[key].add(r.date);
    });

    // Build summary per person
    const summary = allPersons.map(p => {
      const key         = p.name.toLowerCase();
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

    // Sort: TLs first, then by daysPresent desc
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

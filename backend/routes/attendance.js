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

module.exports = router;

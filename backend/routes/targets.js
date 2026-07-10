const express = require('express');
const router = express.Router();

// GET /api/targets - Get all targets
router.get('/', async (req, res) => {
  try {
    const db = req.db;
    const { month, year } = req.query;
    const query = {};
    if (month) query.month = month;
    if (year) query.year = parseInt(year);

    const targets = await db.collection('TideBT_Targets')
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();

    res.json({ success: true, targets });
  } catch (error) {
    console.error('Error fetching targets:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/targets/carry-forward/:name?month=&year= — get remaining from previous period
router.get('/carry-forward/:name', async (req, res) => {
  try {
    const db = req.db;
    const name = decodeURIComponent(req.params.name);
    const { month, year } = req.query;
    if (!month || !year) return res.json({ success: true, carryForward: 0 });

    const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const curIdx = MONTHS.indexOf(month);
    if (curIdx <= 0) return res.json({ success: true, carryForward: 0 });

    const prevMonth = MONTHS[curIdx - 1];
    const prevYear = parseInt(year);

    // Get previous period target
    const prevTargets = await db.collection('TideBT_Targets').find({
      targetFor: { $regex: new RegExp(`^\\s*${name.trim()}$`, 'i') },
      month: prevMonth, year: prevYear
    }).toArray();

    const prevBtTarget = prevTargets.reduce((s, t) => s + (t.btTarget || 0), 0);
    if (prevBtTarget === 0) return res.json({ success: true, carryForward: 0 });

    // Get achieved BT from BT_TL_CONNECT collection for that month
    const allCollections = (await db.listCollections().toArray()).map(c => c.name);
    const ABBR = { 'JANUARY':'JAN','FEBRUARY':'FEB','MARCH':'MAR','APRIL':'APR','MAY':'MAY','JUNE':'JUN','JULY':'JUL','AUGUST':'AUG','SEPTEMBER':'SEP','OCTOBER':'OCT','NOVEMBER':'NOV','DECEMBER':'DEC' };
    const mu = prevMonth.toUpperCase(); const abbr = ABBR[mu] || mu;
    const btCol = allCollections.filter(c => c.toUpperCase().startsWith('BT_TL_CONNECT')).find(c => {
      const cu = c.toUpperCase(); return (cu.includes(mu) || cu.includes(abbr));
    });

    if (!btCol) return res.json({ success: true, carryForward: prevBtTarget });

    // Get merchant numbers for this FSE
    const masterDocs = await db.collection('bt_master').find({
      fseName: { $regex: new RegExp(`^\\s*${name.trim()}\\s*\\d*\\s*$`, 'i') }
    }).project({ merchantNumber: 1 }).toArray();
    const nums = masterDocs.map(m => m.merchantNumber).filter(Boolean);

    let achieved = 0;
    if (nums.length > 0) {
      const btDocs = await db.collection(btCol).find({ merchantNumber: { $in: nums } }).project({ stage3: 1 }).toArray();
      achieved = btDocs.reduce((s, d) => s + (parseFloat(String(d.stage3 || '0').replace(/,/g,'')) || 0), 0);
    }

    const carryForward = Math.max(0, prevBtTarget - achieved);
    res.json({ success: true, carryForward, prevBtTarget, achieved, prevMonth, prevYear });
  } catch (error) {
    console.error('Carry forward error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/targets - Set a target (Admin only)
router.post('/', async (req, res) => {
  try {
    const db = req.db;
    const { targetFor, targetRole, setBy, setByRole, btTarget, rpTarget, month, year, startDate, endDate, carryForward } = req.body;

    if (!targetFor || !btTarget || !rpTarget || !month || !year) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    const cf = parseFloat(carryForward) || 0;
    const totalBtTarget = parseFloat(btTarget) + cf;

    const target = {
      targetFor,
      targetRole: targetRole || 'FSE',
      setBy: setBy || 'Admin',
      setByRole: setByRole || 'Admin',
      btTarget: totalBtTarget,
      btTargetOriginal: parseFloat(btTarget),
      carryForward: cf,
      rpTarget: parseInt(rpTarget),
      month,
      year: parseInt(year),
      startDate: startDate || null,
      endDate: endDate || null,
      createdAt: new Date()
    };

    await db.collection('TideBT_Targets').insertOne(target);
    res.json({ success: true, message: `Target set for ${targetFor}` });
  } catch (error) {
    console.error('Error setting target:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/targets/:id - Update a target
// Admin can edit any target. TL can only edit targets they set (setByRole === 'TL').
router.put('/:id', async (req, res) => {
  try {
    const db = req.db;
    const { ObjectId } = require('mongodb');
    const { btTarget, rpTarget, startDate, endDate, requestedBy } = req.body;

    // Fetch existing target to check ownership
    const existing = await db.collection('TideBT_Targets').findOne({ _id: new ObjectId(req.params.id) });
    if (!existing) return res.status(404).json({ success: false, message: 'Target not found' });

    // If requester is TL, they can only edit targets THEY set (setByRole === 'TL' and setBy matches)
    if (requestedBy === 'TL' && existing.setByRole === 'Admin') {
      return res.status(403).json({ success: false, message: 'TL cannot edit targets set by Admin' });
    }

    const updateFields = { updatedAt: new Date() };
    if (btTarget !== undefined) updateFields.btTarget = parseFloat(btTarget);
    if (rpTarget !== undefined) updateFields.rpTarget = parseInt(rpTarget);
    if (startDate !== undefined) updateFields.startDate = startDate;
    if (endDate !== undefined) updateFields.endDate = endDate;

    const result = await db.collection('TideBT_Targets').updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: updateFields }
    );

    if (result.matchedCount === 0) return res.status(404).json({ success: false, message: 'Target not found' });
    res.json({ success: true, message: 'Target updated' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/targets/:id - Delete a target
router.delete('/:id', async (req, res) => {
  try {
    const db = req.db;
    const { ObjectId } = require('mongodb');

    const result = await db.collection('TideBT_Targets').deleteOne({ _id: new ObjectId(req.params.id) });

    if (result.deletedCount === 0) return res.status(404).json({ success: false, message: 'Target not found' });
    res.json({ success: true, message: 'Target deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/targets/:name - Get target for a specific person
router.get('/:name', async (req, res) => {
  try {
    const db = req.db;
    const name = decodeURIComponent(req.params.name);
    const { month, year } = req.query;

    const query = { targetFor: { $regex: new RegExp(`^${name.trim()}$`, 'i') } };
    if (month) query.month = month;
    if (year) query.year = parseInt(year);

    const target = await db.collection('TideBT_Targets').findOne(query);

    res.json({ success: true, target });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

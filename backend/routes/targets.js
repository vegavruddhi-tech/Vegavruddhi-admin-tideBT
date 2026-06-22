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

// POST /api/targets - Set a target
router.post('/', async (req, res) => {
  try {
    const db = req.db;
    const { targetFor, targetRole, setBy, setByRole, btTarget, rpTarget, month, year } = req.body;

    if (!targetFor || !btTarget || !rpTarget || !month || !year) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    // Always insert new record (keep history)
    const target = {
      targetFor,
      targetRole: targetRole || 'FSE',
      setBy: setBy || 'Admin',
      setByRole: setByRole || 'Admin',
      btTarget: parseFloat(btTarget),
      rpTarget: parseInt(rpTarget),
      month,
      year: parseInt(year),
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
router.put('/:id', async (req, res) => {
  try {
    const db = req.db;
    const { ObjectId } = require('mongodb');
    const { btTarget, rpTarget } = req.body;

    const result = await db.collection('TideBT_Targets').updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { btTarget: parseFloat(btTarget), rpTarget: parseInt(rpTarget), updatedAt: new Date() } }
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

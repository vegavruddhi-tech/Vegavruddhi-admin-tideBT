const express = require('express');
const router = express.Router();

// GET /api/forms - Get all Tide BT forms
router.get('/', async (req, res) => {
  try {
    const db = req.db; // Use ConnectionManager db from middleware
    const { page = 1, limit = 50, employee, status } = req.query;
    
    // Build query
    const query = {};
    if (employee) query.employeeName = new RegExp(employee, 'i');
    if (status) query.status = status;
    
    // Get forms with pagination
    const forms = await db.collection('TideBT Form Responses')
      .find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .toArray();
    
    const total = await db.collection('TideBT Form Responses').countDocuments(query);
    
    res.json({ 
      success: true, 
      forms, 
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('Error fetching forms:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/forms/stats - Get form statistics
router.get('/stats', async (req, res) => {
  try {
    const db = req.db;
    
    const totalForms = await db.collection('TideBT Form Responses').countDocuments();
    
    // Count by status
    const statusCounts = await db.collection('TideBT Form Responses').aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]).toArray();
    
    // Count by employee
    const topEmployees = await db.collection('TideBT Form Responses').aggregate([
      { $group: { _id: '$employeeName', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]).toArray();
    
    res.json({ 
      success: true, 
      stats: {
        totalForms,
        byStatus: statusCounts,
        topEmployees
      }
    });
  } catch (error) {
    console.error('Error fetching form stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

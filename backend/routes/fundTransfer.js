const express = require('express');
const router = express.Router();

// GET /api/fund-transfer - Get all fund transfers (placeholder)
router.get('/', async (req, res) => {
  try {
    // Placeholder - will implement later
    res.json({ 
      success: true, 
      transfers: [],
      message: 'Fund transfer functionality coming soon'
    });
  } catch (error) {
    console.error('Error fetching fund transfers:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

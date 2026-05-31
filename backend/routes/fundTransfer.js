const express = require('express');
const router = express.Router();

// GET /api/fund-transfer - Get all fund transfers
router.get('/', async (req, res) => {
  try {
    const db = req.db;
    const transfers = await db.collection('TideBT_Payments')
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    res.json({ success: true, transfers });
  } catch (error) {
    console.error('Error fetching fund transfers:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/fund-transfer - Record a new fund transfer
router.post('/', async (req, res) => {
  try {
    const db = req.db;
    console.log('📝 Fund transfer POST received:', req.body);
    const { transferToWhom, senderName, transferTo, amount, paymentDoneOn } = req.body;

    if (!transferToWhom || !senderName || !transferTo || !amount || !paymentDoneOn) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    const payment = {
      transferToWhom,
      senderName,
      transferTo,
      amount: parseFloat(amount),
      paymentDoneOn,
      source: 'admin-panel',
      createdAt: new Date()
    };

    const result = await db.collection('TideBT_Payments').insertOne(payment);
    console.log('✅ Payment saved:', result.insertedId);

    res.json({ success: true, message: 'Payment recorded successfully', payment });
  } catch (error) {
    console.error('❌ Error recording fund transfer:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

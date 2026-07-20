const express = require('express');
const router  = express.Router();
const { sendTideBTDailyReport } = require('../utils/tideBTDailyReport');

// POST /api/report/send-daily-bt-report
// Call this after running the BT sheet sync script
// e.g. curl -X POST https://your-backend.vercel.app/api/report/send-daily-bt-report
router.post('/send-daily-bt-report', async (req, res) => {
  try {
    const result = await sendTideBTDailyReport(req.db);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/report/test-bt-report  — manual trigger for testing
router.get('/test-bt-report', async (req, res) => {
  try {
    const result = await sendTideBTDailyReport(req.db);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

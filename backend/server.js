const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const ConnectionManager = require('./utils/ConnectionManager');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Initialize ConnectionManager singleton
const connectionManager = ConnectionManager.getInstance();

// ── MongoDB Connection — cached for Vercel serverless cold starts ──────────
let isConnected = false;

async function connectDB() {
  if (isConnected && mongoose.connection.readyState === 1) return;
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    });
    isConnected = true;
    connectionManager.setMongooseConnection(mongoose.connection);
    console.log('✅ MongoDB Connected - Tide BT Admin Backend');

    // Ensure database indexes exist for ultra-fast queries (background non-blocking)
    (async () => {
      try {
        const db = mongoose.connection.db;
        if (!db) return;
        await Promise.all([
          db.collection('bt_master').createIndex({ merchantNumber: 1 }),
          db.collection('bt_master').createIndex({ fseName: 1, tl: 1 }),
          db.collection('TideBT_Payments').createIndex({ transferTo: 1 }),
          db.collection('TideBT_Payments').createIndex({ senderName: 1 }),
          db.collection('TideBT_Access').createIndex({ tlName: 1 }),
          db.collection('TideBT_Access').createIndex({ fseName: 1 }),
          db.collection('TideBT Form Responses').createIndex({ merchantNumber: 1 })
        ]);
        const cols = (await db.listCollections().toArray()).map(c => c.name);
        const btCols = cols.filter(c => c.toUpperCase().startsWith('BT_TL_CONNECT'));
        for (const col of btCols) {
          await db.collection(col).createIndex({ merchantNumber: 1 });
        }
        console.log('⚡ All MongoDB Atlas Indexes Verified/Created!');
      } catch (idxErr) {
        console.warn('Index creation notice:', idxErr.message);
      }
    })();
  } catch (err) {
    isConnected = false;
    console.error('❌ MongoDB Connection Error:', err.message);
    throw err;
  }
}

// Ensure DB is connected before every request (critical for Vercel cold starts)
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    return res.status(503).json({
      success: false,
      error: 'Database connection unavailable',
      message: err.message
    });
  }
});

// Middleware to attach db to req
app.use(async (req, res, next) => {
  try {
    await connectionManager.ensureInitialized();
    req.db = connectionManager.getConnection();
    next();
  } catch (error) {
    console.error('❌ Database connection error:', error.message);
    res.status(503).json({ 
      success: false, 
      error: 'Database connection unavailable',
      message: error.message 
    });
  }
});

// Routes
app.use('/api/fse', require('./routes/fse'));
app.use('/api/tl', require('./routes/tl'));
app.use('/api/forms', require('./routes/forms'));
app.use('/api/fund-transfer', require('./routes/fundTransfer'));
app.use('/api/rp-audit', require('./routes/rpAudit'));
app.use('/api/targets', require('./routes/targets'));
app.use('/api/attendance', require('./routes/attendance'));
app.use('/api/report', require('./routes/report'));

// Health check
app.get('/health', async (req, res) => {
  const status = connectionManager.getStatus();
  const metrics = connectionManager.getMetrics();
  
  res.json({ 
    status: status.status,
    service: 'Tide BT Admin Backend',
    database: status,
    metrics: {
      uptime: metrics.uptimeFormatted,
      totalRequests: metrics.totalRequests,
      successRate: metrics.successRate
    }
  });
});

const PORT = process.env.PORT || 5001;

if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`🚀 Tide BT Admin Backend running on port ${PORT}`);
  });
}

module.exports = app;

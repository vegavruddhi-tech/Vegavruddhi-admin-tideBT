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
  if (isConnected && mongoose.connection.readyState === 1) return mongoose.connection.db;
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    isConnected = true;
    connectionManager.setMongooseConnection(mongoose.connection);
    return mongoose.connection.db;
  } catch (err) {
    isConnected = false;
    console.error('❌ MongoDB Connection Error:', err.message);
    throw err;
  }
}

// Single fast middleware to attach db to req
app.use(async (req, res, next) => {
  try {
    const db = await connectDB();
    req.db = db;
    next();
  } catch (err) {
    return res.status(503).json({
      success: false,
      error: 'Database connection unavailable',
      message: err.message
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

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'Tide BT Admin Backend',
    message: 'Tide BT Admin Backend API is running successfully!'
  });
});

// Health check
app.get('/health', async (req, res) => {
  try {
    await connectDB();
  } catch (e) {}
  const status = connectionManager.getStatus();
  const metrics = connectionManager.getMetrics();
  
  res.json({ 
    status: isConnected ? 'healthy' : status.status,
    service: 'Tide BT Admin Backend',
    database: {
      ...status,
      status: isConnected ? 'healthy' : 'unhealthy',
      ready: isConnected || status.ready
    },
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

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

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log('✅ MongoDB Connected - Tide BT Admin Backend');
  // Register mongoose connection with ConnectionManager
  connectionManager.setMongooseConnection(mongoose.connection);
})
.catch(err => console.error('❌ MongoDB Connection Error:', err));

// Middleware to ensure ConnectionManager is initialized and attach db to req
app.use(async (req, res, next) => {
  try {
    // Lazy initialize ConnectionManager on first request
    await connectionManager.ensureInitialized();
    
    // Attach database connection to request object
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
app.listen(PORT, () => {
  console.log(`🚀 Tide BT Admin Backend running on port ${PORT}`);
});

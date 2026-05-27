/**
 * Enhanced MongoDB Connection Manager with Lazy Initialization
 * 
 * This class provides intelligent connection management with:
 * - Lazy initialization (Vercel serverless compatible)
 * - Singleton pattern
 * - Health monitoring
 * - Circuit breaker pattern
 * - Automatic recovery
 * - Performance metrics
 * - Error handling
 * 
 * @class ConnectionManager
 */

class ConnectionManager {
  // Singleton instance
  static instance = null;
  
  constructor(options = {}) {
    // Connection state
    this.connection = null;
    this.isReady = false;
    this.isInitialized = false;
    this.initializationPromise = null;
    this.mongooseConnection = null;
    
    // Circuit breaker state
    this.failureCount = 0;
    this.lastFailure = null;
    this.circuitOpen = false;
    this.circuitTimeout = options.circuitTimeout || 60000;
    this.maxFailures = options.maxFailures || 5;
    
    // Environment configuration
    this.isDevelopment = process.env.NODE_ENV !== 'production';
    
    // Configuration options
    this.options = {
      retryAttempts: this.isDevelopment ? 3 : 10,
      retryDelay: this.isDevelopment ? 1000 : 5000,
      healthCheckInterval: options.healthCheckInterval || 30000,
      connectionTimeout: options.connectionTimeout || 10000,
      ...options
    };
    
    // Performance metrics
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      lastRequestTime: null,
      startTime: Date.now(),
      connectionAttempts: 0,
      lastHealthCheck: null,
      responseTimes: []
    };
    
    // Health monitoring
    this.healthCheckTimer = null;
    
    console.log('🔧 ConnectionManager created (Tide BT Admin)');
  }

  static getInstance(options = {}) {
    if (!ConnectionManager.instance) {
      ConnectionManager.instance = new ConnectionManager(options);
    }
    return ConnectionManager.instance;
  }

  setMongooseConnection(mongooseConnection) {
    this.mongooseConnection = mongooseConnection;
    console.log('🔗 Mongoose connection registered for lazy initialization');
  }

  async ensureInitialized() {
    if (this.isInitialized && this.isReady) {
      return true;
    }

    if (this.initializationPromise) {
      console.log('⏳ Waiting for ongoing initialization...');
      return await this.initializationPromise;
    }

    this.initializationPromise = this._performInitialization();
    
    try {
      const result = await this.initializationPromise;
      return result;
    } finally {
      this.initializationPromise = null;
    }
  }

  async _performInitialization() {
    try {
      console.log('🚀 Lazy initializing ConnectionManager...');
      
      if (!this.mongooseConnection) {
        throw new Error('Mongoose connection not set. Call setMongooseConnection() first.');
      }
      
      await this.waitForMongooseConnection(this.mongooseConnection);
      
      this.connection = this.mongooseConnection.db;
      this.isReady = true;
      this.isInitialized = true;
      this.metrics.connectionAttempts++;
      
      this.setupConnectionListeners(this.mongooseConnection);
      this.startHealthMonitoring();
      
      console.log('✅ ConnectionManager lazy initialized successfully');
      console.log(`📊 Database: ${this.mongooseConnection.name}`);
      console.log(`🔗 Host: ${this.mongooseConnection.host}`);
      
      return true;
    } catch (error) {
      console.error('❌ ConnectionManager lazy initialization failed:', error.message);
      this.recordFailure();
      this.isInitialized = false;
      this.isReady = false;
      throw error;
    }
  }

  async waitForMongooseConnection(mongooseConnection, timeout = this.options.connectionTimeout) {
    const start = Date.now();
    
    while (mongooseConnection.readyState !== 1 && (Date.now() - start) < timeout) {
      console.log(`⏳ Waiting for MongoDB connection... (${mongooseConnection.readyState})`);
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    if (mongooseConnection.readyState !== 1) {
      throw new Error(`MongoDB connection timeout after ${timeout}ms. ReadyState: ${mongooseConnection.readyState}`);
    }
  }

  setupConnectionListeners(mongooseConnection) {
    mongooseConnection.on('connected', () => {
      console.log('✅ MongoDB connected');
      this.isReady = true;
      this.resetCircuitBreaker();
    });

    mongooseConnection.on('disconnected', () => {
      console.log('⚠️ MongoDB disconnected');
      this.isReady = false;
    });

    mongooseConnection.on('reconnected', () => {
      console.log('🔄 MongoDB reconnected');
      this.isReady = true;
      this.resetCircuitBreaker();
    });

    mongooseConnection.on('error', (error) => {
      console.error('🔴 MongoDB connection error:', error.message);
      this.isReady = false;
      this.recordFailure();
    });

    mongooseConnection.on('close', () => {
      console.log('🔒 MongoDB connection closed');
      this.isReady = false;
    });
  }

  getConnection() {
    const startTime = Date.now();
    this.metrics.totalRequests++;
    this.metrics.lastRequestTime = startTime;

    try {
      if (!this.isInitialized) {
        throw new Error('ConnectionManager not initialized. Middleware will call ensureInitialized() first.');
      }

      if (this.circuitOpen) {
        if (Date.now() - this.lastFailure > this.circuitTimeout) {
          console.log('🔄 Circuit breaker reset - attempting reconnection');
          this.resetCircuitBreaker();
        } else {
          const timeLeft = Math.ceil((this.circuitTimeout - (Date.now() - this.lastFailure)) / 1000);
          throw new Error(`Circuit breaker open. Database unavailable for ${timeLeft} more seconds.`);
        }
      }

      if (!this.isReady || !this.connection) {
        this.recordFailure();
        throw new Error('Database connection not ready. Please try again in a moment.');
      }

      this.metrics.successfulRequests++;
      this.updateResponseTime(Date.now() - startTime);
      
      return this.connection;
    } catch (error) {
      this.metrics.failedRequests++;
      throw error;
    }
  }

  getCollection(collectionName) {
    if (!collectionName) {
      throw new Error('Collection name is required');
    }
    
    const db = this.getConnection();
    return db.collection(collectionName);
  }

  isConnected() {
    return this.isReady && this.connection && !this.circuitOpen;
  }

  async performHealthCheck() {
    try {
      if (!this.connection) {
        return { healthy: false, error: 'No connection available' };
      }

      const startTime = Date.now();
      await this.connection.admin().ping();
      const responseTime = Date.now() - startTime;

      this.metrics.lastHealthCheck = Date.now();

      return {
        healthy: true,
        responseTime,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('🔴 Health check failed:', error.message);
      this.recordFailure();
      
      return {
        healthy: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  startHealthMonitoring() {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }

    this.healthCheckTimer = setInterval(async () => {
      const health = await this.performHealthCheck();
      if (!health.healthy) {
        console.log(`⚠️ Health check failed: ${health.error}`);
        this.isReady = false;
      }
    }, this.options.healthCheckInterval);

    console.log(`💓 Health monitoring started (every ${this.options.healthCheckInterval / 1000}s)`);
  }

  stopHealthMonitoring() {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
      console.log('💓 Health monitoring stopped');
    }
  }

  recordFailure() {
    this.failureCount++;
    this.lastFailure = Date.now();
    
    if (this.failureCount >= this.maxFailures && !this.circuitOpen) {
      this.circuitOpen = true;
      console.log(`🔴 Circuit breaker opened after ${this.failureCount} failures`);
      console.log(`⏰ Will retry in ${this.circuitTimeout / 1000} seconds`);
    }
  }

  resetCircuitBreaker() {
    if (this.circuitOpen || this.failureCount > 0) {
      console.log('✅ Circuit breaker reset - connection restored');
    }
    this.failureCount = 0;
    this.lastFailure = null;
    this.circuitOpen = false;
  }

  updateResponseTime(responseTime) {
    this.metrics.responseTimes.push(responseTime);
    
    if (this.metrics.responseTimes.length > 100) {
      this.metrics.responseTimes.shift();
    }
    
    this.metrics.averageResponseTime = 
      this.metrics.responseTimes.reduce((sum, time) => sum + time, 0) / 
      this.metrics.responseTimes.length;
  }

  getMetrics() {
    const uptime = Date.now() - this.metrics.startTime;
    const successRate = this.metrics.totalRequests > 0 
      ? (this.metrics.successfulRequests / this.metrics.totalRequests) * 100 
      : 0;

    return {
      isReady: this.isReady,
      isInitialized: this.isInitialized,
      circuitOpen: this.circuitOpen,
      totalRequests: this.metrics.totalRequests,
      successfulRequests: this.metrics.successfulRequests,
      failedRequests: this.metrics.failedRequests,
      successRate: Math.round(successRate * 100) / 100,
      averageResponseTime: Math.round(this.metrics.averageResponseTime * 100) / 100,
      uptime,
      uptimeFormatted: this.formatUptime(uptime),
      lastRequestTime: this.metrics.lastRequestTime,
      lastHealthCheck: this.metrics.lastHealthCheck,
      failureCount: this.failureCount,
      lastFailure: this.lastFailure,
      circuitTimeout: this.circuitTimeout,
      environment: process.env.NODE_ENV || 'development',
      connectionAttempts: this.metrics.connectionAttempts
    };
  }

  formatUptime(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
    if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }

  resetMetrics() {
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      lastRequestTime: null,
      startTime: Date.now(),
      connectionAttempts: this.metrics.connectionAttempts,
      lastHealthCheck: null,
      responseTimes: []
    };
    console.log('📊 Metrics reset');
  }

  async shutdown() {
    console.log('🛑 ConnectionManager shutting down...');
    this.stopHealthMonitoring();
    this.isReady = false;
    this.isInitialized = false;
    this.connection = null;
    console.log('✅ ConnectionManager shutdown complete');
  }

  getStatus() {
    return {
      status: this.isConnected() ? 'healthy' : 'unhealthy',
      ready: this.isReady,
      initialized: this.isInitialized,
      circuitOpen: this.circuitOpen,
      failureCount: this.failureCount,
      lastFailure: this.lastFailure,
      uptime: this.formatUptime(Date.now() - this.metrics.startTime),
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = ConnectionManager;

/**
 * SentinelPharma Server Entry Point
 * ==============================
 * Express.js server orchestrating the SentinelPharma platform.
 * Acts as API gateway between React frontend and Python AI Engine.
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const { logger } = require('./utils/logger');
const researchRoutes = require('./routes/researchRoutes');
const watchlistRoutes = require('./routes/watchlist');
const archivalRoutes = require('./routes/archivalRoutes');
const { createRateLimiter, dynamicRateLimiter } = require('./utils/rateLimiter');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3001;

// ======================
// MIDDLEWARE CONFIGURATION
// ======================

// Security headers
app.use(helmet());

// CORS configuration - allow multiple frontend ports for development
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  process.env.CLIENT_URL
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID']
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// HTTP request logging
app.use(morgan('combined', {
  stream: {
    write: (message) => logger.info(message.trim())
  }
}));

// Rate limiting
app.use('/api/', dynamicRateLimiter);

// ======================
// API ROUTES
// ======================

// Root endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    service: 'sentinelpharma-server',
    message: 'SentinelPharma API Gateway is running',
    endpoints: {
      health: '/health',
      research: '/api/research',
      watchlist: '/api/watchlist',
      archive: '/api/archive'
    }
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'sentinelpharma-server',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Research API routes
app.use('/api/research', researchRoutes);

// Watchlist API routes
app.use('/api/watchlist', watchlistRoutes);

// Archival/Report History API routes
app.use('/api/archive', archivalRoutes);

// ======================
// ERROR HANDLING
// ======================

// 404 handler
app.use((req, res) => {
  logger.warn(`Route not found: ${req.method} ${req.path}`);
  res.status(404).json({
    success: false,
    error: 'Route not found',
    path: req.path
  });
});

// Global error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method
  });

  res.status(err.status || 500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message
  });
});

// ======================
// SERVER STARTUP
// ======================

app.listen(PORT, () => {
  logger.info(`🚀 SentinelPharma Server running on port ${PORT}`);
  logger.info(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`🔗 AI Engine URL: ${process.env.AI_ENGINE_URL || 'http://localhost:8000'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

module.exports = app;

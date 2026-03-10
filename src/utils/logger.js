const config = require('../config');

/**
 * Simple logger utility
 * In production, this could be replaced with winston or pino
 */
const logger = {
  info: (message, meta = {}) => {
    if (config.env !== 'test') {
      console.log(`[INFO] ${new Date().toISOString()} - ${message}`, meta);
    }
  },
  
  error: (message, meta = {}) => {
    console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, meta);
  },
  
  warn: (message, meta = {}) => {
    if (config.env !== 'test') {
      console.warn(`[WARN] ${new Date().toISOString()} - ${message}`, meta);
    }
  },
  
  debug: (message, meta = {}) => {
    if (config.env === 'development') {
      console.log(`[DEBUG] ${new Date().toISOString()} - ${message}`, meta);
    }
  },
};

module.exports = logger;

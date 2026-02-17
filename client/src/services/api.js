/**
 * SentinelPharma API Service
 * =======================
 * Axios configuration and API methods for communicating with the backend.
 */

import axios from 'axios';

// API Base URL
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Create axios instance with default configuration
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 300000, // 5 minute timeout for comprehensive AI analysis
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor - add auth token, logging, etc.
apiClient.interceptors.request.use(
  (config) => {
    // Add request timestamp for tracking
    config.metadata = { startTime: new Date() };
    
    // Log request in development
    if (import.meta.env.DEV) {
      console.log(`📤 API Request: ${config.method?.toUpperCase()} ${config.url}`);
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - handle errors, logging, etc.
apiClient.interceptors.response.use(
  (response) => {
    // Calculate request duration
    const duration = new Date() - response.config.metadata.startTime;
    
    // Log response in development
    if (import.meta.env.DEV) {
      console.log(`📥 API Response: ${response.status} (${duration}ms)`);
    }
    
    return response;
  },
  (error) => {
    // Log error details
    console.error('API Error:', error.message);
    
    // Handle specific error codes
    if (error.response?.status === 401) {
      // Handle unauthorized - redirect to login, etc.
      console.warn('Unauthorized access');
    }
    
    return Promise.reject(error);
  }
);

/**
 * Research Service
 * Handles all research-related API calls
 */
export const researchService = {
  /**
   * Analyze a drug/molecule for repurposing opportunities
   * @param {string} molecule - Name of the drug/compound
   * @param {string} mode - Processing mode ('secure' or 'cloud')
  * @param {string} provider - AI model provider ('ollama', 'gemini')
   * @returns {Promise} API response with analysis results
   */
  analyze: async (molecule, mode = 'cloud', provider = null) => {
    return apiClient.post('/api/research', {
      molecule,
      mode,
      provider
    });
  },
  
  /**
   * Get status of a research request
   * @param {string} requestId - Unique request identifier
   * @returns {Promise} API response with status
   */
  getStatus: async (requestId) => {
    return apiClient.get(`/api/research/${requestId}`);
  },
  
  /**
   * Health check for research service
   * @returns {Promise} API response with health status
   */
  healthCheck: async () => {
    return apiClient.get('/api/research/health');
  }
};

/**
 * Health Service
 * General API health checks
 */
export const healthService = {
  /**
   * Check overall API health
   * @returns {Promise} API response with health status
   */
  check: async () => {
    return apiClient.get('/health');
  }
};

export default apiClient;

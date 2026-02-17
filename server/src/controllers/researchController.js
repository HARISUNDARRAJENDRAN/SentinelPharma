/**
 * SentinelPharma Research Controller
 * ================================
 * Orchestrates multi-agent research requests.
 * Acts as the central coordinator between the frontend and AI Engine.
 * 
 * Responsibilities:
 * - Validate incoming research requests
 * - Route to appropriate processing mode (secure/cloud)
 * - Communicate with Python AI Engine
 * - Aggregate and return results
 * - Maintain audit trails
 */

const { v4: uuidv4 } = require('uuid');
const { logger, auditLog } = require('../utils/logger');
const aiEngineService = require('../services/aiEngineService');

/**
 * Process a drug repurposing research request
 * 
 * @route POST /api/research
 * @param {Object} req.body.molecule - Drug/molecule name to analyze
 * @param {string} req.body.mode - Processing mode: 'secure' (local) or 'cloud' (Gemini)
 * @returns {Object} Research results including ROI calculations
 */
const processResearch = async (req, res) => {
  const requestId = uuidv4();
  const startTime = Date.now();

  try {
    const { molecule, mode = 'cloud', provider = null } = req.body;

    // Validate required fields
    if (!molecule || typeof molecule !== 'string') {
      logger.warn('Invalid research request - missing molecule', { requestId });
      return res.status(400).json({
        success: false,
        error: 'Molecule name is required',
        requestId
      });
    }

    // Validate mode
    const validModes = ['secure', 'cloud'];
    if (!validModes.includes(mode)) {
      logger.warn('Invalid processing mode specified', { requestId, mode });
      return res.status(400).json({
        success: false,
        error: `Invalid mode. Must be one of: ${validModes.join(', ')}`,
        requestId
      });
    }

    // Log research initiation
    auditLog.researchStarted(molecule, mode, requestId);

    // Log processing mode and provider for compliance
    auditLog.processingMode(mode, requestId);
    if (provider) {
      logger.info('AI provider specified', { provider, requestId });
    }

    // Determine which AI endpoint to use based on mode
    const aiConfig = {
      secure: {
        endpoint: '/api/analyze/local',
        model: 'llama3-local',
        description: 'Local Secure Mode - Data never leaves premises'
      },
      cloud: {
        endpoint: '/api/analyze/cloud',
        model: 'gemini-2.0-flash-exp',
        description: 'Cloud Mode - Using Google Gemini'
      }
    };

    const config = aiConfig[mode];
    logger.info(`Using AI configuration: ${config.description}`, { requestId });

    // Call Python AI Engine for analysis
    auditLog.agentActivity('Orchestrator', 'DISPATCHING_AGENTS', { 
      molecule, 
      mode,
      provider,
      requestId 
    });

    // Execute multi-agent analysis
    const analysisResults = await aiEngineService.analyzeCompound({
      molecule,
      mode,
      requestId,
      agents: ['clinical', 'patent', 'iqvia', 'vision', 'exim', 'web_intelligence', 'internal_knowledge', 'regulatory', 'patient_sentiment'],
      provider
    });

    // Calculate request duration
    const duration = Date.now() - startTime;

    // Log successful response
    auditLog.apiResponse(requestId, 200, duration);

    // Return aggregated results
    return res.status(200).json({
      success: true,
      requestId,
      molecule,
      processingMode: mode,
      modelUsed: config.model,
      results: {
        ...analysisResults,
        processingTimeMs: duration
      },
      metadata: {
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        complianceMode: mode === 'secure' ? 'HIPAA_COMPLIANT' : 'STANDARD'
      }
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    
    // Log error details
    logger.error('Research processing failed', {
      requestId,
      error: error.message,
      stack: error.stack,
      duration
    });

    auditLog.apiResponse(requestId, 500, duration);

    return res.status(500).json({
      success: false,
      error: 'Research processing failed',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
      requestId
    });
  }
};

/**
 * Get research status by request ID
 * 
 * @route GET /api/research/:requestId
 * @param {string} req.params.requestId - Unique request identifier
 * @returns {Object} Current status of the research request
 */
const getResearchStatus = async (req, res) => {
  const { requestId } = req.params;

  try {
    logger.info('Status check requested', { requestId });

    // In a production system, this would query a database or cache
    // For now, return a mock status
    return res.status(200).json({
      success: true,
      requestId,
      status: 'completed',
      message: 'Research analysis complete'
    });

  } catch (error) {
    logger.error('Status check failed', { requestId, error: error.message });
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve status'
    });
  }
};

/**
 * Health check for the research service
 * 
 * @route GET /api/research/health
 * @returns {Object} Service health status
 */
const healthCheck = async (req, res) => {
  try {
    // Check AI Engine connectivity
    const aiHealth = await aiEngineService.checkHealth();

    return res.status(200).json({
      success: true,
      service: 'research-controller',
      status: 'healthy',
      dependencies: {
        aiEngine: aiHealth ? 'connected' : 'disconnected'
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Health check failed', { error: error.message });
    return res.status(503).json({
      success: false,
      status: 'unhealthy',
      error: error.message
    });
  }
};

module.exports = {
  processResearch,
  getResearchStatus,
  healthCheck
};

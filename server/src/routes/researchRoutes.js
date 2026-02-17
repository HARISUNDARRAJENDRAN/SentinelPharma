/**
 * SentinelPharma Research Routes
 * ===========================
 * API routes for drug repurposing research operations.
 */

const express = require('express');
const { body, param } = require('express-validator');
const router = express.Router();

const {
  processResearch,
  getResearchStatus,
  healthCheck
} = require('../controllers/researchController');

/**
 * Validation middleware for research requests
 */
const validateResearchRequest = [
  body('molecule')
    .trim()
    .notEmpty()
    .withMessage('Molecule name is required')
    .isLength({ min: 2, max: 200 })
    .withMessage('Molecule name must be between 2 and 200 characters'),
  body('mode')
    .optional()
    .isIn(['secure', 'cloud'])
    .withMessage('Mode must be either "secure" or "cloud"')
];

const validateRequestId = [
  param('requestId')
    .isUUID(4)
    .withMessage('Invalid request ID format')
];

/**
 * @route   POST /api/research
 * @desc    Process a drug repurposing research request
 * @access  Public (should be protected in production)
 */
router.post('/', validateResearchRequest, processResearch);

/**
 * @route   GET /api/research/health
 * @desc    Health check for research service
 * @access  Public
 */
router.get('/health', healthCheck);

/**
 * @route   GET /api/research/:requestId
 * @desc    Get status of a research request
 * @access  Public (should be protected in production)
 */
router.get('/:requestId', validateRequestId, getResearchStatus);

module.exports = router;

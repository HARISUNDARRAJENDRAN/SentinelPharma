/**
 * SentinelPharma Watchlist Routes
 * ===========================
 * API endpoints for Watch & Alert functionality.
 * 
 * Endpoints:
 * - GET    /api/watchlist          - Get user's watchlist
 * - POST   /api/watchlist          - Add molecule to watchlist
 * - DELETE /api/watchlist/:id      - Remove from watchlist
 * - PUT    /api/watchlist/:id      - Update alert preferences
 * - GET    /api/watchlist/alerts   - Get pending alerts
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { logger } = require('../utils/logger');

const router = express.Router();

// In-memory storage (replace with MongoDB in production)
let watchlistItems = [];

/**
 * @route   GET /api/watchlist
 * @desc    Get all watchlist items for a user
 * @access  Private (would require auth in production)
 */
router.get('/', (req, res) => {
    const userId = req.headers['x-user-id'] || 'demo-user';
    
    logger.info('Fetching watchlist', { userId });
    
    const userWatchlist = watchlistItems.filter(item => item.userId === userId);
    
    res.json({
        success: true,
        data: userWatchlist,
        count: userWatchlist.length
    });
});

/**
 * @route   POST /api/watchlist
 * @desc    Add a molecule to the watchlist
 * @access  Private
 */
router.post('/', (req, res) => {
    const userId = req.headers['x-user-id'] || 'demo-user';
    const { molecule, disease, alertPreferences } = req.body;
    
    // Validation
    if (!molecule) {
        return res.status(400).json({
            success: false,
            error: 'Molecule name is required'
        });
    }
    
    // Check for duplicates
    const existing = watchlistItems.find(
        item => item.userId === userId && 
                item.molecule.toLowerCase() === molecule.toLowerCase()
    );
    
    if (existing) {
        return res.status(409).json({
            success: false,
            error: 'Molecule already in watchlist'
        });
    }
    
    const newItem = {
        id: uuidv4(),
        userId,
        molecule,
        disease: disease || null,
        alertPreferences: alertPreferences || {
            clinicalTrials: true,
            patents: true,
            publications: true,
            regulatory: true,
            frequency: 'daily'
        },
        createdAt: new Date().toISOString(),
        lastChecked: null,
        alertCount: 0
    };
    
    watchlistItems.push(newItem);
    
    logger.info('Added to watchlist', { userId, molecule, itemId: newItem.id });
    
    res.status(201).json({
        success: true,
        data: newItem
    });
});

/**
 * @route   DELETE /api/watchlist/:id
 * @desc    Remove a molecule from watchlist
 * @access  Private
 */
router.delete('/:id', (req, res) => {
    const userId = req.headers['x-user-id'] || 'demo-user';
    const { id } = req.params;
    
    const itemIndex = watchlistItems.findIndex(
        item => item.id === id && item.userId === userId
    );
    
    if (itemIndex === -1) {
        return res.status(404).json({
            success: false,
            error: 'Watchlist item not found'
        });
    }
    
    const removed = watchlistItems.splice(itemIndex, 1)[0];
    
    logger.info('Removed from watchlist', { userId, itemId: id, molecule: removed.molecule });
    
    res.json({
        success: true,
        message: 'Item removed from watchlist'
    });
});

/**
 * @route   PUT /api/watchlist/:id
 * @desc    Update alert preferences for a watchlist item
 * @access  Private
 */
router.put('/:id', (req, res) => {
    const userId = req.headers['x-user-id'] || 'demo-user';
    const { id } = req.params;
    const { alertPreferences, disease } = req.body;
    
    const item = watchlistItems.find(
        item => item.id === id && item.userId === userId
    );
    
    if (!item) {
        return res.status(404).json({
            success: false,
            error: 'Watchlist item not found'
        });
    }
    
    // Update fields
    if (alertPreferences) {
        item.alertPreferences = { ...item.alertPreferences, ...alertPreferences };
    }
    if (disease !== undefined) {
        item.disease = disease;
    }
    item.updatedAt = new Date().toISOString();
    
    logger.info('Updated watchlist item', { userId, itemId: id });
    
    res.json({
        success: true,
        data: item
    });
});

/**
 * @route   GET /api/watchlist/alerts
 * @desc    Get pending alerts for user's watchlist
 * @access  Private
 */
router.get('/alerts', (req, res) => {
    const userId = req.headers['x-user-id'] || 'demo-user';
    
    // Simulated alerts (in production, this would query real data sources)
    const userWatchlist = watchlistItems.filter(item => item.userId === userId);
    
    const alerts = userWatchlist.flatMap(item => {
        const mockAlerts = [];
        
        // Generate some mock alerts based on preferences
        if (item.alertPreferences.clinicalTrials && Math.random() > 0.5) {
            mockAlerts.push({
                id: uuidv4(),
                watchlistItemId: item.id,
                molecule: item.molecule,
                type: 'clinical_trial',
                title: `New Phase 2 trial for ${item.molecule}`,
                description: `A new clinical trial has been registered studying ${item.molecule} for ${item.disease || 'various indications'}`,
                source: 'ClinicalTrials.gov',
                sourceUrl: `https://clinicaltrials.gov/search?term=${encodeURIComponent(item.molecule)}`,
                createdAt: new Date().toISOString(),
                read: false
            });
        }
        
        if (item.alertPreferences.patents && Math.random() > 0.6) {
            mockAlerts.push({
                id: uuidv4(),
                watchlistItemId: item.id,
                molecule: item.molecule,
                type: 'patent',
                title: `Patent application filed for ${item.molecule} analog`,
                description: `New patent application related to ${item.molecule} derivatives`,
                source: 'USPTO',
                sourceUrl: `https://patents.google.com/?q=${encodeURIComponent(item.molecule)}`,
                createdAt: new Date().toISOString(),
                read: false
            });
        }
        
        if (item.alertPreferences.publications && Math.random() > 0.4) {
            mockAlerts.push({
                id: uuidv4(),
                watchlistItemId: item.id,
                molecule: item.molecule,
                type: 'publication',
                title: `New research published on ${item.molecule}`,
                description: `Recent study explores novel mechanisms of ${item.molecule}`,
                source: 'PubMed',
                sourceUrl: `https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(item.molecule)}`,
                createdAt: new Date().toISOString(),
                read: false
            });
        }
        
        return mockAlerts;
    });
    
    logger.info('Fetching alerts', { userId, alertCount: alerts.length });
    
    res.json({
        success: true,
        data: alerts,
        count: alerts.length
    });
});

/**
 * @route   POST /api/watchlist/alerts/:id/read
 * @desc    Mark an alert as read
 * @access  Private
 */
router.post('/alerts/:id/read', (req, res) => {
    // In production, this would update the alert status in the database
    res.json({
        success: true,
        message: 'Alert marked as read'
    });
});

module.exports = router;

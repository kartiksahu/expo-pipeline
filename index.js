// Minimal server for Vercel deployment
const express = require('express');
const path = require('path');

const app = express();

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        message: 'Expo Pipeline is running'
    });
});

// Serve static files
app.use(express.static('public'));

// API status endpoint
app.get('/api/status', (req, res) => {
    res.json({
        message: 'Expo Pipeline API',
        version: '1.0.0',
        status: 'ready'
    });
});

// Fallback to index.html for SPA
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

module.exports = app;
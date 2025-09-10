const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

// Import our modular components
const db = require('./src/config/database');
const { userAuthMiddleware } = require('./src/middleware/auth');
const SocketService = require('./src/services/socketService');

// Import routes
const userRoutes = require('./src/routes/users');
const friendRoutes = require('./src/routes/friends');
const callRoutes = require('./src/routes/calls');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Health check (no auth required)
app.get('/health', (req, res) => {
    console.log('💚 Health check called');
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        server: 'R1-Walky Backend',
        version: '1.0.0'
    });
});

// Test connectivity endpoint (no auth required)
app.get('/api/test', (req, res) => {
    console.log('🧪 Test endpoint called');
    res.json({
        message: 'Backend is reachable!',
        timestamp: new Date().toISOString(),
        headers: req.headers
    });
});

// Get TURN server configuration
app.get('/api/turn-servers', (req, res) => {
    // Return TURN server configuration optimized for Cloudflare tunnel
    const turnServers = [
        // Cloudflare TURN servers (primary for tunnel compatibility)
        {
            urls: 'turn:turn.cloudflare.com:3478',
            username: 'webrtc',
            credential: 'webrtc'
        },
        {
            urls: 'turn:turn.cloudflare.com:3478?transport=tcp',
            username: 'webrtc',
            credential: 'webrtc'
        },
        // High-reliability TURN servers for restrictive networks
        {
            urls: 'turn:openrelay.metered.ca:80',
            username: 'openrelayproject',
            credential: 'openrelayproject'
        },
        {
            urls: 'turn:openrelay.metered.ca:443',
            username: 'openrelayproject',
            credential: 'openrelayproject'
        },
        {
            urls: 'turn:openrelay.metered.ca:443?transport=tcp',
            username: 'openrelayproject',
            credential: 'openrelayproject'
        },
        // Alternative TURN servers with TCP transport (better for tunnels)
        {
            urls: 'turn:turn.anyfirewall.com:443?transport=tcp',
            username: 'webrtc',
            credential: 'webrtc'
        },
        {
            urls: 'turn:turn1.xirsys.com:443?transport=tcp',
            username: 'webrtc',
            credential: 'webrtc'
        },
        {
            urls: 'turn:turn.numb.viagenie.ca:443?transport=tcp',
            username: 'webrtc@live.com',
            credential: 'muazkh'
        },
        // UDP TURN servers as fallback
        {
            urls: 'turn:turn.quickblox.com:3478',
            username: 'quickblox',
            credential: 'quickblox'
        },
        {
            urls: 'turn:turn.ekiga.net:3478',
            username: 'ekiga',
            credential: 'ekiga'
        }
    ];

    res.json({
        iceServers: [
            // STUN servers for direct P2P connection
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:stun3.l.google.com:19302' },
            { urls: 'stun:stun4.l.google.com:19302' },
            // TURN servers for relay when P2P fails
            ...turnServers
        ]
    });
});

// Device verification (no auth required)
app.post('/api/auth/verify-device', (req, res) => {
    const { deviceId, verificationCode } = req.body;

    // Check if verification code matches FF4D06
    if (!verificationCode || verificationCode !== 'FF4D06') {
        return res.status(403).json({
            error: 'Invalid device verification code',
            message: 'This does not appear to be a genuine R1 device'
        });
    }

    if (!deviceId) {
        return res.status(400).json({ error: 'Device ID required' });
    }

    // Log verification attempt
    console.log(`Device verification attempt: ${deviceId} with code ${verificationCode}`);

    res.json({
        verified: true,
        deviceId: deviceId,
        message: 'R1 device verified successfully'
    });
});

// Make io available to routes first
app.use('/api', (req, res, next) => {
    req.io = io;
    next();
});

// Apply auth middleware to all /api routes
app.use('/api', userAuthMiddleware);

// Mount routes
app.use('/api', userRoutes);
app.use('/api', friendRoutes);
app.use('/api', callRoutes);

// Serve static files from React build directory (after API routes)
app.use(express.static(path.join(__dirname, '../frontend-new/dist')));

// Serve the main HTML file for all other routes (SPA fallback)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend-new/dist/index.html'));
});

// Initialize database and start server
async function startServer() {
    try {
        // Initialize database
        await db.init();

        // Initialize socket service
        const socketService = new SocketService(io);

        // Start server
        server.listen(PORT, () => {
            console.log(`🚀 R1-Walky backend server running on port ${PORT}`);
            console.log(`📡 WebSocket service initialized`);
            console.log(`🗄️  Database initialized`);
        });
    } catch (err) {
        console.error('❌ Failed to start server:', err);
        process.exit(1);
    }
}

// Handle graceful shutdown
let isShuttingDown = false;

process.on('SIGINT', () => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log('🛑 Received SIGINT, shutting down gracefully...');
    db.close();
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});

process.on('SIGTERM', () => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log('🛑 Received SIGTERM, shutting down gracefully...');
    db.close();
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});

startServer();

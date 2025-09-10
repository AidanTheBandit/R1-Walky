const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const { getCurrentUser } = require('../middleware/auth');

const router = express.Router();

// User registration (no auth required)
router.post('/users', async (req, res) => {
    console.log('👤 POST /api/users called');
    console.log('Request body:', JSON.stringify(req.body, null, 2));

    const { username, deviceId } = req.body;

    if (!username || !deviceId) {
        console.log('❌ Missing username or deviceId');
        return res.status(400).json({ error: 'Username and deviceId required' });
    }

    const userId = uuidv4();

    try {
        const user = await db.createUser(userId, username, deviceId);
        console.log('✅ User created successfully:', username, '(ID:', userId + ')');
        res.json({
            id: userId,
            username: username,
            deviceId: deviceId
        });
    } catch (err) {
        console.log('❌ Database error creating user:', err.message);
        if (err.message.includes('UNIQUE constraint failed')) {
            return res.status(409).json({ error: 'Username already exists' });
        }
        return res.status(500).json({ error: 'Database error' });
    }
});

// Get current user
router.get('/users/me', (req, res) => {
    console.log('🔍 GET /api/users/me called');
    console.log('Headers:', JSON.stringify(req.headers, null, 2));
    console.log('X-User-ID:', req.headers['x-user-id']);

    getCurrentUser(req, res, (user) => {
        console.log('✅ User found:', user.username, '(ID:', user.id + ')');
        res.json({
            id: user.id,
            username: user.username,
            deviceId: user.device_id
        });
    });
});

// Search users
router.get('/users/search', (req, res) => {
    const { username } = req.query;

    if (!username) {
        return res.status(400).json({ error: 'Username query required' });
    }

    getCurrentUser(req, res, async (currentUser) => {
        try {
            const users = await db.searchUsers(username, currentUser.id);
            res.json({ users });
        } catch (err) {
            console.error('Database error searching users:', err);
            return res.status(500).json({ error: 'Database error' });
        }
    });
});

module.exports = router;

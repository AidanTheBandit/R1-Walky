const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const { getCurrentUser } = require('../middleware/auth');

const router = express.Router();

// WebRTC signaling - initiate call
router.post('/calls/initiate', (req, res) => {
    const { targetUsername, offer } = req.body;

    if (!targetUsername || !offer) {
        return res.status(400).json({ error: 'Target username and offer required' });
    }

    getCurrentUser(req, res, async (currentUser) => {
        console.log(`User ${currentUser.username} initiating call to: ${targetUsername}`);

        try {
            // Find target user (case-insensitive)
            const targetUser = await db.getUserByUsername(targetUsername);
            if (!targetUser) {
                console.error('Target user not found:', targetUsername);
                return res.status(404).json({ error: 'User not found' });
            }

            const callId = uuidv4();
            await db.createCall(callId, currentUser.id, targetUser.id);

            console.log(`Call initiated: ${currentUser.username} -> ${targetUsername} (ID: ${callId})`);

            // Emit to target user via socket
            req.io.to(targetUser.id).emit('incoming-call', {
                callId,
                caller: currentUser.id,
                callerUsername: currentUser.username,
                offer
            });

            res.json({
                callId,
                targetId: targetUser.id,
                status: 'initiated'
            });
        } catch (err) {
            console.error('Database error creating call:', err);
            return res.status(500).json({ error: 'Database error' });
        }
    });
});

// WebRTC signaling - retry call with new offer
router.post('/calls/retry', (req, res) => {
    const { callId, offer } = req.body;

    if (!callId || !offer) {
        return res.status(400).json({ error: 'Call ID and offer required' });
    }

    getCurrentUser(req, res, async (currentUser) => {
        console.log(`User ${currentUser.username} retrying call: ${callId}`);

        try {
            // Verify the call exists and user is part of it
            const call = await db.getCall(callId);
            if (!call || (call.caller_id !== currentUser.id && call.callee_id !== currentUser.id)) {
                console.error('Call not found for retry:', callId);
                return res.status(404).json({ error: 'Call not found' });
            }

            // Determine target user
            const targetId = call.caller_id === currentUser.id ? call.callee_id : call.caller_id;

            // Send retry offer to target user
            req.io.to(targetId).emit('call-retry', {
                callId,
                caller: currentUser.id,
                callerUsername: currentUser.username,
                offer
            });

            res.json({
                callId,
                targetId,
                status: 'retry-sent'
            });
        } catch (err) {
            console.error('Database error retrying call:', err);
            return res.status(500).json({ error: 'Database error' });
        }
    });
});

module.exports = router;

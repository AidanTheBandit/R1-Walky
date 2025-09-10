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

    // Support both WebRTC and server-mediated calls
    if (offer.type === 'server-mediated') {
        // Server-mediated call - no WebRTC validation needed
        console.log('Server-mediated call initiation');
    } else {
        // WebRTC call - validate offer structure
        if (!offer.type || !offer.sdp) {
            return res.status(400).json({ error: 'Invalid WebRTC offer - missing type or sdp' });
        }

        // Validate SDP type
        if (offer.type !== 'offer') {
            return res.status(400).json({ error: 'Invalid WebRTC offer type - must be "offer"' });
        }
    }

    getCurrentUser(req, res, async (currentUser) => {
        try {
            console.log(`User ${currentUser.username} initiating call to: ${targetUsername}`);

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
        try {
            console.log(`User ${currentUser.username} retrying call: ${callId}`);

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

// WebRTC signaling - answer call
router.post('/calls/answer', (req, res) => {
    const { callId, answer } = req.body;

    if (!callId || !answer) {
        return res.status(400).json({ error: 'Call ID and answer required' });
    }

    // Support both WebRTC and server-mediated calls
    if (answer.type === 'server-mediated') {
        // Server-mediated call - no WebRTC validation needed
        console.log('Server-mediated call answer');
    } else {
        // WebRTC call - validate answer structure
        if (!answer.type || !answer.sdp) {
            return res.status(400).json({ error: 'Invalid WebRTC answer - missing type or sdp' });
        }

        // Validate SDP type
        if (answer.type !== 'answer') {
            return res.status(400).json({ error: 'Invalid WebRTC answer type - must be "answer"' });
        }
    }

    getCurrentUser(req, res, async (currentUser) => {
        try {
            console.log(`User ${currentUser.username} answering call: ${callId}`);

            // Verify the call exists and user is the callee
            const call = await db.getCall(callId);
            if (!call || call.callee_id !== currentUser.id) {
                console.error('Call not found or unauthorized:', callId);
                return res.status(404).json({ error: 'Call not found' });
            }

            console.log(`Call answered: ${currentUser.username} answered call ${callId}`);

            // Update call status to connected
            await db.updateCall(callId, 'connected');

            // Emit to caller via socket
            req.io.to(call.caller_id).emit('call-answered', {
                callId,
                answerer: currentUser.id,
                answererUsername: currentUser.username,
                answer
            });

            res.json({
                callId,
                callerId: call.caller_id,
                status: 'answered'
            });
        } catch (err) {
            console.error('Database error answering call:', err);
            return res.status(500).json({ error: 'Database error' });
        }
    });
});

// WebRTC signaling - exchange ICE candidates
router.post('/calls/ice-candidate', (req, res) => {
    const { callId, candidate } = req.body;

    if (!callId || !candidate) {
        return res.status(400).json({ error: 'Call ID and ICE candidate required' });
    }

    getCurrentUser(req, res, async (currentUser) => {
        try {
            console.log(`User ${currentUser.username} sending ICE candidate for call: ${callId}`);

            // Verify the call exists and user is part of it
            const call = await db.getCall(callId);
            if (!call || (call.caller_id !== currentUser.id && call.callee_id !== currentUser.id)) {
                console.error('Call not found for ICE candidate:', callId);
                return res.status(404).json({ error: 'Call not found' });
            }

            // Determine target user (send to the other participant)
            const targetId = call.caller_id === currentUser.id ? call.callee_id : call.caller_id;

            // Send ICE candidate to the other user
            req.io.to(targetId).emit('ice-candidate', {
                callId,
                candidate,
                from: currentUser.id
            });

            res.json({ status: 'ice-candidate-sent' });
        } catch (err) {
            console.error('Database error sending ICE candidate:', err);
            return res.status(500).json({ error: 'Database error' });
        }
    });
});

// WebRTC signaling - end call
router.post('/calls/end', (req, res) => {
    const { callId } = req.body;

    if (!callId) {
        return res.status(400).json({ error: 'Call ID required' });
    }

    getCurrentUser(req, res, async (currentUser) => {
        try {
            console.log(`User ${currentUser.username} ending call: ${callId}`);

            // Get call details before ending
            const call = await db.getCall(callId);
            if (!call || (call.caller_id !== currentUser.id && call.callee_id !== currentUser.id)) {
                console.error('Call not found for ending:', callId);
                return res.status(404).json({ error: 'Call not found' });
            }

            // End the call in database
            const ended = await db.endCall(callId);
            if (!ended) {
                return res.status(404).json({ error: 'Call not found' });
            }

            console.log(`Call ended: ${currentUser.username} ended call ${callId}`);

            // Determine target user (notify the other participant)
            const targetId = call.caller_id === currentUser.id ? call.callee_id : call.caller_id;

            // Emit to other user via socket
            req.io.to(targetId).emit('call-ended', {
                callId,
                endedBy: currentUser.id,
                endedByUsername: currentUser.username
            });

            res.json({
                callId,
                status: 'ended'
            });
        } catch (err) {
            console.error('Database error ending call:', err);
            return res.status(500).json({ error: 'Database error' });
        }
    });
});

// Audio streaming - start audio stream
router.post('/calls/start-audio', (req, res) => {
    const { callId } = req.body;

    if (!callId) {
        return res.status(400).json({ error: 'Call ID required' });
    }

    getCurrentUser(req, res, async (currentUser) => {
        try {
            console.log(`User ${currentUser.username} starting audio stream for call: ${callId}`);

            // Verify the call exists and user is part of it
            const call = await db.getCall(callId);
            if (!call || (call.caller_id !== currentUser.id && call.callee_id !== currentUser.id)) {
                console.error('Call not found for audio stream:', callId);
                return res.status(404).json({ error: 'Call not found' });
            }

            // Update call audio stream status
            await db.updateCallAudioStream(callId, true);

            // Determine target user
            const targetId = call.caller_id === currentUser.id ? call.callee_id : call.caller_id;

            // Notify other user that audio stream started
            req.io.to(targetId).emit('audio-stream-started', {
                callId,
                from: currentUser.id,
                fromUsername: currentUser.username
            });

            res.json({ status: 'audio-stream-started' });
        } catch (err) {
            console.error('Database error starting audio stream:', err);
            return res.status(500).json({ error: 'Database error' });
        }
    });
});

// Audio streaming - stop audio stream
router.post('/calls/stop-audio', (req, res) => {
    const { callId } = req.body;

    if (!callId) {
        return res.status(400).json({ error: 'Call ID required' });
    }

    getCurrentUser(req, res, async (currentUser) => {
        try {
            console.log(`User ${currentUser.username} stopping audio stream for call: ${callId}`);

            // Verify the call exists and user is part of it
            const call = await db.getCall(callId);
            if (!call || (call.caller_id !== currentUser.id && call.callee_id !== currentUser.id)) {
                console.error('Call not found for audio stream:', callId);
                return res.status(404).json({ error: 'Call not found' });
            }

            // Update call audio stream status
            await db.updateCallAudioStream(callId, false);

            // Determine target user
            const targetId = call.caller_id === currentUser.id ? call.callee_id : call.caller_id;

            // Notify other user that audio stream stopped
            req.io.to(targetId).emit('audio-stream-stopped', {
                callId,
                from: currentUser.id,
                fromUsername: currentUser.username
            });

            res.json({ status: 'audio-stream-stopped' });
        } catch (err) {
            console.error('Database error stopping audio stream:', err);
            return res.status(500).json({ error: 'Database error' });
        }
    });
});

module.exports = router;

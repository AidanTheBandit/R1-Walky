const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const { getCurrentUser } = require('../middleware/auth');

const router = express.Router();

// Update user location
router.post('/location/update', (req, res) => {
    const { latitude, longitude } = req.body;

    if (latitude === undefined || longitude === undefined) {
        return res.status(400).json({ error: 'Latitude and longitude required' });
    }

    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
        return res.status(400).json({ error: 'Invalid latitude or longitude values' });
    }

    getCurrentUser(req, res, async (currentUser) => {
        try {
            console.log(`User ${currentUser.username} updating location: ${latitude}, ${longitude}`);

            await db.updateUserLocation(currentUser.id, latitude, longitude);

            // Check for nearby channels and auto-join
            const nearbyChannels = await db.getNearbyChannels(latitude, longitude, 1); // 1km radius
            const joinedChannels = [];

            for (const channel of nearbyChannels) {
                try {
                    await db.joinChannel(channel.id, currentUser.id);
                    joinedChannels.push(channel);
                    console.log(`Auto-joined channel ${channel.name} for user ${currentUser.username}`);
                } catch (err) {
                    console.error(`Failed to join channel ${channel.id}:`, err);
                }
            }

            // Leave channels that are no longer nearby
            const userChannels = await db.getUserChannels(currentUser.id);
            const leftChannels = [];

            for (const userChannel of userChannels) {
                const distance = calculateDistance(latitude, longitude, userChannel.latitude, userChannel.longitude);
                if (distance > userChannel.radius) {
                    try {
                        await db.leaveChannel(userChannel.id, currentUser.id);
                        leftChannels.push(userChannel);
                        console.log(`Auto-left channel ${userChannel.name} for user ${currentUser.username}`);
                    } catch (err) {
                        console.error(`Failed to leave channel ${userChannel.id}:`, err);
                    }
                }
            }

            res.json({
                status: 'location-updated',
                joinedChannels: joinedChannels.map(c => ({ id: c.id, name: c.name })),
                leftChannels: leftChannels.map(c => ({ id: c.id, name: c.name }))
            });
        } catch (err) {
            console.error('Database error updating location:', err);
            return res.status(500).json({ error: 'Database error' });
        }
    });
});

// Get nearby channels
router.get('/location/channels/nearby', (req, res) => {
    const { latitude, longitude, radius } = req.query;

    if (latitude === undefined || longitude === undefined) {
        return res.status(400).json({ error: 'Latitude and longitude required' });
    }

    const radiusKm = radius ? parseFloat(radius) : 1; // Default 1km

    getCurrentUser(req, res, async (currentUser) => {
        try {
            console.log(`User ${currentUser.username} requesting nearby channels: ${latitude}, ${longitude}, ${radiusKm}km`);

            const channels = await db.getNearbyChannels(parseFloat(latitude), parseFloat(longitude), radiusKm);

            res.json({
                channels: channels.map(c => ({
                    id: c.id,
                    name: c.name,
                    latitude: c.latitude,
                    longitude: c.longitude,
                    radius: c.radius,
                    distance: c.distance
                }))
            });
        } catch (err) {
            console.error('Database error getting nearby channels:', err);
            return res.status(500).json({ error: 'Database error' });
        }
    });
});

// Create location channel
router.post('/location/channels', (req, res) => {
    const { name, latitude, longitude, radius } = req.body;

    if (!name || latitude === undefined || longitude === undefined || !radius) {
        return res.status(400).json({ error: 'Name, latitude, longitude, and radius required' });
    }

    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
        return res.status(400).json({ error: 'Invalid latitude or longitude values' });
    }

    if (radius <= 0 || radius > 10) {
        return res.status(400).json({ error: 'Radius must be between 0 and 10 km' });
    }

    getCurrentUser(req, res, async (currentUser) => {
        try {
            console.log(`User ${currentUser.username} creating location channel: ${name}`);

            const channelId = uuidv4();
            await db.createLocationChannel(channelId, name, latitude, longitude, radius);

            // Auto-join the creator
            await db.joinChannel(channelId, currentUser.id);

            res.json({
                channel: {
                    id: channelId,
                    name,
                    latitude,
                    longitude,
                    radius
                },
                status: 'channel-created'
            });
        } catch (err) {
            console.error('Database error creating location channel:', err);
            return res.status(500).json({ error: 'Database error' });
        }
    });
});

// Join location channel
router.post('/location/channels/:channelId/join', (req, res) => {
    const { channelId } = req.params;

    getCurrentUser(req, res, async (currentUser) => {
        try {
            console.log(`User ${currentUser.username} joining location channel: ${channelId}`);

            await db.joinChannel(channelId, currentUser.id);

            // Notify other channel participants via socket
            req.io.to(`channel_${channelId}`).emit('user-joined-channel', {
                userId: currentUser.id,
                username: currentUser.username,
                channelId
            });

            res.json({ status: 'channel-joined' });
        } catch (err) {
            console.error('Database error joining location channel:', err);
            return res.status(500).json({ error: 'Database error' });
        }
    });
});

// Leave location channel
router.post('/location/channels/:channelId/leave', (req, res) => {
    const { channelId } = req.params;

    getCurrentUser(req, res, async (currentUser) => {
        try {
            console.log(`User ${currentUser.username} leaving location channel: ${channelId}`);

            await db.leaveChannel(channelId, currentUser.id);

            // Notify other channel participants via socket
            req.io.to(`channel_${channelId}`).emit('user-left-channel', {
                userId: currentUser.id,
                username: currentUser.username,
                channelId
            });

            res.json({ status: 'channel-left' });
        } catch (err) {
            console.error('Database error leaving location channel:', err);
            return res.status(500).json({ error: 'Database error' });
        }
    });
});

// Get user's channels
router.get('/location/channels', (req, res) => {
    getCurrentUser(req, res, async (currentUser) => {
        try {
            console.log(`User ${currentUser.username} requesting their channels`);

            const channels = await db.getUserChannels(currentUser.id);

            res.json({
                channels: channels.map(c => ({
                    id: c.id,
                    name: c.name,
                    latitude: c.latitude,
                    longitude: c.longitude,
                    radius: c.radius,
                    joinedAt: c.joined_at
                }))
            });
        } catch (err) {
            console.error('Database error getting user channels:', err);
            return res.status(500).json({ error: 'Database error' });
        }
    });
});

// Get channel participants
router.get('/location/channels/:channelId/participants', (req, res) => {
    const { channelId } = req.params;

    getCurrentUser(req, res, async (currentUser) => {
        try {
            console.log(`User ${currentUser.username} requesting participants for channel: ${channelId}`);

            const participants = await db.getChannelParticipants(channelId);

            res.json({
                participants: participants.map(p => ({
                    id: p.id,
                    username: p.username,
                    joinedAt: p.joined_at
                }))
            });
        } catch (err) {
            console.error('Database error getting channel participants:', err);
            return res.status(500).json({ error: 'Database error' });
        }
    });
});

// Start group call in channel
router.post('/location/channels/:channelId/group-call/start', (req, res) => {
    const { channelId } = req.params;

    getCurrentUser(req, res, async (currentUser) => {
        try {
            console.log(`User ${currentUser.username} starting group call in channel: ${channelId}`);

            // Check if user is in the channel
            const participants = await db.getChannelParticipants(channelId);
            const isParticipant = participants.some(p => p.id === currentUser.id);

            if (!isParticipant) {
                return res.status(403).json({ error: 'You are not a participant in this channel' });
            }

            // Check if there's already an active group call
            const existingCall = await db.getGroupCall(channelId);
            if (existingCall) {
                return res.json({
                    callId: existingCall.id,
                    status: 'already-active'
                });
            }

            // Create new group call
            const callId = `group_${channelId}_${Date.now()}`;
            await db.createGroupCall(callId, channelId, currentUser.id);

            // Notify all channel participants
            for (const participant of participants) {
                req.io.to(participant.id).emit('group-call-started', {
                    callId,
                    channelId,
                    startedBy: currentUser.id,
                    startedByUsername: currentUser.username
                });
            }

            res.json({
                callId,
                channelId,
                status: 'group-call-started'
            });
        } catch (err) {
            console.error('Database error starting group call:', err);
            return res.status(500).json({ error: 'Database error' });
        }
    });
});

// Helper function to calculate distance
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of the Earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // Distance in km
}

module.exports = router;

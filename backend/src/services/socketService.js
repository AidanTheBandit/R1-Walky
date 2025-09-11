const db = require('../config/database');

class SocketService {
    constructor(io) {
        this.io = io;
        this.setupSocketHandlers();
    }

    setupSocketHandlers() {
        this.io.on('connection', (socket) => {
            console.log('🔌 User connected:', socket.id);

            // Register user socket
            socket.on('register', (userId) => {
                socket.userId = userId;
                socket.join(userId);
                console.log(`👤 User ${userId} registered and online`);

                // Notify friends that user is online
                this.notifyFriendsOnlineStatus(userId, true);
            });

            // Update user location
            socket.on('update-location', async (data) => {
                const { latitude, longitude } = data;
                try {
                    await db.updateUserLocation(socket.userId, latitude, longitude);
                    console.log(`📍 Updated location for user ${socket.userId}: ${latitude}, ${longitude}`);

                    // Check for nearby channels and auto-join
                    const nearbyChannels = await db.getNearbyChannels(latitude, longitude, 1); // 1km radius
                    for (const channel of nearbyChannels) {
                        await this.joinLocationChannel(socket, channel.id);
                    }

                    // Leave channels that are no longer nearby
                    const userChannels = await db.getUserChannels(socket.userId);
                    for (const userChannel of userChannels) {
                        const distance = this.calculateDistance(latitude, longitude, userChannel.latitude, userChannel.longitude);
                        if (distance > userChannel.radius) {
                            await this.leaveLocationChannel(socket, userChannel.id);
                        }
                    }
                } catch (err) {
                    console.error('❌ Database error updating location:', err);
                }
            });

            // Join location channel
            socket.on('join-location-channel', async (data) => {
                const { channelId } = data;
                await this.joinLocationChannel(socket, channelId);
            });

            // Leave location channel
            socket.on('leave-location-channel', async (data) => {
                const { channelId } = data;
                await this.leaveLocationChannel(socket, channelId);
            });

            // Start group call in channel
            socket.on('start-group-call', async (data) => {
                const { channelId } = data;
                try {
                    // Check if user is in the channel
                    const participants = await db.getChannelParticipants(channelId);
                    const isParticipant = participants.some(p => p.id === socket.userId);

                    if (!isParticipant) {
                        socket.emit('error', { message: 'You are not a participant in this channel' });
                        return;
                    }

                    // Check if there's already an active group call
                    const existingCall = await db.getGroupCall(channelId);
                    if (existingCall) {
                        socket.emit('group-call-joined', { callId: existingCall.id, channelId });
                        return;
                    }

                    // Create new group call
                    const callId = `group_${channelId}_${Date.now()}`;
                    await db.createGroupCall(callId, channelId, socket.userId);

                    // Notify all channel participants
                    const channelParticipants = await db.getChannelParticipants(channelId);
                    for (const participant of channelParticipants) {
                        this.io.to(participant.id).emit('group-call-started', {
                            callId,
                            channelId,
                            startedBy: socket.userId
                        });
                    }

                    console.log(`📞 Group call started in channel ${channelId} by user ${socket.userId}`);
                } catch (err) {
                    console.error('❌ Database error starting group call:', err);
                    socket.emit('error', { message: 'Failed to start group call' });
                }
            });

            // Join existing group call
            socket.on('join-group-call', async (data) => {
                const { callId } = data;
                try {
                    const call = await db.getCall(callId);
                    if (call && call.is_group_call) {
                        socket.emit('group-call-joined', { callId, channelId: call.channel_id });
                        console.log(`📞 User ${socket.userId} joined group call ${callId}`);
                    } else {
                        socket.emit('error', { message: 'Group call not found' });
                    }
                } catch (err) {
                    console.error('❌ Database error joining group call:', err);
                    socket.emit('error', { message: 'Failed to join group call' });
                }
            });

            // Handle call answer
            socket.on('answer-call', async (data) => {
                const { callId, answer } = data;
                console.log('📞 Call answered:', callId);

                try {
                    // Find caller and send answer
                    const call = await db.getCall(callId);
                    if (call) {
                        this.io.to(call.caller_id).emit('call-answered', {
                            callId,
                            answer
                        });
                    } else {
                        console.error('❌ Call not found for answer:', callId);
                    }
                } catch (err) {
                    console.error('❌ Database error getting call for answer:', err);
                }
            });

            // Handle audio data streaming (both old and new formats)
            socket.on('audio-data', async (data) => {
                const { callId, audioBlob, audioData, sampleRate, channels, targetId } = data;

                try {
                    // Verify the call exists and user is part of it
                    const call = await db.getCall(callId);
                    if (!call) {
                        console.error('❌ Call not found:', callId);
                        return;
                    }

                    if (call.is_group_call) {
                        // Group call - relay to all channel participants except sender
                        const participants = await db.getChannelParticipants(call.channel_id);
                        const otherParticipants = participants.filter(p => p.id !== socket.userId);

                        // Check which format we received and relay accordingly
                        if (audioData) {
                            // New PCM format
                            for (const participant of otherParticipants) {
                                this.io.to(participant.id).emit('audio-data', {
                                    callId,
                                    audioData,
                                    sampleRate,
                                    channels,
                                    fromUserId: socket.userId,
                                    speakerName: await this.getUsername(socket.userId)
                                });
                            }
                            console.log(`🔊 Relayed PCM audio data from ${socket.userId} to ${otherParticipants.length} participants in group call ${callId}`);
                        } else if (audioBlob) {
                            // Old blob format - relay as is for backward compatibility
                            for (const participant of otherParticipants) {
                                this.io.to(participant.id).emit('audio-data', {
                                    callId,
                                    audioBlob,
                                    fromUserId: socket.userId,
                                    speakerName: await this.getUsername(socket.userId)
                                });
                            }
                            console.log(`🔊 Relayed blob audio data from ${socket.userId} to ${otherParticipants.length} participants in group call ${callId}`);
                        }
                    } else {
                        // 1-on-1 call - relay to the other party
                        const otherPartyId = call.caller_id === socket.userId ? call.callee_id : call.caller_id;

                        // Check which format we received and relay accordingly
                        if (audioData) {
                            // New PCM format
                            this.io.to(otherPartyId).emit('audio-data', {
                                callId,
                                audioData,
                                sampleRate,
                                channels,
                                fromUserId: socket.userId,
                                speakerName: await this.getUsername(socket.userId)
                            });
                            console.log(`🔊 Relayed PCM audio data from ${socket.userId} to ${otherPartyId} for call ${callId}`);
                        } else if (audioBlob) {
                            // Old blob format - relay as is for backward compatibility
                            this.io.to(otherPartyId).emit('audio-data', {
                                callId,
                                audioBlob,
                                fromUserId: socket.userId,
                                speakerName: await this.getUsername(socket.userId)
                            });
                            console.log(`🔊 Relayed blob audio data from ${socket.userId} to ${otherPartyId} for call ${callId}`);
                        }
                    }
                } catch (err) {
                    console.error('❌ Database error verifying call for audio data:', err);
                }
            });

            // Handle start audio streaming
            socket.on('start-audio-stream', async (data) => {
                const { callId } = data;

                try {
                    const updated = await db.updateCallAudioStream(callId, true);
                    if (updated) {
                        console.log(`🎤 Audio streaming started for call ${callId} by user ${socket.userId}`);

                        // Notify the other party that audio streaming has started
                        const call = await db.getCall(callId);
                        if (call) {
                            const otherPartyId = call.caller_id === socket.userId ? call.callee_id : call.caller_id;
                            this.io.to(otherPartyId).emit('audio-stream-started', {
                                callId,
                                fromUserId: socket.userId
                            });
                        }
                    }
                } catch (err) {
                    console.error('❌ Database error starting audio stream:', err);
                }
            });

            // Handle stop audio streaming
            socket.on('stop-audio-stream', async (data) => {
                const { callId } = data;

                try {
                    const updated = await db.updateCallAudioStream(callId, false);
                    if (updated) {
                        console.log(`🔇 Audio streaming stopped for call ${callId} by user ${socket.userId}`);

                        // Notify the other party that audio streaming has stopped
                        const call = await db.getCall(callId);
                        if (call) {
                            const otherPartyId = call.caller_id === socket.userId ? call.callee_id : call.caller_id;
                            this.io.to(otherPartyId).emit('audio-stream-stopped', {
                                callId,
                                fromUserId: socket.userId
                            });
                        }
                    }
                } catch (err) {
                    console.error('❌ Database error stopping audio stream:', err);
                }
            });

            // Handle call end
            socket.on('end-call', async (data) => {
                const { callId } = data;
                console.log('📞 Call ended:', callId);

                try {
                    // Find the other party and notify them
                    const call = await db.getCall(callId);
                    if (call) {
                        const otherPartyId = call.caller_id === socket.userId ? call.callee_id : call.caller_id;
                        this.io.to(otherPartyId).emit('call-ended', { callId });

                        // Remove call from database
                        await db.endCall(callId);
                    }
                } catch (err) {
                    console.error('❌ Database error ending call:', err);
                }
            });

            // Handle disconnect
            socket.on('disconnect', () => {
                console.log('🔌 User disconnected:', socket.id);

                if (socket.userId) {
                    // Notify friends that user went offline
                    this.notifyFriendsOnlineStatus(socket.userId, false);
                }
            });
        });
    }

    async notifyFriendsOnlineStatus(userId, isOnline) {
        try {
            // Get all friends of this user
            const friends = await db.getFriends(userId);

            // Notify each friend about the online status change
            friends.forEach(friend => {
                const event = isOnline ? 'user-online' : 'user-offline';
                this.io.to(friend.id).emit(event, { userId });
            });
        } catch (err) {
            console.error('❌ Database error notifying friends of online status:', err);
        }
    }

    async joinLocationChannel(socket, channelId) {
        try {
            await db.joinChannel(channelId, socket.userId);
            socket.join(`channel_${channelId}`);
            console.log(`📍 User ${socket.userId} joined location channel ${channelId}`);

            // Notify other channel participants
            socket.to(`channel_${channelId}`).emit('user-joined-channel', {
                userId: socket.userId,
                username: await this.getUsername(socket.userId),
                channelId
            });
        } catch (err) {
            console.error('❌ Database error joining channel:', err);
        }
    }

    async leaveLocationChannel(socket, channelId) {
        try {
            await db.leaveChannel(channelId, socket.userId);
            socket.leave(`channel_${channelId}`);
            console.log(`📍 User ${socket.userId} left location channel ${channelId}`);

            // Notify other channel participants
            socket.to(`channel_${channelId}`).emit('user-left-channel', {
                userId: socket.userId,
                username: await this.getUsername(socket.userId),
                channelId
            });
        } catch (err) {
            console.error('❌ Database error leaving channel:', err);
        }
    }

    calculateDistance(lat1, lon1, lat2, lon2) {
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

    async getUsername(userId) {
        try {
            const user = await db.getUserById(userId);
            return user ? user.username : 'Unknown';
        } catch (err) {
            console.error('❌ Error getting username:', err);
            return 'Unknown';
        }
    }

    // Method to emit events to specific users (used by routes)
    emitToUser(userId, event, data) {
        this.io.to(userId).emit(event, data);
    }
}

module.exports = SocketService;

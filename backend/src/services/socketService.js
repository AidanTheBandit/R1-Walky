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
                    if (call && (call.caller_id === socket.userId || call.callee_id === socket.userId)) {
                        // Relay audio data to the other party
                        const otherPartyId = call.caller_id === socket.userId ? call.callee_id : call.caller_id;

                        // Check which format we received and relay accordingly
                        if (audioData) {
                            // New PCM format
                            this.io.to(otherPartyId).emit('audio-data', {
                                callId,
                                audioData,
                                sampleRate,
                                channels,
                                fromUserId: socket.userId
                            });
                            console.log(`🔊 Relayed PCM audio data from ${socket.userId} to ${otherPartyId} for call ${callId}`);
                        } else if (audioBlob) {
                            // Old blob format - relay as is for backward compatibility
                            this.io.to(otherPartyId).emit('audio-data', {
                                callId,
                                audioBlob,
                                fromUserId: socket.userId
                            });
                            console.log(`🔊 Relayed blob audio data from ${socket.userId} to ${otherPartyId} for call ${callId}`);
                        } else {
                            console.error('❌ No audio data found in message');
                        }
                    } else {
                        console.error('❌ Invalid call for audio data:', callId);
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

    // Method to emit events to specific users (used by routes)
    emitToUser(userId, event, data) {
        this.io.to(userId).emit(event, data);
    }
}

module.exports = SocketService;

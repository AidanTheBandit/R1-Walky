const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;

// Middleware to parse JSON bodies
app.use(express.json());

// Initialize database first
const db = new sqlite3.Database('./walkie_talkie.db', (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to SQLite database');
        initDatabase();
    }
});

// Initialize database tables
function initDatabase() {
    db.serialize(() => {
        // Users table
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            device_id TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Friendships table (many-to-many)
        db.run(`CREATE TABLE IF NOT EXISTS friendships (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            friend_id TEXT NOT NULL,
            status TEXT DEFAULT 'pending',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id),
            FOREIGN KEY (friend_id) REFERENCES users (id),
            UNIQUE(user_id, friend_id)
        )`);

        // Active calls table
        db.run(`CREATE TABLE IF NOT EXISTS active_calls (
            id TEXT PRIMARY KEY,
            caller_id TEXT NOT NULL,
            callee_id TEXT NOT NULL,
            status TEXT DEFAULT 'pending',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (caller_id) REFERENCES users (id),
            FOREIGN KEY (callee_id) REFERENCES users (id)
        )`);

        // Setup routes after database is ready
        setupRoutes();
    });
}

// Middleware to get current user from session
function userAuthMiddleware(req, res, next) {
    // Try to get user from header
    const userId = req.headers['x-user-id'];

    if (userId) {
        req.currentUserId = userId;
    }

    next();
}

// Helper function to get current user
function getCurrentUser(req, res, callback) {
    if (req.currentUserId) {
        // If we have a user ID from headers, use it
        db.get('SELECT * FROM users WHERE id = ?', [req.currentUserId], (err, user) => {
            if (err) {
                console.error('Database error getting user by ID:', err);
                return res.status(500).json({ error: 'Database error' });
            }
            if (!user) {
                return res.status(401).json({ error: 'User not found - please re-authenticate' });
            }
            callback(user);
        });
    } else {
        // No user ID provided - require authentication
        return res.status(401).json({ error: 'Authentication required' });
    }
}

// Setup all routes after database is initialized
function setupRoutes() {
    // Health check (no auth required)
    app.get('/health', (req, res) => {
        res.json({ status: 'OK', timestamp: new Date().toISOString() });
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

    // User registration (no auth required)
    app.post('/api/users', (req, res) => {
        const { username, deviceId } = req.body;

        if (!username || !deviceId) {
            return res.status(400).json({ error: 'Username and deviceId required' });
        }

        const userId = uuidv4();

        // Convert username to lowercase for case-insensitive storage
        const normalizedUsername = username.toLowerCase();
        
        db.run(
            'INSERT INTO users (id, username, device_id) VALUES (?, ?, ?)',
            [userId, normalizedUsername, deviceId],
            function(err) {
                if (err) {
                    if (err.message.includes('UNIQUE constraint failed')) {
                        return res.status(409).json({ error: 'Username already exists' });
                    }
                    return res.status(500).json({ error: 'Database error' });
                }

                res.json({
                    id: userId,
                    username: username,
                    deviceId: deviceId
                });
            }
        );
    });

    // Apply auth middleware to all /api routes
    app.use('/api', userAuthMiddleware);

    // Get current user
    app.get('/api/users/me', (req, res) => {
        getCurrentUser(req, res, (user) => {
            res.json({
                id: user.id,
                username: user.username,
                deviceId: user.device_id
            });
        });
    });

    // Search users
    app.get('/api/users/search', (req, res) => {
        const { username } = req.query;

        if (!username) {
            return res.status(400).json({ error: 'Username query required' });
        }

        getCurrentUser(req, res, (currentUser) => {
            db.all(
                'SELECT id, username FROM users WHERE username LIKE ? AND id != ? LIMIT 10',
                [`%${username}%`, currentUser.id],
                (err, rows) => {
                    if (err) {
                        return res.status(500).json({ error: 'Database error' });
                    }
                    res.json({ users: rows });
                }
            );
        });
    });

    // Add friend (send friend request)
    app.post('/api/friends', (req, res) => {
        const { friendUsername } = req.body;

        if (!friendUsername) {
            return res.status(400).json({ error: 'Friend username required' });
        }

        getCurrentUser(req, res, (currentUser) => {
            console.log(`User ${currentUser.username} (${currentUser.device_id}) trying to add friend: ${friendUsername}`);

            // Find friend (case-insensitive)
            db.get('SELECT id, username, device_id FROM users WHERE username = ?', [friendUsername.toLowerCase()], (err, friend) => {
                if (err || !friend) {
                    console.error('Friend lookup error:', err);
                    return res.status(404).json({ error: 'User not found' });
                }

                console.log(`Found friend: ${friend.username} (${friend.device_id})`);

                if (friend.id === currentUser.id) {
                    return res.status(400).json({ error: 'Cannot add yourself as friend' });
                }

                // Check if friendship already exists
                db.get(
                    'SELECT * FROM friendships WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)',
                    [currentUser.id, friend.id, friend.id, currentUser.id],
                    (err, existingFriendship) => {
                        if (err) {
                            console.error('Database error checking existing friendship:', err);
                            return res.status(500).json({ error: 'Database error' });
                        }

                        if (existingFriendship) {
                            if (existingFriendship.status === 'accepted') {
                                return res.status(409).json({ error: 'Already friends' });
                            } else if (existingFriendship.status === 'pending') {
                                return res.status(409).json({ error: 'Friend request already sent' });
                            }
                        }

                        // Create friend request
                        const friendshipId = uuidv4();
                        db.run(
                            'INSERT INTO friendships (id, user_id, friend_id, status) VALUES (?, ?, ?, ?)',
                            [friendshipId, currentUser.id, friend.id, 'pending'],
                            function(err) {
                                if (err) {
                                    console.error('Database error creating friendship:', err);
                                    return res.status(500).json({ error: 'Database error' });
                                }
                                console.log(`Friend request created: ${currentUser.username} -> ${friend.username}`);

                                // Emit notification to the friend
                                io.to(friend.id).emit('friend-request-received', {
                                    friendshipId,
                                    fromUser: {
                                        id: currentUser.id,
                                        username: currentUser.username
                                    }
                                });

                                res.json({
                                    success: true,
                                    friendshipId,
                                    message: 'Friend request sent'
                                });
                            }
                        );
                    }
                );
            });
        });
    });

    // Get friends list (only accepted friendships)
    app.get('/api/friends', (req, res) => {
        getCurrentUser(req, res, (currentUser) => {
            console.log(`Getting friends for user: ${currentUser.username} (${currentUser.device_id})`);

            db.all(`
                SELECT u.username, u.id, f.status
                FROM users u
                JOIN friendships f ON (
                    (f.friend_id = u.id AND f.user_id = ?) OR
                    (f.user_id = u.id AND f.friend_id = ?)
                )
                WHERE u.id != ? AND f.status = 'accepted'
            `, [currentUser.id, currentUser.id, currentUser.id], (err, rows) => {
                if (err) {
                    console.error('Database error getting friends:', err);
                    return res.status(500).json({ error: 'Database error' });
                }

                console.log(`Found ${rows.length} friends for ${currentUser.username}`);
                // For simplicity, mark all as offline
                const friends = rows.map(row => ({
                    id: row.id,
                    username: row.username,
                    status: 'offline'
                }));

                res.json(friends);
            });
        });
    });

    // Get pending friend requests
    app.get('/api/friends/requests', (req, res) => {
        getCurrentUser(req, res, (currentUser) => {
            console.log(`Getting friend requests for user: ${currentUser.username} (${currentUser.device_id})`);

            db.all(`
                SELECT u.username, u.id, f.id as friendshipId
                FROM users u
                JOIN friendships f ON f.user_id = u.id
                WHERE f.friend_id = ? AND f.status = 'pending'
            `, [currentUser.id], (err, rows) => {
                if (err) {
                    console.error('Database error getting friend requests:', err);
                    return res.status(500).json({ error: 'Database error' });
                }

                console.log(`Found ${rows.length} friend requests for ${currentUser.username}`);
                res.json({ requests: rows });
            });
        });
    });

    // Accept friend request
    app.post('/api/friends/:friendshipId/accept', (req, res) => {
        const { friendshipId } = req.params;

        getCurrentUser(req, res, (currentUser) => {
            // First verify this user is the recipient of the friend request
            db.get(
                'SELECT user_id, friend_id FROM friendships WHERE id = ? AND status = ?',
                [friendshipId, 'pending'],
                (err, friendship) => {
                    if (err) {
                        return res.status(500).json({ error: 'Database error' });
                    }
                    if (!friendship || friendship.friend_id !== currentUser.id) {
                        return res.status(404).json({ error: 'Friend request not found' });
                    }

                    db.run(
                        'UPDATE friendships SET status = ? WHERE id = ?',
                        ['accepted', friendshipId],
                        function(err) {
                            if (err) {
                                return res.status(500).json({ error: 'Database error' });
                            }
                            if (this.changes === 0) {
                                return res.status(404).json({ error: 'Friend request not found' });
                            }

                            // Get user details for notification
                            db.get('SELECT id, username FROM users WHERE id = ?', [friendship.user_id], (err, requester) => {
                                if (err) {
                                    console.error('Error getting requester details:', err);
                                    return;
                                }

                                // Notify the requester that their request was accepted
                                io.to(friendship.user_id).emit('friend-request-accepted', {
                                    friendshipId,
                                    accepter: {
                                        id: currentUser.id,
                                        username: currentUser.username
                                    }
                                });

                                // Notify the accepter that the friendship is now active
                                io.to(friendship.friend_id).emit('friendship-updated', {
                                    friendshipId,
                                    friend: {
                                        id: requester.id,
                                        username: requester.username
                                    },
                                    status: 'accepted'
                                });
                            });

                            res.json({ success: true, message: 'Friend request accepted' });
                        }
                    );
                }
            );
        });
    });

    // Reject friend request
    app.post('/api/friends/:friendshipId/reject', (req, res) => {
        const { friendshipId } = req.params;

        getCurrentUser(req, res, (currentUser) => {
            // First verify this user is the recipient of the friend request
            db.get(
                'SELECT user_id FROM friendships WHERE id = ? AND status = ? AND friend_id = ?',
                [friendshipId, 'pending', currentUser.id],
                (err, friendship) => {
                    if (err) {
                        return res.status(500).json({ error: 'Database error' });
                    }
                    if (!friendship) {
                        return res.status(404).json({ error: 'Friend request not found' });
                    }

                    db.run(
                        'DELETE FROM friendships WHERE id = ?',
                        [friendshipId],
                        function(err) {
                            if (err) {
                                return res.status(500).json({ error: 'Database error' });
                            }
                            if (this.changes === 0) {
                                return res.status(404).json({ error: 'Friend request not found' });
                            }

                            // Notify the requester that their request was rejected
                            io.to(friendship.user_id).emit('friend-request-rejected', {
                                friendshipId
                            });

                            res.json({ success: true, message: 'Friend request rejected' });
                        }
                    );
                }
            );
        });
    });

    // Delete friend (unfriend)
    app.delete('/api/friends/:friendId', (req, res) => {
        const { friendId } = req.params;
        
        getCurrentUser(req, res, (currentUser) => {
            // Delete friendship in both directions
            db.run(
                'DELETE FROM friendships WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)',
                [currentUser.id, friendId, friendId, currentUser.id],
                function(err) {
                    if (err) {
                        console.error('Database error removing friendship:', err);
                        return res.status(500).json({ error: 'Database error' });
                    }
                    
                    if (this.changes === 0) {
                        return res.status(404).json({ error: 'Friendship not found' });
                    }
                    
                    console.log(`Friendship removed between ${currentUser.id} and ${friendId}`);
                    
                    // Notify the other user
                    io.to(friendId).emit('friendship-updated', {
                        type: 'removed',
                        userId: currentUser.id
                    });
                    
                    res.json({ success: true, message: 'Friend removed' });
                }
            );
        });
    });

    // WebRTC signaling - initiate call
    app.post('/api/calls/initiate', (req, res) => {
        const { targetUsername, offer } = req.body;

        if (!targetUsername || !offer) {
            return res.status(400).json({ error: 'Target username and offer required' });
        }

        getCurrentUser(req, res, (currentUser) => {
            console.log(`User ${currentUser.username} initiating call to: ${targetUsername}`);

            // Find target user (case-insensitive)
            db.get('SELECT id FROM users WHERE username = ?', [targetUsername.toLowerCase()], (err, targetUser) => {
                if (err || !targetUser) {
                    console.error('Target user not found:', targetUsername);
                    return res.status(404).json({ error: 'User not found' });
                }

                const callId = uuidv4();

                // Create call record
                db.run(
                    'INSERT INTO active_calls (id, caller_id, callee_id) VALUES (?, ?, ?)',
                    [callId, currentUser.id, targetUser.id],
                    function(err) {
                        if (err) {
                            console.error('Database error creating call:', err);
                            return res.status(500).json({ error: 'Database error' });
                        }

                        console.log(`Call initiated: ${currentUser.username} -> ${targetUsername} (ID: ${callId})`);

                        // Emit to target user via socket
                        io.to(targetUser.id).emit('incoming-call', {
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
                    }
                );
            });
        });
    });

    // WebRTC signaling - retry call with new offer
    app.post('/api/calls/retry', (req, res) => {
        const { callId, offer } = req.body;

        if (!callId || !offer) {
            return res.status(400).json({ error: 'Call ID and offer required' });
        }

        getCurrentUser(req, res, (currentUser) => {
            console.log(`User ${currentUser.username} retrying call: ${callId}`);

            // Verify the call exists and user is part of it
            db.get(
                'SELECT * FROM active_calls WHERE id = ? AND (caller_id = ? OR callee_id = ?)',
                [callId, currentUser.id, currentUser.id],
                (err, call) => {
                    if (err || !call) {
                        console.error('Call not found for retry:', callId);
                        return res.status(404).json({ error: 'Call not found' });
                    }

                    // Determine target user
                    const targetId = call.caller_id === currentUser.id ? call.callee_id : call.caller_id;

                    // Send retry offer to target user
                    io.to(targetId).emit('call-retry', {
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
                }
            );
        });
    });

    // WebSocket connection handling
    io.on('connection', (socket) => {
        console.log('User connected:', socket.id);

        // Register user socket
        socket.on('register', (userId) => {
            socket.userId = userId;
            socket.join(userId);
            console.log(`User ${userId} registered`);
        });

        // Handle call answer
        socket.on('answer-call', (data) => {
            const { callId, answer } = data;
            console.log('Call answered:', callId);
            // Find caller and send answer
            db.get(
                'SELECT caller_id FROM active_calls WHERE id = ?',
                [callId],
                (err, call) => {
                    if (!err && call) {
                        io.to(call.caller_id).emit('call-answered', {
                            callId,
                            answer
                        });
                    } else {
                        console.error('Call not found for answer:', callId);
                    }
                }
            );
        });

        // Handle ICE candidates
        socket.on('ice-candidate', (data) => {
            const { callId, candidate, targetId } = data;
            console.log('ICE candidate received for call:', callId);
            io.to(targetId).emit('ice-candidate', {
                callId,
                candidate
            });
        });
        
        // Handle call end
        socket.on('end-call', (data) => {
            const { callId } = data;
            console.log('Call ended:', callId);
            
            // Find the other party and notify them
            db.get(
                'SELECT caller_id, callee_id FROM active_calls WHERE id = ?',
                [callId],
                (err, call) => {
                    if (!err && call) {
                        const otherPartyId = call.caller_id === socket.userId ? call.callee_id : call.caller_id;
                        io.to(otherPartyId).emit('call-ended', { callId });
                        
                        // Remove call from database
                        db.run('DELETE FROM active_calls WHERE id = ?', [callId]);
                    }
                }
            );
        });
        
        // Track user online status
        socket.on('register', (userId) => {
            socket.userId = userId;
            socket.join(userId);
            console.log(`User ${userId} registered and online`);
            
            // Notify friends that user is online
            db.all(`
                SELECT DISTINCT 
                    CASE 
                        WHEN f.user_id = ? THEN f.friend_id
                        ELSE f.user_id
                    END as friend_id
                FROM friendships f
                WHERE (f.user_id = ? OR f.friend_id = ?) AND f.status = 'accepted'
            `, [userId, userId, userId], (err, friends) => {
                if (!err && friends) {
                    friends.forEach(friend => {
                        io.to(friend.friend_id).emit('user-online', { userId });
                    });
                }
            });
        });

        socket.on('disconnect', () => {
            console.log('User disconnected:', socket.id);
            
            if (socket.userId) {
                // Notify friends that user went offline
                db.all(`
                    SELECT DISTINCT 
                        CASE 
                            WHEN f.user_id = ? THEN f.friend_id
                            ELSE f.user_id
                        END as friend_id
                    FROM friendships f
                    WHERE (f.user_id = ? OR f.friend_id = ?) AND f.status = 'accepted'
                `, [socket.userId, socket.userId, socket.userId], (err, friends) => {
                    if (!err && friends) {
                        friends.forEach(friend => {
                            io.to(friend.friend_id).emit('user-offline', { userId: socket.userId });
                        });
                    }
                });
            }
        });
    });

    // Serve static files from frontend directory (after API routes)
    app.use(express.static(path.join(__dirname, '../frontend')));

    // Serve the main HTML file for all other routes
    app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, '../frontend/index.html'));
    });

    // Start server after routes are set up
    server.listen(PORT, () => {
        console.log(`R1-Walky backend server running on port ${PORT}`);
    });
}

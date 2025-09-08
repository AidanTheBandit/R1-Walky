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

// Middleware
app.use(cors());
app.use(express.json());

// API Routes (must come before static file serving)

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Device verification endpoint
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

    // In a real implementation, you might want to store verification attempts
    // For now, just return success if code is correct
    res.json({
        verified: true,
        deviceId: deviceId,
        message: 'R1 device verified successfully'
    });
});
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
    });
}

// Device verification endpoint
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

    // In a real implementation, you might want to store verification attempts
    // For now, just return success if code is correct
    res.json({
        verified: true,
        deviceId: deviceId,
        message: 'R1 device verified successfully'
    });
});

// User registration
app.post('/api/users', (req, res) => {
    const { username, deviceId } = req.body;

    if (!username || !deviceId) {
        return res.status(400).json({ error: 'Username and deviceId required' });
    }

    const userId = uuidv4();

    db.run(
        'INSERT INTO users (id, username, device_id) VALUES (?, ?, ?)',
        [userId, username, deviceId],
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

// Get current user (would use auth token in real app)
app.get('/api/users/me', (req, res) => {
    // For simplicity, return first user
    db.get('SELECT * FROM users LIMIT 1', (err, row) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        if (!row) {
            return res.status(404).json({ error: 'No users found' });
        }
        res.json({
            id: row.id,
            username: row.username,
            deviceId: row.device_id
        });
    });
});

// Search users
app.get('/api/users/search', (req, res) => {
    const { username } = req.query;

    if (!username) {
        return res.status(400).json({ error: 'Username query required' });
    }

    db.all(
        'SELECT id, username FROM users WHERE username LIKE ? LIMIT 10',
        [`%${username}%`],
        (err, rows) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            res.json({ users: rows });
        }
    );
});

// Add friend (send friend request)
app.post('/api/friends', (req, res) => {
    const { friendUsername } = req.body;

    if (!friendUsername) {
        return res.status(400).json({ error: 'Friend username required' });
    }

    // For simplicity, assume current user is first user
    db.get('SELECT id FROM users LIMIT 1', (err, currentUser) => {
        if (err || !currentUser) {
            return res.status(500).json({ error: 'Current user not found' });
        }

        // Find friend
        db.get('SELECT id FROM users WHERE username = ?', [friendUsername], (err, friend) => {
            if (err || !friend) {
                return res.status(404).json({ error: 'User not found' });
            }

            if (currentUser.id === friend.id) {
                return res.status(400).json({ error: 'Cannot add yourself as friend' });
            }

            // Check if friendship already exists
            db.get(
                'SELECT id, status FROM friendships WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)',
                [currentUser.id, friend.id, friend.id, currentUser.id],
                (err, existingFriendship) => {
                    if (err) {
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
                                return res.status(500).json({ error: 'Database error' });
                            }
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
    // For simplicity, assume current user is first user
    db.get('SELECT id FROM users LIMIT 1', (err, currentUser) => {
        if (err || !currentUser) {
            return res.status(500).json({ error: 'Current user not found' });
        }

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
                return res.status(500).json({ error: 'Database error' });
            }

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
    // For simplicity, assume current user is first user
    db.get('SELECT id FROM users LIMIT 1', (err, currentUser) => {
        if (err || !currentUser) {
            return res.status(500).json({ error: 'Current user not found' });
        }

        db.all(`
            SELECT u.username, u.id, f.id as friendshipId
            FROM users u
            JOIN friendships f ON f.user_id = u.id
            WHERE f.friend_id = ? AND f.status = 'pending'
        `, [currentUser.id], (err, rows) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }

            res.json({ requests: rows });
        });
    });
});

// Accept friend request
app.post('/api/friends/:friendshipId/accept', (req, res) => {
    const { friendshipId } = req.params;

    db.run(
        'UPDATE friendships SET status = ? WHERE id = ? AND status = ?',
        ['accepted', friendshipId, 'pending'],
        function(err) {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            if (this.changes === 0) {
                return res.status(404).json({ error: 'Friend request not found' });
            }
            res.json({ success: true, message: 'Friend request accepted' });
        }
    );
});

// Reject friend request
app.post('/api/friends/:friendshipId/reject', (req, res) => {
    const { friendshipId } = req.params;

    db.run(
        'DELETE FROM friendships WHERE id = ? AND status = ?',
        [friendshipId, 'pending'],
        function(err) {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            if (this.changes === 0) {
                return res.status(404).json({ error: 'Friend request not found' });
            }
            res.json({ success: true, message: 'Friend request rejected' });
        }
    );
});

// WebRTC signaling - initiate call
app.post('/api/calls/initiate', (req, res) => {
    const { targetUsername, offer } = req.body;

    if (!targetUsername || !offer) {
        return res.status(400).json({ error: 'Target username and offer required' });
    }

    // Find target user
    db.get('SELECT id FROM users WHERE username = ?', [targetUsername], (err, targetUser) => {
        if (err || !targetUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        // For simplicity, assume current user is first user
        db.get('SELECT id FROM users LIMIT 1', (err, currentUser) => {
            if (err || !currentUser) {
                return res.status(500).json({ error: 'Current user not found' });
            }

            const callId = uuidv4();

            // Create call record
            db.run(
                'INSERT INTO active_calls (id, caller_id, callee_id) VALUES (?, ?, ?)',
                [callId, currentUser.id, targetUser.id],
                function(err) {
                    if (err) {
                        return res.status(500).json({ error: 'Database error' });
                    }

                    // Emit to target user via socket
                    io.to(targetUser.id).emit('incoming-call', {
                        callId,
                        caller: currentUser.id,
                        offer
                    });

                    res.json({
                        callId,
                        status: 'initiated'
                    });
                }
            );
        });
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
                }
            }
        );
    });

    // Handle ICE candidates
    socket.on('ice-candidate', (data) => {
        const { callId, candidate, targetId } = data;
        io.to(targetId).emit('ice-candidate', {
            callId,
            candidate
        });
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

// Serve static files from frontend directory (after API routes)
app.use(express.static(path.join(__dirname, '../frontend')));

// Serve the main HTML file for all other routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Start server
server.listen(PORT, () => {
    console.log(`R1-Walky backend server running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('Shutting down server...');
    db.close((err) => {
        if (err) {
            console.error('Error closing database:', err.message);
        } else {
            console.log('Database connection closed');
        }
        process.exit(0);
    });
});

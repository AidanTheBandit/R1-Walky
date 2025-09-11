const sqlite3 = require('sqlite3').verbose();

class Database {
    constructor() {
        this.db = null;
        this.isInitialized = false;
        this.dbClosed = false;
    }

    init() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database('./walkie_talkie.db', (err) => {
                if (err) {
                    console.error('❌ Error opening database:', err.message);
                    reject(err);
                    return;
                }

                console.log('✅ Connected to SQLite database');
                this.initializeTables().then(() => {
                    this.isInitialized = true;
                    resolve();
                }).catch(reject);
            });
        });
    }

    initializeTables() {
        return new Promise((resolve, reject) => {
            this.db.serialize(() => {
                // Users table
                this.db.run(`CREATE TABLE IF NOT EXISTS users (
                    id TEXT PRIMARY KEY,
                    username TEXT UNIQUE NOT NULL,
                    device_id TEXT NOT NULL,
                    latitude REAL,
                    longitude REAL,
                    location_updated_at DATETIME,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )`, (err) => {
                    if (err) {
                        console.error('❌ Error creating users table:', err);
                        reject(err);
                        return;
                    }
                });

                // Friendships table
                this.db.run(`CREATE TABLE IF NOT EXISTS friendships (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    friend_id TEXT NOT NULL,
                    status TEXT DEFAULT 'pending',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users (id),
                    FOREIGN KEY (friend_id) REFERENCES users (id),
                    UNIQUE(user_id, friend_id)
                )`, (err) => {
                    if (err) {
                        console.error('❌ Error creating friendships table:', err);
                        reject(err);
                        return;
                    }
                });

                // Location channels table
                this.db.run(`CREATE TABLE IF NOT EXISTS location_channels (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    latitude REAL NOT NULL,
                    longitude REAL NOT NULL,
                    radius REAL NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )`, (err) => {
                    if (err) {
                        console.error('❌ Error creating location_channels table:', err);
                        reject(err);
                        return;
                    }
                });

                // Channel participants table
                this.db.run(`CREATE TABLE IF NOT EXISTS channel_participants (
                    id TEXT PRIMARY KEY,
                    channel_id TEXT NOT NULL,
                    user_id TEXT NOT NULL,
                    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (channel_id) REFERENCES location_channels (id),
                    FOREIGN KEY (user_id) REFERENCES users (id),
                    UNIQUE(channel_id, user_id)
                )`, (err) => {
                    if (err) {
                        console.error('❌ Error creating channel_participants table:', err);
                        reject(err);
                        return;
                    }
                });

                // Active calls table - recreate with proper schema for group calls
                this.db.run(`DROP TABLE IF EXISTS active_calls`, (dropErr) => {
                    if (dropErr) {
                        console.error('❌ Error dropping active_calls table:', dropErr);
                    }

                    this.db.run(`CREATE TABLE active_calls (
                        id TEXT PRIMARY KEY,
                        channel_id TEXT,
                        caller_id TEXT,
                        status TEXT DEFAULT 'pending',
                        audio_stream_active INTEGER DEFAULT 0,
                        is_group_call INTEGER DEFAULT 0,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (channel_id) REFERENCES location_channels (id),
                        FOREIGN KEY (caller_id) REFERENCES users (id)
                    )`, (err) => {
                        if (err) {
                            console.error('❌ Error creating active_calls table:', err);
                            reject(err);
                            return;
                        }

                        console.log('✅ Database tables initialized with location and group call support');
                        resolve();
                    });
                });
            });
        });
    }

    // User operations
    createUser(userId, username, deviceId) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'INSERT INTO users (id, username, device_id) VALUES (?, ?, ?)',
                [userId, username.toLowerCase(), deviceId],
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({ id: userId, username, deviceId });
                    }
                }
            );
        });
    }

    getUserById(userId) {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT * FROM users WHERE id = ?', [userId], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    getUserByUsername(username) {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT * FROM users WHERE username = ?', [username.toLowerCase()], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    searchUsers(username, currentUserId) {
        return new Promise((resolve, reject) => {
            this.db.all(
                'SELECT id, username FROM users WHERE username LIKE ? AND id != ? LIMIT 10',
                [`%${username}%`, currentUserId],
                (err, rows) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(rows);
                    }
                }
            );
        });
    }

    // Friendship operations
    createFriendRequest(friendshipId, userId, friendId) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'INSERT INTO friendships (id, user_id, friend_id, status) VALUES (?, ?, ?, ?)',
                [friendshipId, userId, friendId, 'pending'],
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({ id: friendshipId, userId, friendId });
                    }
                }
            );
        });
    }

    getFriendship(userId, friendId) {
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT * FROM friendships WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)',
                [userId, friendId, friendId, userId],
                (err, row) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(row);
                    }
                }
            );
        });
    }

    getFriends(userId) {
        return new Promise((resolve, reject) => {
            this.db.all(`
                SELECT u.username, u.id, f.status
                FROM users u
                JOIN friendships f ON (
                    (f.friend_id = u.id AND f.user_id = ?) OR
                    (f.user_id = u.id AND f.friend_id = ?)
                )
                WHERE u.id != ? AND f.status = 'accepted'
            `, [userId, userId, userId], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows.map(row => ({
                        id: row.id,
                        username: row.username,
                        status: 'offline' // For now, mark all as offline
                    })));
                }
            });
        });
    }

    getFriendRequests(userId) {
        return new Promise((resolve, reject) => {
            this.db.all(`
                SELECT u.username, u.id, f.id as friendshipId
                FROM users u
                JOIN friendships f ON f.user_id = u.id
                WHERE f.friend_id = ? AND f.status = 'pending'
            `, [userId], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    acceptFriendRequest(friendshipId) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'UPDATE friendships SET status = ? WHERE id = ?',
                ['accepted', friendshipId],
                function(err) {
                    if (err) {
                        reject(err);
                    } else if (this.changes === 0) {
                        reject(new Error('Friend request not found'));
                    } else {
                        resolve();
                    }
                }
            );
        });
    }

    rejectFriendRequest(friendshipId) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'DELETE FROM friendships WHERE id = ?',
                [friendshipId],
                function(err) {
                    if (err) {
                        reject(err);
                    } else if (this.changes === 0) {
                        reject(new Error('Friend request not found'));
                    } else {
                        resolve();
                    }
                }
            );
        });
    }

    getFriendshipById(friendshipId) {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT * FROM friendships WHERE id = ?', [friendshipId], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    // Call operations
    createCall(callId, callerId, calleeId) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'INSERT INTO active_calls (id, caller_id, callee_id) VALUES (?, ?, ?)',
                [callId, callerId, calleeId],
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({ id: callId, callerId, calleeId });
                    }
                }
            );
        });
    }

    getCall(callId) {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT * FROM active_calls WHERE id = ?', [callId], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    updateCall(callId, status) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'UPDATE active_calls SET status = ? WHERE id = ?',
                [status, callId],
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(this.changes > 0);
                    }
                }
            );
        });
    }

    endCall(callId) {
        return new Promise((resolve, reject) => {
            this.db.run('DELETE FROM active_calls WHERE id = ?', [callId], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes > 0);
                }
            });
        });
    }

    updateCallAudioStream(callId, active) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'UPDATE active_calls SET audio_stream_active = ? WHERE id = ?',
                [active ? 1 : 0, callId],
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(this.changes > 0);
                    }
                }
            );
        });
    }

    // Location operations
    updateUserLocation(userId, latitude, longitude) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'UPDATE users SET latitude = ?, longitude = ?, location_updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [latitude, longitude, userId],
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(this.changes > 0);
                    }
                }
            );
        });
    }

    getUserLocation(userId) {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT latitude, longitude, location_updated_at FROM users WHERE id = ?', [userId], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    // Location channel operations
    createLocationChannel(channelId, name, latitude, longitude, radius) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'INSERT INTO location_channels (id, name, latitude, longitude, radius) VALUES (?, ?, ?, ?, ?)',
                [channelId, name, latitude, longitude, radius],
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({ id: channelId, name, latitude, longitude, radius });
                    }
                }
            );
        });
    }

    getNearbyChannels(latitude, longitude, radiusKm = 1) {
        return new Promise((resolve, reject) => {
            // Calculate distance using Haversine formula
            const query = `
                SELECT *,
                (6371 * acos(cos(radians(?)) * cos(radians(latitude)) * cos(radians(longitude) - radians(?)) + sin(radians(?)) * sin(radians(latitude)))) AS distance
                FROM location_channels
                WHERE distance <= ?
                ORDER BY distance ASC
            `;
            this.db.all(query, [latitude, longitude, latitude, radiusKm], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    joinChannel(channelId, userId) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'INSERT OR REPLACE INTO channel_participants (id, channel_id, user_id, joined_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)',
                [`${channelId}_${userId}`, channelId, userId],
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(this.changes > 0);
                    }
                }
            );
        });
    }

    leaveChannel(channelId, userId) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'DELETE FROM channel_participants WHERE channel_id = ? AND user_id = ?',
                [channelId, userId],
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(this.changes > 0);
                    }
                }
            );
        });
    }

    getChannelParticipants(channelId) {
        return new Promise((resolve, reject) => {
            this.db.all(`
                SELECT u.id, u.username, cp.joined_at
                FROM users u
                JOIN channel_participants cp ON u.id = cp.user_id
                WHERE cp.channel_id = ?
            `, [channelId], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    getUserChannels(userId) {
        return new Promise((resolve, reject) => {
            this.db.all(`
                SELECT lc.*, cp.joined_at
                FROM location_channels lc
                JOIN channel_participants cp ON lc.id = cp.channel_id
                WHERE cp.user_id = ?
            `, [userId], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    // Group call operations
    createGroupCall(callId, channelId, callerId) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'INSERT INTO active_calls (id, channel_id, caller_id, is_group_call) VALUES (?, ?, ?, 1)',
                [callId, channelId, callerId],
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({ id: callId, channelId, callerId });
                    }
                }
            );
        });
    }

    getGroupCall(channelId) {
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT * FROM active_calls WHERE channel_id = ? AND is_group_call = 1 ORDER BY created_at DESC LIMIT 1',
                [channelId],
                (err, row) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(row);
                    }
                }
            );
        });
    }

    // Close database connection
    close() {
        if (this.db && !this.dbClosed) {
            this.dbClosed = true;
            this.db.close((err) => {
                if (err) {
                    console.error('❌ Error closing database:', err);
                } else {
                    console.log('✅ Database connection closed');
                }
            });
        } else if (this.dbClosed) {
            console.log('ℹ️ Database already closed');
        }
    }
}

module.exports = new Database();

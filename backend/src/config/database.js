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

                // Active calls table
                this.db.run(`CREATE TABLE IF NOT EXISTS active_calls (
                    id TEXT PRIMARY KEY,
                    caller_id TEXT NOT NULL,
                    callee_id TEXT NOT NULL,
                    status TEXT DEFAULT 'pending',
                    audio_stream_active INTEGER DEFAULT 0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (caller_id) REFERENCES users (id),
                    FOREIGN KEY (callee_id) REFERENCES users (id)
                )`, (err) => {
                    if (err) {
                        console.error('❌ Error creating active_calls table:', err);
                        reject(err);
                        return;
                    }

                    console.log('✅ Database tables initialized');
                    resolve();
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

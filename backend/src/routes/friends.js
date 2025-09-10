const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const { getCurrentUser } = require('../middleware/auth');

const router = express.Router();

// Add friend (send friend request)
router.post('/friends', (req, res) => {
    const { friendUsername } = req.body;

    if (!friendUsername) {
        return res.status(400).json({ error: 'Friend username required' });
    }

    getCurrentUser(req, res, async (currentUser) => {
        console.log(`User ${currentUser.username} (${currentUser.device_id}) trying to add friend: ${friendUsername}`);

        try {
            // Find friend (case-insensitive)
            const friend = await db.getUserByUsername(friendUsername);
            if (!friend) {
                console.error('Friend lookup error: User not found');
                return res.status(404).json({ error: 'User not found' });
            }

            console.log(`Found friend: ${friend.username} (${friend.device_id})`);

            if (friend.id === currentUser.id) {
                return res.status(400).json({ error: 'Cannot add yourself as friend' });
            }

            // Check if friendship already exists
            const existingFriendship = await db.getFriendship(currentUser.id, friend.id);
            if (existingFriendship) {
                if (existingFriendship.status === 'accepted') {
                    return res.status(409).json({ error: 'Already friends' });
                } else if (existingFriendship.status === 'pending') {
                    return res.status(409).json({ error: 'Friend request already sent' });
                }
            }

            // Create friend request
            const friendshipId = uuidv4();
            await db.createFriendRequest(friendshipId, currentUser.id, friend.id);

            console.log(`Friend request created: ${currentUser.username} -> ${friend.username}`);

            // Emit notification to the friend (this will be handled by socket service)
            req.io.to(friend.id).emit('friend-request-received', {
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
        } catch (err) {
            console.error('Database error creating friendship:', err);
            return res.status(500).json({ error: 'Database error' });
        }
    });
});

// Get friends list (only accepted friendships)
router.get('/friends', (req, res) => {
    console.log('👥 GET /api/friends called');
    console.log('X-User-ID:', req.headers['x-user-id']);

    getCurrentUser(req, res, async (currentUser) => {
        console.log(`👤 Getting friends for user: ${currentUser.username} (${currentUser.device_id})`);

        try {
            const friends = await db.getFriends(currentUser.id);
            console.log(`✅ Found ${friends.length} friends for ${currentUser.username}`);
            res.json(friends);
        } catch (err) {
            console.log('❌ Database error getting friends:', err);
            return res.status(500).json({ error: 'Database error' });
        }
    });
});

// Get pending friend requests
router.get('/friends/requests', (req, res) => {
    getCurrentUser(req, res, async (currentUser) => {
        console.log(`Getting friend requests for user: ${currentUser.username} (${currentUser.device_id})`);

        try {
            const requests = await db.getFriendRequests(currentUser.id);
            console.log(`Found ${requests.length} friend requests for ${currentUser.username}`);
            res.json({ requests });
        } catch (err) {
            console.error('Database error getting friend requests:', err);
            return res.status(500).json({ error: 'Database error' });
        }
    });
});

// Accept friend request
router.post('/friends/:friendshipId/accept', (req, res) => {
    const { friendshipId } = req.params;

    getCurrentUser(req, res, async (currentUser) => {
        try {
            // First verify this user is the recipient of the friend request
            const friendship = await db.getFriendshipById(friendshipId);
            if (!friendship || friendship.friend_id !== currentUser.id || friendship.status !== 'pending') {
                return res.status(404).json({ error: 'Friend request not found' });
            }

            await db.acceptFriendRequest(friendshipId);

            // Get user details for notification
            const requester = await db.getUserById(friendship.user_id);

            // Notify the requester that their request was accepted
            req.io.to(friendship.user_id).emit('friend-request-accepted', {
                friendshipId,
                accepter: {
                    id: currentUser.id,
                    username: currentUser.username
                }
            });

            // Notify the accepter that the friendship is now active
            req.io.to(friendship.friend_id).emit('friendship-updated', {
                friendshipId,
                friend: {
                    id: requester.id,
                    username: requester.username
                },
                status: 'accepted'
            });

            res.json({ success: true, message: 'Friend request accepted' });
        } catch (err) {
            console.error('Database error accepting friend request:', err);
            return res.status(500).json({ error: 'Database error' });
        }
    });
});

// Reject friend request
router.post('/friends/:friendshipId/reject', (req, res) => {
    const { friendshipId } = req.params;

    getCurrentUser(req, res, async (currentUser) => {
        try {
            // First verify this user is the recipient of the friend request
            const friendship = await db.getFriendshipById(friendshipId);
            if (!friendship || friendship.friend_id !== currentUser.id || friendship.status !== 'pending') {
                return res.status(404).json({ error: 'Friend request not found' });
            }

            await db.rejectFriendRequest(friendshipId);

            // Notify the requester that their request was rejected
            req.io.to(friendship.user_id).emit('friend-request-rejected', {
                friendshipId
            });

            res.json({ success: true, message: 'Friend request rejected' });
        } catch (err) {
            console.error('Database error rejecting friend request:', err);
            return res.status(500).json({ error: 'Database error' });
        }
    });
});

// Delete friend (unfriend)
router.delete('/friends/:friendId', (req, res) => {
    const { friendId } = req.params;

    getCurrentUser(req, res, async (currentUser) => {
        try {
            await db.removeFriendship(currentUser.id, friendId);

            console.log(`Friendship removed between ${currentUser.id} and ${friendId}`);

            // Notify the other user
            req.io.to(friendId).emit('friendship-updated', {
                type: 'removed',
                userId: currentUser.id
            });

            res.json({ success: true, message: 'Friend removed' });
        } catch (err) {
            console.error('Database error removing friendship:', err);
            return res.status(500).json({ error: 'Database error' });
        }
    });
});

module.exports = router;

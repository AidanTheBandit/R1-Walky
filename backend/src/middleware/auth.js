const db = require('../config/database');

// Authentication middleware
function userAuthMiddleware(req, res, next) {
    // Try to get user from header
    const userId = req.headers['x-user-id'];

    if (userId) {
        console.log('🔐 Auth middleware: X-User-ID found:', userId);
        req.currentUserId = userId;
    } else {
        console.log('🔐 Auth middleware: No X-User-ID header');
    }

    next();
}

// Helper function to get current user
async function getCurrentUser(req, res, callback) {
    if (req.currentUserId) {
        // If we have a user ID from headers, use it
        console.log('🔍 Looking up user by ID:', req.currentUserId);
        try {
            const user = await db.getUserById(req.currentUserId);
            if (!user) {
                console.log('❌ User not found with ID:', req.currentUserId);
                return res.status(401).json({ error: 'User not found - please re-authenticate' });
            }
            console.log('✅ Found user:', user.username, '(ID:', user.id + ')');
            callback(user);
        } catch (err) {
            console.log('❌ Database error getting user by ID:', err);
            return res.status(500).json({ error: 'Database error' });
        }
    } else {
        // No user ID provided - require authentication
        console.log('❌ No X-User-ID header provided');
        return res.status(401).json({ error: 'Authentication required' });
    }
}

module.exports = {
    userAuthMiddleware,
    getCurrentUser
};

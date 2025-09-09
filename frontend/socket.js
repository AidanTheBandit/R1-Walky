// Socket handling module for SimpleWalky
class SocketHandler {
    constructor(app) {
        this.app = app;
    }

    connectSocket() {
        console.log('connectSocket called');
        if (!this.app.currentUser || !this.app.currentUser.id) {
            console.log('No current user, cannot connect socket');
            return;
        }
        
        if (typeof io === 'undefined') {
            console.log('Socket.io not loaded, cannot connect');
            // Update status to show offline
            const statusElement = document.getElementById('connection-status');
            if (statusElement) {
                statusElement.textContent = 'Offline';
                statusElement.className = 'status offline';
            }
            return;
        }
        
        console.log('Creating socket connection');
        this.app.socket = io();
        this.app.socket.on('connect', () => {
            console.log('Socket connected successfully');
            this.app.socket.emit('register', this.app.currentUser.id);
        });

        this.app.socket.on('connect_error', (error) => {
            console.log('Socket connection error:', error);
            // Update status to show offline
            const statusElement = document.getElementById('connection-status');
            if (statusElement) {
                statusElement.textContent = 'Offline';
                statusElement.className = 'status offline';
            }
        });

        this.app.socket.on('disconnect', () => {
            console.log('Socket disconnected');
            // Update status to show offline
            const statusElement = document.getElementById('connection-status');
            if (statusElement) {
                statusElement.textContent = 'Offline';
                statusElement.className = 'status offline';
            }
        });

        // Listen for real-time friend request events
        this.app.socket.on('friend-request-received', (data) => {
            console.log('Friend request received:', data);
            friendsHandler.loadFriendRequests(); // Refresh friend requests
            utils.updateStatus(`Friend request from ${data.fromUser.username}`);
        });
        
        this.app.socket.on('friend-request-accepted', (data) => {
            console.log('Friend request accepted:', data);
            friendsHandler.loadFriends(); // Refresh friends list
            utils.updateStatus(`${data.accepter.username} accepted your request!`);
        });
        
        this.app.socket.on('friendship-updated', (data) => {
            console.log('Friendship updated:', data);
            friendsHandler.loadFriends(); // Refresh friends list
        });        // Call events (server-mediated)
        this.app.socket.on('incoming-call', (data) => {
            console.log('📞 Incoming server-mediated call:', data);
            this.handleIncomingCall(data);
        });

        this.app.socket.on('call-answered', (data) => {
            console.log('✅ Call answered:', data);
            this.handleCallAnswered(data);
        });

        // Server-mediated audio events
        this.app.socket.on('audio-data', (data) => {
            audioHandler.handleIncomingAudio(data);
        });

        this.app.socket.on('audio-stream-started', (data) => {
            audioHandler.handleAudioStreamStarted(data);
        });

        this.app.socket.on('audio-stream-stopped', (data) => {
            audioHandler.handleAudioStreamStopped(data);
        });

        // Legacy WebRTC events (for backward compatibility)
        this.app.socket.on('ice-candidate', (data) => {
            console.log('⚠️ Received ICE candidate but using server-mediated mode');
        });

        this.app.socket.on('call-ended', (data) => {
            console.log('Call ended by other party:', data);
            callsHandler.endCall();
        });

        this.app.socket.on('user-online', (data) => {
            console.log('User came online:', data);
            friendsHandler.updateFriendStatus(data.userId, true);
        });

        this.app.socket.on('user-offline', (data) => {
            console.log('User went offline:', data);
            friendsHandler.updateFriendStatus(data.userId, false);
        });
    }

    // Handle incoming call (moved from main class)
    handleIncomingCall(data) {
        this.app.currentCall = {
            id: data.callId,
            caller: data.caller,
            callerUsername: data.callerUsername,
            offer: data.offer,
            status: 'incoming'
        };

        // Show incoming call UI
        document.getElementById('caller-name').textContent = data.callerUsername;
        document.getElementById('incoming-call').classList.add('active');

        // Play ringtone
        this.app.ringtone.play().catch(e => console.log('Ringtone play failed:', e));
    }

    // Handle call answered (moved from main class)
    handleCallAnswered(data) {
        if (!this.app.currentCall || this.app.currentCall.id !== data.callId) {
            console.log('Ignoring call answer - wrong call ID');
            return;
        }

        // For server-mediated calls, just set to connected state
        this.app.currentCall.status = 'connected';
        this.app.currentCall.mode = 'server-mediated';
        callsHandler.showEndCallButton();
        utils.updateStatus(`Connected to ${this.app.currentCall.targetUsername} (server-mediated)`);

        console.log('✅ Server-mediated call connected:', data.callId);
    }
}

// Handler will be instantiated in app.js

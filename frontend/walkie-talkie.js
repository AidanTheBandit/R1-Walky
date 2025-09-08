// R1-Walky Frontend - Main Application Logic

class WalkieTalkie {
    constructor() {
        this.currentUser = null;
        this.friends = [];
        this.currentCall = null;
        this.isPTTPressed = false;
        this.peerConnection = null;
        this.localStream = null;
        this.remoteStream = null;

        // Initialize crypto utilities
        this.keyExchange = new KeyExchange();
        this.voiceEncryption = new VoiceEncryption();
        this.secureStorage = new SecureStorage();

        this.init();
    }

    async init() {
        // Check for existing user session
        const hasSession = await this.loadUserSession();
        if (hasSession && this.currentUser) {
            console.log('Found existing session for user:', this.currentUser.username);
            this.showMainScreen();
        } else {
            this.setupEventListeners();
            this.verifyDevice();
        }
    }

    // Device Verification
    async verifyDevice() {
        const status = document.getElementById('verify-status');

        try {
            status.textContent = 'Checking device...';

            // Try to get device information from R1 APIs
            const deviceInfo = await this.getDeviceInfo();

            if (deviceInfo && deviceInfo.verificationCode === 'FF4D06') {
                // Verify with backend
                const verificationResponse = await fetch('/api/auth/verify-device', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        deviceId: deviceInfo.deviceId || 'R1-DEV-001',
                        verificationCode: deviceInfo.verificationCode
                    })
                });

                if (verificationResponse.ok) {
                    const result = await verificationResponse.json();
                    status.textContent = result.message;
                    status.className = 'status';
                    setTimeout(() => this.showAuthScreen(), 1000);
                } else {
                    const error = await verificationResponse.json();
                    status.textContent = error.message || 'Device verification failed';
                    status.className = 'status error';
                }
            } else {
                status.textContent = 'Device verification code not found. Is this a genuine R1?';
                status.className = 'status error';
                // For development, proceed anyway after a delay
                setTimeout(() => this.showAuthScreen(), 3000);
            }
        } catch (error) {
            console.error('Device verification failed:', error);
            status.textContent = 'Verification error - proceeding in development mode';
            status.className = 'status error';
            // For development, proceed anyway
            setTimeout(() => this.showAuthScreen(), 2000);
        }
    }

    async getDeviceInfo() {
        // Try to get device info from R1 hardware APIs
        try {
            // Check if we're in an R1 environment
            if (typeof window !== 'undefined' && window.navigator) {
                // Try to get device info from various sources
                const deviceInfo = {
                    deviceId: null,
                    verificationCode: null,
                    userAgent: navigator.userAgent,
                    platform: navigator.platform
                };

                // Check for R1-specific APIs or identifiers
                if (window.creationStorage && window.creationStorage.plain) {
                    // Try to get stored device info
                    try {
                        const storedDeviceId = await window.creationStorage.plain.getItem('device_id');
                        if (storedDeviceId) {
                            deviceInfo.deviceId = atob(storedDeviceId);
                        }
                    } catch (e) {
                        console.log('No stored device ID found');
                    }
                }

                // Check for hardware identifier in various places
                // This is where FF4D06 should be found on a real R1
                if (navigator.userAgent.includes('R1') || navigator.platform.includes('R1')) {
                    deviceInfo.verificationCode = 'FF4D06'; // This should come from hardware
                    deviceInfo.deviceId = deviceInfo.deviceId || 'R1-' + Math.random().toString(36).substr(2, 9).toUpperCase();
                }

                // Check for device sensors (R1 specific)
                if (window.creationSensors && window.creationSensors.accelerometer) {
                    deviceInfo.hasAccelerometer = true;
                    deviceInfo.verificationCode = 'FF4D06'; // Presence of creationSensors indicates R1
                }

                // Check for creation storage
                if (window.creationStorage) {
                    deviceInfo.hasCreationStorage = true;
                    if (!deviceInfo.verificationCode) {
                        deviceInfo.verificationCode = 'FF4D06'; // Presence of creationStorage indicates R1
                    }
                }

                console.log('Device info detected:', deviceInfo);
                return deviceInfo;
            }
        } catch (error) {
            console.error('Error getting device info:', error);
        }

        // Fallback for development - simulate R1 device
        console.log('Using development fallback device info');
        return {
            deviceId: 'R1-DEV-001',
            verificationCode: 'FF4D06', // Allow development mode
            isDevelopment: true
        };
    }

    // Screen Management
    showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        document.getElementById(screenId).classList.add('active');
    }

    showAuthScreen() {
        this.showScreen('auth-screen');
    }

    showMainScreen() {
        this.showScreen('main-screen');
        this.updateUserInfo();
        this.loadFriends();
    }

        // Authentication
    async registerUser() {
        const username = document.getElementById('username').value.trim();
        const status = document.getElementById('auth-status');

        if (!username) {
            status.textContent = 'Please enter a username';
            status.className = 'status error';
            return;
        }

        try {
            status.textContent = 'Registering...';

            const response = await fetch('/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: username,
                    deviceId: 'R1-DEV-001' // In real R1, get from hardware
                })
            });

            if (response.ok) {
                const user = await response.json();
                this.currentUser = user;

                // Save user session to secure storage
                await this.saveUserSession(user);

                this.showMainScreen();
            } else {
                const error = await response.json();
                status.textContent = `Registration failed: ${error.error}`;
                status.className = 'status error';
            }
        } catch (error) {
            console.error('Registration error:', error);
            status.textContent = 'Network error';
            status.className = 'status error';
        }
    }

    // Session Management
    async saveUserSession(user) {
        try {
            const sessionData = {
                userId: user.id,
                username: user.username,
                deviceId: user.deviceId,
                loginTime: Date.now()
            };

            if (this.secureStorage) {
                await this.secureStorage.storeCredentials(user.username, user.id);
                await this.secureStorage.setItem('user_session', btoa(JSON.stringify(sessionData)));
            }

            // Also store in localStorage as backup
            localStorage.setItem('r1_walky_session', JSON.stringify(sessionData));
        } catch (error) {
            console.error('Failed to save session:', error);
        }
    }

    async loadUserSession() {
        try {
            // Try secure storage first
            if (this.secureStorage) {
                const sessionData = await this.secureStorage.getItem('user_session');
                if (sessionData) {
                    const session = JSON.parse(atob(sessionData));
                    this.currentUser = {
                        id: session.userId,
                        username: session.username,
                        deviceId: session.deviceId
                    };
                    return true;
                }
            }

            // Fallback to localStorage
            const sessionData = localStorage.getItem('r1_walky_session');
            if (sessionData) {
                const session = JSON.parse(sessionData);
                this.currentUser = {
                    id: session.userId,
                    username: session.username,
                    deviceId: session.deviceId
                };
                return true;
            }
        } catch (error) {
            console.error('Failed to load session:', error);
        }
        return false;
    }

    async clearUserSession() {
        try {
            if (this.secureStorage) {
                await this.secureStorage.removeItem('user_session');
            }
            localStorage.removeItem('r1_walky_session');
            this.currentUser = null;
        } catch (error) {
            console.error('Failed to clear session:', error);
        }
    }

    // User Interface Updates
    updateUserInfo() {
        if (this.currentUser) {
            document.getElementById('current-user').textContent = this.currentUser.username;
            document.getElementById('connection-status').textContent = 'Online';
            document.getElementById('connection-status').className = 'status online';
        }
    }

    // Friends Management
    async loadFriends() {
        try {
            const response = await fetch('/api/friends');
            if (response.ok) {
                this.friends = await response.json();
                this.renderFriendsList();
            }
        } catch (error) {
            console.error('Failed to load friends:', error);
        }
    }

    renderFriendsList() {
        const friendsList = document.getElementById('friends-list');
        friendsList.innerHTML = '';

        if (this.friends.length === 0) {
            friendsList.innerHTML = '<div class="friend-item">No friends yet</div>';
            return;
        }

        this.friends.forEach(friend => {
            const friendItem = document.createElement('div');
            friendItem.className = 'friend-item';
            friendItem.innerHTML = `
                <span class="friend-name">${friend.username}</span>
                <span class="friend-status ${friend.status || 'offline'}">${friend.status || 'offline'}</span>
            `;
            friendItem.addEventListener('click', () => this.callFriend(friend));
            friendsList.appendChild(friendItem);
        });
    }

    showAddFriendModal() {
        document.getElementById('add-friend-modal').classList.add('active');
    }

    hideAddFriendModal() {
        document.getElementById('add-friend-modal').classList.remove('active');
        document.getElementById('friend-username').value = '';
        document.getElementById('add-friend-status').textContent = '';
    }

    async addFriend() {
        const username = document.getElementById('friend-username').value.trim();
        const status = document.getElementById('add-friend-status');

        if (!username) {
            status.textContent = 'Please enter a username';
            status.className = 'status error';
            return;
        }

        try {
            status.textContent = 'Sending friend request...';

            const response = await fetch('/api/friends', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ friendUsername: username })
            });

            if (response.ok) {
                const result = await response.json();
                status.textContent = result.message || 'Friend request sent!';
                status.className = 'status';
                setTimeout(() => this.hideAddFriendModal(), 1000);
            } else {
                const error = await response.json();
                status.textContent = error.error || 'Failed to send request';
                status.className = 'status error';
            }
        } catch (error) {
            console.error('Add friend error:', error);
            status.textContent = 'Network error';
            status.className = 'status error';
        }
    }

    // Friend Requests Management
    async loadFriendRequests() {
        try {
            const response = await fetch('/api/friends/requests');
            if (response.ok) {
                const data = await response.json();
                this.friendRequests = data.requests || [];
                this.renderFriendRequests();
            }
        } catch (error) {
            console.error('Failed to load friend requests:', error);
        }
    }

    renderFriendRequests() {
        const requestsList = document.getElementById('friend-requests-list');
        requestsList.innerHTML = '';

        if (this.friendRequests.length === 0) {
            requestsList.innerHTML = '<div class="friend-request-item">No pending requests</div>';
            return;
        }

        this.friendRequests.forEach(request => {
            const requestItem = document.createElement('div');
            requestItem.className = 'friend-request-item';
            requestItem.innerHTML = `
                <span class="username">${request.username}</span>
                <div class="friend-request-buttons">
                    <button class="btn small accept-btn" data-friendship-id="${request.friendshipId}">✓</button>
                    <button class="btn small reject-btn" data-friendship-id="${request.friendshipId}">✗</button>
                </div>
            `;

            // Add event listeners
            const acceptBtn = requestItem.querySelector('.accept-btn');
            const rejectBtn = requestItem.querySelector('.reject-btn');

            acceptBtn.addEventListener('click', () => this.acceptFriendRequest(request.friendshipId));
            rejectBtn.addEventListener('click', () => this.rejectFriendRequest(request.friendshipId));

            requestsList.appendChild(requestItem);
        });
    }

    async acceptFriendRequest(friendshipId) {
        try {
            const response = await fetch(`/api/friends/${friendshipId}/accept`, {
                method: 'POST'
            });

            if (response.ok) {
                // Remove from requests list and refresh friends
                this.friendRequests = this.friendRequests.filter(req => req.friendshipId !== friendshipId);
                this.renderFriendRequests();
                this.loadFriends();
            } else {
                console.error('Failed to accept friend request');
            }
        } catch (error) {
            console.error('Accept friend request error:', error);
        }
    }

    async rejectFriendRequest(friendshipId) {
        try {
            const response = await fetch(`/api/friends/${friendshipId}/reject`, {
                method: 'POST'
            });

            if (response.ok) {
                // Remove from requests list
                this.friendRequests = this.friendRequests.filter(req => req.friendshipId !== friendshipId);
                this.renderFriendRequests();
            } else {
                console.error('Failed to reject friend request');
            }
        } catch (error) {
            console.error('Reject friend request error:', error);
        }
    }

    showFriendRequestsModal() {
        this.loadFriendRequests();
        document.getElementById('friend-requests-modal').classList.add('active');
    }

    hideFriendRequestsModal() {
        document.getElementById('friend-requests-modal').classList.remove('active');
    }

    // Voice Communication
    async callFriend(friend) {
        if (this.currentCall) {
            this.endCall();
            return;
        }

        try {
            this.updateCallStatus(`Calling ${friend.username}...`);
            this.setFriendStatus(friend.username, 'calling');

            // Get user media
            this.localStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    sampleRate: 16000
                }
            });

            // Create peer connection
            this.peerConnection = new RTCPeerConnection({
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' }
                ]
            });

            // Set up event handlers
            this.setupPeerConnectionEvents();

            // Add local stream
            this.localStream.getTracks().forEach(track => {
                this.peerConnection.addTrack(track, this.localStream);
            });

            // Create offer
            const offer = await this.peerConnection.createOffer();
            await this.peerConnection.setLocalDescription(offer);

            // Send offer to friend via signaling server
            const response = await fetch('/api/calls/initiate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    targetUsername: friend.username,
                    offer: offer
                })
            });

            if (response.ok) {
                const callData = await response.json();
                this.currentCall = {
                    id: callData.callId,
                    friend: friend,
                    status: 'calling',
                    isInitiator: true
                };
                this.updatePTTStatus('connecting');

                // Set up socket connection for signaling
                this.setupSignalingSocket();
            } else {
                throw new Error('Failed to initiate call');
            }

        } catch (error) {
            console.error('Call error:', error);
            this.updateCallStatus('Call failed');
            this.setFriendStatus(friend.username, 'offline');
            this.endCall();
        }
    }

    setupPeerConnectionEvents() {
        // Handle ICE candidates
        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate && this.currentCall) {
                // Send ICE candidate to peer
                this.sendSignalingMessage('ice-candidate', {
                    callId: this.currentCall.id,
                    candidate: event.candidate,
                    targetId: this.currentCall.friend.id
                });
            }
        };

        // Handle connection state changes
        this.peerConnection.onconnectionstatechange = () => {
            console.log('Connection state:', this.peerConnection.connectionState);
            if (this.peerConnection.connectionState === 'connected') {
                this.updateCallStatus(`Connected to ${this.currentCall.friend.username}`);
                this.updatePTTStatus('ready');
                this.setFriendStatus(this.currentCall.friend.username, 'online');
            } else if (this.peerConnection.connectionState === 'disconnected' ||
                       this.peerConnection.connectionState === 'failed') {
                this.updateCallStatus('Call disconnected');
                this.endCall();
            }
        };

        // Handle remote stream
        this.peerConnection.ontrack = (event) => {
            console.log('Received remote stream');
            this.remoteStream = event.streams[0];
            this.playRemoteAudio();
        };
    }

    setupSignalingSocket() {
        // Initialize socket connection if not already done
        if (!this.socket) {
            this.socket = io();

            this.socket.on('connect', () => {
                console.log('Connected to signaling server');
                // Register this user
                if (this.currentUser) {
                    this.socket.emit('register', this.currentUser.id);
                }
            });

            // Handle incoming call
            this.socket.on('incoming-call', (data) => {
                this.handleIncomingCall(data);
            });

            // Handle call answered
            this.socket.on('call-answered', (data) => {
                this.handleCallAnswered(data);
            });

            // Handle ICE candidates
            this.socket.on('ice-candidate', (data) => {
                this.handleIceCandidate(data);
            });
        }
    }

    sendSignalingMessage(type, data) {
        if (this.socket) {
            this.socket.emit(type, data);
        }
    }

    handleIncomingCall(data) {
        console.log('Incoming call:', data);
        // For now, automatically accept calls (in a real app, show accept/reject UI)
        this.acceptIncomingCall(data);
    }

    async acceptIncomingCall(data) {
        try {
            // Get user media
            this.localStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    sampleRate: 16000
                }
            });

            // Create peer connection
            this.peerConnection = new RTCPeerConnection({
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' }
                ]
            });

            // Set up event handlers
            this.setupPeerConnectionEvents();

            // Add local stream
            this.localStream.getTracks().forEach(track => {
                this.peerConnection.addTrack(track, this.localStream);
            });

            // Set remote description
            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));

            // Create answer
            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);

            // Send answer back
            this.sendSignalingMessage('answer-call', {
                callId: data.callId,
                answer: answer
            });

            // Set up current call
            this.currentCall = {
                id: data.callId,
                friend: { id: data.caller, username: 'Caller' }, // We don't know the username here
                status: 'connected',
                isInitiator: false
            };

            this.updateCallStatus('Call connected');
            this.updatePTTStatus('ready');

        } catch (error) {
            console.error('Error accepting call:', error);
            this.endCall();
        }
    }

    async handleCallAnswered(data) {
        if (this.currentCall && this.currentCall.id === data.callId) {
            try {
                await this.peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
                console.log('Call answered successfully');
            } catch (error) {
                console.error('Error setting remote description:', error);
            }
        }
    }

    async handleIceCandidate(data) {
        if (this.currentCall && this.currentCall.id === data.callId) {
            try {
                await this.peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
            } catch (error) {
                console.error('Error adding ICE candidate:', error);
            }
        }
    }

    async playRemoteAudio() {
        if (this.remoteStream) {
            const audio = new Audio();
            audio.srcObject = this.remoteStream;
            audio.play();
        }
    }

    endCall() {
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }

        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }

        if (this.currentCall) {
            this.setFriendStatus(this.currentCall.friend.username, 'offline');
            this.currentCall = null;
        }

        this.updatePTTStatus('ready');
        this.updateCallStatus('');
    }

    // PTT Handling
    handlePTTStart() {
        if (!this.currentCall) return;

        this.isPTTPressed = true;
        this.updatePTTStatus('talking');

        // Enable microphone transmission
        if (this.localStream) {
            this.localStream.getAudioTracks().forEach(track => {
                track.enabled = true;
            });
        }
    }

    handlePTTEnd() {
        if (!this.currentCall) return;

        this.isPTTPressed = false;
        this.updatePTTStatus('listening');

        // Disable microphone (but keep connection alive)
        if (this.localStream) {
            this.localStream.getAudioTracks().forEach(track => {
                track.enabled = false;
            });
        }
    }

    updatePTTStatus(status) {
        const indicator = document.getElementById('ptt-indicator');
        const statusText = document.querySelector('.ptt-status');

        indicator.className = `ptt-indicator ${status}`;
        statusText.textContent = status.charAt(0).toUpperCase() + status.slice(1);
    }

    updateCallStatus(message) {
        document.getElementById('call-status').textContent = message;
    }

    setFriendStatus(username, status) {
        const friendItems = document.querySelectorAll('.friend-item');
        friendItems.forEach(item => {
            const nameSpan = item.querySelector('.friend-name');
            const statusSpan = item.querySelector('.friend-status');
            if (nameSpan && nameSpan.textContent === username) {
                statusSpan.textContent = status;
                statusSpan.className = `friend-status ${status}`;
            }
        });
    }

    // Hardware Event Handlers
    setupHardwareEvents() {
        // PTT Button (side button) - for voice transmission, NOT LLM
        window.addEventListener('sideClick', () => {
            console.log('PTT sideClick detected');
            if (this.currentCall) {
                if (this.isPTTPressed) {
                    this.handlePTTEnd();
                } else {
                    this.handlePTTStart();
                }
            }
        });

        // Long press for PTT
        window.addEventListener('longPressStart', () => {
            console.log('PTT longPressStart detected');
            if (this.currentCall) {
                this.handlePTTStart();
            }
        });

        window.addEventListener('longPressEnd', () => {
            console.log('PTT longPressEnd detected');
            if (this.currentCall) {
                this.handlePTTEnd();
            }
        });

        // Scroll wheel for navigation
        window.addEventListener('scrollUp', () => {
            // Navigate up in friends list
            this.navigateFriends(-1);
        });

        window.addEventListener('scrollDown', () => {
            // Navigate down in friends list
            this.navigateFriends(1);
        });
    }

    navigateFriends(direction) {
        const friendItems = document.querySelectorAll('.friend-item');
        if (friendItems.length === 0) return;

        // Find currently selected item
        let currentIndex = -1;
        friendItems.forEach((item, index) => {
            if (item.classList.contains('selected')) {
                currentIndex = index;
            }
        });

        // Remove current selection
        if (currentIndex >= 0) {
            friendItems[currentIndex].classList.remove('selected');
        }

        // Calculate new index
        currentIndex += direction;
        if (currentIndex < 0) currentIndex = friendItems.length - 1;
        if (currentIndex >= friendItems.length) currentIndex = 0;

        // Select new item
        friendItems[currentIndex].classList.add('selected');
    }

    // Event Listeners
    setupEventListeners() {
        // Auth
        document.getElementById('register-btn').addEventListener('click', () => this.registerUser());

        // Friends
        document.getElementById('add-friend-btn').addEventListener('click', () => this.showAddFriendModal());
        document.getElementById('friend-requests-btn').addEventListener('click', () => this.showFriendRequestsModal());
        document.getElementById('cancel-add-friend').addEventListener('click', () => this.hideAddFriendModal());
        document.getElementById('confirm-add-friend').addEventListener('click', () => this.addFriend());
        document.getElementById('close-friend-requests').addEventListener('click', () => this.hideFriendRequestsModal());

        // PTT
        document.getElementById('ptt-indicator').addEventListener('click', () => {
            if (this.isPTTPressed) {
                this.handlePTTEnd();
            } else {
                this.handlePTTStart();
            }
        });

        // Hardware events
        this.setupHardwareEvents();

        // Enter key for inputs
        document.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const activeElement = document.activeElement;
                if (activeElement.id === 'username') {
                    this.registerUser();
                } else if (activeElement.id === 'friend-username') {
                    this.addFriend();
                }
            }
        });
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new WalkieTalkie();
});

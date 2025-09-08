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
        console.log('🚀 Initializing WalkieTalkie app...');

        // Check for existing user session (synchronous)
        console.log('🔍 Checking for existing user session...');
        const hasSession = this.loadUserSession();

        if (hasSession && this.currentUser) {
            console.log('✅ Found existing session for user:', this.currentUser.username);
            this.showMainScreen();
        } else {
            console.log('❌ No valid session found, showing auth screen');
            this.setupEventListeners();
            this.verifyDevice();
        }

        // Show debug panel for development
        this.showDebugPanel();
    }

    // Helper method to make authenticated API calls - Enhanced
    async apiCall(endpoint, options = {}) {
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };

        // Add user ID to headers if we have a current user
        if (this.currentUser && this.currentUser.id) {
            headers['X-User-ID'] = this.currentUser.id;
            console.log('🔑 Adding auth header for user:', this.currentUser.username, 'ID:', this.currentUser.id);
        } else {
            console.log('⚠️ No current user for API call to:', endpoint);
            // Try to load session if we don't have a user
            const hasSession = await this.loadUserSession();
            if (hasSession && this.currentUser) {
                headers['X-User-ID'] = this.currentUser.id;
                console.log('🔄 Recovered session for API call');
            }
        }

        try {
            const response = await fetch(endpoint, {
                ...options,
                headers
            });

            console.log('📡 API call to:', endpoint, 'Status:', response.status);

            // Handle authentication errors
            if (response.status === 401) {
                console.log('🚫 Authentication error - attempting to recover session');

                // Try to reload session
                const hasSession = await this.loadUserSession();
                if (hasSession && this.currentUser) {
                    console.log('🔄 Session recovered, retrying API call');
                    // Retry the call with recovered session
                    headers['X-User-ID'] = this.currentUser.id;
                    const retryResponse = await fetch(endpoint, {
                        ...options,
                        headers
                    });
                    if (retryResponse.ok) {
                        console.log('✅ API call succeeded after session recovery');
                        return retryResponse;
                    }
                }

                // If recovery failed, clear session and redirect
                console.log('❌ Session recovery failed, clearing session');
                await this.clearUserSession();
                this.showAuthScreen();
                throw new Error('Authentication required');
            }

            return response;
        } catch (error) {
            if (error.message === 'Authentication required') {
                throw error;
            }
            console.error('Network error:', error);
            throw error;
        }
    }

    // Device Verification - Simplified for development
    async verifyDevice() {
        const status = document.getElementById('verify-status');

        try {
            status.textContent = 'Checking device...';

            // For development, skip R1 verification and proceed directly
            console.log('🔧 Development mode: Skipping R1 verification');
            status.textContent = 'Development mode - proceeding...';
            status.className = 'status';

            // Get device info (but don't require R1)
            const deviceInfo = await this.getDeviceInfo();

            setTimeout(() => this.showAuthScreen(), 1000);
        } catch (error) {
            console.error('Device verification failed:', error);
            status.textContent = 'Verification error - proceeding in development mode';
            status.className = 'status error';
            // For development, proceed anyway
            setTimeout(() => this.showAuthScreen(), 2000);
        }
    }

    // Debug functionality
    showDebugPanel() {
        const debugPanel = document.getElementById('debug-panel');
        debugPanel.style.display = 'block';
        this.updateDebugInfo();

        // Add check storage button if it doesn't exist
        if (!document.getElementById('check-storage')) {
            const checkButton = document.createElement('button');
            checkButton.id = 'check-storage';
            checkButton.className = 'btn small';
            checkButton.textContent = 'Check Cookie';
            checkButton.addEventListener('click', () => this.checkStorageContents());
            debugPanel.appendChild(checkButton);
        }

        // Add clear storage button if it doesn't exist
        if (!document.getElementById('clear-storage')) {
            const clearButton = document.createElement('button');
            clearButton.id = 'clear-storage';
            clearButton.className = 'btn small';
            clearButton.textContent = 'Clear Cookie';
            clearButton.style.background = '#f44336';
            clearButton.style.borderColor = '#d32f2f';
            clearButton.addEventListener('click', () => this.clearAllStorage());
            debugPanel.appendChild(clearButton);
        }
    }

    updateDebugInfo() {
        const debugInfo = document.getElementById('debug-info');
        const deviceInfo = this.getDeviceInfo();

        // Check cookie status
        const cookies = document.cookie.split(';');
        const sessionCookie = cookies.find(cookie => cookie.trim().startsWith('r1_walky_session='));
        const hasCookie = !!sessionCookie;

        debugInfo.innerHTML = `
            <div><strong>User:</strong> ${this.currentUser ? this.currentUser.username : 'None'}</div>
            <div><strong>User ID:</strong> ${this.currentUser ? this.currentUser.id : 'None'}</div>
            <div><strong>Device ID:</strong> ${deviceInfo.deviceId || 'Unknown'}</div>
            <div><strong>Verification:</strong> ${deviceInfo.verificationCode || 'None'}</div>
            <div><strong>Has Sensors:</strong> ${deviceInfo.hasAccelerometer ? 'Yes' : 'No'}</div>
            <div><strong>Has Storage:</strong> ${deviceInfo.hasCreationStorage ? 'Yes' : 'No'}</div>
            <div><strong>Auth Method:</strong> Cookies</div>
            <div><strong>Session Cookie:</strong> ${hasCookie ? 'Yes' : 'No'}</div>
            <div><strong>User Agent:</strong> ${navigator.userAgent.substring(0, 30)}...</div>
            <div><strong>Platform:</strong> ${navigator.platform}</div>
            <div><strong>Session:</strong> ${this.currentUser ? 'Active' : 'None'}</div>
        `;
    }

    // Enhanced device info with more debugging
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
                    platform: navigator.platform,
                    hasAccelerometer: false,
                    hasCreationStorage: false,
                    hasCreationSensors: false,
                    isDevelopment: false
                };

                // Check for R1-specific APIs or identifiers
                if (window.creationStorage && window.creationStorage.plain) {
                    deviceInfo.hasCreationStorage = true;
                    console.log('✅ creationStorage.plain available');

                    // Try to get stored device info from secure storage first
                    if (window.creationStorage.secure) {
                        try {
                            const storedDeviceId = await window.creationStorage.secure.getItem('r1_walky_device_id');
                            if (storedDeviceId) {
                                deviceInfo.deviceId = atob(storedDeviceId);
                                console.log('📱 Stored device ID found in secure storage:', deviceInfo.deviceId);
                            } else {
                                // Generate and store a new device ID in secure storage
                                const newDeviceId = 'R1-' + Math.random().toString(36).substr(2, 9).toUpperCase();
                                await window.creationStorage.secure.setItem('r1_walky_device_id', btoa(newDeviceId));
                                deviceInfo.deviceId = newDeviceId;
                                console.log('🆕 New device ID generated and stored in secure storage:', deviceInfo.deviceId);
                            }
                        } catch (error) {
                            console.log('⚠️ Error accessing secure storage for device ID:', error);
                            // Fallback to plain storage
                            try {
                                const storedDeviceId = await window.creationStorage.plain.getItem('device_id');
                                if (storedDeviceId) {
                                    deviceInfo.deviceId = atob(storedDeviceId);
                                    console.log('📱 Stored device ID found in plain storage:', deviceInfo.deviceId);
                                }
                            } catch (e) {
                                console.log('⚠️ Error accessing plain storage for device ID:', e);
                            }
                        }
                    } else {
                        // Fallback to plain storage if secure storage not available
                        try {
                            const storedDeviceId = await window.creationStorage.plain.getItem('device_id');
                            if (storedDeviceId) {
                                deviceInfo.deviceId = atob(storedDeviceId);
                                console.log('📱 Stored device ID found in plain storage:', deviceInfo.deviceId);
                            } else {
                                console.log('❌ No stored device ID');
                            }
                        } catch (e) {
                            console.log('⚠️ Error accessing stored device ID:', e);
                        }
                    }
                } else {
                    console.log('❌ creationStorage.plain not available');
                }

                // Check for hardware identifier in various places
                // This is where FF4D06 should be found on a real R1
                if (navigator.userAgent.includes('R1') || navigator.platform.includes('R1')) {
                    deviceInfo.verificationCode = 'FF4D06'; // This should come from hardware
                    deviceInfo.deviceId = deviceInfo.deviceId || 'R1-' + Math.random().toString(36).substr(2, 9).toUpperCase();
                    console.log('🤖 R1 detected in user agent/platform');
                } else {
                    console.log('❌ R1 not detected in user agent/platform');
                }

                // Check for device sensors (R1 specific)
                if (window.creationSensors && window.creationSensors.accelerometer) {
                    deviceInfo.hasAccelerometer = true;
                    deviceInfo.hasCreationSensors = true;
                    deviceInfo.verificationCode = 'FF4D06'; // Presence of creationSensors indicates R1
                    console.log('✅ creationSensors.accelerometer available');
                } else {
                    console.log('❌ creationSensors.accelerometer not available');
                }

                // Check for creation storage
                if (window.creationStorage) {
                    deviceInfo.hasCreationStorage = true;
                    if (!deviceInfo.verificationCode) {
                        deviceInfo.verificationCode = 'FF4D06'; // Presence of creationStorage indicates R1
                    }
                    console.log('✅ creationStorage available');
                } else {
                    console.log('❌ creationStorage not available');
                }

                // Check for other R1-specific APIs
                if (window.PluginMessageHandler) {
                    console.log('✅ PluginMessageHandler available (R1 API)');
                } else {
                    console.log('❌ PluginMessageHandler not available');
                }

                console.log('📊 Device info detected:', deviceInfo);
                return deviceInfo;
            }
        } catch (error) {
            console.error('❌ Error getting device info:', error);
        }

        // Fallback for development - simulate R1 device
        console.log('🔧 Using development fallback device info');
        return {
            deviceId: 'R1-DEV-001',
            verificationCode: 'FF4D06', // Allow development mode
            isDevelopment: true,
            hasAccelerometer: false,
            hasCreationStorage: false,
            hasCreationSensors: false
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
        // Check if we have a valid user before showing main screen
        if (!this.currentUser || !this.currentUser.id) {
            console.log('No valid user session - redirecting to auth');
            this.showAuthScreen();
            return;
        }

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

            // Get device info for device ID
            const deviceInfo = await this.getDeviceInfo();
            const deviceId = deviceInfo.deviceId || 'R1-DEV-001';

            const response = await this.apiCall('/api/users', {
                method: 'POST',
                body: JSON.stringify({
                    username: username,
                    deviceId: deviceId
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

    // Session Management - Simplified to use cookies
    saveUserSession(user) {
        try {
            console.log('💾 Saving user session to cookie for:', user.username);

            // Save to cookie (expires in 30 days)
            const sessionData = {
                userId: user.id,
                username: user.username,
                deviceId: user.deviceId,
                loginTime: Date.now()
            };

            const encodedData = btoa(JSON.stringify(sessionData));
            document.cookie = `r1_walky_session=${encodedData}; path=/; max-age=${30 * 24 * 60 * 60}; SameSite=Lax`;

            console.log('✅ Session saved to cookie');
        } catch (error) {
            console.error('❌ Failed to save session:', error);
        }
    }

    loadUserSession() {
        try {
            console.log('🔄 Loading user session from cookie...');

            // Get cookie
            const cookies = document.cookie.split(';');
            const sessionCookie = cookies.find(cookie => cookie.trim().startsWith('r1_walky_session='));

            if (sessionCookie) {
                const encodedData = sessionCookie.split('=')[1];
                if (!encodedData) {
                    console.log('❌ Empty session cookie data');
                    return false;
                }

                const session = JSON.parse(atob(encodedData));

                // Validate session data
                if (!session.userId || !session.username) {
                    console.log('❌ Invalid session data:', session);
                    return false;
                }

                this.currentUser = {
                    id: session.userId,
                    username: session.username,
                    deviceId: session.deviceId
                };

                console.log('✅ Session loaded from cookie:', this.currentUser.username);
                return true;
            }

            console.log('❌ No session cookie found');
            return false;
        } catch (error) {
            console.error('❌ Failed to load session:', error);
            // Clear corrupted cookie
            this.clearUserSession();
            return false;
        }
    }

    clearUserSession() {
        try {
            console.log('🧹 Clearing session cookie');

            // Clear cookie
            document.cookie = 'r1_walky_session=; path=/; max-age=0; SameSite=Lax';

            this.currentUser = null;
            console.log('✅ Session cookie cleared');
        } catch (error) {
            console.error('❌ Failed to clear session:', error);
        }
    }

    // Debug method to check storage contents
    async checkStorageContents() {
        console.log('🔍 Checking storage contents...');

        // Check localStorage
        const localSession = localStorage.getItem('r1_walky_session');
        console.log('💾 localStorage session:', localSession ? JSON.parse(localSession) : 'None');

        // Check R1 secure storage
        if (this.isR1Device()) {
            try {
                const r1Session = await window.creationStorage.secure.getItem('r1_walky_auth_session');
                console.log('� R1 secure storage session:', r1Session ? JSON.parse(atob(r1Session)) : 'None');
            } catch (error) {
                console.log('❌ R1 secure storage error:', error);
            }
        }

        // Check secureStorage
        if (this.secureStorage) {
            try {
                const secureSession = await this.secureStorage.getItem('user_session');
                console.log('🔐 secureStorage session:', secureSession ? JSON.parse(atob(secureSession)) : 'None');
            } catch (error) {
                console.log('❌ secureStorage error:', error);
            }
        }
    }

    // Debug method to clear all storage
    async clearAllStorage() {
        console.log('🧹 Clearing all storage...');

        try {
            // Clear R1 secure storage
            if (this.isR1Device()) {
                await window.creationStorage.secure.removeItem('r1_walky_auth_session');
                await window.creationStorage.secure.removeItem('r1_walky_device_id');
                console.log('✅ Cleared R1 secure storage');
            }

            // Clear secureStorage
            if (this.secureStorage) {
                await this.secureStorage.removeItem('user_session');
                console.log('✅ Cleared secureStorage');
            }

            // Clear localStorage
            localStorage.removeItem('r1_walky_session');
            console.log('✅ Cleared localStorage');

            // Clear current user
            this.currentUser = null;
            console.log('✅ Cleared current user');

            // Redirect to auth
            this.showAuthScreen();
            console.log('✅ Redirected to auth screen');
        } catch (error) {
            console.error('❌ Error clearing storage:', error);
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
            const response = await this.apiCall('/api/friends');
            if (response.ok) {
                this.friends = await response.json();
                this.renderFriendsList();
            } else {
                console.error('Failed to load friends:', response.status);
                // If it's an auth error, apiCall will handle redirecting
            }
        } catch (error) {
            console.error('Failed to load friends:', error);
            // If it's an auth error, apiCall will handle redirecting
        }
    }

    renderFriendsList() {
        const friendsList = document.getElementById('friends-list');
        if (!friendsList) {
            console.warn('⚠️ Friends list element not found');
            return;
        }

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

            // Add click listener immediately
            friendItem.addEventListener('click', () => {
                console.log(`👆 Friend clicked: ${friend.username}`);
                this.callFriend(friend);
            });

            friendsList.appendChild(friendItem);
        });

        console.log(`✅ Rendered ${this.friends.length} friends`);
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

            const response = await this.apiCall('/api/friends', {
                method: 'POST',
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
            const response = await this.apiCall('/api/friends/requests');
            if (response.ok) {
                const data = await response.json();
                this.friendRequests = data.requests || [];
                this.renderFriendRequests();
            } else {
                console.error('Failed to load friend requests:', response.status);
            }
        } catch (error) {
            console.error('Failed to load friend requests:', error);
        }
    }

    renderFriendRequests() {
        const requestsList = document.getElementById('friend-requests-list');
        if (!requestsList) {
            console.warn('⚠️ Friend requests list element not found');
            return;
        }

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

            // Add event listeners immediately after creating elements
            const acceptBtn = requestItem.querySelector('.accept-btn');
            const rejectBtn = requestItem.querySelector('.reject-btn');

            if (acceptBtn) {
                acceptBtn.addEventListener('click', () => this.acceptFriendRequest(request.friendshipId));
                console.log(`✅ Added accept listener for request ${request.friendshipId}`);
            }

            if (rejectBtn) {
                rejectBtn.addEventListener('click', () => this.rejectFriendRequest(request.friendshipId));
                console.log(`✅ Added reject listener for request ${request.friendshipId}`);
            }

            requestsList.appendChild(requestItem);
        });

        console.log(`✅ Rendered ${this.friendRequests.length} friend requests`);
    }

    async acceptFriendRequest(friendshipId) {
        try {
            const response = await this.apiCall(`/api/friends/${friendshipId}/accept`, {
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
            const response = await this.apiCall(`/api/friends/${friendshipId}/reject`, {
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
            const response = await this.apiCall('/api/calls/initiate', {
                method: 'POST',
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

            // Handle friend request received
            this.socket.on('friend-request-received', (data) => {
                this.handleFriendRequestReceived(data);
            });

            // Handle friend request accepted
            this.socket.on('friend-request-accepted', (data) => {
                this.handleFriendRequestAccepted(data);
            });

            // Handle friend request rejected
            this.socket.on('friend-request-rejected', (data) => {
                this.handleFriendRequestRejected(data);
            });

            // Handle friendship updated
            this.socket.on('friendship-updated', (data) => {
                this.handleFriendshipUpdated(data);
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

    // Friend-related WebSocket event handlers
    handleFriendRequestReceived(data) {
        console.log('Friend request received:', data);
        this.showNotification(`Friend request from ${data.fromUser.username}`, 'info');
        // Refresh friend requests list
        this.loadFriendRequests();
    }

    handleFriendRequestAccepted(data) {
        console.log('Friend request accepted:', data);
        this.showNotification(`${data.accepter.username} accepted your friend request!`, 'success');
        // Refresh friends list
        this.loadFriends();
    }

    handleFriendRequestRejected(data) {
        console.log('Friend request rejected:', data);
        this.showNotification('Your friend request was declined', 'warning');
    }

    handleFriendshipUpdated(data) {
        console.log('Friendship updated:', data);
        if (data.status === 'accepted') {
            this.showNotification(`You are now friends with ${data.friend.username}!`, 'success');
            // Refresh friends list
            this.loadFriends();
        }
    }

    // Notification system
    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <span class="notification-message">${message}</span>
            <button class="notification-close">&times;</button>
        `;

        // Add to notifications container
        let container = document.getElementById('notifications-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'notifications-container';
            container.className = 'notifications-container';
            document.body.appendChild(container);
        }

        container.appendChild(notification);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 5000);

        // Close button functionality
        const closeBtn = notification.querySelector('.notification-close');
        closeBtn.addEventListener('click', () => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        });
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

    // Event Listeners - Improved with better error handling
    setupEventListeners() {
        console.log('🎧 Setting up event listeners...');

        // Helper function to safely add event listener
        const addListener = (id, event, handler, description) => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener(event, handler);
                console.log(`✅ Added ${event} listener for ${description}`);
            } else {
                console.warn(`⚠️ Element ${id} not found for ${description}`);
            }
        };

        // Auth
        addListener('register-btn', 'click', () => this.registerUser(), 'register button');

        // Friends
        addListener('add-friend-btn', 'click', () => this.showAddFriendModal(), 'add friend button');
        addListener('friend-requests-btn', 'click', () => this.showFriendRequestsModal(), 'friend requests button');
        addListener('cancel-add-friend', 'click', () => this.hideAddFriendModal(), 'cancel add friend');
        addListener('confirm-add-friend', 'click', () => this.addFriend(), 'confirm add friend');
        addListener('close-friend-requests', 'click', () => this.hideFriendRequestsModal(), 'close friend requests');

        // PTT
        addListener('ptt-indicator', 'click', () => {
            if (this.isPTTPressed) {
                this.handlePTTEnd();
            } else {
                this.handlePTTStart();
            }
        }, 'PTT indicator');

        // Debug
        addListener('refresh-debug', 'click', () => this.updateDebugInfo(), 'refresh debug');

        // Hardware events
        this.setupHardwareEvents();

        console.log('✅ Event listeners setup complete');
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new WalkieTalkie();
});

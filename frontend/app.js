class SimpleWalky {
    constructor() {
        this.currentUser = null;
        this.friends = [];
        this.friendRequests = [];
        this.socket = null;
        this.currentCall = null;
        this.peerConnection = null;
        this.localStream = null;
        this.remoteStream = null;
        this.ringtone = null;
        this.remoteAudio = null;
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
            sampleRate: 16000
        });
        this.gainNode = null;
        this.volumeLevel = 2.0; // Default 200% volume boost
        this.isRecording = false;
        this.useServerMediated = true; // Enable server-mediated audio by default
        this.init();
    }

    init() {
        console.log('Starting SimpleWalky...');
        
        // Test XMLHttpRequest availability
        console.log('XMLHttpRequest available:', typeof XMLHttpRequest);
        console.log('Promise available:', typeof Promise);
        console.log('JSON available:', typeof JSON);
        
        // Test basic XMLHttpRequest
        if (typeof XMLHttpRequest !== 'undefined') {
            const testXhr = new XMLHttpRequest();
            testXhr.open('GET', '/health', true);
            testXhr.onload = () => console.log('Test XMLHttpRequest success, status:', testXhr.status);
            testXhr.onerror = () => console.log('Test XMLHttpRequest failed');
            testXhr.send();
        }
        
        // Create handlers first
        window.utils = new Utils(this);
        window.audioHandler = new AudioHandler(this);
        window.socketHandler = new SocketHandler(this);
        window.friendsHandler = new FriendsHandler(this);
        window.callsHandler = new CallsHandler(this);
        
        // Initialize audio elements
        this.ringtone = document.getElementById('ringtone');
        this.remoteAudio = document.getElementById('remote-audio');
        
        // Initialize volume control
        this.setupVolumeControl();
        
        // Check for existing session
        const saved = localStorage.getItem('walky_user');
        if (saved) {
            this.currentUser = JSON.parse(saved);
            console.log('Found saved user:', this.currentUser);
            
            // Validate the user exists by making a test API call
            this.validateUser().then(isValid => {
                if (isValid) {
                    this.showMainScreen();
                } else {
                    console.log('Saved user is invalid, clearing and showing login');
                    localStorage.removeItem('walky_user');
                    this.currentUser = null;
                    this.updateStatus('Session expired - please log in again');
                    this.setupLoginListeners();
                }
            }).catch(error => {
                console.log('Error validating user, clearing and showing login:', error);
                localStorage.removeItem('walky_user');
                this.currentUser = null;
                this.updateStatus('Connection error - please log in again');
                this.setupLoginListeners();
            });
        } else {
            console.log('No saved user found, showing login screen');
            this.setupLoginListeners();
        }
        
        this.updateDebug();
    }

    setupVolumeControl() {
        const volumeSlider = document.getElementById('volume-slider');
        const volumeValue = document.getElementById('volume-value');

        if (volumeSlider && volumeValue) {
            // Set initial values
            volumeSlider.value = this.volumeLevel;
            volumeValue.textContent = Math.round(this.volumeLevel * 100) + '%';

            // Add event listener for volume changes
            volumeSlider.addEventListener('input', (e) => {
                this.volumeLevel = parseFloat(e.target.value);
                volumeValue.textContent = Math.round(this.volumeLevel * 100) + '%';

                // Apply volume boost immediately if we have audio context
                if (this.gainNode) {
                    this.gainNode.gain.value = this.volumeLevel;
                    console.log(`🔊 Volume boosted to ${Math.round(this.volumeLevel * 100)}%`);
                }

                // Also set HTML audio element volume as fallback
                if (this.remoteAudio) {
                    this.remoteAudio.volume = Math.min(this.volumeLevel, 1.0);
                }
            });
        }
    }

    setupLoginListeners() {
        document.getElementById('login-btn').onclick = () => this.login();
        document.getElementById('username').onkeypress = (e) => {
            if (e.key === 'Enter') this.login();
        };
    }

    setupMainListeners() {
        document.getElementById('add-friend-btn').onclick = () => friendsHandler.addFriend();
        document.getElementById('friend-username').onkeypress = (e) => {
            if (e.key === 'Enter') friendsHandler.addFriend();
        };
        
        const pttBtn = document.getElementById('ptt-button');
        pttBtn.onmousedown = () => callsHandler.startTalk();
        pttBtn.onmouseup = () => callsHandler.stopTalk();
        pttBtn.ontouchstart = () => callsHandler.startTalk();
        pttBtn.ontouchend = () => callsHandler.stopTalk();
        
        // Call handling
        document.getElementById('answer-call').onclick = () => callsHandler.answerCall();
        document.getElementById('reject-call').onclick = () => callsHandler.rejectCall();
        document.getElementById('end-call-button').onclick = () => callsHandler.endCall();
        
        // R1 hardware button support
        window.addEventListener('longPressStart', () => callsHandler.startTalk());
        window.addEventListener('longPressEnd', () => callsHandler.stopTalk());
        window.addEventListener('sideClick', () => {
            if (this.currentCall && this.currentCall.status === 'incoming') {
                callsHandler.answerCall();
            }
        });
    }

    login() {
        const username = document.getElementById('username').value.trim();
        const status = document.getElementById('login-status');

        if (!username) {
            status.textContent = 'Enter username';
            status.className = 'status error';
            return;
        }

        status.textContent = 'Joining...';
        status.className = 'status';

        const deviceId = 'R1-' + Date.now();
        window.utils.xhrRequest('/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, deviceId })
        }).then(response => {
            console.log('Login response:', response.ok, response.status);
            if (response.ok) {
                response.json().then(user => {
                    this.currentUser = user;
                    localStorage.setItem('walky_user', JSON.stringify(user));
                    this.showMainScreen();
                }).catch(error => {
                    console.error('JSON parse error:', error);
                    status.textContent = 'Response error';
                    status.className = 'status error';
                });
            } else {
                response.json().then(error => {
                    status.textContent = error.error || 'Login failed';
                    status.className = 'status error';
                }).catch(() => {
                    status.textContent = 'Login failed';
                    status.className = 'status error';
                });
            }
        }).catch(error => {
            console.error('Login error:', error);
            status.textContent = 'Network error';
            status.className = 'status error';
        });
    }

    showMainScreen() {
        document.getElementById('login-screen').classList.remove('active');
        document.getElementById('main-screen').classList.add('active');
        document.getElementById('current-user').textContent = this.currentUser.username;
        document.getElementById('connection-status').textContent = 'Online';
        document.getElementById('connection-status').className = 'status online';

        this.setupMainListeners();
        friendsHandler.loadFriends();
        friendsHandler.loadFriendRequests();
        socketHandler.connectSocket();
    }

    updateDebug() {
        const debug = document.getElementById('debug');
        const mode = this.useServerMediated ? 'Server-Mediated' : 'WebRTC P2P';
        debug.innerHTML = `
            User: ${this.currentUser ? this.currentUser.username : 'None'}<br>
            Friends: ${this.friends.length}<br>
            Requests: ${this.friendRequests.length}<br>
            Call: ${this.currentCall ? this.currentCall.status : 'None'}<br>
            Mode: ${mode}<br>
            Platform: ${navigator.platform.substring(0, 10)}
        `;
    }

    validateUser() {
        console.log('validateUser called');
        if (!this.currentUser || !this.currentUser.id) {
            console.log('No current user or ID');
            return Promise.resolve(false);
        }
        
        console.log('Validating user:', this.currentUser.username, 'ID:', this.currentUser.id);
        
        return new Promise((resolve, reject) => {
            window.utils.xhrRequest('/api/users/me', {
                headers: { 'X-User-ID': this.currentUser.id }
            }).then(response => {
                console.log('validateUser response:', response.ok, response.status);
                resolve(response.ok);
            }).catch(error => {
                console.error('User validation error:', error);
                resolve(false);
            });
        });
    }

    updateStatus(message) {
        const statusElement = document.getElementById('call-status');
        if (statusElement) {
            statusElement.textContent = message;
        }
    }
}

// Start the app
const app = new SimpleWalky();

// Update debug info periodically
setInterval(() => app.updateDebug(), 5000);

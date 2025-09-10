import { useState, useEffect, useRef } from 'react'
import { io } from 'socket.io-client'
import './App.css'

// Simple alert for debugging on old browsers
window.debugR1Walky = function(message) {
  console.log('R1-Walky Debug:', message);
  // Also try alert for very old browsers
  if (typeof alert !== 'undefined') {
    alert('R1-Walky: ' + message);
  }
};

function App() {
  const [currentUser, setCurrentUser] = useState(null)
  const [friends, setFriends] = useState([])
  const [friendRequests, setFriendRequests] = useState([])
  const [currentCall, setCurrentCall] = useState(null)
  const [connectionStatus, setConnectionStatus] = useState('Offline')
  const [loginStatus, setLoginStatus] = useState('')
  const [callStatus, setCallStatus] = useState('')
  const [volumeLevel, setVolumeLevel] = useState(2.0)
  const [isPTTPressed, setIsPTTPressed] = useState(false)
  const [showMainScreen, setShowMainScreen] = useState(false)
  const [showIncomingCall, setShowIncomingCall] = useState(false)
  const [incomingCaller, setIncomingCaller] = useState('')
  const [incomingCallData, setIncomingCallData] = useState(null)
  const [peerConnection, setPeerConnection] = useState(null)
  const [debugLogs, setDebugLogs] = useState([])
  const [showDebug, setShowDebug] = useState(false) // Only show when debugger friend exists

  const socketRef = useRef(null)
  const ringtoneRef = useRef(null)
  const remoteAudioRef = useRef(null)
  const localStreamRef = useRef(null)
  const peerConnectionRef = useRef(null)

  // Debug logging function
  const addDebugLog = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString()
    const logEntry = `[${timestamp}] ${type.toUpperCase()}: ${message}`
    console.log(logEntry)
    setDebugLogs(prev => [...prev.slice(-9), logEntry]) // Keep last 10 logs
  }

  // Test backend connectivity
  const testBackendConnectivity = async () => {
    addDebugLog('Testing backend connectivity...')
    try {
      const response = await makeXMLHttpRequest('/api/test')
      addDebugLog(`Backend connectivity test: ${response.ok} (${response.status})`)
      if (response.ok) {
        const data = await response.json()
        addDebugLog(`Backend response: ${data.message}`)
      } else {
        addDebugLog('Backend connectivity test failed', 'error')
      }
    } catch (error) {
      addDebugLog(`Backend connectivity test error: ${error.message}`, 'error')
    }
  }

  // Initialize app on mount
  useEffect(() => {
    addDebugLog('App component mounted')
    console.log('XMLHttpRequest available:', typeof XMLHttpRequest)
    console.log('WebSocket available:', typeof WebSocket)
    console.log('io available:', typeof io)
    console.log('Promise available:', typeof Promise)
    console.log('JSON available:', typeof JSON)
    
    // Test basic XMLHttpRequest
    const testXhr = new XMLHttpRequest()
    testXhr.open('GET', '/health', true)
    testXhr.onload = function() {
      console.log('Test XMLHttpRequest success, status:', testXhr.status)
      addDebugLog('XMLHttpRequest test successful')
    }
    testXhr.onerror = function() {
      console.log('Test XMLHttpRequest failed')
      addDebugLog('XMLHttpRequest test failed', 'error')
    }
    testXhr.send()
    
    // Test backend connectivity
    testBackendConnectivity()
    
    initializeApp()
  }, [])

  // Ensure if no current user, show login screen
  useEffect(() => {
    if (!currentUser && showMainScreen) {
      addDebugLog('No current user but main screen shown, resetting to login', 'warn')
      setShowMainScreen(false)
    }
  }, [currentUser, showMainScreen])

  // Monitor currentUser state changes
  useEffect(() => {
    addDebugLog(`currentUser state changed: ${currentUser ? JSON.stringify(currentUser) : 'null'}`)
  }, [currentUser])

  const initializeApp = () => {
    addDebugLog('Starting app initialization')

    // Check for existing session
    const saved = localStorage.getItem('walky_user')
    if (saved) {
      try {
        const user = JSON.parse(saved)
        
        // Prevent "debugger" as a saved username
        if (user.username && user.username.toLowerCase() === 'debugger') {
          addDebugLog('Removing saved user with reserved username "debugger"', 'warn')
          localStorage.removeItem('walky_user')
          return
        }
        
        addDebugLog(`Found saved user: ${user.username} (ID: ${user.id})`)
        setCurrentUser(user)

        // Validate user with backend
        validateUser(user)
      } catch (e) {
        addDebugLog(`Error parsing saved user: ${e.message}`, 'error')
        localStorage.removeItem('walky_user')
      }
    } else {
      addDebugLog('No saved user found')
    }
  }

  // Simple XMLHttpRequest utility for old browsers
  const makeXMLHttpRequest = (url, options = {}) => {
    addDebugLog(`Making XMLHttpRequest to: ${url}`)
    
    // Convert relative URLs to absolute for old browsers
    if (url.startsWith('/')) {
      url = window.location.protocol + '//' + window.location.host + url;
      addDebugLog(`Converted to absolute URL: ${url}`)
    }
    
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open(options.method || 'GET', url, true);

      // Set headers - compatible with old browsers
      if (options.headers) {
        for (var key in options.headers) {
          if (options.headers.hasOwnProperty(key)) {
            xhr.setRequestHeader(key, options.headers[key]);
          }
        }
      }

      xhr.onload = function() {
        addDebugLog(`XMLHttpRequest onload triggered with status: ${xhr.status}`)
        addDebugLog(`XMLHttpRequest response text: ${xhr.responseText}`)
        addDebugLog(`XMLHttpRequest readyState: ${xhr.readyState}`)
        addDebugLog(`XMLHttpRequest statusText: ${xhr.statusText}`)
        const response = {
          ok: xhr.status >= 200 && xhr.status < 300,
          status: xhr.status,
          json: function() {
            try {
              const parsed = JSON.parse(xhr.responseText || '{}')
              addDebugLog(`XMLHttpRequest parsed response: ${JSON.stringify(parsed)}`)
              return Promise.resolve(parsed);
            } catch (e) {
              addDebugLog(`XMLHttpRequest JSON parse error: ${e.message}`, 'error')
              addDebugLog(`XMLHttpRequest raw response text: "${xhr.responseText}"`, 'error')
              return Promise.reject(new Error('Invalid JSON response'));
            }
          }
        };
        addDebugLog(`XMLHttpRequest response object created: ok=${response.ok}, status=${response.status}`)
        resolve(response);
      };

      xhr.onerror = function() {
        addDebugLog('XMLHttpRequest onerror triggered', 'error')
        addDebugLog(`XMLHttpRequest error details: readyState=${xhr.readyState}, status=${xhr.status}, statusText=${xhr.statusText}`, 'error')
        reject(new Error('Network error'));
      };

      xhr.timeout = 10000;
      xhr.ontimeout = function() {
        addDebugLog('XMLHttpRequest ontimeout triggered', 'error')
        addDebugLog(`XMLHttpRequest timeout details: readyState=${xhr.readyState}, status=${xhr.status}`, 'error')
        reject(new Error('Request timeout'));
      };

      xhr.onabort = function() {
        addDebugLog('XMLHttpRequest onabort triggered', 'error')
        reject(new Error('Request aborted'));
      };

      if (options.body) {
        xhr.send(options.body);
      } else {
        xhr.send();
      }
    });
  };

  const validateUser = async (user) => {
    addDebugLog(`Validating user: ${user.username} with ID: ${user.id}`)
    try {
      addDebugLog('Making API call to /api/users/me')
      const response = await makeXMLHttpRequest('/api/users/me', {
        headers: { 'X-User-ID': user.id }
      });
      addDebugLog(`Validation response: ${response.ok} (${response.status})`)
      
      if (response.ok) {
        const userData = await response.json()
        addDebugLog(`User validated successfully: ${userData.username} (ID: ${userData.id})`)
        addDebugLog(`Setting currentUser state after validation: ${JSON.stringify(userData)}`)
        setCurrentUser(userData)
        addDebugLog(`Updating localStorage after validation: ${JSON.stringify(userData)}`)
        localStorage.setItem('walky_user', JSON.stringify(userData))
        addDebugLog('Setting showMainScreen to true after validation')
        setShowMainScreen(true);
        addDebugLog('Calling loadFriends() after validation with userData')
        loadFriends(userData);
        addDebugLog('Calling loadFriendRequests() after validation with userData')
        loadFriendRequests(userData);
        // Small delay to ensure state is updated
        addDebugLog('Scheduling connectSocket() in 100ms after validation with userData')
        setTimeout(() => {
          addDebugLog('Executing connectSocket() after validation with userData')
          connectSocket(userData)
        }, 100);
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        addDebugLog(`User validation failed (${response.status}): ${errorData.error}`, 'error')
        // User doesn't exist, create them
        await createUser(user.username)
      }
    } catch (error) {
      addDebugLog(`User validation error: ${error.message}`, 'error')
      // Network error, try to create user
      await createUser(user.username)
    }
  };

  const createUser = async (username) => {
    // Prevent "debugger" as a username
    if (username.toLowerCase() === 'debugger') {
      addDebugLog('Cannot create user with reserved username "debugger"', 'error')
      setLoginStatus('Username "debugger" is reserved')
      localStorage.removeItem('walky_user')
      setCurrentUser(null)
      return
    }

    addDebugLog(`Creating new user: ${username}`)
    try {
      const deviceId = 'R1-' + Date.now()
      addDebugLog(`Making XMLHttpRequest to create user with deviceId: ${deviceId}`)
      const response = await makeXMLHttpRequest('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, deviceId })
      })
      addDebugLog(`Create user XMLHttpRequest response: ${response.status}`)

      if (response.ok) {
        const user = await response.json()
        addDebugLog(`User created successfully: ${user.username} (ID: ${user.id})`)
        addDebugLog(`Setting currentUser state: ${JSON.stringify(user)}`)
        setCurrentUser(user)
        addDebugLog(`Saving to localStorage: ${JSON.stringify(user)}`)
        localStorage.setItem('walky_user', JSON.stringify(user))
        addDebugLog('Setting showMainScreen to true')
        setShowMainScreen(true)
        addDebugLog('Calling loadFriends() with user data')
        loadFriends(user)
        addDebugLog('Calling loadFriendRequests() with user data')
        loadFriendRequests(user)
        // Small delay to ensure state is updated
        addDebugLog('Scheduling connectSocket() in 100ms with user data')
        setTimeout(() => {
          addDebugLog('Executing connectSocket() with user data')
          connectSocket(user)
        }, 100);
      } else {
        const error = await response.json()
        addDebugLog(`Failed to create user: ${error.error}`, 'error')
        setLoginStatus(`Failed to create user: ${error.error}`)
        localStorage.removeItem('walky_user')
        setCurrentUser(null)
        setFriends([])
        setFriendRequests([])
        setShowMainScreen(false)  // Reset to login screen
      }
    } catch (error) {
      addDebugLog(`Create user error: ${error.message}`, 'error')
      setLoginStatus('Network error - cannot create user')
      localStorage.removeItem('walky_user')
      setCurrentUser(null)
      setFriends([])
      setFriendRequests([])
      setShowMainScreen(false)
    }
  };

  const login = async () => {
    const username = document.getElementById('username').value.trim()
    if (!username) {
      setLoginStatus('Enter username')
      return
    }

    // Prevent "debugger" as a username
    if (username.toLowerCase() === 'debugger') {
      setLoginStatus('Username "debugger" is reserved')
      return
    }

    setLoginStatus('Joining...')
    addDebugLog(`Attempting login for: ${username}`)

    try {
      const deviceId = 'R1-' + Date.now()
      addDebugLog(`Making XMLHttpRequest to /api/users with deviceId: ${deviceId}`)
      const response = await makeXMLHttpRequest('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, deviceId })
      })
      addDebugLog(`Login XMLHttpRequest response: ${response.status}`)

      if (response.ok) {
        const user = await response.json()
        addDebugLog(`Login successful for user: ${user.username} (ID: ${user.id})`)
        addDebugLog(`Setting currentUser state after login: ${JSON.stringify(user)}`)
        setCurrentUser(user)
        addDebugLog(`Saving to localStorage after login: ${JSON.stringify(user)}`)
        localStorage.setItem('walky_user', JSON.stringify(user))
        addDebugLog('Setting showMainScreen to true after login')
        setShowMainScreen(true)
        addDebugLog('Calling loadFriends() after login with user data')
        loadFriends(user)
        addDebugLog('Calling loadFriendRequests() after login with user data')
        loadFriendRequests(user)
        // Small delay to ensure state is updated
        addDebugLog('Scheduling connectSocket() in 100ms after login with user data')
        setTimeout(() => {
          addDebugLog('Executing connectSocket() after login with user data')
          connectSocket(user)
        }, 100);
      } else {
        const error = await response.json()
        addDebugLog(`Login failed: ${error.error}`, 'error')
        setLoginStatus(error.error || 'Login failed')
      }
    } catch (error) {
      addDebugLog(`Login error: ${error.message}`, 'error')
      setLoginStatus('Network error')
    }
  }

  const loadFriends = async (userData = null) => {
    const user = userData || currentUser
    addDebugLog(`loadFriends called, user: ${user ? JSON.stringify(user) : 'null'}`)
    if (!user) {
      addDebugLog('Cannot load friends: no user provided', 'error')
      return
    }

    if (!user.id) {
      addDebugLog('Cannot load friends: no user ID', 'error')
      return
    }

    addDebugLog(`Loading friends for user: ${user.username} (ID: ${user.id})`)
    try {
      addDebugLog('Making XMLHttpRequest to /api/friends')
      const response = await makeXMLHttpRequest('/api/friends', {
        method: 'GET',
        headers: { 'X-User-ID': user.id }
      })
      addDebugLog(`Friends XMLHttpRequest response: ${response.status}`)

      if (response.ok) {
        const friendsData = await response.json()
        addDebugLog(`Loaded ${friendsData.length} friends: ${friendsData.map(f => f.username).join(', ')}`)
        setFriends(friendsData)

        // Check if user has "debugger" as a friend to show debug overlay
        const hasDebuggerFriend = friendsData.some(friend => friend.username.toLowerCase() === 'debugger')
        setShowDebug(hasDebuggerFriend)
        if (hasDebuggerFriend) {
          addDebugLog('Debug overlay enabled - debugger friend found')
        }
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        addDebugLog(`Failed to load friends (${response.status}): ${errorData.error}`, 'error')
      }
    } catch (error) {
      addDebugLog(`Load friends error: ${error.message}`, 'error')
    }
  }

  const loadFriendRequests = async (userData = null) => {
    const user = userData || currentUser
    addDebugLog(`loadFriendRequests called, user: ${user ? JSON.stringify(user) : 'null'}`)
    if (!user) {
      addDebugLog('Cannot load friend requests: no user provided', 'error')
      return
    }

    if (!user.id) {
      addDebugLog('Cannot load friend requests: no user ID', 'error')
      return
    }

    addDebugLog(`Loading friend requests for user: ${user.username} (ID: ${user.id})`)
    try {
      addDebugLog('Making XMLHttpRequest to /api/friends/requests')
      const response = await makeXMLHttpRequest('/api/friends/requests', {
        method: 'GET',
        headers: { 'X-User-ID': user.id }
      })
      addDebugLog(`Friend requests XMLHttpRequest response: ${response.status}`)

      if (response.ok) {
        const data = await response.json()
        addDebugLog(`Loaded ${data.requests?.length || 0} friend requests`)
        setFriendRequests(data.requests || [])
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        addDebugLog(`Failed to load friend requests (${response.status}): ${errorData.error}`, 'error')
      }
    } catch (error) {
      addDebugLog(`Load friend requests error: ${error.message}`, 'error')
    }
  }

  const connectSocket = (userData = null) => {
    const user = userData || currentUser
    addDebugLog(`connectSocket called, user: ${user ? JSON.stringify(user) : 'null'}`)
    if (!user || !user.id) {
      addDebugLog('Cannot connect socket: no user or user ID', 'error')
      return
    }

    addDebugLog(`Connecting to WebSocket for user: ${user.username} (ID: ${user.id})`)
    
    // Try socket.io first, fallback to native WebSocket
    if (typeof io !== 'undefined') {
      addDebugLog('Using socket.io for connection')
      socketRef.current = io('/', {
        path: '/socket.io',
        transports: ['websocket', 'polling'],
        timeout: 5000,
        forceNew: true,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000
      })

      socketRef.current.on('connect', () => {
        addDebugLog('Socket.io connected successfully')
        setConnectionStatus('Online')
        addDebugLog(`Registering user: ${user.id}`)
        socketRef.current.emit('register', user.id)
      })

      socketRef.current.on('connect_error', (error) => {
        addDebugLog(`Socket.io connection error: ${error.message}`, 'error')
        setConnectionStatus('Offline')
      })

      socketRef.current.on('disconnect', (reason) => {
        addDebugLog(`Socket.io disconnected: ${reason}`, 'error')
        setConnectionStatus('Offline')
      })

      socketRef.current.on('reconnect', (attemptNumber) => {
        addDebugLog(`Socket.io reconnected after ${attemptNumber} attempts`)
        setConnectionStatus('Online')
        // Re-register after reconnection
        socketRef.current.emit('register', user.id)
      })

      socketRef.current.on('reconnect_error', (error) => {
        addDebugLog(`Socket.io reconnection error: ${error.message}`, 'error')
        setConnectionStatus('Offline')
      })

      // Friend request events
      socketRef.current.on('friend-request-received', (data) => {
        addDebugLog(`Friend request received from: ${data.fromUser?.username}`)
        loadFriendRequests(user)
        setCallStatus(`Friend request from ${data.fromUser?.username}`)
      })

      socketRef.current.on('friend-request-accepted', (data) => {
        addDebugLog(`Friend request accepted by: ${data.accepter?.username}`)
        loadFriends(user)
        setCallStatus(`${data.accepter?.username} accepted your request!`)
      })

      socketRef.current.on('friendship-updated', (data) => {
        addDebugLog('Friendship updated')
        loadFriends(user)
      })

      // Call events
      socketRef.current.on('incoming-call', (data) => {
        addDebugLog(`Incoming call from: ${data.callerUsername}`)
        setIncomingCaller(data.callerUsername)
        setIncomingCallData(data)
        setShowIncomingCall(true)
        setCallStatus(`Incoming call from ${data.callerUsername}`)
        
        // Play ringer
        if (ringtoneRef.current) {
          ringtoneRef.current.play().catch(err => {
            addDebugLog(`Failed to play ringer: ${err.message}`, 'error')
          })
        }
      })

      socketRef.current.on('call-answered', async (data) => {
        addDebugLog('Call answered by recipient')
        setCallStatus(`Connected to ${data.answererUsername}`)
        
        // For server-mediated calls, just update status
        if (currentCall) {
          setCurrentCall(prev => ({ ...prev, status: 'connected' }))
        }
      })

      socketRef.current.on('call-ended', (data) => {
        addDebugLog(`Call ended by ${data.endedByUsername}`)
        setCallStatus(`Call ended by ${data.endedByUsername}`)
        endCall()
      })

      // Audio streaming events for server-mediated calls
      socketRef.current.on('audio-data', (data) => {
        addDebugLog('Received audio data from server')
        if (AudioHandler.current) {
          AudioHandler.current.handleIncomingAudio(data)
        }
      })

      socketRef.current.on('audio-stream-started', (data) => {
        addDebugLog(`${data.fromUsername} started speaking`)
        setCallStatus(`${data.fromUsername} is speaking...`)
      })

      socketRef.current.on('audio-stream-stopped', (data) => {
        addDebugLog(`${data.fromUsername} stopped speaking`)
        setCallStatus(`Connected to ${currentCall?.targetUsername || 'user'}`)
      })

      // User status events
      socketRef.current.on('user-online', (data) => {
        addDebugLog(`User ${data.userId} came online`)
        // Update friend status in the friends list
        setFriends(prevFriends => 
          prevFriends.map(friend => 
            friend.id === data.userId 
              ? { ...friend, status: 'online' }
              : friend
          )
        )
      })

      socketRef.current.on('user-offline', (data) => {
        addDebugLog(`User ${data.userId} went offline`)
        // Update friend status in the friends list
        setFriends(prevFriends => 
          prevFriends.map(friend => 
            friend.id === data.userId 
              ? { ...friend, status: 'offline' }
              : friend
          )
        )
      })

    } else {
      addDebugLog('Socket.io not available, WebSocket features will not work', 'error')
      setConnectionStatus('Offline - No WebSocket Support')
    }
  }

  const callFriend = async (friend) => {
    if (!currentUser || currentCall) return

    try {
      setCallStatus(`Calling ${friend.username}...`)
      addDebugLog(`Initiating server-mediated call to ${friend.username}`)

      // Get user media for audio
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: false,
          sampleRate: 44100,
          channelCount: 1
        }
      })

      localStreamRef.current = stream
      addDebugLog('Got user media successfully')

      // Disable tracks initially (PTT mode)
      stream.getAudioTracks().forEach(track => {
        track.enabled = false
      })

      // Send call initiation (server-mediated, no WebRTC offer needed)
      const response = await makeXMLHttpRequest('/api/calls/initiate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': currentUser.id
        },
        body: JSON.stringify({
          targetUsername: friend.username,
          offer: { type: 'server-mediated', mode: 'audio-relay' }
        })
      })

      if (response.ok) {
        const callData = await response.json()
        const newCall = {
          id: callData.callId,
          status: 'calling',
          targetUsername: friend.username,
          targetId: callData.targetId,
          isInitiator: true,
          mode: 'server-mediated'
        }
        setCurrentCall(newCall)
        setCallStatus(`Calling ${friend.username}...`)
        addDebugLog(`Server-mediated call initiated with ID: ${callData.callId}`)

        // Set up audio processing for server relay with the new call data
        AudioHandler.current.setCurrentCall(newCall)
        const started = await AudioHandler.current.startRecording(localStreamRef.current)
        if (!started) {
          addDebugLog('Failed to start audio recording', 'error')
        }
      } else {
        throw new Error('Failed to initiate call')
      }
    } catch (error) {
      addDebugLog(`Call error: ${error.message}`, 'error')
      setCallStatus(`Call failed: ${error.message}`)
      endCall()
    }
  }

  // Audio Handler Class - Complete rewrite based on working old system
  const AudioHandler = useRef(null)

  // Initialize audio handler
  useEffect(() => {
    if (!AudioHandler.current) {
      AudioHandler.current = new AudioHandlerClass()
    }
  }, [])

  class AudioHandlerClass {
    constructor() {
      this.audioContext = null
      this.scriptProcessor = null
      this.audioQueue = []
      this.isPlaying = false
      this.sampleRate = 16000
      this.channels = 1
      this.currentCall = null
      this.isRecording = false
    }

    // Initialize audio context
    async initAudioContext() {
      try {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
          sampleRate: this.sampleRate
        })

        if (this.audioContext.state === 'suspended') {
          await this.audioContext.resume()
        }

        addDebugLog('Audio context initialized successfully')
        return true
      } catch (error) {
        addDebugLog(`Failed to initialize audio context: ${error.message}`, 'error')
        return false
      }
    }

    // Set current call for audio processing
    setCurrentCall(call) {
      this.currentCall = call
      addDebugLog(`Audio handler call set: ${call?.id}`)
    }

    // Start audio recording and processing
    async startRecording(localStream) {
      if (!this.audioContext) {
        const initialized = await this.initAudioContext()
        if (!initialized) return false
      }

      if (!localStream) {
        addDebugLog('No local stream available for recording', 'error')
        return false
      }

      try {
        addDebugLog('Starting audio recording...')

        // Create media stream source
        const source = this.audioContext.createMediaStreamSource(localStream)

        // Create script processor for raw audio data
        this.scriptProcessor = this.audioContext.createScriptProcessor(1024, 1, 1)

        this.scriptProcessor.onaudioprocess = (event) => {
          if (!this.currentCall || !this.isRecording) return

          const inputBuffer = event.inputBuffer
          const inputData = inputBuffer.getChannelData(0)

          // Convert Float32Array to Int16Array for transmission
          const pcmData = new Int16Array(inputData.length)
          const len = inputData.length
          for (let i = 0; i < len; i++) {
            pcmData[i] = inputData[i] * 32767 | 0
          }

          // Send PCM data to server
          this.sendAudioData(pcmData)
        }

        // Connect nodes
        source.connect(this.scriptProcessor)
        this.scriptProcessor.connect(this.audioContext.destination)

        this.isRecording = true
        addDebugLog('Audio recording started successfully')
        return true

      } catch (error) {
        addDebugLog(`Error starting audio recording: ${error.message}`, 'error')
        return false
      }
    }

    // Stop audio recording
    stopRecording() {
      if (this.scriptProcessor) {
        this.scriptProcessor.disconnect()
        this.scriptProcessor = null
      }
      this.isRecording = false
      addDebugLog('Audio recording stopped')
    }

    // Send PCM audio data to server
    sendAudioData(pcmData) {
      if (!this.currentCall || !socketRef.current) return

      // Convert Int16Array to Uint8Array for base64 encoding
      const uint8Array = new Uint8Array(pcmData.buffer)

      // Convert to base64
      let binary = ''
      const len = uint8Array.byteLength
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(uint8Array[i])
      }
      const base64Data = btoa(binary)

      // Send via socket
      socketRef.current.emit('audio-data', {
        callId: this.currentCall.id,
        audioData: base64Data,
        sampleRate: this.sampleRate,
        channels: this.channels,
        targetId: this.currentCall.targetId
      })

      addDebugLog(`Sent ${pcmData.length} PCM samples (${base64Data.length} bytes)`)
    }

    // Handle incoming audio data
    handleIncomingAudio(data) {
      if (!this.currentCall || data.callId !== this.currentCall.id) return

      try {
        // Decode base64 PCM data
        const binaryString = atob(data.audioData)
        const uint8Array = new Uint8Array(binaryString.length)
        for (let i = 0; i < binaryString.length; i++) {
          uint8Array[i] = binaryString.charCodeAt(i)
        }

        // Convert to Int16Array
        const pcmData = new Int16Array(uint8Array.buffer)

        // Add to audio queue
        this.audioQueue.push(pcmData)

        addDebugLog(`Added PCM data to queue (queue length: ${this.audioQueue.length})`)

        // Start playing if not already playing
        if (!this.isPlaying) {
          this.startPlayback()
        }

      } catch (error) {
        addDebugLog(`Error handling incoming audio: ${error.message}`, 'error')
      }
    }

    // Start continuous audio playback
    async startPlayback() {
      if (this.isPlaying) return

      try {
        if (!this.audioContext) {
          const initialized = await this.initAudioContext()
          if (!initialized) return
        }

        if (this.audioContext.state === 'suspended') {
          await this.audioContext.resume()
        }

        this.isPlaying = true
        addDebugLog('Started audio playback')
        this.playAudioQueue()

      } catch (error) {
        addDebugLog(`Error starting playback: ${error.message}`, 'error')
        this.isPlaying = false
      }
    }

    // Play audio from queue continuously
    playAudioQueue() {
      if (!this.isPlaying) {
        addDebugLog('Playback stopped')
        return
      }

      if (this.audioQueue.length > 0) {
        const pcmData = this.audioQueue.shift()
        addDebugLog(`Playing PCM chunk: ${pcmData.length} samples`)
        this.playPCMData(pcmData)
      } else {
        addDebugLog('Audio queue empty, waiting...')
      }

      // Schedule next playback
      setTimeout(() => this.playAudioQueue(), 30)
    }

    // Play PCM data using Web Audio API
    playPCMData(pcmData) {
      try {
        // Create audio buffer
        const audioBuffer = this.audioContext.createBuffer(
          this.channels,
          pcmData.length,
          this.sampleRate
        )

        // Fill audio buffer with PCM data
        const channelData = audioBuffer.getChannelData(0)
        const len = pcmData.length
        for (let i = 0; i < len; i++) {
          channelData[i] = pcmData[i] / 32767.0
        }

        // Create buffer source
        const source = this.audioContext.createBufferSource()
        source.buffer = audioBuffer

        // Apply volume boost
        const gainNode = this.audioContext.createGain()
        gainNode.gain.value = Math.min(volumeLevel, 2.0)

        // Connect and play
        source.connect(gainNode)
        gainNode.connect(this.audioContext.destination)

        source.start()

        addDebugLog('PCM audio chunk played successfully')

      } catch (error) {
        addDebugLog(`Error playing PCM data: ${error.message}`, 'error')
      }
    }

    // Stop playback
    stopPlayback() {
      this.isPlaying = false
      this.audioQueue = []
      addDebugLog('Stopped audio playback')
    }

    // Clean up resources
    cleanup() {
      this.stopRecording()
      this.stopPlayback()

      if (this.audioContext) {
        this.audioContext.close().catch(err => {
          addDebugLog(`Error closing audio context: ${err.message}`, 'error')
        })
        this.audioContext = null
      }

      this.currentCall = null
      addDebugLog('Audio handler cleaned up')
    }
  }



  const acceptCall = async () => {
    if (!incomingCallData) return

    try {
      addDebugLog('Accepting incoming server-mediated call')
      
      // Stop ringer
      if (ringtoneRef.current) {
        ringtoneRef.current.pause()
        ringtoneRef.current.currentTime = 0
      }

      // Get user media for the call
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: false,
          sampleRate: 44100,
          channelCount: 1
        }
      })

      localStreamRef.current = stream
      addDebugLog('Got user media for incoming call')

      // Disable tracks initially (PTT mode)
      stream.getAudioTracks().forEach(track => {
        track.enabled = false
      })

      // Send answer for server-mediated call (no WebRTC answer needed)
      const response = await makeXMLHttpRequest('/api/calls/answer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': currentUser.id
        },
        body: JSON.stringify({
          callId: incomingCallData.callId,
          answer: { type: 'server-mediated', mode: 'audio-relay' }
        })
      })

      if (response.ok) {
        // Update state
        const newCall = {
          id: incomingCallData.callId,
          status: 'connected',
          targetUsername: incomingCallData.callerUsername,
          targetId: incomingCallData.caller,
          isInitiator: false,
          mode: 'server-mediated'
        }
        setCurrentCall(newCall)

        setShowIncomingCall(false)
        setIncomingCaller('')
        setIncomingCallData(null)
        setCallStatus(`Connected to ${incomingCallData.callerUsername}`)
        addDebugLog('Server-mediated call accepted and connected')

        // Set up audio processing for server relay with the new call data
        AudioHandler.current.setCurrentCall(newCall)
        const started = await AudioHandler.current.startRecording(localStreamRef.current)
        if (!started) {
          addDebugLog('Failed to start audio recording', 'error')
        }
      } else {
        throw new Error('Failed to send answer')
      }

    } catch (error) {
      addDebugLog(`Failed to accept call: ${error.message}`, 'error')
      setCallStatus(`Failed to accept call: ${error.message}`)
      rejectCall()
    }
  }

  const rejectCall = async () => {
    addDebugLog('Rejecting incoming call')
    
    // Stop ringer
    if (ringtoneRef.current) {
      ringtoneRef.current.pause()
      ringtoneRef.current.currentTime = 0
    }

    // Send call rejection
    if (incomingCallData) {
      try {
        await makeXMLHttpRequest('/api/calls/end', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-User-ID': currentUser.id
          },
          body: JSON.stringify({ callId: incomingCallData.callId })
        })
      } catch (error) {
        addDebugLog(`Failed to reject call: ${error.message}`, 'error')
      }
    }

    setShowIncomingCall(false)
    setIncomingCaller('')
    setIncomingCallData(null)
    setCallStatus('Call rejected')
  }

  const endCall = async () => {
    addDebugLog('Ending call')
    
    // Stop local media
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        track.stop()
        addDebugLog(`Stopped ${track.kind} track`)
      })
      localStreamRef.current = null
    }

    // Clean up audio processing
    if (AudioHandler.current) {
      AudioHandler.current.cleanup()
    }

    // Close peer connection if exists (fallback for any remaining WebRTC)
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close()
      peerConnectionRef.current = null
      setPeerConnection(null)
      addDebugLog('Closed peer connection')
    }

    // Send end call event
    if (currentCall) {
      try {
        await makeXMLHttpRequest('/api/calls/end', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-User-ID': currentUser.id
          },
          body: JSON.stringify({ callId: currentCall.id })
        })
        addDebugLog('Sent end call request to server')
      } catch (error) {
        addDebugLog(`Failed to end call on server: ${error.message}`, 'error')
      }
    }

    setCurrentCall(null)
    setCallStatus('')
    setIsPTTPressed(false)
    addDebugLog('Call ended locally')
  }

  const handlePTTStart = () => {
    if (!currentCall || !localStreamRef.current) {
      addDebugLog('PTT start ignored: no active call or media stream', 'warn')
      return
    }

    setIsPTTPressed(true)
    setCallStatus('Talking...')
    addDebugLog('PTT activated - enabling microphone')

    // Enable all audio tracks
    const audioTracks = localStreamRef.current.getAudioTracks()
    audioTracks.forEach(track => {
      track.enabled = true
      addDebugLog(`Enabled audio track: ${track.label} (${track.readyState})`)
    })

    // Start recording in AudioHandler
    if (AudioHandler.current) {
      AudioHandler.current.isRecording = true
      addDebugLog('Audio recording enabled')
    }

    // Send audio stream started event
    if (socketRef.current) {
      socketRef.current.emit('start-audio-stream', {
        callId: currentCall.id
      })
      addDebugLog('Sent audio stream started event')
    }
  }

  const handlePTTEnd = () => {
    if (!currentCall || !localStreamRef.current) {
      addDebugLog('PTT end ignored: no active call or media stream', 'warn')
      return
    }

    setIsPTTPressed(false)
    setCallStatus(`Connected to ${currentCall.targetUsername}`)
    addDebugLog('PTT released - disabling microphone')

    // Disable all audio tracks
    const audioTracks = localStreamRef.current.getAudioTracks()
    audioTracks.forEach(track => {
      track.enabled = false
      addDebugLog(`Disabled audio track: ${track.label} (${track.readyState})`)
    })

    // Stop recording in AudioHandler
    if (AudioHandler.current) {
      AudioHandler.current.isRecording = false
      addDebugLog('Audio recording disabled')
    }

    // Send audio stream stopped event
    if (socketRef.current) {
      socketRef.current.emit('stop-audio-stream', {
        callId: currentCall.id
      })
      addDebugLog('Sent audio stream stopped event')
    }
  }

  const addFriend = async () => {
    if (!currentUser) {
      addDebugLog('Cannot add friend: no current user', 'error')
      return
    }

    const friendUsername = document.getElementById('friend-username').value.trim()
    if (!friendUsername) {
      setCallStatus('Enter a username')
      return
    }

    // Prevent adding yourself
    if (friendUsername.toLowerCase() === currentUser.username.toLowerCase()) {
      setCallStatus('Cannot add yourself as friend')
      return
    }

    addDebugLog(`Adding friend: ${friendUsername}`)
    setCallStatus(`Sending friend request to ${friendUsername}...`)

    try {
      const response = await makeXMLHttpRequest('/api/friends', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': currentUser.id
        },
        body: JSON.stringify({ friendUsername })
      })

      addDebugLog(`Add friend response: ${response.status}`)
      if (response.ok) {
        const data = await response.json()
        setCallStatus(`Friend request sent to ${friendUsername}!`)
        // Clear the input
        document.getElementById('friend-username').value = ''
      } else {
        const error = await response.json()
        setCallStatus(error.error || 'Failed to send friend request')
      }
    } catch (error) {
      addDebugLog(`Add friend error: ${error.message}`, 'error')
      setCallStatus('Network error')
    }
  }

  const acceptFriendRequest = async (friendshipId) => {
    if (!currentUser) {
      addDebugLog('Cannot accept friend request: no current user', 'error')
      return
    }

    addDebugLog(`Accepting friend request: ${friendshipId}`)
    setCallStatus('Accepting friend request...')

    try {
      const response = await makeXMLHttpRequest(`/api/friends/${friendshipId}/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': currentUser.id
        }
      })

      addDebugLog(`Accept friend request response: ${response.status}`)
      if (response.ok) {
        setCallStatus('Friend request accepted!')
        // Reload friend requests and friends list
        loadFriendRequests(currentUser)
        setTimeout(() => loadFriends(currentUser), 500)
      } else {
        const error = await response.json()
        setCallStatus(error.error || 'Failed to accept friend request')
      }
    } catch (error) {
      addDebugLog(`Accept friend request error: ${error.message}`, 'error')
      setCallStatus('Network error')
    }
  }

  const rejectFriendRequest = async (friendshipId) => {
    if (!currentUser) {
      addDebugLog('Cannot reject friend request: no current user', 'error')
      return
    }

    addDebugLog(`Rejecting friend request: ${friendshipId}`)
    setCallStatus('Rejecting friend request...')

    try {
      const response = await makeXMLHttpRequest(`/api/friends/${friendshipId}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': currentUser.id
        }
      })

      addDebugLog(`Reject friend request response: ${response.status}`)
      if (response.ok) {
        setCallStatus('Friend request rejected')
        // Reload friend requests
        loadFriendRequests(currentUser)
      } else {
        const error = await response.json()
        setCallStatus(error.error || 'Failed to reject friend request')
      }
    } catch (error) {
      addDebugLog(`Reject friend request error: ${error.message}`, 'error')
      setCallStatus('Network error')
    }
  }

  const updateVolume = (e) => {
    const newVolume = parseFloat(e.target.value)
    setVolumeLevel(newVolume)

    if (remoteAudioRef.current) {
      remoteAudioRef.current.volume = Math.min(newVolume, 1.0)
    }
  }

  if (!showMainScreen) {
    return (
      <div className="app">
        <div id="login-screen" className="screen active">
          <div className="header">
            <h1>R1-Walky</h1>
          </div>
          <div className="content">
            <input
              type="text"
              id="username"
              placeholder="Username"
              maxLength="20"
              onKeyPress={(e) => e.key === 'Enter' && login()}
            />
            <button id="login-btn" className="btn primary" onClick={login}>
              Join
            </button>
            <div id="login-status" className="status">{loginStatus}</div>
          </div>
        </div>

        {/* Incoming Call Screen */}
        {showIncomingCall && (
          <div className="incoming-call-overlay">
            <div className="incoming-call-content">
              <div className="caller-info">
                <h2>Incoming Call</h2>
                <div className="caller-name">{incomingCaller}</div>
              </div>
              <div className="call-buttons">
                <button className="btn call-accept" onClick={acceptCall}>
                  📞 Accept
                </button>
                <button className="btn call-reject" onClick={rejectCall}>
                  📞 Reject
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Debug Overlay */}
        {showDebug && (
          <div className="debug-overlay">
            <div className="debug-header">
              <span>R1 Debug</span>
              <button onClick={() => setShowDebug(false)}>×</button>
            </div>
            <div className="debug-content">
              <div className="debug-log info">
                � Debug Mode Active - Add "debugger" as friend to toggle this overlay
              </div>
              {debugLogs.map((log, index) => (
                <div key={index} className={`debug-log ${log.includes('ERROR') ? 'error' : log.includes('WARN') ? 'warn' : 'info'}`}>
                  {log}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="app">
      <div id="main-screen" className="screen active">
        <div className="header">
          <h1>R1-Walky</h1>
          <div className="user-info">
            {currentUser?.username} | <span className={`status ${connectionStatus.toLowerCase()}`}>{connectionStatus}</span>
          </div>
        </div>
        <div className="content">
          {friendRequests.length > 0 && (
            <div className="friend-requests">
              {friendRequests.map(request => (
                <div key={request.friendshipId} className="friend-request">
                  <span>{request.username}</span>
                  <div className="request-buttons">
                    <button 
                      className="btn small accept" 
                      onClick={() => acceptFriendRequest(request.friendshipId)}
                      title="Accept friend request"
                    >
                      ✓
                    </button>
                    <button 
                      className="btn small reject" 
                      onClick={() => rejectFriendRequest(request.friendshipId)}
                      title="Reject friend request"
                    >
                      ✗
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="friends-section">
            <div className="section-header">
              <h2>Friends</h2>
            </div>
            <div className="friends-list">
              {friends.length === 0 ? (
                <div className="friend-item">No friends yet</div>
              ) : (
                friends.map(friend => (
                  <div
                    key={friend.id}
                    className="friend-item"
                    onClick={() => callFriend(friend)}
                  >
                    <span className="friend-name">{friend.username}</span>
                    <span className={`friend-status ${friend.status || 'offline'}`}>
                      {friend.status || 'offline'}
                    </span>
                  </div>
                ))
              )}
            </div>
            <input type="text" id="friend-username" placeholder="Add friend" />
            <button className="btn" onClick={addFriend}>Add</button>
          </div>

          <div className="ptt-section">
            <button
              className={`ptt-button ${isPTTPressed ? 'active' : ''}`}
              onMouseDown={handlePTTStart}
              onMouseUp={handlePTTEnd}
              onTouchStart={handlePTTStart}
              onTouchEnd={handlePTTEnd}
            >
              <div>HOLD</div>
              <div>TO TALK</div>
            </button>
            <div className="volume-control">
              <label htmlFor="volume-slider">🔊 Volume:</label>
              <input
                type="range"
                id="volume-slider"
                min="0"
                max="3"
                step="0.1"
                value={volumeLevel}
                onChange={updateVolume}
              />
              <span id="volume-value">{Math.round(volumeLevel * 100)}%</span>
            </div>
          </div>

          {currentCall && (
            <button className="btn" onClick={endCall}>End Call</button>
          )}

          <div className="call-status">{callStatus}</div>
        </div>
      </div>

      <audio ref={ringtoneRef} loop>
        <source src="/ringer.mp3" type="audio/mpeg" />
      </audio>
      <audio ref={remoteAudioRef} autoplay></audio>

      {/* Incoming Call Overlay */}
      {showIncomingCall && (
        <div className="incoming-call-overlay">
          <div className="incoming-call-content">
            <div className="caller-info">
              <h2>Incoming Call</h2>
              <div className="caller-name">{incomingCaller}</div>
            </div>
            <div className="call-buttons">
              <button className="btn call-accept" onClick={acceptCall}>
                📞 Accept
              </button>
              <button className="btn call-reject" onClick={rejectCall}>
                📞 Reject
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Debug Overlay */}
      {showDebug && (
        <div className="debug-overlay">
          <div className="debug-header">
            <span>R1 Debug</span>
            <button onClick={() => setShowDebug(false)}>×</button>
          </div>
          <div className="debug-content">
            <div className="debug-log info">
              💡 Tip: Add "debugger" as friend to toggle this overlay
              </div>
              {debugLogs.map((log, index) => (
                <div key={index} className={`debug-log ${log.includes('ERROR') ? 'error' : log.includes('WARN') ? 'warn' : 'info'}`}>
                  {log}
                </div>
              ))}
            </div>
          </div>
        )}
    </div>
  )
}

export default App

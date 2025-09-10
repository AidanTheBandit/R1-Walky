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
  const [showDebug, setShowDebug] = useState(true) // Show debug by default for R1

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
        setCallStatus(`${data.answererUsername} answered`)
        
        // Set remote description (answer) for the caller
        if (peerConnectionRef.current && data.answer) {
          try {
            await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.answer))
            addDebugLog('Set remote description from answer')
            setCallStatus(`Connected to ${data.answererUsername}`)
          } catch (error) {
            addDebugLog(`Failed to set remote description: ${error.message}`, 'error')
            endCall()
          }
        }
      })

      socketRef.current.on('call-ended', (data) => {
        addDebugLog(`Call ended by ${data.endedByUsername}`)
        setCallStatus(`Call ended by ${data.endedByUsername}`)
        endCall()
      })

      // ICE candidate handling for WebRTC
      socketRef.current.on('ice-candidate', async (data) => {
        addDebugLog('Received ICE candidate')
        if (peerConnectionRef.current && data.candidate) {
          try {
            await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(data.candidate))
            addDebugLog('Added ICE candidate successfully')
          } catch (error) {
            addDebugLog(`Failed to add ICE candidate: ${error.message}`, 'error')
          }
        }
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

  // WebRTC configuration
  const rtcConfig = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'turn:turn.quickblox.com:3478', username: 'quickblox', credential: 'quickblox' },
      { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
      { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' }
    ],
    iceCandidatePoolSize: 10
  }

  const callFriend = async (friend) => {
    if (!currentUser || currentCall) return

    try {
      setCallStatus(`Calling ${friend.username}...`)
      addDebugLog(`Initiating call to ${friend.username}`)

      // Get user media first
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

      // Create RTCPeerConnection
      const pc = new RTCPeerConnection(rtcConfig)
      peerConnectionRef.current = pc
      setPeerConnection(pc)

      // Add local stream to peer connection
      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream)
        addDebugLog(`Added ${track.kind} track to peer connection`)
      })

      // Handle remote stream
      pc.ontrack = (event) => {
        addDebugLog('Received remote stream')
        const [remoteStream] = event.streams
        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = remoteStream
          remoteAudioRef.current.volume = volumeLevel
          addDebugLog('Set remote audio stream')
        }
      }

      // Handle ICE candidates
      pc.onicecandidate = async (event) => {
        if (event.candidate) {
          addDebugLog('Sending ICE candidate')
          try {
            await makeXMLHttpRequest('/api/calls/ice-candidate', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-User-ID': currentUser.id
              },
              body: JSON.stringify({
                callId: currentCall?.id,
                candidate: event.candidate
              })
            })
          } catch (error) {
            addDebugLog(`Failed to send ICE candidate: ${error.message}`, 'error')
          }
        }
      }

      // Monitor connection state
      pc.onconnectionstatechange = () => {
        addDebugLog(`Connection state changed: ${pc.connectionState}`)
        if (pc.connectionState === 'connected') {
          setCallStatus(`Connected to ${friend.username}`)
        } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
          setCallStatus('Call disconnected')
          endCall()
        }
      }

      // Create offer
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: false
      })
      
      await pc.setLocalDescription(offer)
      addDebugLog('Created and set local description (offer)')

      // Send call initiation with offer
      const response = await makeXMLHttpRequest('/api/calls/initiate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': currentUser.id
        },
        body: JSON.stringify({
          targetUsername: friend.username,
          offer: offer
        })
      })

      if (response.ok) {
        const callData = await response.json()
        setCurrentCall({
          id: callData.callId,
          status: 'calling',
          targetUsername: friend.username,
          targetId: callData.targetId,
          isInitiator: true,
          mode: 'webrtc'
        })
        setCallStatus(`Calling ${friend.username}...`)
        addDebugLog(`Call initiated with ID: ${callData.callId}`)
      } else {
        throw new Error('Failed to initiate call')
      }
    } catch (error) {
      addDebugLog(`Call error: ${error.message}`, 'error')
      setCallStatus(`Call failed: ${error.message}`)
      endCall()
    }
  }

  const acceptCall = async () => {
    if (!incomingCallData) return

    try {
      addDebugLog('Accepting incoming call')
      
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

      // Create WebRTC peer connection
      const pc = new RTCPeerConnection(rtcConfig)
      peerConnectionRef.current = pc
      setPeerConnection(pc)

      // Add local stream to peer connection
      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream)
        addDebugLog(`Added ${track.kind} track to peer connection`)
      })

      // Handle remote stream
      pc.ontrack = (event) => {
        addDebugLog('Received remote stream')
        const [remoteStream] = event.streams
        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = remoteStream
          remoteAudioRef.current.volume = volumeLevel
          addDebugLog('Set remote audio stream')
        }
      }

      // Handle ICE candidates
      pc.onicecandidate = async (event) => {
        if (event.candidate) {
          addDebugLog('Sending ICE candidate from callee')
          try {
            await makeXMLHttpRequest('/api/calls/ice-candidate', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-User-ID': currentUser.id
              },
              body: JSON.stringify({
                callId: incomingCallData.callId,
                candidate: event.candidate
              })
            })
          } catch (error) {
            addDebugLog(`Failed to send ICE candidate: ${error.message}`, 'error')
          }
        }
      }

      // Monitor connection state
      pc.onconnectionstatechange = () => {
        addDebugLog(`Connection state changed: ${pc.connectionState}`)
        if (pc.connectionState === 'connected') {
          setCallStatus(`Connected to ${incomingCallData.callerUsername}`)
        } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
          setCallStatus('Call disconnected')
          endCall()
        }
      }

      // Set remote description from offer
      await pc.setRemoteDescription(new RTCSessionDescription(incomingCallData.offer))
      addDebugLog('Set remote description from offer')
      
      // Create answer
      const answer = await pc.createAnswer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: false
      })
      
      await pc.setLocalDescription(answer)
      addDebugLog('Created and set local description (answer)')

      // Send answer back to caller
      const response = await makeXMLHttpRequest('/api/calls/answer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': currentUser.id
        },
        body: JSON.stringify({
          callId: incomingCallData.callId,
          answer: answer
        })
      })

      if (response.ok) {
        // Update state
        setCurrentCall({
          id: incomingCallData.callId,
          status: 'connected',
          targetUsername: incomingCallData.callerUsername,
          targetId: incomingCallData.caller,
          isInitiator: false,
          mode: 'webrtc'
        })

        setShowIncomingCall(false)
        setIncomingCaller('')
        setIncomingCallData(null)
        setCallStatus(`Connected to ${incomingCallData.callerUsername}`)
        addDebugLog('Call accepted and connected')
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

    // Close peer connection
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
    localStreamRef.current.getAudioTracks().forEach(track => {
      track.enabled = true
      addDebugLog(`Enabled audio track: ${track.label}`)
    })
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
    localStreamRef.current.getAudioTracks().forEach(track => {
      track.enabled = false
      addDebugLog(`Disabled audio track: ${track.label}`)
    })
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

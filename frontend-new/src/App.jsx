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

  // Initialize app
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
    
    initializeApp()
  }, [])

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
        addDebugLog(`XMLHttpRequest response: ${xhr.status}`)
        const response = {
          ok: xhr.status >= 200 && xhr.status < 300,
          status: xhr.status,
          json: function() {
            try {
              return Promise.resolve(JSON.parse(xhr.responseText || '{}'));
            } catch (e) {
              return Promise.reject(new Error('Invalid JSON response'));
            }
          }
        };
        resolve(response);
      };

      xhr.onerror = function() {
        addDebugLog('XMLHttpRequest network error', 'error')
        reject(new Error('Network error'));
      };

      xhr.timeout = 10000;
      xhr.ontimeout = function() {
        addDebugLog('XMLHttpRequest timeout', 'error')
        reject(new Error('Request timeout'));
      };

      if (options.body) {
        xhr.send(options.body);
      } else {
        xhr.send();
      }
    });
  };

  const validateUser = async (user) => {
    addDebugLog(`Validating user: ${user.username}`)
    try {
      addDebugLog('Making API call to /api/users/me')
      const response = await makeXMLHttpRequest('/api/users/me', {
        headers: { 'X-User-ID': user.id }
      });
      addDebugLog(`Validation response: ${response.ok} (${response.status})`)

      if (response.ok) {
        addDebugLog('User validated successfully')
        setShowMainScreen(true);
        loadFriends();
        loadFriendRequests();
        // Small delay to ensure state is updated
        setTimeout(() => connectSocket(), 100);
      } else {
        addDebugLog(`User validation failed (${response.status}), creating new user`, 'warn')
        // User doesn't exist, create them
        await createUser(user.username)
      }
    } catch (error) {
      addDebugLog(`User validation error: ${error.message}, creating new user`, 'warn')
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
        setCurrentUser(user)
        localStorage.setItem('walky_user', JSON.stringify(user))
        setShowMainScreen(true)
        loadFriends()
        loadFriendRequests()
        // Small delay to ensure state is updated
        setTimeout(() => connectSocket(), 100);
      } else {
        const error = await response.json()
        addDebugLog(`Failed to create user: ${error.error}`, 'error')
        setLoginStatus(`Failed to create user: ${error.error}`)
        localStorage.removeItem('walky_user')
        setCurrentUser(null)
      }
    } catch (error) {
      addDebugLog(`Create user error: ${error.message}`, 'error')
      setLoginStatus('Network error - cannot create user')
      localStorage.removeItem('walky_user')
      setCurrentUser(null)
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
        setCurrentUser(user)
        localStorage.setItem('walky_user', JSON.stringify(user))
        setShowMainScreen(true)
        loadFriends()
        loadFriendRequests()
        // Small delay to ensure state is updated
        setTimeout(() => connectSocket(), 100);
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

  const loadFriends = async () => {
    if (!currentUser) {
      addDebugLog('Cannot load friends: no current user', 'error')
      return
    }

    addDebugLog(`Loading friends for user: ${currentUser.username}`)
    try {
      addDebugLog('Making XMLHttpRequest to /api/friends')
      const response = await makeXMLHttpRequest('/api/friends', {
        method: 'GET',
        headers: { 'X-User-ID': currentUser.id }
      })
      addDebugLog(`Friends XMLHttpRequest response: ${response.status}`)

      if (response.ok) {
        const friendsData = await response.json()
        addDebugLog(`Loaded ${friendsData.length} friends`)
        setFriends(friendsData)
      } else {
        addDebugLog(`Failed to load friends: ${response.status}`, 'error')
      }
    } catch (error) {
      addDebugLog(`Load friends error: ${error.message}`, 'error')
    }
  }

  const loadFriendRequests = async () => {
    if (!currentUser) {
      console.log('No current user, skipping loadFriendRequests')
      return
    }

    console.log('Loading friend requests for user:', currentUser.username)
    try {
      console.log('Making XMLHttpRequest to /api/friends/requests')
      const response = await makeXMLHttpRequest('/api/friends/requests', {
        method: 'GET',
        headers: { 'X-User-ID': currentUser.id }
      })
      console.log('Friend requests XMLHttpRequest response status:', response.status)

      if (response.ok) {
        const data = await response.json()
        console.log('Friend requests loaded:', data)
        setFriendRequests(data.requests || [])
      } else {
        console.log('Failed to load friend requests, status:', response.status)
      }
    } catch (error) {
      console.error('Load friend requests error:', error)
    }
  }

  const addFriend = async () => {
    if (!currentUser) {
      addDebugLog('Cannot add friend: no current user', 'error')
      return
    }

    const usernameInput = document.getElementById('friend-username')
    if (!usernameInput) return

    const username = usernameInput.value.trim()
    if (!username) return

    // Special case: "debugger" toggles debug overlay
    if (username.toLowerCase() === 'debugger') {
      addDebugLog('Toggling debug overlay')
      setShowDebug(!showDebug)
      usernameInput.value = ''
      setCallStatus('Debug overlay toggled')
      return
    }

    addDebugLog(`Adding friend: ${username}`)
    try {
      const response = await makeXMLHttpRequest('/api/friends', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': currentUser.id
        },
        body: JSON.stringify({ friendUsername: username })
      })

      addDebugLog(`Add friend response: ${response.status}`)
      if (response.ok) {
        usernameInput.value = ''
        setCallStatus('Friend request sent!')
        setTimeout(() => loadFriends(), 1000)
      } else {
        const error = await response.json()
        setCallStatus(error.error || 'Failed to add friend')
      }
    } catch (error) {
      addDebugLog(`Add friend error: ${error.message}`, 'error')
      setCallStatus('Network error')
    }
  }

  const connectSocket = () => {
    if (!currentUser || !currentUser.id) {
      addDebugLog('Cannot connect socket: no current user or user ID', 'error')
      return
    }

    addDebugLog(`Connecting to WebSocket for user: ${currentUser.username} (ID: ${currentUser.id})`)
    
    // Try socket.io first, fallback to native WebSocket
    if (typeof io !== 'undefined') {
      addDebugLog('Using socket.io')
      socketRef.current = io('/', {
        path: '/socket.io',
        transports: ['websocket', 'polling']
      })

      socketRef.current.on('connect', () => {
        addDebugLog('Socket.io connected successfully')
        setConnectionStatus('Online')
        socketRef.current.emit('register', currentUser.id)
      })

      socketRef.current.on('connect_error', (error) => {
        addDebugLog(`Socket.io connection error: ${error.message}`, 'error')
        setConnectionStatus('Offline')
      })

      socketRef.current.on('disconnect', () => {
        addDebugLog('Socket.io disconnected', 'error')
        setConnectionStatus('Offline')
      })

      // Friend request events
      socketRef.current.on('friend-request-received', (data) => {
        addDebugLog(`Friend request received from: ${data.fromUser?.username}`)
        loadFriendRequests()
        setCallStatus(`Friend request from ${data.fromUser?.username}`)
      })

      socketRef.current.on('friend-request-accepted', (data) => {
        addDebugLog(`Friend request accepted by: ${data.accepter?.username}`)
        loadFriends()
        setCallStatus(`${data.accepter?.username} accepted your request!`)
      })

      socketRef.current.on('friendship-updated', (data) => {
        addDebugLog('Friendship updated')
        loadFriends()
      })
    } else if (typeof WebSocket !== 'undefined') {
      addDebugLog('Using native WebSocket fallback')
      // Fallback to native WebSocket
      const wsUrl = (window.location.protocol === 'https:' ? 'wss:' : 'ws:') + '//' + window.location.host + '/socket.io/?EIO=3&transport=websocket'
      socketRef.current = new WebSocket(wsUrl)

      socketRef.current.onopen = function() {
        addDebugLog('WebSocket connected successfully')
        setConnectionStatus('Online')
        // Send registration message
        socketRef.current.send(JSON.stringify({
          type: 'register',
          userId: currentUser.id
        }))
      }

      socketRef.current.onmessage = function(event) {
        try {
          const data = JSON.parse(event.data)
          addDebugLog(`WebSocket message received: ${data.type}`)
          
          if (data.type === 'friend-request-received') {
            loadFriendRequests()
            setCallStatus(`Friend request from ${data.fromUser?.username}`)
          } else if (data.type === 'friend-request-accepted') {
            loadFriends()
            setCallStatus(`${data.accepter?.username} accepted your request!`)
          } else if (data.type === 'friendship-updated') {
            loadFriends()
          }
        } catch (e) {
          addDebugLog(`Failed to parse WebSocket message: ${e.message}`, 'error')
        }
      }

      socketRef.current.onclose = function() {
        addDebugLog('WebSocket disconnected', 'error')
        setConnectionStatus('Offline')
      }

      socketRef.current.onerror = function(error) {
        addDebugLog(`WebSocket error: ${error.message}`, 'error')
        setConnectionStatus('Offline')
      }
    } else {
      addDebugLog('Neither socket.io nor WebSocket available', 'error')
      setConnectionStatus('Offline')
    }
  }

  const callFriend = async (friend) => {
    if (!currentUser || currentCall) return

    try {
      setCallStatus(`Calling ${friend.username}...`)

      // Get user media
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: 16000,
          channelCount: 1
        }
      })

      localStreamRef.current = stream

      // Disable tracks initially (PTT mode)
      stream.getAudioTracks().forEach(track => {
        track.enabled = false
      })

      // Send call initiation
      const response = await makeXMLHttpRequest('/api/calls/initiate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': currentUser.id
        },
        body: JSON.stringify({
          targetUsername: friend.username,
          offer: { type: 'server-mediated' }
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
          mode: 'server-mediated'
        })
        setCallStatus(`Calling ${friend.username} (server-mediated)...`)
        console.log('Call initiated:', callData.callId)
      } else {
        throw new Error('Failed to initiate call')
      }
    } catch (error) {
      console.error('Call error:', error)
      setCallStatus('Call failed')
      endCall()
    }
  }

  const endCall = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop())
      localStreamRef.current = null
    }

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close()
      peerConnectionRef.current = null
    }

    setCurrentCall(null)
    setCallStatus('')
    setIsPTTPressed(false)
  }

  const handlePTTStart = () => {
    if (!currentCall) return

    setIsPTTPressed(true)
    setCallStatus('talking')

    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = true
      })
    }
  }

  const handlePTTEnd = () => {
    if (!currentCall) return

    setIsPTTPressed(false)
    setCallStatus('listening')

    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = false
      })
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
                    <button className="btn small">✓</button>
                    <button className="btn small">✗</button>
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

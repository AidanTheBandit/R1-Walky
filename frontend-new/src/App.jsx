import { useState, useEffect, useRef } from 'react'
import { io } from 'socket.io-client'
import './App.css'

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

  const socketRef = useRef(null)
  const ringtoneRef = useRef(null)
  const remoteAudioRef = useRef(null)
  const localStreamRef = useRef(null)
  const peerConnectionRef = useRef(null)

  // Initialize app
  useEffect(() => {
    initializeApp()
  }, [])

  const initializeApp = () => {
    console.log('Starting R1-Walky React...')

    // Check for existing session
    const saved = localStorage.getItem('walky_user')
    if (saved) {
      const user = JSON.parse(saved)
      console.log('Found saved user:', user)
      setCurrentUser(user)

      // Validate user with backend
      validateUser(user)
    } else {
      console.log('No saved user found')
    }
  }

  const validateUser = async (user) => {
    console.log('Validating user:', user.username)
    try {
      console.log('Making API call to /api/users/me')
      const response = await fetch('/api/users/me', {
        headers: { 'X-User-ID': user.id }
      })
      console.log('API response status:', response.status)

      if (response.ok) {
        console.log('User validated successfully')
        setShowMainScreen(true)
        loadFriends()
        loadFriendRequests()
        connectSocket()
      } else {
        console.log('User validation failed')
        localStorage.removeItem('walky_user')
        setCurrentUser(null)
      }
    } catch (error) {
      console.error('User validation error:', error)
      localStorage.removeItem('walky_user')
      setCurrentUser(null)
    }
  }

  const login = async () => {
    const username = document.getElementById('username').value.trim()
    if (!username) {
      setLoginStatus('Enter username')
      return
    }

    setLoginStatus('Joining...')
    console.log('Attempting login for user:', username)

    try {
      const deviceId = 'R1-' + Date.now()
      console.log('Making API call to /api/users with deviceId:', deviceId)
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, deviceId })
      })
      console.log('Login API response status:', response.status)

      if (response.ok) {
        const user = await response.json()
        console.log('Login successful, user:', user)
        setCurrentUser(user)
        localStorage.setItem('walky_user', JSON.stringify(user))
        setShowMainScreen(true)
        loadFriends()
        loadFriendRequests()
        connectSocket()
      } else {
        const error = await response.json()
        console.log('Login failed with error:', error)
        setLoginStatus(error.error || 'Login failed')
      }
    } catch (error) {
      console.error('Login error:', error)
      setLoginStatus('Network error')
    }
  }

  const loadFriends = async () => {
    if (!currentUser) {
      console.log('No current user, skipping loadFriends')
      return
    }

    console.log('Loading friends for user:', currentUser.username)
    try {
      console.log('Making API call to /api/friends')
      const response = await fetch('/api/friends', {
        headers: { 'X-User-ID': currentUser.id }
      })
      console.log('Friends API response status:', response.status)

      if (response.ok) {
        const friendsData = await response.json()
        console.log('Friends loaded:', friendsData)
        setFriends(friendsData)
      } else {
        console.log('Failed to load friends, status:', response.status)
      }
    } catch (error) {
      console.error('Load friends error:', error)
    }
  }

  const loadFriendRequests = async () => {
    if (!currentUser) {
      console.log('No current user, skipping loadFriendRequests')
      return
    }

    console.log('Loading friend requests for user:', currentUser.username)
    try {
      console.log('Making API call to /api/friends/requests')
      const response = await fetch('/api/friends/requests', {
        headers: { 'X-User-ID': currentUser.id }
      })
      console.log('Friend requests API response status:', response.status)

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
    if (!currentUser) return

    const username = document.getElementById('friend-username').value.trim()
    if (!username) return

    try {
      const response = await fetch('/api/friends', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': currentUser.id
        },
        body: JSON.stringify({ friendUsername: username })
      })

      if (response.ok) {
        document.getElementById('friend-username').value = ''
        setCallStatus('Friend request sent!')
        setTimeout(() => loadFriends(), 1000)
      } else {
        const error = await response.json()
        setCallStatus(error.error || 'Failed to add friend')
      }
    } catch (error) {
      console.error('Add friend error:', error)
      setCallStatus('Network error')
    }
  }

  const connectSocket = () => {
    if (!currentUser) {
      console.log('No current user, skipping socket connection')
      return
    }

    console.log('Connecting to socket for user:', currentUser.username)
    // Use relative URL so Vite proxy handles it
    socketRef.current = io('/', {
      path: '/socket.io',
      transports: ['websocket', 'polling']
    })

    socketRef.current.on('connect', () => {
      console.log('Socket connected successfully')
      setConnectionStatus('Online')
      socketRef.current.emit('register', currentUser.id)
    })

    socketRef.current.on('connect_error', (error) => {
      console.log('Socket connection error:', error)
      setConnectionStatus('Offline')
    })

    socketRef.current.on('disconnect', () => {
      console.log('Socket disconnected')
      setConnectionStatus('Offline')
    })

    // Friend request events
    socketRef.current.on('friend-request-received', (data) => {
      console.log('Friend request received:', data)
      loadFriendRequests()
      setCallStatus(`Friend request from ${data.fromUser.username}`)
    })

    socketRef.current.on('friend-request-accepted', (data) => {
      console.log('Friend request accepted:', data)
      loadFriends()
      setCallStatus(`${data.accepter.username} accepted your request!`)
    })

    socketRef.current.on('friendship-updated', (data) => {
      console.log('Friendship updated:', data)
      loadFriends()
    })
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
      const response = await fetch('/api/calls/initiate', {
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
    </div>
  )
}

export default App

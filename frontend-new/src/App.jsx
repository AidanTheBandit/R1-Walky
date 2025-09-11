import { useState, useEffect, useRef } from 'react'
import { io } from 'socket.io-client'
import './App.css'
import LoginScreen from './components/LoginScreen'
import MainScreen from './components/MainScreen'
import DebugOverlay from './components/DebugOverlay'
import { makeXMLHttpRequest, addDebugLog } from './utils/api'
import { AudioHandlerClass } from './utils/AudioHandler'
import { useSocket } from './hooks/useSocket'

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
  const [showDebug, setShowDebug] = useState(false)
  const [showGroupCall, setShowGroupCall] = useState(false)
  const [groupCallData, setGroupCallData] = useState(null)
  const [showCalling, setShowCalling] = useState(false)
  const [callingTarget, setCallingTarget] = useState('')

  const ringtoneRef = useRef(null)
  const remoteAudioRef = useRef(null)
  const localStreamRef = useRef(null)
  const peerConnectionRef = useRef(null)
  const AudioHandler = useRef(null)

  // Initialize AudioHandler
  useEffect(() => {
    if (!AudioHandler.current) {
      AudioHandler.current = new AudioHandlerClass()
      addDebugLogLocal('AudioHandler initialized successfully')
    } else {
      addDebugLogLocal('AudioHandler already initialized')
    }

    // Initialize audio context early
    if (AudioHandler.current) {
      AudioHandler.current.initAudioContext().then(success => {
        if (success) {
          addDebugLogLocal('Audio context initialized early')
        } else {
          addDebugLogLocal('Failed to initialize audio context early', 'error')
        }
      })
    }
  }, [])
  const loadFriends = async (userData = null) => {
    const user = userData || currentUser
    addDebugLogLocal(`loadFriends called, user: ${user ? JSON.stringify(user) : 'null'}`)
    if (!user) {
      addDebugLogLocal('Cannot load friends: no user provided', 'error')
      return
    }

    if (!user.id) {
      addDebugLogLocal('Cannot load friends: no user ID', 'error')
      return
    }

    addDebugLogLocal(`Loading friends for user: ${user.username} (ID: ${user.id})`)
    try {
      addDebugLogLocal('Making XMLHttpRequest to /api/friends')
      const response = await makeXMLHttpRequest('/api/friends', {
        method: 'GET',
        headers: { 'X-User-ID': user.id }
      })
      addDebugLogLocal(`Friends XMLHttpRequest response: ${response.status}`)

      if (response.ok) {
        const friendsData = await response.json()
        addDebugLogLocal(`Loaded ${friendsData.length} friends: ${friendsData.map(f => f.username).join(', ')}`)
        setFriends(friendsData)

        // Check if user has "debugger" as a friend to show debug overlay
        const hasDebuggerFriend = friendsData.some(friend => friend.username.toLowerCase() === 'debugger')
        setShowDebug(hasDebuggerFriend)
        if (hasDebuggerFriend) {
          addDebugLogLocal('Debug overlay enabled - debugger friend found')
        }
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        addDebugLogLocal(`Failed to load friends (${response.status}): ${errorData.error}`, 'error')
      }
    } catch (error) {
      addDebugLogLocal(`Load friends error: ${error.message}`, 'error')
    }
  }

  const loadFriendRequests = async (userData = null) => {
    const user = userData || currentUser
    addDebugLogLocal(`loadFriendRequests called, user: ${user ? JSON.stringify(user) : 'null'}`)
    if (!user) {
      addDebugLogLocal('Cannot load friend requests: no user provided', 'error')
      return
    }

    if (!user.id) {
      addDebugLogLocal('Cannot load friend requests: no user ID', 'error')
      return
    }

    addDebugLogLocal(`Loading friend requests for user: ${user.username} (ID: ${user.id})`)
    try {
      addDebugLogLocal('Making XMLHttpRequest to /api/friends/requests')
      const response = await makeXMLHttpRequest('/api/friends/requests', {
        method: 'GET',
        headers: { 'X-User-ID': user.id }
      })
      addDebugLogLocal(`Friend requests XMLHttpRequest response: ${response.status}`)

      if (response.ok) {
        const data = await response.json()
        addDebugLogLocal(`Loaded ${data.requests?.length || 0} friend requests`)
        setFriendRequests(data.requests || [])
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        addDebugLogLocal(`Failed to load friend requests (${response.status}): ${errorData.error}`, 'error')
      }
    } catch (error) {
      addDebugLogLocal(`Load friend requests error: ${error.message}`, 'error')
    }
  }

  const endCall = async () => {
    addDebugLogLocal('Ending call')
    
    // Stop local media
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        track.stop()
        addDebugLogLocal(`Stopped ${track.kind} track`)
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
      addDebugLogLocal('Closed peer connection')
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
        addDebugLogLocal('Sent end call request to server')
      } catch (error) {
        addDebugLogLocal(`Failed to end call on server: ${error.message}`, 'error')
      }
    }

    setCurrentCall(null)
    setCallStatus('')
    setIsPTTPressed(false)
    setShowCalling(false)
    setCallingTarget('')
    addDebugLogLocal('Call ended locally')
  }

  const { socketRef, connectSocket } = useSocket(
    currentUser,
    setConnectionStatus,
    setFriends,
    loadFriendRequests,
    loadFriends,
    setCallStatus,
    setCurrentCall,
    setShowIncomingCall,
    setIncomingCaller,
    setIncomingCallData,
    endCall,
    AudioHandler,
    setShowCalling,
    setCallingTarget
  )

  // Make refs available globally for audio handler (after socket is initialized)
  useEffect(() => {
    window.socketRef = socketRef
    window.ringtoneRef = ringtoneRef
    window.volumeLevel = volumeLevel
    addDebugLogLocal('Global refs initialized')
  }, [socketRef])

  // Debug logging function
  const addDebugLogLocal = (message, type = 'info') => {
    const logEntry = addDebugLog(message, type)
    setDebugLogs(prev => [...prev.slice(-9), logEntry]) // Keep last 10 logs
  }

  const handlePTTStart = () => {
    if (!currentCall || !localStreamRef.current) {
      addDebugLogLocal('PTT start ignored: no active call or media stream', 'warn')
      return
    }

    setIsPTTPressed(true)
    setCallStatus('Talking...')
    addDebugLogLocal('PTT activated - enabling microphone')

    // Enable all audio tracks
    const audioTracks = localStreamRef.current.getAudioTracks()
    audioTracks.forEach(track => {
      track.enabled = true
      addDebugLogLocal(`Enabled audio track: ${track.label} (${track.readyState})`)
    })

    // Start audio recording in AudioHandler (not just flag, actual recording)
    if (AudioHandler.current) {
      AudioHandler.current.isRecording = true
      // Ensure the audio recording is actively processing audio
      if (!AudioHandler.current.scriptProcessor && localStreamRef.current) {
        addDebugLogLocal('Re-initializing audio recording for PTT')
        AudioHandler.current.startRecording(localStreamRef.current)
      }
      addDebugLogLocal('Audio recording enabled and active')
    }

    // Send audio stream started event
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('start-audio-stream', {
        callId: currentCall.id
      })
      addDebugLogLocal('Sent audio stream started event')
    } else {
      addDebugLogLocal('Socket not available for PTT start event', 'warn')
    }
  }

  const handlePTTEnd = () => {
    if (!currentCall || !localStreamRef.current) {
      addDebugLogLocal('PTT end ignored: no active call or media stream', 'warn')
      return
    }

    setIsPTTPressed(false)
    setCallStatus(`Connected to ${currentCall.targetUsername}`)
    addDebugLogLocal('PTT released - disabling microphone')

    // Disable all audio tracks
    const audioTracks = localStreamRef.current.getAudioTracks()
    audioTracks.forEach(track => {
      track.enabled = false
      addDebugLogLocal(`Disabled audio track: ${track.label} (${track.readyState})`)
    })

    // Stop recording in AudioHandler (but keep the processor ready for next PTT)
    if (AudioHandler.current) {
      AudioHandler.current.isRecording = false
      addDebugLogLocal('Audio recording disabled')
    }

    // Send audio stream stopped event
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('stop-audio-stream', {
        callId: currentCall.id
      })
      addDebugLogLocal('Sent audio stream stopped event')
    } else {
      addDebugLogLocal('Socket not available for PTT end event', 'warn')
    }
  }

  // Test backend connectivity
  const testBackendConnectivity = async () => {
    addDebugLogLocal('Testing backend connectivity...')
    try {
      const response = await makeXMLHttpRequest('/api/test')
      addDebugLogLocal(`Backend connectivity test: ${response.ok} (${response.status})`)
      if (response.ok) {
        const data = await response.json()
        addDebugLogLocal(`Backend response: ${data.message}`)
      } else {
        addDebugLogLocal('Backend connectivity test failed', 'error')
      }
    } catch (error) {
      addDebugLogLocal(`Backend connectivity test error: ${error.message}`, 'error')
    }
  }

  // Initialize app on mount
  useEffect(() => {
    addDebugLogLocal('App component mounted')
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
      addDebugLogLocal('XMLHttpRequest test successful')
    }
    testXhr.onerror = function() {
      console.log('Test XMLHttpRequest failed')
      addDebugLogLocal('XMLHttpRequest test failed', 'error')
    }
    testXhr.send()
    
    // Test backend connectivity
    testBackendConnectivity()
    
    initializeApp()
  }, [])

  // Ensure if no current user, show login screen
  useEffect(() => {
    if (!currentUser && showMainScreen) {
      addDebugLogLocal('No current user but main screen shown, resetting to login', 'warn')
      setShowMainScreen(false)
    }
  }, [currentUser, showMainScreen])

  // Hardware event simulator for testing (remove in production)
  useEffect(() => {
    const handleKeyDown = (event) => {
      switch(event.key) {
        case 'ArrowUp':
          event.preventDefault()
          window.dispatchEvent(new CustomEvent('scrollUp'))
          break
        case 'ArrowDown':
          event.preventDefault()
          window.dispatchEvent(new CustomEvent('scrollDown'))
          break
        case 'Enter':
          event.preventDefault()
          window.dispatchEvent(new CustomEvent('sideClick'))
          break
        case ' ':
          event.preventDefault()
          window.dispatchEvent(new CustomEvent('longPressStart'))
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('longPressEnd'))
          }, 1000)
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const initializeApp = () => {
    addDebugLogLocal('Starting app initialization')

    // Check for existing session
    const saved = localStorage.getItem('walky_user')
    if (saved) {
      try {
        const user = JSON.parse(saved)
        
        // Prevent "debugger" as a saved username
        if (user.username && user.username.toLowerCase() === 'debugger') {
          addDebugLogLocal('Removing saved user with reserved username "debugger"', 'warn')
          localStorage.removeItem('walky_user')
          return
        }
        
        addDebugLogLocal(`Found saved user: ${user.username} (ID: ${user.id})`)
        setCurrentUser(user)

        // Validate user with backend
        validateUser(user)
      } catch (e) {
        addDebugLogLocal(`Error parsing saved user: ${e.message}`, 'error')
        localStorage.removeItem('walky_user')
      }
    } else {
      addDebugLogLocal('No saved user found')
    }
  }

  const validateUser = async (user) => {
    addDebugLogLocal(`Validating user: ${user.username} with ID: ${user.id}`)
    try {
      addDebugLogLocal('Making API call to /api/users/me')
      const response = await makeXMLHttpRequest('/api/users/me', {
        headers: { 'X-User-ID': user.id }
      });
      addDebugLogLocal(`Validation response: ${response.ok} (${response.status})`)
      
      if (response.ok) {
        const userData = await response.json()
        addDebugLogLocal(`User validated successfully: ${userData.username} (ID: ${userData.id})`)
        addDebugLogLocal(`Setting currentUser state after validation: ${JSON.stringify(userData)}`)
        setCurrentUser(userData)
        addDebugLogLocal(`Updating localStorage after validation: ${JSON.stringify(userData)}`)
        localStorage.setItem('walky_user', JSON.stringify(userData))
        addDebugLogLocal('Setting showMainScreen to true after validation')
        setShowMainScreen(true);
        addDebugLogLocal('Calling loadFriends() after validation with userData')
        loadFriends(userData);
        addDebugLogLocal('Calling loadFriendRequests() after validation with userData')
        loadFriendRequests(userData);
        // Small delay to ensure state is updated
        addDebugLogLocal('Scheduling connectSocket() in 100ms after validation with userData')
        setTimeout(() => {
          addDebugLogLocal('Executing connectSocket() after validation with userData')
          connectSocket(userData)
        }, 100);
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        addDebugLogLocal(`User validation failed (${response.status}): ${errorData.error}`, 'error')
        // User doesn't exist, create them
        await createUser(user.username)
      }
    } catch (error) {
      addDebugLogLocal(`User validation error: ${error.message}`, 'error')
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

  const callFriend = async (friend) => {
    if (!currentUser || currentCall) return

    try {
      setCallingTarget(friend.username)
      setShowCalling(true)
      setCallStatus(`Calling ${friend.username}...`)
      addDebugLogLocal(`Initiating server-mediated call to ${friend.username}`)

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
      addDebugLogLocal('Got user media successfully')

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
        addDebugLogLocal(`Server-mediated call initiated with ID: ${callData.callId}`)

        // Set up audio processing for server relay with the new call data
        if (AudioHandler.current) {
          AudioHandler.current.setCurrentCall(newCall)
          const started = await AudioHandler.current.startRecording(localStreamRef.current)
          if (!started) {
            addDebugLogLocal('Failed to start audio recording', 'error')
          } else {
            addDebugLogLocal('Audio recording started successfully')
          }
        } else {
          addDebugLogLocal('AudioHandler not initialized - initializing now', 'error')
          // Initialize AudioHandler if not already done
          AudioHandler.current = new AudioHandlerClass()
          AudioHandler.current.setCurrentCall(newCall)
          const started = await AudioHandler.current.startRecording(localStreamRef.current)
          if (!started) {
            addDebugLogLocal('Failed to start audio recording after initialization', 'error')
          } else {
            addDebugLogLocal('Audio recording started successfully after initialization')
          }
        }
      } else {
        throw new Error('Failed to initiate call')
      }
    } catch (error) {
      addDebugLogLocal(`Call error: ${error.message}`, 'error')
      setCallStatus(`Call failed: ${error.message}`)
      setShowCalling(false)
      setCallingTarget('')
      endCall()
    }
  }

  const acceptCall = async () => {
    if (!incomingCallData) return

    try {
      addDebugLogLocal('Accepting incoming server-mediated call')
      
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
      addDebugLogLocal('Got user media for incoming call')

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
        addDebugLogLocal('Server-mediated call accepted and connected')

        // Set up audio processing for server relay with the new call data
        if (AudioHandler.current) {
          AudioHandler.current.setCurrentCall(newCall)
          const started = await AudioHandler.current.startRecording(localStreamRef.current)
          if (!started) {
            addDebugLogLocal('Failed to start audio recording', 'error')
          } else {
            addDebugLogLocal('Audio recording started successfully')
          }
        } else {
          addDebugLogLocal('AudioHandler not initialized - initializing now', 'error')
          // Initialize AudioHandler if not already done
          AudioHandler.current = new AudioHandlerClass()
          AudioHandler.current.setCurrentCall(newCall)
          const started = await AudioHandler.current.startRecording(localStreamRef.current)
          if (!started) {
            addDebugLogLocal('Failed to start audio recording after initialization', 'error')
          } else {
            addDebugLogLocal('Audio recording started successfully after initialization')
          }
        }
      } else {
        throw new Error('Failed to send answer')
      }

    } catch (error) {
      addDebugLogLocal(`Failed to accept call: ${error.message}`, 'error')
      setCallStatus(`Failed to accept call: ${error.message}`)
      rejectCall()
    }
  }

  const rejectCall = async () => {
    addDebugLogLocal('Rejecting incoming call')
    
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
        addDebugLogLocal('Sent reject call request to server')
      } catch (error) {
        addDebugLogLocal(`Failed to reject call on server: ${error.message}`, 'error')
      }
    }

    setShowIncomingCall(false)
    setIncomingCaller('')
    setIncomingCallData(null)
    setCallStatus('Call rejected')
    addDebugLogLocal('Call rejected')
  }

  const cancelCall = async () => {
    addDebugLogLocal('Cancelling outgoing call')
    
    // Stop local media
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        track.stop()
        addDebugLogLocal(`Stopped ${track.kind} track`)
      })
      localStreamRef.current = null
    }

    // Clean up audio processing
    if (AudioHandler.current) {
      AudioHandler.current.cleanup()
    }

    // Send end call event if there's an active call
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
        addDebugLogLocal('Sent cancel call request to server')
      } catch (error) {
        addDebugLogLocal(`Failed to cancel call on server: ${error.message}`, 'error')
      }
    }

    setCurrentCall(null)
    setCallStatus('')
    setIsPTTPressed(false)
    setShowCalling(false)
    setCallingTarget('')
    addDebugLogLocal('Call cancelled')
  }

  const handleGroupCallStarted = (data) => {
    addDebugLogLocal(`Group call started: ${JSON.stringify(data)}`)
    setGroupCallData(data)
    setShowGroupCall(true)
    setCallStatus(`Group call active in ${data.channelName || 'channel'}`)
  }

  const handleGroupCallClosed = () => {
    addDebugLogLocal('Group call closed')
    setShowGroupCall(false)
    setGroupCallData(null)
    setCallStatus('')
  }

  const addFriend = async (friendUsername) => {
    if (!currentUser) {
      addDebugLogLocal('Cannot add friend: no current user', 'error')
      return false
    }

    // Use the parameter passed from the component instead of DOM element
    if (!friendUsername) {
      setCallStatus('Enter a username')
      return false
    }

    // Prevent adding yourself
    if (friendUsername.toLowerCase() === currentUser.username.toLowerCase()) {
      setCallStatus('Cannot add yourself as friend')
      return false
    }

    addDebugLogLocal(`Adding friend: ${friendUsername}`)
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

      addDebugLogLocal(`Add friend response: ${response.status}`)
      if (response.ok) {
        const data = await response.json()
        setCallStatus(`Friend request sent to ${friendUsername}!`)
        return true
      } else {
        const error = await response.json()
        setCallStatus(error.error || 'Failed to send friend request')
        return false
      }
    } catch (error) {
      addDebugLogLocal(`Add friend error: ${error.message}`, 'error')
      setCallStatus('Network error')
      return false
    }
  }

  const acceptFriendRequest = async (friendshipId) => {
    if (!currentUser) {
      addDebugLogLocal('Cannot accept friend request: no current user', 'error')
      return
    }

    addDebugLogLocal(`Accepting friend request: ${friendshipId}`)
    setCallStatus('Accepting friend request...')

    try {
      const response = await makeXMLHttpRequest(`/api/friends/${friendshipId}/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': currentUser.id
        }
      })

      addDebugLogLocal(`Accept friend request response: ${response.status}`)
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
      addDebugLogLocal(`Accept friend request error: ${error.message}`, 'error')
      setCallStatus('Network error')
    }
  }

  const rejectFriendRequest = async (friendshipId) => {
    if (!currentUser) {
      addDebugLogLocal('Cannot reject friend request: no current user', 'error')
      return
    }

    addDebugLogLocal(`Rejecting friend request: ${friendshipId}`)
    setCallStatus('Rejecting friend request...')

    try {
      const response = await makeXMLHttpRequest(`/api/friends/${friendshipId}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': currentUser.id
        }
      })

      addDebugLogLocal(`Reject friend request response: ${response.status}`)
      if (response.ok) {
        setCallStatus('Friend request rejected')
        // Reload friend requests
        loadFriendRequests(currentUser)
      } else {
        const error = await response.json()
        setCallStatus(error.error || 'Failed to reject friend request')
      }
    } catch (error) {
      addDebugLogLocal(`Reject friend request error: ${error.message}`, 'error')
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
        <LoginScreen login={login} loginStatus={loginStatus} />

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
      <MainScreen
        currentUser={currentUser}
        connectionStatus={connectionStatus}
        friendRequests={friendRequests}
        friends={friends}
        callFriend={callFriend}
        addFriend={addFriend}
        acceptFriendRequest={acceptFriendRequest}
        rejectFriendRequest={rejectFriendRequest}
        isPTTPressed={isPTTPressed}
        handlePTTStart={handlePTTStart}
        handlePTTEnd={handlePTTEnd}
        volumeLevel={volumeLevel}
        updateVolume={updateVolume}
        currentCall={currentCall}
        endCall={endCall}
        callStatus={callStatus}
        showGroupCall={showGroupCall}
        groupCallData={groupCallData}
        onGroupCallStarted={handleGroupCallStarted}
        onGroupCallClosed={handleGroupCallClosed}
        showIncomingCall={showIncomingCall}
        incomingCaller={incomingCaller}
        acceptCall={acceptCall}
        rejectCall={rejectCall}
        showCalling={showCalling}
        callingTarget={callingTarget}
        cancelCall={cancelCall}
      />

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

export default App

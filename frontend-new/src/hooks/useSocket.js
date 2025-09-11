import { useRef, useEffect } from 'react';
import { io } from 'socket.io-client';
import { addDebugLog } from '../utils/api.js';

export const useSocket = (currentUser, setConnectionStatus, setFriends, loadFriendRequests, loadFriends, setCallStatus, setCurrentCall, setShowIncomingCall, setIncomingCaller, setIncomingCallData, endCall, AudioHandler, setShowCalling, setCallingTarget) => {
  const socketRef = useRef(null);

  const connectSocket = (userData = null) => {
    const user = userData || currentUser;
    addDebugLog(`connectSocket called, user: ${user ? JSON.stringify(user) : 'null'}`);
    if (!user || !user.id) {
      addDebugLog('Cannot connect socket: no user or user ID', 'error');
      return;
    }

    addDebugLog(`Connecting to WebSocket for user: ${user.username} (ID: ${user.id})`);

    // Try socket.io first, fallback to native WebSocket
    if (typeof io !== 'undefined') {
      addDebugLog('Using socket.io for connection');
      socketRef.current = io('/', {
        path: '/socket.io',
        transports: ['websocket', 'polling'],
        timeout: 5000,
        forceNew: true,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000
      });

      socketRef.current.on('connect', () => {
        addDebugLog('Socket.io connected successfully');
        setConnectionStatus('Online');
        addDebugLog(`Registering user: ${user.id}`);
        socketRef.current.emit('register', user.id);
      });

      socketRef.current.on('connect_error', (error) => {
        addDebugLog(`Socket.io connection error: ${error.message}`, 'error');
        setConnectionStatus('Offline');
      });

      socketRef.current.on('disconnect', (reason) => {
        addDebugLog(`Socket.io disconnected: ${reason}`, 'error');
        setConnectionStatus('Offline');
      });

      socketRef.current.on('reconnect', (attemptNumber) => {
        addDebugLog(`Socket.io reconnected after ${attemptNumber} attempts`);
        setConnectionStatus('Online');
        // Re-register after reconnection
        socketRef.current.emit('register', user.id);
      });

      socketRef.current.on('reconnect_error', (error) => {
        addDebugLog(`Socket.io reconnection error: ${error.message}`, 'error');
        setConnectionStatus('Offline');
      });

      // Friend request events
      socketRef.current.on('friend-request-received', (data) => {
        addDebugLog(`Friend request received from: ${data.fromUser?.username}`);
        if (loadFriendRequests) loadFriendRequests(user);
        setCallStatus(`Friend request from ${data.fromUser?.username}`);
      });

      socketRef.current.on('friend-request-accepted', (data) => {
        addDebugLog(`Friend request accepted by: ${data.accepter?.username}`);
        if (loadFriends) loadFriends(user);
        setCallStatus(`${data.accepter?.username} accepted your request!`);
      });

      socketRef.current.on('friendship-updated', (data) => {
        addDebugLog('Friendship updated');
        if (loadFriends) loadFriends(user);
      });

      // Call events
      socketRef.current.on('incoming-call', (data) => {
        addDebugLog(`Incoming call from: ${data.callerUsername}`);
        setIncomingCaller(data.callerUsername);
        setIncomingCallData(data);
        setShowIncomingCall(true);
        setCallStatus(`Incoming call from ${data.callerUsername}`);

        // Play ringer
        if (window.ringtoneRef?.current) {
          window.ringtoneRef.current.play().catch(err => {
            addDebugLog(`Failed to play ringer: ${err.message}`, 'error');
          });
        }
      });

      socketRef.current.on('call-answered', async (data) => {
        addDebugLog('Call answered by recipient');
        setCallStatus(`Connected to ${data.answererUsername}`);

        // Hide calling overlay
        setShowCalling(false);
        setCallingTarget('');

        // For server-mediated calls, just update status
        if (setCurrentCall) {
          setCurrentCall(prev => ({ ...prev, status: 'connected' }));
        }
      });

      socketRef.current.on('call-ended', (data) => {
        addDebugLog(`Call ended by ${data.endedByUsername}`);
        setCallStatus(`Call ended by ${data.endedByUsername}`);
        if (endCall) endCall();
      });

      // Audio streaming events for server-mediated calls
      socketRef.current.on('audio-data', (data) => {
        addDebugLog('Received audio data from server');
        if (AudioHandler.current) {
          AudioHandler.current.handleIncomingAudio(data);
        }
      });

      socketRef.current.on('audio-stream-started', (data) => {
        addDebugLog(`${data.fromUsername} started speaking`);
        setCallStatus(`${data.fromUsername} is speaking...`);
      });

      socketRef.current.on('audio-stream-stopped', (data) => {
        addDebugLog(`${data.fromUsername} stopped speaking`);
        setCallStatus(`Connected to user`);
      });

      // Group call events
      socketRef.current.on('group-call-started', (data) => {
        addDebugLog(`Group call started in channel ${data.channelId} by ${data.startedByUsername}`);
        // This will be handled by the LocationChannels component
      });

      socketRef.current.on('group-call-joined', (data) => {
        addDebugLog(`Joined group call ${data.callId} in channel ${data.channelId}`);
        // This will be handled by the GroupCallOverlay component
      });

      socketRef.current.on('user-joined-channel', (data) => {
        addDebugLog(`User ${data.username} joined channel ${data.channelId}`);
        // This will be handled by the LocationChannels component
      });

      socketRef.current.on('user-left-channel', (data) => {
        addDebugLog(`User ${data.username} left channel ${data.channelId}`);
        // This will be handled by the LocationChannels component
      });

      // User status events
      socketRef.current.on('user-online', (data) => {
        addDebugLog(`User ${data.userId} came online`);
        // Update friend status in the friends list
        setFriends(prevFriends =>
          prevFriends.map(friend =>
            friend.id === data.userId
              ? { ...friend, status: 'online' }
              : friend
          )
        );
      });

      socketRef.current.on('user-offline', (data) => {
        addDebugLog(`User ${data.userId} went offline`);
        // Update friend status in the friends list
        setFriends(prevFriends =>
          prevFriends.map(friend =>
            friend.id === data.userId
              ? { ...friend, status: 'offline' }
              : friend
          )
        );
      });

    } else {
      addDebugLog('Socket.io not available, WebSocket features will not work', 'error');
      setConnectionStatus('Offline - No WebSocket Support');
    }
  };

  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  return { socketRef, connectSocket };
};

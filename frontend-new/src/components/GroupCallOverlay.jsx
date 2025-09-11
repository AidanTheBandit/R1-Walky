import React, { useState, useEffect, useRef } from 'react'
import SpeakerIndicator from './SpeakerIndicator'

function GroupCallOverlay({
  showGroupCall,
  groupCallData,
  onClose,
  volumeLevel,
  updateVolume
}) {
  const [isConnected, setIsConnected] = useState(false)
  const [participants, setParticipants] = useState([])
  const [isMuted, setIsMuted] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [currentSpeaker, setCurrentSpeaker] = useState(null)

  const remoteAudioRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const audioContextRef = useRef(null)
  const streamRef = useRef(null)

  useEffect(() => {
    if (showGroupCall && groupCallData) {
      initializeGroupCall()
    } else {
      cleanupGroupCall()
    }

    return () => {
      cleanupGroupCall()
    }
  }, [showGroupCall, groupCallData])

  const initializeGroupCall = async () => {
    try {
      console.log('Initializing group call:', groupCallData)

      // Get user media
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: false,
          sampleRate: 44100,
          channelCount: 1
        }
      })

      streamRef.current = stream

      // Disable tracks initially (PTT mode)
      stream.getAudioTracks().forEach(track => {
        track.enabled = false
      })

      // Set up audio context for processing
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)()

      setIsConnected(true)

      // Join the group call via socket
      if (window.socketRef?.current) {
        window.socketRef.current.emit('join-group-call', {
          callId: groupCallData.callId
        })
      }

      // Load participants
      await loadParticipants()

    } catch (error) {
      console.error('Failed to initialize group call:', error)
      alert('Failed to start group call: ' + error.message)
      onClose()
    }
  }

  const cleanupGroupCall = () => {
    console.log('Cleaning up group call')

    // Stop media stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop()
      })
      streamRef.current = null
    }

    // Close audio context
    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }

    // Stop recording
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop()
      mediaRecorderRef.current = null
    }

    setIsConnected(false)
    setIsRecording(false)
    setParticipants([])
    setCurrentSpeaker(null)
  }

  const loadParticipants = async () => {
    try {
      if (groupCallData?.channelId) {
        const response = await fetch(`/api/location/channels/${groupCallData.channelId}/participants`, {
          headers: {
            'X-User-ID': window.currentUser?.id
          }
        })

        if (response.ok) {
          const data = await response.json()
          setParticipants(data.participants || [])
        }
      }
    } catch (error) {
      console.error('Failed to load participants:', error)
    }
  }

  const handlePTTStart = () => {
    if (!streamRef.current || isMuted) return

    console.log('PTT started in group call')

    // Enable audio tracks
    streamRef.current.getAudioTracks().forEach(track => {
      track.enabled = true
    })

    setIsRecording(true)

    // Start recording and streaming
    startAudioStreaming()
  }

  const handlePTTEnd = () => {
    if (!streamRef.current) return

    console.log('PTT ended in group call')

    // Disable audio tracks
    streamRef.current.getAudioTracks().forEach(track => {
      track.enabled = false
    })

    setIsRecording(false)

    // Stop recording
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop()
    }
  }

  const startAudioStreaming = () => {
    if (!streamRef.current || !audioContextRef.current) return

    try {
      // Create audio processing nodes
      const source = audioContextRef.current.createMediaStreamSource(streamRef.current)
      const processor = audioContextRef.current.createScriptProcessor(4096, 1, 1)

      processor.onaudioprocess = (event) => {
        if (!isRecording) return

        const inputBuffer = event.inputBuffer
        const inputData = inputBuffer.getChannelData(0)

        // Convert to 16-bit PCM
        const pcmData = new Int16Array(inputData.length)
        for (let i = 0; i < inputData.length; i++) {
          pcmData[i] = Math.max(-32768, Math.min(32767, inputData[i] * 32768))
        }

        // Send audio data via socket
        if (window.socketRef?.current) {
          window.socketRef.current.emit('audio-data', {
            callId: groupCallData.callId,
            audioData: Array.from(pcmData),
            sampleRate: audioContextRef.current.sampleRate,
            channels: 1
          })
        }
      }

      source.connect(processor)
      processor.connect(audioContextRef.current.destination)

    } catch (error) {
      console.error('Failed to start audio streaming:', error)
    }
  }

  const toggleMute = () => {
    setIsMuted(!isMuted)
    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach(track => {
        track.enabled = isMuted // Will be toggled
      })
    }
  }

  const leaveGroupCall = () => {
    // Send leave call event
    if (window.socketRef?.current && groupCallData) {
      window.socketRef.current.emit('leave-group-call', {
        callId: groupCallData.callId
      })
    }

    onClose()
  }

  if (!showGroupCall || !groupCallData) {
    return null
  }

  return (
    <div className="group-call-overlay">
      <div className="group-call-header">
        <h3>Group Call</h3>
        <div className="call-info">
          <span className="channel-name">{groupCallData.channelName || 'Location Channel'}</span>
          <span className="connection-status">
            {isConnected ? '🟢 Connected' : '🔴 Connecting...'}
          </span>
        </div>
        <button className="close-btn" onClick={leaveGroupCall}>×</button>
      </div>

      <div className="group-call-content">
        <div className="participants-section">
          <h4>Participants ({participants.length})</h4>
          <div className="participants-list">
            {participants.map(participant => (
              <div key={participant.id} className="participant-item">
                <div className="participant-avatar">
                  <span className="participant-initial">
                    {participant.username.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="participant-info">
                  <span className="participant-name">{participant.username}</span>
                  <span className="participant-status">
                    {participant.id === window.currentUser?.id ? 'You' : 'Connected'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <SpeakerIndicator
          currentCall={groupCallData}
          speakers={participants}
        />

        <div className="group-call-controls">
          <div className="ptt-section">
            <button
              className={`ptt-button ${isRecording ? 'active' : ''} ${isMuted ? 'muted' : ''}`}
              onMouseDown={handlePTTStart}
              onMouseUp={handlePTTEnd}
              onTouchStart={handlePTTStart}
              onTouchEnd={handlePTTEnd}
              disabled={!isConnected || isMuted}
            >
              <div>{isMuted ? 'MUTED' : 'HOLD'}</div>
              <div>{isMuted ? '' : 'TO TALK'}</div>
            </button>
          </div>

          <div className="control-buttons">
            <button
              className={`control-btn ${isMuted ? 'active' : ''}`}
              onClick={toggleMute}
            >
              {isMuted ? '🔇 Unmute' : '🎤 Mute'}
            </button>

            <div className="volume-control">
              <label htmlFor="group-volume-slider">🔊 Volume:</label>
              <input
                type="range"
                id="group-volume-slider"
                min="0"
                max="3"
                step="0.1"
                value={volumeLevel}
                onChange={updateVolume}
              />
              <span id="group-volume-value">{Math.round(volumeLevel * 100)}%</span>
            </div>
          </div>
        </div>
      </div>

      <audio ref={remoteAudioRef} autoplay></audio>
    </div>
  )
}

export default GroupCallOverlay

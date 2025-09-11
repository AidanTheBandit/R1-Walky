import React, { useState, useEffect } from 'react'

function SpeakerIndicator({ currentCall, speakers }) {
  const [activeSpeakers, setActiveSpeakers] = useState(new Map())
  const [speakingHistory, setSpeakingHistory] = useState([])

  useEffect(() => {
    if (!currentCall || !speakers) return

    // Update active speakers based on audio data
    const updateActiveSpeakers = (audioData) => {
      if (audioData && audioData.fromUserId) {
        setActiveSpeakers(prev => {
          const newMap = new Map(prev)
          newMap.set(audioData.fromUserId, {
            username: audioData.speakerName || audioData.fromUserId,
            timestamp: Date.now(),
            isActive: true
          })
          return newMap
        })

        // Add to speaking history
        setSpeakingHistory(prev => {
          const newHistory = [...prev, {
            userId: audioData.fromUserId,
            username: audioData.speakerName || audioData.fromUserId,
            timestamp: Date.now()
          }].slice(-10) // Keep last 10 speakers
          return newHistory
        })

        // Clear inactive speakers after 2 seconds
        setTimeout(() => {
          setActiveSpeakers(prev => {
            const newMap = new Map(prev)
            const speaker = newMap.get(audioData.fromUserId)
            if (speaker && Date.now() - speaker.timestamp > 2000) {
              newMap.delete(audioData.fromUserId)
            }
            return newMap
          })
        }, 2000)
      }
    }

    // Listen for audio data events
    if (window.socketRef?.current) {
      const handleAudioData = (data) => {
        updateActiveSpeakers(data)
      }

      window.socketRef.current.on('audio-data', handleAudioData)

      return () => {
        window.socketRef.current.off('audio-data', handleAudioData)
      }
    }
  }, [currentCall, speakers])

  // Clear all speakers when call ends
  useEffect(() => {
    if (!currentCall) {
      setActiveSpeakers(new Map())
      setSpeakingHistory([])
    }
  }, [currentCall])

  if (!currentCall || activeSpeakers.size === 0) {
    return null
  }

  const activeSpeakerList = Array.from(activeSpeakers.values())

  return (
    <div className="speaker-indicator">
      <div className="speaker-header">
        <h4>Now Speaking</h4>
      </div>

      <div className="active-speakers">
        {activeSpeakerList.map((speaker, index) => (
          <div key={speaker.userId || index} className="speaker-item active">
            <div className="speaker-avatar">
              <div className="speaking-indicator"></div>
            </div>
            <div className="speaker-info">
              <span className="speaker-name">{speaker.username}</span>
              <span className="speaker-status">Speaking</span>
            </div>
          </div>
        ))}
      </div>

      {speakingHistory.length > 0 && (
        <div className="speaker-history">
          <h5>Recent Speakers</h5>
          <div className="history-list">
            {speakingHistory.slice().reverse().map((speaker, index) => (
              <div key={`${speaker.userId}-${speaker.timestamp}`} className="speaker-item history">
                <div className="speaker-avatar small">
                  <span className="speaker-initial">
                    {speaker.username.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="speaker-info">
                  <span className="speaker-name">{speaker.username}</span>
                  <span className="speaker-time">
                    {new Date(speaker.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default SpeakerIndicator

import React, { useState, useEffect } from 'react'
import FriendRequests from './FriendRequests'
import FriendsList from './FriendsList'
import PTTButton from './PTTButton'
import LocationChannels from './LocationChannels'
import GroupCallOverlay from './GroupCallOverlay'

function MainScreen({
  currentUser,
  connectionStatus,
  friendRequests,
  friends,
  callFriend,
  addFriend,
  acceptFriendRequest,
  rejectFriendRequest,
  isPTTPressed,
  handlePTTStart,
  handlePTTEnd,
  volumeLevel,
  updateVolume,
  currentCall,
  endCall,
  callStatus,
  showGroupCall,
  groupCallData,
  onGroupCallStarted,
  onGroupCallClosed
}) {
  const [currentScreen, setCurrentScreen] = useState('main')
  const [selectedFriendIndex, setSelectedFriendIndex] = useState(0)

  // Hardware button event listeners
  useEffect(() => {
    const handleScrollUp = () => {
      if (currentScreen === 'friends') {
        setSelectedFriendIndex(prev => Math.max(0, prev - 1))
      }
    }

    const handleScrollDown = () => {
      if (currentScreen === 'friends') {
        setSelectedFriendIndex(prev => Math.min(friends.length - 1, prev + 1))
      }
    }

    const handleSideClick = () => {
      if (currentScreen === 'friends' && friends[selectedFriendIndex]) {
        callFriend(friends[selectedFriendIndex])
      }
    }

    // Add event listeners
    window.addEventListener('scrollUp', handleScrollUp)
    window.addEventListener('scrollDown', handleScrollDown)
    window.addEventListener('sideClick', handleSideClick)

    return () => {
      window.removeEventListener('scrollUp', handleScrollUp)
      window.removeEventListener('scrollDown', handleScrollDown)
      window.removeEventListener('sideClick', handleSideClick)
    }
  }, [currentScreen, friends, selectedFriendIndex, callFriend])

  const renderMainScreen = () => (
    <div className="main-screen">
      <div className="lcd-screen">
        <div className="lcd-content">
          {currentCall ? (
            <>
              <div className="connect-message">connect with "{currentCall.targetUsername}"</div>
              <div className="status-line"></div>
              <div className="status-text">
                <span>status</span>
                <span className={currentCall.status === 'connected' ? 'status-connected' : 'status-disconnected'}>
                  {currentCall.status === 'connected' ? 'connected' : currentCall.status}
                </span>
              </div>
            </>
          ) : (
            <>
              <div className="connect-message">R1-Walky</div>
              <div className="status-line"></div>
              <div className="status-text">
                <span>status</span>
                <span className={connectionStatus === 'Online' ? 'status-connected' : 'status-disconnected'}>
                  {connectionStatus.toLowerCase()}
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="control-section">
        <div className="flow-section">
          <button className="flow-button">
            Flow 1 
            <span className="flow-arrow">⟵</span>
          </button>
          <button className="friends-btn" onClick={() => setCurrentScreen('friends')}>
            friends
          </button>
        </div>

        <div className="speaker-section">
          <div className="speaker-grill">
            <svg className="speaker-icon" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
            </svg>
          </div>
        </div>
      </div>
    </div>
  )

  const renderFriendsScreen = () => (
    <div className="friends-screen">
      <button className="back-btn" onClick={() => setCurrentScreen('main')}>←</button>
      <div className="lcd-screen">
        <div className="lcd-content">
          <div className="friends-title">select a friend</div>
          <div className="status-line"></div>
          <div className="friends-list">
            {friends.length === 0 ? (
              <div className="friend-item">
                <span>No friends</span>
                <span className="status-disconnected">not connected</span>
              </div>
            ) : (
              friends.map((friend, index) => (
                <div
                  key={friend.id}
                  className={`friend-item ${index === selectedFriendIndex ? 'selected' : ''}`}
                  onClick={() => {
                    setSelectedFriendIndex(index)
                    callFriend(friend)
                  }}
                >
                  <span className="friend-name">{friend.username}</span>
                  <span className={friend.status === 'online' ? 'status-connected' : 'status-disconnected'}>
                    {friend.status === 'online' ? 'connected' : 'not connected'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="control-section">
        <div className="speaker-section">
          <div className="speaker-grill">
            <svg className="speaker-icon" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
            </svg>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div className={`r1-device screen-${currentScreen}`}>
      {renderMainScreen()}
      {renderFriendsScreen()}

      <GroupCallOverlay
        showGroupCall={showGroupCall}
        groupCallData={groupCallData}
        onClose={onGroupCallClosed}
        volumeLevel={volumeLevel}
        updateVolume={updateVolume}
      />
    </div>
  )
}

export default MainScreen

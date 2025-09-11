import React, { useState, useEffect } from 'react'
import FriendRequests from './FriendRequests'
import FriendsList from './FriendsList'
import PTTButton from './PTTButton'
import LocationChannels from './LocationChannels'
import GroupCallOverlay from './GroupCallOverlay'
import speakerSvg from '../assets/speaker.svg'

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
          <div className="lcd-text lcd-title">R1-WALKY - {currentUser?.username || 'User'}</div>
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
  )

  const renderFriendsScreen = () => (
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
  )

  const renderChannelsScreen = () => (
    <div className="lcd-content">
      <div className="channels-title">location channels</div>
      <div className="status-line"></div>
      <LocationChannels
        currentUser={currentUser}
        onChannelJoined={(channelId) => {
          console.log('Joined channel:', channelId)
        }}
        onGroupCallStarted={onGroupCallStarted}
      />
    </div>
  )

  const renderSettingsScreen = () => (
    <div className="lcd-content">
      <div className="settings-title">settings</div>
      <div className="status-line"></div>
      <div className="settings-list">
        <div className="setting-item">
          <span>volume</span>
          <input
            type="range"
            min="0"
            max="3"
            step="0.1"
            value={volumeLevel}
            onChange={updateVolume}
            className="volume-slider"
          />
        </div>
        <div className="setting-item">
          <span>debug</span>
          <span>{friends.some(f => f.username.toLowerCase() === 'debugger') ? 'on' : 'off'}</span>
        </div>
      </div>
    </div>
  )

  const renderCurrentScreen = () => {
    switch (currentScreen) {
      case 'friends':
        return renderFriendsScreen()
      case 'channels':
        return renderChannelsScreen()
      case 'settings':
        return renderSettingsScreen()
      default:
        return renderMainScreen()
    }
  }

  return (
    <div className="r1-device">
      {/* LCD Screen - Fixed Size */}
      <div className="lcd-screen">
        {renderCurrentScreen()}
      </div>

      {/* Control Section - Fixed Layout */}
      <div className="control-section">
        {/* Speaker SVG as PTT Button */}
        <div className="speaker-section">
          <button
            className={`speaker-btn ${isPTTPressed ? 'active' : ''}`}
            onMouseDown={handlePTTStart}
            onMouseUp={handlePTTEnd}
            onTouchStart={handlePTTStart}
            onTouchEnd={handlePTTEnd}
          >
            <img src={speakerSvg} alt="Speaker" className="speaker-icon" />
          </button>
        </div>

        {/* Vertical Button Stack */}
        <div className="button-stack">
          <button
            className="control-btn friends-btn"
            onClick={() => setCurrentScreen('friends')}
          >
            friends
          </button>
          <button
            className="control-btn channels-btn"
            onClick={() => setCurrentScreen('channels')}
          >
            channels
          </button>
          <button
            className="control-btn settings-btn"
            onClick={() => setCurrentScreen('settings')}
          >
            settings
          </button>
          {currentScreen !== 'main' && (
            <button
              className="control-btn back-btn"
              onClick={() => setCurrentScreen('main')}
            >
              back
            </button>
          )}
        </div>
      </div>

      {/* Friend Requests Overlay */}
      <FriendRequests
        friendRequests={friendRequests}
        acceptFriendRequest={acceptFriendRequest}
        rejectFriendRequest={rejectFriendRequest}
      />

      {/* Group Call Overlay */}
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

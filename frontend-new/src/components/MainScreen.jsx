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
        <div>
          <div className="lcd-text lcd-title">R1-WALKY</div>
          <div className="lcd-text">Connect with "{currentCall.targetUsername}"</div>
          <div className="lcd-text">----------------------</div>
          <div className="lcd-text lcd-status">Status: {currentCall.status === 'connected' ? 'Connected' : currentCall.status}</div>
        </div>
      ) : (
        <div>
          <div className="lcd-text lcd-title">R1-WALKY</div>
          <div className="lcd-text">{currentUser?.username || 'User'}</div>
          <div className="lcd-text">{connectionStatus}</div>
        </div>
      )}
    </div>
  )

  const renderFriendsScreen = () => (
    <div className="lcd-content">
      <div className="lcd-text lcd-title">
        FRIENDS
      </div>
      {friends.length === 0 ? (
        <div className="no-data">No friends</div>
      ) : (
        <div className="friends-list">
          {friends.map((friend, index) => (
            <div
              key={friend.id}
              className={`friend-item ${index === selectedFriendIndex ? 'selected' : ''}`}
            >
              <div className="friend-name">{friend.username}</div>
              <div className="friend-status">
                {friend.status === 'online' ? '●' : '○'}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  const renderChannelsScreen = () => (
    <div className="lcd-content">
      <div className="lcd-text lcd-title">
        CHANNELS
      </div>
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
      <div className="lcd-text lcd-title">
        SETTINGS
      </div>
      <div className="settings-list">
        <div className="setting-item">
          <span>Volume</span>
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
          <span>Debug</span>
          <span>{friends.some(f => f.username.toLowerCase() === 'debugger') ? 'ON' : 'OFF'}</span>
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
      {/* LCD Screen */}
      <div className="lcd-screen">
        {renderCurrentScreen()}
      </div>

      {/* Speaker and Controls Section */}
      <div className="speaker-controls">
        <div
          className="speaker-area"
          onClick={isPTTPressed ? handlePTTEnd : handlePTTStart}
        >
          <img
            src={speakerSvg}
            alt="Speaker"
            className="speaker-svg"
          />
        </div>
        <div className="controls-area">
          <button
            className="control-btn friends-btn"
            onClick={() => setCurrentScreen('friends')}
          >
            👥
          </button>
          <button
            className="control-btn channels-btn"
            onClick={() => setCurrentScreen('channels')}
          >
            📡
          </button>
          <button
            className="control-btn settings-btn"
            onClick={() => setCurrentScreen('settings')}
          >
            ⚙
          </button>
        </div>
      </div>

      {/* PTT Button */}
      <div className="ptt-section">
        <PTTButton
          isPTTPressed={isPTTPressed}
          handlePTTStart={handlePTTStart}
          handlePTTEnd={handlePTTEnd}
          volumeLevel={volumeLevel}
          updateVolume={updateVolume}
        />
      </div>

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

import React, { useState, useEffect } from 'react'
import FriendRequests from './FriendRequests'
import FriendsList from './FriendsList'
import PTTButton from './PTTButton'
import GroupCallOverlay from './GroupCallOverlay'
import speakerSvg from '../assets/speaker.svg'

function MainScreen({
  currentUser,
  connectionStatus,
  friendRequests,
  friends,
  callFriend,
  addFriend,
  removeFriend,
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
  onGroupCallClosed,
  showIncomingCall,
  incomingCaller,
  acceptCall,
  rejectCall,
  showCalling,
  callingTarget,
  cancelCall
}) {
  const [currentScreen, setCurrentScreen] = useState('main')
  const [selectedFriendIndex, setSelectedFriendIndex] = useState(0)
  const [showAddFriend, setShowAddFriend] = useState(false)
  const [newFriendUsername, setNewFriendUsername] = useState('')

  // Handle automatic screen switching for call states
  useEffect(() => {
    if (showIncomingCall || showCalling) {
      // Don't allow navigation away from call screens
      return
    }
    // Reset to main screen when call states are cleared or when call becomes connected
    if (currentScreen !== 'main' && currentScreen !== 'friends' && currentScreen !== 'settings') {
      setCurrentScreen('main')
    }
    // If we're in friends screen and a call becomes connected, go to main
    if (currentScreen === 'friends' && currentCall && currentCall.status === 'connected') {
      setCurrentScreen('main')
    }
  }, [showIncomingCall, showCalling, currentScreen, currentCall])

  const handleAddFriend = () => {
    if (newFriendUsername.trim()) {
      addFriend(newFriendUsername.trim())
      setNewFriendUsername('')
    }
  }

  const handleRemoveFriend = (friendId) => {
    if (removeFriend) {
      removeFriend(friendId)
    } else {
      // Fallback if removeFriend prop is not provided
      console.log('Remove friend functionality not implemented:', friendId)
    }
  }

  const renderMainScreen = () => (
    <div className="lcd-content">
      {currentCall ? (
        <div>
          <div className="lcd-text lcd-title">R1-WALKY</div>
          <div className="lcd-text">Connected to "{currentCall.targetUsername}"</div>
          <div className="call-buttons">
            <button className="call-end-btn" onClick={endCall}>
              📞 END CALL
            </button>
          </div>
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
      <div className="back-btn" onClick={() => setCurrentScreen('main')}>← BACK</div>
      <div className="lcd-text lcd-title">
        FRIENDS
      </div>

      {/* Add Friend Input */}
      <div className="add-friend-input-container">
        <input
          type="text"
          className="add-friend-input"
          placeholder="add friend"
          value={newFriendUsername}
          onChange={(e) => setNewFriendUsername(e.target.value)}
          onKeyPress={(e) => {
            if (e.key === 'Enter') {
              handleAddFriend()
            }
          }}
        />
        <button
          className="add-friend-check-btn"
          onClick={handleAddFriend}
          disabled={!newFriendUsername.trim()}
        >
          ✓
        </button>
      </div>

      {/* Friends List */}
      {friends.length === 0 ? (
        <div className="no-friends">no friends</div>
      ) : (
        <div className="friends-text-list">
          {friends.map((friend, index) => (
            <div key={friend.id} className="friend-text-line">
              <span
                className="friend-text-name"
                onClick={() => callFriend(friend)}
              >
                {friend.username}
              </span>
              <button
                className="friend-remove-x"
                onClick={() => handleRemoveFriend(friend.id)}
                title="Remove friend"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  const renderChannelsScreen = () => (
    <div className="lcd-content">
      <div className="back-btn" onClick={() => setCurrentScreen('main')}>← BACK</div>
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
      <div className="back-btn" onClick={() => setCurrentScreen('main')}>← BACK</div>
      <div className="lcd-text lcd-title">
        SETTINGS
      </div>
      <div className="settings-list">
        <div className="setting-item">
          <span>Volume: {Math.round(volumeLevel * 100)}%</span>
        </div>
        <div className="setting-item">
          <span>Connection: {connectionStatus}</span>
        </div>
        <div className="setting-item">
          <span>Username: {currentUser?.username || 'Not set'}</span>
        </div>
      </div>
    </div>
  )

  const renderIncomingCallScreen = () => (
    <div className="lcd-content">
      <div className="lcd-text lcd-title">
        INCOMING CALL
      </div>
      <div className="caller-info">
        <div className="caller-name">{incomingCaller}</div>
        <div className="call-status">is calling...</div>
      </div>
      <div className="call-buttons">
        <button className="call-accept-btn" onClick={acceptCall}>
          📞 ACCEPT
        </button>
        <button className="call-reject-btn" onClick={rejectCall}>
          📞 REJECT
        </button>
      </div>
    </div>
  )

  const renderCallingScreen = () => (
    <div className="lcd-content">
      <div className="lcd-text lcd-title">
        CALLING...
      </div>
      <div className="calling-info">
        <div className="target-name">{callingTarget}</div>
        <div className="call-status">{callStatus}</div>
      </div>
      <div className="call-buttons">
        <button className="call-cancel-btn" onClick={cancelCall}>
          📞 CANCEL
        </button>
      </div>
    </div>
  )

  const renderCurrentScreen = () => {
    // Handle call states first
    if (showIncomingCall) {
      return renderIncomingCallScreen()
    }
    if (showCalling) {
      return renderCallingScreen()
    }

    // Handle normal screens
    switch (currentScreen) {
      case 'friends':
        return renderFriendsScreen()
      case 'settings':
        return renderSettingsScreen()
      default:
        return renderMainScreen()
    }
  }

  return (
    <div className="r1-device">
      {/* LCD Screen - Takes up most of the space */}
      <div className="lcd-screen">
        {renderCurrentScreen()}
      </div>

      {/* Speaker and Controls Section - Fixed height at bottom */}
      <div className="speaker-controls">
        <div
          className={`speaker-area ${isPTTPressed ? 'ptt-active' : ''}`}
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
            FRIENDS
          </button>
          <button
            className="control-btn settings-btn"
            onClick={() => setCurrentScreen('settings')}
          >
            SETTINGS
          </button>
        </div>
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

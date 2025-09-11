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
          <div className="lcd-title">CONNECTED</div>
          <div className="status-line"></div>
          <div className="lcd-text">TO: {currentCall.targetUsername.toUpperCase()}</div>
          <div className="lcd-text" style={{ color: isPTTPressed ? '#ff6b35' : '#00ff44', textShadow: isPTTPressed ? '0 0 4px rgba(255, 107, 53, 0.5)' : '0 0 2px rgba(0, 255, 68, 0.3)' }}>
            {isPTTPressed ? 'TRANSMITTING...' : 'PRESS PTT TO TALK'}
          </div>
          <div className="call-buttons" style={{ marginTop: '12px' }}>
            <button className="call-end-btn" onClick={endCall}>
              END CALL
            </button>
          </div>
        </div>
      ) : (
        <div>
          <div className="lcd-title">R1-WALKY</div>
          <div className="status-line"></div>
          <div className="lcd-text">CALLSIGN: {currentUser?.username?.toUpperCase() || 'UNKNOWN'}</div>
          <div className="lcd-text" style={{ 
            color: connectionStatus === 'Connected' ? '#00ff44' : '#ff4444',
            textShadow: connectionStatus === 'Connected' ? '0 0 2px rgba(0, 255, 68, 0.5)' : '0 0 2px rgba(255, 68, 68, 0.5)'
          }}>
            STATUS: {connectionStatus.toUpperCase()}
          </div>
          {friendRequests.length > 0 && (
            <div className="lcd-text" style={{ color: '#ffaa00', textShadow: '0 0 2px rgba(255, 170, 0, 0.5)' }}>
              {friendRequests.length} PENDING REQUEST{friendRequests.length > 1 ? 'S' : ''}
            </div>
          )}
        </div>
      )}
    </div>
  )

  const renderFriendsScreen = () => (
    <div className="lcd-content">
      <div className="back-btn" onClick={() => setCurrentScreen('main')}>← BACK</div>
      <div className="lcd-title">CONTACTS</div>
      <div className="status-line"></div>

      {/* Add Friend Input */}
      <div className="add-friend-input-container">
        <input
          type="text"
          className="add-friend-input"
          placeholder="add contact"
          value={newFriendUsername}
          onChange={(e) => setNewFriendUsername(e.target.value.toLowerCase())}
          onKeyPress={(e) => {
            if (e.key === 'Enter') {
              handleAddFriend()
            }
          }}
          style={{ textTransform: 'uppercase' }}
        />
        <button
          className="add-friend-check-btn"
          onClick={handleAddFriend}
          disabled={!newFriendUsername.trim()}
        >
          +
        </button>
      </div>

      {/* Friend Requests */}
      {friendRequests.length > 0 && (
        <div style={{ marginBottom: '8px' }}>
          <div className="lcd-text" style={{ color: '#ffaa00', marginBottom: '4px' }}>
            PENDING REQUESTS:
          </div>
          {friendRequests.map((request) => (
            <div key={request.id} className="friend-text-line" style={{ background: 'rgba(255, 170, 0, 0.1)' }}>
              <span className="friend-text-name">
                {request.requesterUsername?.toUpperCase() || 'UNKNOWN'}
              </span>
              <div style={{ display: 'flex', gap: '4px' }}>
                <button
                  style={{
                    background: 'rgba(0, 255, 68, 0.2)',
                    border: '1px solid #00ff44',
                    color: '#00ff44',
                    fontSize: '10px',
                    padding: '2px 6px',
                    borderRadius: '2px',
                    cursor: 'pointer'
                  }}
                  onClick={() => acceptFriendRequest(request.id)}
                >
                  ✓
                </button>
                <button
                  style={{
                    background: 'rgba(255, 68, 68, 0.2)',
                    border: '1px solid #ff4444',
                    color: '#ff4444',
                    fontSize: '10px',
                    padding: '2px 6px',
                    borderRadius: '2px',
                    cursor: 'pointer'
                  }}
                  onClick={() => rejectFriendRequest(request.id)}
                >
                  ✗
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Friends List */}
      {friends.length === 0 ? (
        <div className="no-friends">NO CONTACTS</div>
      ) : (
        <div className="friends-text-list">
          {friends.map((friend, index) => (
            <div key={friend.id} className="friend-text-line">
              <span
                className="friend-text-name"
                onClick={() => callFriend(friend)}
                style={{ textTransform: 'uppercase' }}
              >
                {friend.username}
              </span>
              <button
                className="friend-remove-x"
                onClick={() => handleRemoveFriend(friend.id)}
                title="Remove contact"
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
      <div className="lcd-title">SETTINGS</div>
      <div className="status-line"></div>
      <div className="settings-list">
        <div className="setting-item">
          <span>VOLUME: {Math.round(volumeLevel * 100)}%</span>
        </div>
        <div className="setting-item">
          <span>STATUS: {connectionStatus.toUpperCase()}</span>
        </div>
        <div className="setting-item">
          <span>CALLSIGN: {currentUser?.username?.toUpperCase() || 'NOT SET'}</span>
        </div>
        <div className="setting-item">
          <span>CONTACTS: {friends.length}</span>
        </div>
      </div>
    </div>
  )

  const renderIncomingCallScreen = () => (
    <div className="lcd-content">
      <div className="lcd-title">INCOMING CALL</div>
      <div className="status-line"></div>
      <div className="caller-info">
        <div className="caller-name">{incomingCaller?.toUpperCase()}</div>
        <div className="call-status">IS CALLING...</div>
      </div>
      <div className="call-buttons">
        <button className="call-accept-btn" onClick={acceptCall}>
          ACCEPT
        </button>
        <button className="call-reject-btn" onClick={rejectCall}>
          REJECT
        </button>
      </div>
    </div>
  )

  const renderCallingScreen = () => (
    <div className="lcd-content">
      <div className="lcd-title">CALLING...</div>
      <div className="status-line"></div>
      <div className="calling-info">
        <div className="target-name">{callingTarget?.toUpperCase()}</div>
        <div className="call-status">{callStatus?.toUpperCase() || 'CONNECTING...'}</div>
      </div>
      <div className="call-buttons">
        <button className="call-cancel-btn" onClick={cancelCall}>
          CANCEL
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
            className={`control-btn friends-btn ${currentScreen === 'friends' ? 'active' : ''}`}
            onClick={() => setCurrentScreen('friends')}
          >
            CONTACTS
          </button>
          <button
            className={`control-btn settings-btn ${currentScreen === 'settings' ? 'active' : ''}`}
            onClick={() => setCurrentScreen('settings')}
          >
            CONFIG
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

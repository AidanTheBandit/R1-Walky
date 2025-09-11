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

  // Handle automatic screen switching for call states
  useEffect(() => {
    if (showIncomingCall || showCalling) {
      // Don't allow navigation away from call screens
      return
    }
    // Reset to main screen when call states are cleared
    if (currentScreen !== 'main' && currentScreen !== 'friends' && currentScreen !== 'channels' && currentScreen !== 'settings') {
      setCurrentScreen('main')
    }
  }, [showIncomingCall, showCalling, currentScreen])

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
      <div className="back-btn" onClick={() => setCurrentScreen('main')}>← BACK</div>
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
              className={`friend-item ${index === selectedFriendIndex ? 'selected' : ''} callable`}
              onClick={() => callFriend(friend)}
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
            className="control-btn channels-btn"
            onClick={() => setCurrentScreen('channels')}
          >
            CHANNELS
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

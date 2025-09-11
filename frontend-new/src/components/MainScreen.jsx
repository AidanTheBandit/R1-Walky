import React, { useState, useEffect } from 'react'
import HomeScreen from './HomeScreen'
import ContactsScreen from './ContactsScreen'
import IncomingCallScreen from './IncomingCallScreen'
import CallingScreen from './CallingScreen'
import SettingsScreen from './SettingsScreen'
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

  // Handle add friend with proper API integration
  const handleAddFriend = async (username) => {
    try {
      const success = await addFriend(username)
      return success
    } catch (error) {
      console.error('Failed to add friend:', error)
      return false
    }
  }

  // Handle remove friend with proper API integration
  const handleRemoveFriend = async (friendId) => {
    try {
      await removeFriend(friendId)
    } catch (error) {
      console.error('Failed to remove friend:', error)
    }
  }

  const renderCurrentScreen = () => {
    if (showIncomingCall) {
      return (
        <IncomingCallScreen
          incomingCaller={incomingCaller}
          onAccept={acceptCall}
          onReject={rejectCall}
        />
      )
    }

    if (showCalling) {
      return (
        <CallingScreen
          callingTarget={callingTarget}
          callStatus={callStatus}
          onCancel={cancelCall}
        />
      )
    }

    switch (currentScreen) {
      case 'contacts':
        return (
          <ContactsScreen
            friends={friends}
            friendRequests={friendRequests}
            onBack={() => setCurrentScreen('main')}
            onCallFriend={callFriend}
            onRemoveFriend={handleRemoveFriend}
            onAddFriend={handleAddFriend}
            onAcceptRequest={acceptFriendRequest}
            onRejectRequest={rejectFriendRequest}
          />
        )
      case 'settings':
        return (
          <SettingsScreen
            connectionStatus={connectionStatus}
            currentUser={currentUser}
            volumeLevel={volumeLevel}
            friends={friends}
            onBack={() => setCurrentScreen('main')}
          />
        )
      default:
        return (
          <HomeScreen
            currentUser={currentUser}
            connectionStatus={connectionStatus}
            friendRequests={friendRequests}
            friends={friends}
            currentCall={currentCall}
            isPTTPressed={isPTTPressed}
            endCall={endCall}
          />
        )
    }
  }

  return (
    <div className="r1-device">
      {/* Antenna indicator */}
      <div className="antenna-indicator"></div>
      
      {/* Signal strength indicator */}
      <div className="signal-strength">
        <div className={`signal-bar ${connectionStatus === 'Connected' ? 'active' : ''}`}></div>
        <div className={`signal-bar ${connectionStatus === 'Connected' ? 'active' : ''}`}></div>
        <div className={`signal-bar ${connectionStatus === 'Connected' ? 'active' : ''}`}></div>
        <div className={`signal-bar ${connectionStatus === 'Connected' ? 'active' : ''}`}></div>
      </div>
      
      {/* Volume indicator */}
      <div className="volume-indicator">
        <div className={`volume-bar ${volumeLevel > 0.25 ? 'active' : ''}`}></div>
        <div className={`volume-bar ${volumeLevel > 0.5 ? 'active' : ''}`}></div>
        <div className={`volume-bar ${volumeLevel > 0.75 ? 'active' : ''}`}></div>
        <div className={`volume-bar ${volumeLevel > 1 ? 'active' : ''}`}></div>
      </div>

      {/* LCD Screen */}
      <div className="lcd-screen">
        {renderCurrentScreen()}
      </div>

      {/* Speaker and Controls Section */}
      <div className="speaker-controls">
        <div
          className={`speaker-area enhanced ${isPTTPressed ? 'ptt-active' : ''}`}
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
            className={`control-btn ${currentScreen === 'contacts' ? 'active' : ''}`}
            onClick={() => setCurrentScreen('contacts')}
          >
            CONTACTS
          </button>
          <button
            className={`control-btn ${currentScreen === 'settings' ? 'active' : ''}`}
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

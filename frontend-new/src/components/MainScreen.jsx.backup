import React from 'react'
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
  return (
    <div id="main-screen" className="screen active">
      <div className="header">
        <h1>R1-Walky</h1>
        <div className="user-info">
          {currentUser?.username} | <span className={`status ${connectionStatus.toLowerCase()}`}>{connectionStatus}</span>
        </div>
      </div>
      <div className="content">
        <FriendRequests
          friendRequests={friendRequests}
          acceptFriendRequest={acceptFriendRequest}
          rejectFriendRequest={rejectFriendRequest}
        />

        <FriendsList
          friends={friends}
          callFriend={callFriend}
          addFriend={addFriend}
        />

        <LocationChannels
          currentUser={currentUser}
          onChannelJoined={(channelId) => {
            console.log('Joined channel:', channelId)
          }}
          onGroupCallStarted={onGroupCallStarted}
        />

        <PTTButton
          isPTTPressed={isPTTPressed}
          handlePTTStart={handlePTTStart}
          handlePTTEnd={handlePTTEnd}
          volumeLevel={volumeLevel}
          updateVolume={updateVolume}
        />

        {currentCall && (
          <button className="btn" onClick={endCall}>End Call</button>
        )}

        <div className="call-status">{callStatus}</div>
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

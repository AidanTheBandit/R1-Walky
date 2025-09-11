import React from 'react'
import FriendRequests from './FriendRequests'
import FriendsList from './FriendsList'
import PTTButton from './PTTButton'

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
  callStatus
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
    </div>
  )
}

export default MainScreen

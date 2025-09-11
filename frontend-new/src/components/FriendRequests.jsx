import React from 'react'

function FriendRequests({ friendRequests, acceptFriendRequest, rejectFriendRequest }) {
  if (friendRequests.length === 0) return null

  return (
    <div className="friend-requests">
      {friendRequests.map(request => (
        <div key={request.friendshipId} className="friend-request-item">
          <div className="friend-request-text">
            Friend request from {request.username}
          </div>
          <div className="friend-request-buttons">
            <button
              className="friend-request-btn accept-btn"
              onClick={() => acceptFriendRequest(request.friendshipId)}
            >
              accept
            </button>
            <button
              className="friend-request-btn reject-btn"
              onClick={() => rejectFriendRequest(request.friendshipId)}
            >
              reject
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

export default FriendRequests

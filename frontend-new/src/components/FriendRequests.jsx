import React from 'react'

function FriendRequests({ friendRequests, acceptFriendRequest, rejectFriendRequest }) {
  if (friendRequests.length === 0) return null

  return (
    <div className="friend-requests">
      {friendRequests.map(request => (
        <div key={request.friendshipId} className="friend-request">
          <span>{request.username}</span>
          <div className="request-buttons">
            <button
              className="btn small accept"
              onClick={() => acceptFriendRequest(request.friendshipId)}
              title="Accept friend request"
            >
              ✓
            </button>
            <button
              className="btn small reject"
              onClick={() => rejectFriendRequest(request.friendshipId)}
              title="Reject friend request"
            >
              ✗
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

export default FriendRequests

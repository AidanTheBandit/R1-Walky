import React from 'react'

function FriendsList({ friends, callFriend, addFriend }) {
  return (
    <div className="friends-section">
      <div className="section-header">
        <h2>Friends</h2>
      </div>
      <div className="friends-list">
        {friends.length === 0 ? (
          <div className="friend-item">No friends yet</div>
        ) : (
          friends.map(friend => (
            <div
              key={friend.id}
              className="friend-item"
              onClick={() => callFriend(friend)}
            >
              <span className="friend-name">{friend.username}</span>
              <span className={`friend-status ${friend.status || 'offline'}`}>
                {friend.status || 'offline'}
              </span>
            </div>
          ))
        )}
      </div>
      <input type="text" id="friend-username" placeholder="Add friend" />
      <button className="btn" onClick={addFriend}>Add</button>
    </div>
  )
}

export default FriendsList

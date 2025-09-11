import React, { useState } from 'react'

function ContactsScreen({ friends, friendRequests, onBack, onCallFriend, onRemoveFriend, onAddFriend, onAcceptRequest, onRejectRequest }) {
  const [newFriendUsername, setNewFriendUsername] = useState('')

  const handleAddFriend = async () => {
    if (newFriendUsername.trim()) {
      const success = await onAddFriend(newFriendUsername.trim())
      if (success) {
        setNewFriendUsername('')
      }
    }
  }

  return (
    <div className="lcd-content">
      <div className="back-btn" onClick={onBack}>← BACK</div>
      <div className="lcd-title">CONTACTS</div>
      <div className="status-line"></div>

      {/* Add Friend */}
      <div style={{ marginBottom: '8px' }}>
        <div className="lcd-text" style={{ fontSize: 'clamp(9px, 2.5vw, 12px)', marginBottom: '4px' }}>
          ADD CONTACT:
        </div>
        <div className="add-friend-input-container">
          <input
            type="text"
            className="add-friend-input"
            placeholder="USERNAME"
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
      </div>

      {/* Friend Requests */}
      {friendRequests.length > 0 && (
        <div style={{ marginBottom: '8px' }}>
          <div className="lcd-text" style={{ color: '#ffaa00', marginBottom: '4px', fontSize: 'clamp(9px, 2.5vw, 12px)' }}>
            REQUESTS ({friendRequests.length}):
          </div>
          {friendRequests.map((request) => (
            <div key={request.friendshipId || request.id} className="friend-text-line" style={{ 
              background: 'rgba(255, 170, 0, 0.1)',
              border: '1px solid rgba(255, 170, 0, 0.3)',
              padding: '2px 4px',
              marginBottom: '2px'
            }}>
              <span className="friend-text-name" style={{ color: '#ffaa00', fontSize: 'clamp(10px, 2.8vw, 12px)' }}>
                {(request.username || 'UNKNOWN').toUpperCase()}
              </span>
              <div style={{ display: 'flex', gap: '2px' }}>
                <button
                  style={{
                    background: 'rgba(0, 255, 68, 0.2)',
                    border: '1px solid #00ff44',
                    color: '#00ff44',
                    fontSize: '8px',
                    padding: '1px 3px',
                    borderRadius: '1px',
                    cursor: 'pointer'
                  }}
                  onClick={() => onAcceptRequest(request.friendshipId || request.id)}
                >
                  ✓
                </button>
                <button
                  style={{
                    background: 'rgba(255, 68, 68, 0.2)',
                    border: '1px solid #ff4444',
                    color: '#ff4444',
                    fontSize: '8px',
                    padding: '1px 3px',
                    borderRadius: '1px',
                    cursor: 'pointer'
                  }}
                  onClick={() => onRejectRequest(request.friendshipId || request.id)}
                >
                  ✗
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Friends List */}
      <div style={{ marginBottom: '4px' }}>
        <div className="lcd-text" style={{ fontSize: 'clamp(9px, 2.5vw, 12px)', marginBottom: '4px' }}>
          CONTACTS ({friends.length}):
        </div>
        {friends.length === 0 ? (
          <div className="no-friends">NO CONTACTS</div>
        ) : (
          <div>
            {friends.map((friend) => (
              <div key={friend.id} className="friend-text-line" style={{ 
                padding: '2px 4px',
                marginBottom: '2px'
              }}>
                <span
                  className="friend-text-name"
                  onClick={() => onCallFriend(friend)}
                  style={{ 
                    textTransform: 'uppercase',
                    fontSize: 'clamp(10px, 2.8vw, 12px)',
                    cursor: 'pointer'
                  }}
                >
                  {friend.username}
                </span>
                <button
                  className="friend-remove-x"
                  onClick={() => onRemoveFriend(friend.id)}
                  title="Remove contact"
                  style={{ fontSize: '10px' }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default ContactsScreen

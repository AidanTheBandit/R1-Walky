import React from 'react'

function HomeScreen({ currentUser, connectionStatus, friendRequests, friends, currentCall, isPTTPressed, endCall }) {
  return (
    <div className="lcd-content">
      {currentCall ? (
        <div>
          <div className="lcd-title">CONNECTED</div>
          <div className="status-line"></div>
          <div className="lcd-text">TO: {currentCall.targetUsername.toUpperCase()}</div>
          <div className="lcd-text" style={{ 
            color: isPTTPressed ? '#ff6b35' : '#00ff44', 
            textShadow: isPTTPressed ? '0 0 4px rgba(255, 107, 53, 0.5)' : '0 0 2px rgba(0, 255, 68, 0.3)' 
          }}>
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
          <div className="lcd-title">
            <span className={`status-led ${connectionStatus === 'Connected' ? 'connected' : 'disconnected'}`}></span>
            R1-WALKY
          </div>
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
              <span className="status-led calling"></span>
              {friendRequests.length} PENDING REQUEST{friendRequests.length > 1 ? 'S' : ''}
            </div>
          )}
          {friends.length > 0 && (
            <div className="lcd-text" style={{ fontSize: 'clamp(9px, 2.5vw, 12px)', opacity: 0.8 }}>
              {friends.length} CONTACT{friends.length > 1 ? 'S' : ''} AVAILABLE
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default HomeScreen

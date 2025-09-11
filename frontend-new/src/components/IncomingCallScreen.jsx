import React from 'react'

function IncomingCallScreen({ incomingCaller, onAccept, onReject }) {
  return (
    <div className="lcd-content">
      <div className="lcd-title">INCOMING CALL</div>
      <div className="status-line"></div>
      <div className="caller-info">
        <div className="caller-name">{incomingCaller?.toUpperCase()}</div>
        <div className="call-status">IS CALLING...</div>
      </div>
      <div className="call-buttons">
        <button className="call-accept-btn" onClick={onAccept}>
          ACCEPT
        </button>
        <button className="call-reject-btn" onClick={onReject}>
          REJECT
        </button>
      </div>
    </div>
  )
}

export default IncomingCallScreen

import React from 'react'

function IncomingCallOverlay({ showIncomingCall, incomingCaller, acceptCall, rejectCall }) {
  if (!showIncomingCall) return null

  return (
    <div className="incoming-call-overlay">
      <div className="incoming-call-content">
        <div className="caller-info">
          <h2>Incoming Call</h2>
          <div className="caller-name">{incomingCaller}</div>
        </div>
        <div className="call-buttons">
          <button className="btn call-accept" onClick={acceptCall}>
            📞 Accept
          </button>
          <button className="btn call-reject" onClick={rejectCall}>
            📞 Reject
          </button>
        </div>
      </div>
    </div>
  )
}

export default IncomingCallOverlay

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

function CallingOverlay({ showCalling, targetName, callStatus, cancelCall }) {
  if (!showCalling) return null

  return (
    <div className="calling-overlay">
      <div className="calling-content">
        <h2>Calling...</h2>
        <div className="calling-target">{targetName}</div>
        <div className="calling-status">{callStatus}</div>
        <button className="cancel-call-btn" onClick={cancelCall}>
          Cancel Call
        </button>
      </div>
    </div>
  )
}

export { IncomingCallOverlay, CallingOverlay }
export default IncomingCallOverlay

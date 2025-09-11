import React from 'react'

function CallingScreen({ callingTarget, callStatus, onCancel }) {
  return (
    <div className="lcd-content">
      <div className="lcd-title">CALLING...</div>
      <div className="status-line"></div>
      <div className="calling-info">
        <div className="target-name">{callingTarget?.toUpperCase()}</div>
        <div className="call-status">{callStatus?.toUpperCase() || 'CONNECTING...'}</div>
      </div>
      <div className="call-buttons">
        <button className="call-cancel-btn" onClick={onCancel}>
          CANCEL
        </button>
      </div>
    </div>
  )
}

export default CallingScreen

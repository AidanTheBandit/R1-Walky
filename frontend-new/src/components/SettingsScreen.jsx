import React from 'react'

function SettingsScreen({ connectionStatus, currentUser, volumeLevel, friends, onBack }) {
  return (
    <div className="lcd-content">
      <div className="back-btn" onClick={onBack}>← BACK</div>
      <div className="lcd-title">SETTINGS</div>
      <div className="status-line"></div>
      <div className="settings-list">
        <div className="setting-item">
          <span>VOLUME: {Math.round(volumeLevel * 100)}%</span>
        </div>
        <div className="setting-item">
          <span>STATUS: {connectionStatus.toUpperCase()}</span>
        </div>
        <div className="setting-item">
          <span>CALLSIGN: {currentUser?.username?.toUpperCase() || 'NOT SET'}</span>
        </div>
        <div className="setting-item">
          <span>CONTACTS: {friends.length}</span>
        </div>
      </div>
    </div>
  )
}

export default SettingsScreen

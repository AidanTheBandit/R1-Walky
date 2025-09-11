import React from 'react'

function PTTButton({ isPTTPressed, handlePTTStart, handlePTTEnd, volumeLevel, updateVolume }) {
  return (
    <div className="ptt-section">
      <button
        className={`ptt-button ${isPTTPressed ? 'active' : ''}`}
        onMouseDown={handlePTTStart}
        onMouseUp={handlePTTEnd}
        onTouchStart={handlePTTStart}
        onTouchEnd={handlePTTEnd}
      >
        <div className="ptt-icon">🎙️</div>
        <div className="ptt-text">
          {isPTTPressed ? 'TX' : 'PTT'}
        </div>
      </button>
      <div className="volume-control">
        <label htmlFor="volume-slider">🔊</label>
        <input
          type="range"
          id="volume-slider"
          min="0"
          max="3"
          step="0.1"
          value={volumeLevel}
          onChange={updateVolume}
        />
        <span id="volume-value">{Math.round(volumeLevel * 100)}%</span>
      </div>
    </div>
  )
}

export default PTTButton

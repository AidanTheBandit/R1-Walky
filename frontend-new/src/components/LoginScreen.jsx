import React from 'react'

function LoginScreen({ login, loginStatus }) {
  return (
    <div className="r1-device">
      {/* LCD Screen showing login interface */}
      <div className="lcd-screen">
        <div className="lcd-content">
          <div className="lcd-title">R1-WALKY</div>
          <div className="status-line"></div>
          <div className="lcd-text">ENTER CALLSIGN</div>
          
          <div style={{ width: '90%', marginTop: '12px' }}>
            <input
              type="text"
              id="username"
              placeholder="CALLSIGN"
              maxLength="20"
              onKeyPress={(e) => e.key === 'Enter' && login()}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '2px solid #00ff44',
                borderRadius: '4px',
                background: 'rgba(0, 20, 0, 0.8)',
                color: '#00ff44',
                fontFamily: 'PG, Courier New, monospace',
                fontSize: 'clamp(12px, 3.5vw, 16px)',
                textAlign: 'center',
                outline: 'none',
                textShadow: '0 0 2px rgba(0, 255, 68, 0.3)',
                textTransform: 'uppercase'
              }}
            />
          </div>

          {loginStatus && (
            <div className="lcd-text" style={{ marginTop: '8px', color: loginStatus.includes('failed') || loginStatus.includes('error') ? '#ff4444' : '#00ff44' }}>
              {loginStatus.toUpperCase()}
            </div>
          )}
        </div>
      </div>

      {/* Bottom controls with JOIN button */}
      <div className="speaker-controls">
        <div 
          className="speaker-area"
          onClick={login}
          style={{ cursor: 'pointer' }}
        >
          <div style={{
            color: '#ccc',
            fontSize: 'clamp(12px, 3.5vw, 18px)',
            fontWeight: 'bold',
            fontFamily: 'PG, Courier New, monospace',
            textShadow: '0 1px 1px rgba(0, 0, 0, 0.5)',
            zIndex: 3,
            position: 'relative'
          }}>
            JOIN
          </div>
        </div>
        
        <div className="controls-area">
          <div className="control-btn" style={{ opacity: 0.5, cursor: 'not-allowed' }}>
            FREQ
          </div>
          <div className="control-btn" style={{ opacity: 0.5, cursor: 'not-allowed' }}>
            VOL
          </div>
        </div>
      </div>
    </div>
  )
}

export default LoginScreen

import React from 'react'

function DebugOverlay({ showDebug, setShowDebug, debugLogs }) {
  if (!showDebug) return null

  return (
    <div className="debug-overlay">
      <div className="debug-header">
        <span>R1 Debug</span>
        <button onClick={() => setShowDebug(false)}>×</button>
      </div>
      <div className="debug-content">
        <div className="debug-log info">
          � Debug Mode Active - Add "debugger" as friend to toggle this overlay
        </div>
        {debugLogs.map((log, index) => (
          <div key={index} className={`debug-log ${log.includes('ERROR') ? 'error' : log.includes('WARN') ? 'warn' : 'info'}`}>
            {log}
          </div>
        ))}
      </div>
    </div>
  )
}

export default DebugOverlay

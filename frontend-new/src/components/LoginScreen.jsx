import React from 'react'

function LoginScreen({ login, loginStatus }) {
  return (
    <div id="login-screen" className="screen active">
      <div className="header">
        <h1>R1-Walky</h1>
      </div>
      <div className="content">
        <input
          type="text"
          id="username"
          placeholder="Username"
          maxLength="20"
          onKeyPress={(e) => e.key === 'Enter' && login()}
        />
        <button id="login-btn" className="btn primary" onClick={login}>
          Join
        </button>
        <div id="login-status" className="status">{loginStatus}</div>
      </div>
    </div>
  )
}

export default LoginScreen

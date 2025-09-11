import React, { useState, useEffect } from 'react'
import FriendRequests from './FriendRequests'
import FriendsList from './FriendsList'
import PTTButton from './PTTButton'
import GroupCallOverlay from './GroupCallOverlay'
import speakerSvg from '../assets/speaker.svg'

function MainScreen({
  currentUser,
  connectionStatus,
  friendRequests,
  friends,
  callFriend,
  addFriend,
  removeFriend,
  acceptFriendRequest,
  rejectFriendRequest,
  isPTTPressed,
  handlePTTStart,
  handlePTTEnd,
  volumeLevel,
  updateVolume,
  currentCall,
  endCall,
  callStatus,
  showGroupCall,
  groupCallData,
  onGroupCallStarted,
  onGroupCallClosed,
  showIncomingCall,
  incomingCaller,
  acceptCall,
  rejectCall,
  showCalling,
  callingTarget,
  cancelCall
}) {
  const [currentScreen, setCurrentScreen] = useState('main')
  const [selectedFriendIndex, setSelectedFriendIndex] = useState(0)
  const [selectedRequestIndex, setSelectedRequestIndex] = useState(0)
  const [selectedMenuIndex, setSelectedMenuIndex] = useState(0)
  const [showAddFriend, setShowAddFriend] = useState(false)
  const [newFriendUsername, setNewFriendUsername] = useState('')

  // Main menu options
  const mainMenuOptions = ['FRIENDS', 'REQUESTS', 'SETTINGS']

  // Handle scroll wheel navigation
  useEffect(() => {
    const handleScrollUp = () => {
      if (showIncomingCall || showCalling) return // Don't navigate during calls
      
      if (currentScreen === 'main') {
        // Navigate through main menu
        setSelectedMenuIndex(prev => Math.max(0, prev - 1))
      } else if (currentScreen === 'friends') {
        // Navigate through combined requests + friends list
        const totalItems = friendRequests.length + friends.length;
        if (totalItems > 0) {
          setSelectedFriendIndex(prev => Math.max(0, prev - 1))
        }
      } else if (currentScreen === 'requests') {
        // Navigate through friend requests
        if (friendRequests.length > 0) {
          setSelectedRequestIndex(prev => Math.max(0, prev - 1))
        }
      }
    }

    const handleScrollDown = () => {
      if (showIncomingCall || showCalling) return // Don't navigate during calls
      
      if (currentScreen === 'main') {
        // Navigate through main menu
        setSelectedMenuIndex(prev => Math.min(mainMenuOptions.length - 1, prev + 1))
      } else if (currentScreen === 'friends') {
        // Navigate through combined requests + friends list
        const totalItems = friendRequests.length + friends.length;
        if (totalItems > 0) {
          setSelectedFriendIndex(prev => Math.min(totalItems - 1, prev + 1))
        }
      } else if (currentScreen === 'requests') {
        // Navigate through friend requests
        if (friendRequests.length > 0) {
          setSelectedRequestIndex(prev => Math.min(friendRequests.length - 1, prev + 1))
        }
      }
    }

    const handleSideClick = () => {
      if (showIncomingCall) {
        acceptCall()
        return
      }
      if (showCalling) {
        cancelCall()
        return
      }
      
      if (currentScreen === 'main') {
        // Select current menu option
        const selectedOption = mainMenuOptions[selectedMenuIndex]
        if (selectedOption === 'FRIENDS') {
          setCurrentScreen('friends')
          setSelectedFriendIndex(0)
        } else if (selectedOption === 'REQUESTS') {
          setCurrentScreen('requests')
          setSelectedRequestIndex(0)
        } else if (selectedOption === 'SETTINGS') {
          setCurrentScreen('settings')
        }
      } else if (currentScreen === 'friends') {
        // Handle selection in combined friends/requests list
        const totalItems = friendRequests.length + friends.length;
        if (totalItems > 0 && selectedFriendIndex < totalItems) {
          if (selectedFriendIndex < friendRequests.length) {
            // Selected item is a friend request - accept it
            const request = friendRequests[selectedFriendIndex];
            acceptFriendRequest(request.friendshipId || request.id);
          } else {
            // Selected item is a friend - call them
            const friendIndex = selectedFriendIndex - friendRequests.length;
            if (friends[friendIndex]) {
              callFriend(friends[friendIndex]);
            }
          }
        }
      } else if (currentScreen === 'requests') {
        // Accept selected friend request
        if (friendRequests.length > 0 && friendRequests[selectedRequestIndex]) {
          acceptFriendRequest(friendRequests[selectedRequestIndex].friendshipId)
        }
      } else {
        // Go back to main screen from other screens
        setCurrentScreen('main')
        setSelectedMenuIndex(0)
      }
    }

    // Add event listeners for R1 hardware events
    window.addEventListener('scrollUp', handleScrollUp)
    window.addEventListener('scrollDown', handleScrollDown)
    window.addEventListener('sideClick', handleSideClick)

    return () => {
      window.removeEventListener('scrollUp', handleScrollUp)
      window.removeEventListener('scrollDown', handleScrollDown)
      window.removeEventListener('sideClick', handleSideClick)
    }
  }, [currentScreen, selectedMenuIndex, selectedFriendIndex, selectedRequestIndex, friends, friendRequests, showIncomingCall, showCalling, callFriend, acceptFriendRequest, acceptCall, cancelCall])

  // Reset selection when screens change
  useEffect(() => {
    if (currentScreen === 'friends') {
      setSelectedFriendIndex(0)
    } else if (currentScreen === 'requests') {
      setSelectedRequestIndex(0)
    } else if (currentScreen === 'main') {
      setSelectedMenuIndex(0)
    }
  }, [currentScreen])

  // Handle automatic screen switching for call states
  useEffect(() => {
    if (showIncomingCall || showCalling) {
      // Don't allow navigation away from call screens
      return
    }
    // If we're in a screen and a call becomes connected, go to main
    if (currentCall && currentCall.status === 'connected') {
      setCurrentScreen('main')
    }
  }, [showIncomingCall, showCalling, currentCall])

  const handleAddFriend = async () => {
    if (!newFriendUsername.trim()) return;
    
    try {
      const response = await fetch('/api/friends', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': currentUser?.id
        },
        body: JSON.stringify({
          friendUsername: newFriendUsername.trim()
        })
      });

      const data = await response.json();
      
      if (response.ok) {
        console.log('Friend request sent successfully');
        setNewFriendUsername('');
        // Optionally show success feedback
      } else {
        console.error('Failed to send friend request:', data.error);
        // Could show error message to user
      }
    } catch (error) {
      console.error('Error sending friend request:', error);
    }
  }

  const handleRemoveFriend = async (friendId) => {
    try {
      const response = await fetch(`/api/friends/${friendId}`, {
        method: 'DELETE',
        headers: {
          'X-User-ID': currentUser?.id
        }
      });

      if (response.ok) {
        console.log('Friend removed successfully');
        // The friends list will be updated through the socket connection
      } else {
        const data = await response.json();
        console.error('Failed to remove friend:', data.error);
      }
    } catch (error) {
      console.error('Error removing friend:', error);
    }
  }

  const renderMainScreen = () => (
    <div className="lcd-content">
      {currentCall ? (
        <div>
          <div className="lcd-title">
            <span className="status-led calling"></span>
            CONNECTED
          </div>
          <div className="status-line"></div>
          <div className="lcd-text">TO: {currentCall.targetUsername.toUpperCase()}</div>
          <div className="lcd-text" style={{ color: isPTTPressed ? '#ff6b35' : '#00ff44', textShadow: isPTTPressed ? '0 0 4px rgba(255, 107, 53, 0.5)' : '0 0 2px rgba(0, 255, 68, 0.3)' }}>
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
          
          <div className="status-line" style={{ marginTop: '8px' }}></div>
          <div className="lcd-text" style={{ fontSize: 'clamp(9px, 2.5vw, 12px)', marginBottom: '4px' }}>
            USE SCROLL WHEEL TO NAVIGATE
          </div>
          <div className="lcd-text" style={{ fontSize: 'clamp(9px, 2.5vw, 12px)', marginBottom: '4px' }}>
            SIDE BUTTON TO SELECT
          </div>
          
          {/* Selected Menu Item Display */}
          <div style={{ marginTop: '8px', width: '100%', textAlign: 'center' }}>
            <div className="lcd-text" style={{
              padding: '4px 12px',
              backgroundColor: 'rgba(0, 255, 68, 0.2)',
              border: '1px solid rgba(0, 255, 68, 0.5)',
              borderRadius: '4px',
              textShadow: '0 0 4px rgba(0, 255, 68, 0.5)',
              fontSize: 'clamp(12px, 3.5vw, 16px)',
              fontWeight: 'bold'
            }}>
              {'> '}{mainMenuOptions[selectedMenuIndex]}
              {mainMenuOptions[selectedMenuIndex] === 'REQUESTS' && friendRequests.length > 0 && ` (${friendRequests.length})`}
            </div>
          </div>
        </div>
      )}
    </div>
  )

  const renderFriendsScreen = () => (
    <div className="lcd-content">
      <div className="back-btn" onClick={() => setCurrentScreen('main')}>← BACK</div>
      <div className="lcd-title">CONTACTS</div>
      <div className="status-line"></div>

      <div className="lcd-text" style={{ fontSize: 'clamp(9px, 2.5vw, 12px)', marginBottom: '6px' }}>
        SCROLL: NAVIGATE | SIDE: CALL/ACCEPT
      </div>

      {/* Scrollable content area */}
      <div style={{ 
        width: '100%', 
        height: '100%', 
        overflowY: 'auto',
        paddingRight: '4px',
        scrollbarWidth: 'thin',
        scrollbarColor: '#00ff44 transparent'
      }}>
        
        {/* Friend Requests Section */}
        {friendRequests.length > 0 && (
          <div style={{ marginBottom: '8px' }}>
            <div className="lcd-text" style={{ 
              color: '#ffaa00', 
              marginBottom: '4px',
              fontSize: 'clamp(10px, 2.8vw, 13px)',
              fontWeight: 'bold'
            }}>
              REQUESTS ({friendRequests.length}):
            </div>
            {friendRequests.map((request, index) => {
              const isSelected = selectedFriendIndex === index && selectedFriendIndex < friendRequests.length;
              return (
                <div 
                  key={request.friendshipId || request.id} 
                  className="friend-text-line"
                  style={{
                    backgroundColor: isSelected ? 'rgba(255, 170, 0, 0.3)' : 'rgba(255, 170, 0, 0.1)',
                    border: isSelected ? '1px solid rgba(255, 170, 0, 0.6)' : '1px solid rgba(255, 170, 0, 0.3)',
                    borderRadius: '2px',
                    margin: '1px 0',
                    padding: '3px 6px'
                  }}
                >
                  <span style={{
                    color: '#ffaa00',
                    fontSize: 'clamp(10px, 2.8vw, 13px)',
                    textShadow: isSelected ? '0 0 4px rgba(255, 170, 0, 0.5)' : '0 0 2px rgba(255, 170, 0, 0.3)'
                  }}>
                    {isSelected ? '> ' : '  '}{request.username?.toUpperCase() || 'UNKNOWN'}
                  </span>
                  <div style={{ display: 'flex', gap: '3px' }}>
                    <button
                      style={{
                        background: 'rgba(0, 255, 68, 0.2)',
                        border: '1px solid #00ff44',
                        color: '#00ff44',
                        fontSize: '9px',
                        padding: '1px 4px',
                        borderRadius: '2px',
                        cursor: 'pointer'
                      }}
                      onClick={() => acceptFriendRequest(request.friendshipId || request.id)}
                    >
                      ✓
                    </button>
                    <button
                      style={{
                        background: 'rgba(255, 68, 68, 0.2)',
                        border: '1px solid #ff4444',
                        color: '#ff4444',
                        fontSize: '9px',
                        padding: '1px 4px',
                        borderRadius: '2px',
                        cursor: 'pointer'
                      }}
                      onClick={() => rejectFriendRequest(request.friendshipId || request.id)}
                    >
                      ✗
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Friends Section */}
        <div style={{ marginBottom: '8px' }}>
          <div className="lcd-text" style={{ 
            color: '#00ff44', 
            marginBottom: '4px',
            fontSize: 'clamp(10px, 2.8vw, 13px)',
            fontWeight: 'bold'
          }}>
            CONTACTS ({friends.length}):
          </div>
          
          {friends.length === 0 ? (
            <div className="no-friends" style={{ fontSize: 'clamp(9px, 2.5vw, 12px)' }}>
              NO CONTACTS ADDED
            </div>
          ) : (
            friends.map((friend, index) => {
              const friendIndex = friendRequests.length + index;
              const isSelected = selectedFriendIndex === friendIndex;
              return (
                <div 
                  key={friend.id} 
                  className="friend-text-line"
                  style={{
                    backgroundColor: isSelected ? 'rgba(0, 255, 68, 0.2)' : 'transparent',
                    border: isSelected ? '1px solid rgba(0, 255, 68, 0.5)' : '1px solid transparent',
                    borderRadius: '2px',
                    margin: '1px 0',
                    padding: '3px 6px'
                  }}
                >
                  <span
                    className="friend-text-name"
                    onClick={() => callFriend(friend)}
                    style={{ 
                      fontSize: 'clamp(10px, 2.8vw, 13px)',
                      textShadow: isSelected ? '0 0 4px rgba(0, 255, 68, 0.5)' : '0 0 2px rgba(0, 255, 68, 0.3)'
                    }}
                  >
                    {isSelected ? '> ' : '  '}{friend.username.toUpperCase()}
                  </span>
                  <button
                    className="friend-remove-x"
                    onClick={() => handleRemoveFriend(friend.id)}
                    title="Remove contact"
                    style={{ fontSize: '12px' }}
                  >
                    ×
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Add Friend Section */}
        <div style={{ marginTop: '8px' }}>
          <div className="lcd-text" style={{ 
            color: '#00ff44', 
            marginBottom: '4px',
            fontSize: 'clamp(10px, 2.8vw, 13px)',
            fontWeight: 'bold'
          }}>
            ADD CONTACT:
          </div>
          <div className="add-friend-input-container">
            <input
              type="text"
              className="add-friend-input"
              placeholder="USERNAME"
              value={newFriendUsername}
              onChange={(e) => setNewFriendUsername(e.target.value.toLowerCase())}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleAddFriend()
                }
              }}
              style={{ 
                textTransform: 'uppercase',
                fontSize: 'clamp(9px, 2.5vw, 12px)'
              }}
            />
            <button
              className="add-friend-check-btn"
              onClick={handleAddFriend}
              disabled={!newFriendUsername.trim()}
            >
              +
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  const renderRequestsScreen = () => (
    <div className="lcd-content">
      <div className="back-btn" onClick={() => setCurrentScreen('main')}>← BACK</div>
      <div className="lcd-title">FRIEND REQUESTS</div>
      <div className="status-line"></div>

      <div className="lcd-text" style={{ fontSize: 'clamp(9px, 2.5vw, 12px)', marginBottom: '6px' }}>
        SCROLL: NAVIGATE | SIDE: ACCEPT
      </div>

      {friendRequests.length === 0 ? (
        <div className="no-friends">NO PENDING REQUESTS</div>
      ) : (
        <div style={{ width: '100%' }}>
          {friendRequests.map((request, index) => (
            <div 
              key={request.friendshipId || request.id} 
              className="friend-text-line"
              style={{
                backgroundColor: index === selectedRequestIndex ? 'rgba(255, 170, 0, 0.2)' : 'rgba(255, 170, 0, 0.1)',
                border: index === selectedRequestIndex ? '1px solid rgba(255, 170, 0, 0.6)' : '1px solid rgba(255, 170, 0, 0.3)',
                borderRadius: '2px',
                margin: '1px 0',
                padding: '4px 8px'
              }}
            >
              <span 
                className="friend-text-name"
                style={{
                  color: '#ffaa00',
                  textTransform: 'uppercase',
                  textShadow: index === selectedRequestIndex ? '0 0 4px rgba(255, 170, 0, 0.5)' : '0 0 2px rgba(255, 170, 0, 0.3)'
                }}
              >
                {index === selectedRequestIndex ? '> ' : '  '}{request.username?.toUpperCase() || 'UNKNOWN'}
              </span>
              <div style={{ display: 'flex', gap: '4px' }}>
                <button
                  style={{
                    background: 'rgba(0, 255, 68, 0.2)',
                    border: '1px solid #00ff44',
                    color: '#00ff44',
                    fontSize: '10px',
                    padding: '2px 6px',
                    borderRadius: '2px',
                    cursor: 'pointer'
                  }}
                  onClick={() => acceptFriendRequest(request.friendshipId || request.id)}
                >
                  ✓
                </button>
                <button
                  style={{
                    background: 'rgba(255, 68, 68, 0.2)',
                    border: '1px solid #ff4444',
                    color: '#ff4444',
                    fontSize: '10px',
                    padding: '2px 6px',
                    borderRadius: '2px',
                    cursor: 'pointer'
                  }}
                  onClick={() => rejectFriendRequest(request.friendshipId || request.id)}
                >
                  ✗
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  const renderChannelsScreen = () => (
    <div className="lcd-content">
      <div className="back-btn" onClick={() => setCurrentScreen('main')}>← BACK</div>
      <div className="lcd-text lcd-title">
        CHANNELS
      </div>
      <LocationChannels
        currentUser={currentUser}
        onChannelJoined={(channelId) => {
          console.log('Joined channel:', channelId)
        }}
        onGroupCallStarted={onGroupCallStarted}
      />
    </div>
  )

  const renderSettingsScreen = () => (
    <div className="lcd-content">
      <div className="back-btn" onClick={() => setCurrentScreen('main')}>← BACK</div>
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

  const renderIncomingCallScreen = () => (
    <div className="lcd-content">
      <div className="lcd-title">INCOMING CALL</div>
      <div className="status-line"></div>
      <div className="caller-info">
        <div className="caller-name">{incomingCaller?.toUpperCase()}</div>
        <div className="call-status">IS CALLING...</div>
      </div>
      <div className="call-buttons">
        <button className="call-accept-btn" onClick={acceptCall}>
          ACCEPT
        </button>
        <button className="call-reject-btn" onClick={rejectCall}>
          REJECT
        </button>
      </div>
    </div>
  )

  const renderCallingScreen = () => (
    <div className="lcd-content">
      <div className="lcd-title">CALLING...</div>
      <div className="status-line"></div>
      <div className="calling-info">
        <div className="target-name">{callingTarget?.toUpperCase()}</div>
        <div className="call-status">{callStatus?.toUpperCase() || 'CONNECTING...'}</div>
      </div>
      <div className="call-buttons">
        <button className="call-cancel-btn" onClick={cancelCall}>
          CANCEL
        </button>
      </div>
    </div>
  )

  const renderCurrentScreen = () => {
    // Handle call states first
    if (showIncomingCall) {
      return renderIncomingCallScreen()
    }
    if (showCalling) {
      return renderCallingScreen()
    }

    // Handle normal screens
    switch (currentScreen) {
      case 'friends':
        return renderFriendsScreen()
      case 'requests':
        return renderRequestsScreen()
      case 'settings':
        return renderSettingsScreen()
      default:
        return renderMainScreen()
    }
  }

  return (
    <div className="r1-device">
      {/* Antenna indicator */}
      <div className="antenna-indicator"></div>
      
      {/* Signal strength indicator */}
      <div className="signal-strength">
        <div className={`signal-bar ${connectionStatus === 'Connected' ? 'active' : ''}`}></div>
        <div className={`signal-bar ${connectionStatus === 'Connected' ? 'active' : ''}`}></div>
        <div className={`signal-bar ${connectionStatus === 'Connected' ? 'active' : ''}`}></div>
        <div className={`signal-bar ${connectionStatus === 'Connected' ? 'active' : ''}`}></div>
      </div>
      
      {/* Volume indicator */}
      <div className="volume-indicator">
        <div className={`volume-bar ${volumeLevel > 0.25 ? 'active' : ''}`}></div>
        <div className={`volume-bar ${volumeLevel > 0.5 ? 'active' : ''}`}></div>
        <div className={`volume-bar ${volumeLevel > 0.75 ? 'active' : ''}`}></div>
        <div className={`volume-bar ${volumeLevel > 1 ? 'active' : ''}`}></div>
      </div>

      {/* LCD Screen - Takes up most of the space */}
      <div className="lcd-screen">
        {renderCurrentScreen()}
      </div>

      {/* Speaker and Controls Section - Fixed height at bottom */}
      <div className="speaker-controls">
        <div
          className={`speaker-area enhanced ${isPTTPressed ? 'ptt-active' : ''}`}
          onClick={isPTTPressed ? handlePTTEnd : handlePTTStart}
        >
          <img
            src={speakerSvg}
            alt="Speaker"
            className="speaker-svg"
          />
        </div>
        
        <div className="controls-area">
          <button
            className={`control-btn friends-btn ${currentScreen === 'friends' ? 'active' : ''}`}
            onClick={() => {
              setCurrentScreen('friends')
              setSelectedFriendIndex(0)
            }}
          >
            CONTACTS
          </button>
          <button
            className={`control-btn settings-btn ${currentScreen === 'settings' ? 'active' : ''}`}
            onClick={() => setCurrentScreen('settings')}
          >
            CONFIG
          </button>
        </div>
      </div>

      <GroupCallOverlay
        showGroupCall={showGroupCall}
        groupCallData={groupCallData}
        onClose={onGroupCallClosed}
        volumeLevel={volumeLevel}
        updateVolume={updateVolume}
      />
    </div>
  )
}

export default MainScreen

import React, { useState, useEffect } from 'react'
import LocationService from '../utils/LocationService'

function LocationChannels({ currentUser, onChannelJoined, onGroupCallStarted }) {
  const [locationChannels, setLocationChannels] = useState([])
  const [userChannels, setUserChannels] = useState([])
  const [nearbyChannels, setNearbyChannels] = useState([])
  const [currentLocation, setCurrentLocation] = useState(null)
  const [isLocationEnabled, setIsLocationEnabled] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [showCreateChannel, setShowCreateChannel] = useState(false)
  const [newChannelName, setNewChannelName] = useState('')
  const [newChannelRadius, setNewChannelRadius] = useState(1)

  useEffect(() => {
    initializeLocationTracking()
    loadUserChannels()

    // Listen for location channel events
    if (window.socketRef?.current) {
      window.socketRef.current.on('user-joined-channel', handleUserJoinedChannel)
      window.socketRef.current.on('user-left-channel', handleUserLeftChannel)
      window.socketRef.current.on('group-call-started', handleGroupCallStarted)
    }

    return () => {
      if (window.socketRef?.current) {
        window.socketRef.current.off('user-joined-channel', handleUserJoinedChannel)
        window.socketRef.current.off('user-left-channel', handleUserLeftChannel)
        window.socketRef.current.off('group-call-started', handleGroupCallStarted)
      }
    }
  }, [])

  const initializeLocationTracking = async () => {
    try {
      setIsLoading(true)
      const position = await LocationService.getCurrentPosition()
      setCurrentLocation(position)
      setIsLocationEnabled(true)

      // Start location tracking
      LocationService.startLocationTracking(async (position) => {
        setCurrentLocation(position)
        await updateLocationOnServer(position)
        await loadNearbyChannels(position)
      })

      await updateLocationOnServer(position)
      await loadNearbyChannels(position)
    } catch (error) {
      console.error('Location tracking error:', error)
      setIsLocationEnabled(false)
    } finally {
      setIsLoading(false)
    }
  }

  const updateLocationOnServer = async (position) => {
    try {
      if (currentUser?.id) {
        await LocationService.updateLocationOnServer(currentUser.id)
      }
    } catch (error) {
      console.error('Failed to update location on server:', error)
    }
  }

  const loadNearbyChannels = async (position) => {
    try {
      const channels = await LocationService.getNearbyChannels(
        position.latitude,
        position.longitude,
        2 // 2km radius
      )
      setNearbyChannels(channels)
    } catch (error) {
      console.error('Failed to load nearby channels:', error)
    }
  }

  const loadUserChannels = async () => {
    try {
      if (currentUser?.id) {
        const channels = await LocationService.getUserChannels()
        setUserChannels(channels)
      }
    } catch (error) {
      console.error('Failed to load user channels:', error)
    }
  }

  const handleUserJoinedChannel = (data) => {
    console.log('User joined channel:', data)
    loadUserChannels()
  }

  const handleUserLeftChannel = (data) => {
    console.log('User left channel:', data)
    loadUserChannels()
  }

  const handleGroupCallStarted = (data) => {
    console.log('Group call started:', data)
    if (onGroupCallStarted) {
      onGroupCallStarted(data)
    }
  }

  const handleJoinChannel = async (channelId) => {
    try {
      setIsLoading(true)
      await LocationService.joinLocationChannel(channelId)

      // Emit socket event
      if (window.socketRef?.current) {
        window.socketRef.current.emit('join-location-channel', { channelId })
      }

      await loadUserChannels()
      if (onChannelJoined) {
        onChannelJoined(channelId)
      }
    } catch (error) {
      console.error('Failed to join channel:', error)
      alert('Failed to join channel: ' + error.message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleLeaveChannel = async (channelId) => {
    try {
      setIsLoading(true)
      await LocationService.leaveLocationChannel(channelId)

      // Emit socket event
      if (window.socketRef?.current) {
        window.socketRef.current.emit('leave-location-channel', { channelId })
      }

      await loadUserChannels()
    } catch (error) {
      console.error('Failed to leave channel:', error)
      alert('Failed to leave channel: ' + error.message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateChannel = async () => {
    if (!newChannelName.trim() || !currentLocation) {
      alert('Please enter a channel name and ensure location is available')
      return
    }

    try {
      setIsLoading(true)
      const result = await LocationService.createLocationChannel(
        newChannelName.trim(),
        currentLocation.latitude,
        currentLocation.longitude,
        newChannelRadius
      )

      setNewChannelName('')
      setNewChannelRadius(1)
      setShowCreateChannel(false)

      await loadUserChannels()
      await loadNearbyChannels(currentLocation)

      alert(`Channel "${result.channel.name}" created successfully!`)
    } catch (error) {
      console.error('Failed to create channel:', error)
      alert('Failed to create channel: ' + error.message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleStartGroupCall = async (channelId) => {
    try {
      setIsLoading(true)
      const result = await LocationService.startGroupCall(channelId)

      if (window.socketRef?.current) {
        window.socketRef.current.emit('start-group-call', { channelId })
      }

      if (onGroupCallStarted) {
        onGroupCallStarted(result)
      }
    } catch (error) {
      console.error('Failed to start group call:', error)
      alert('Failed to start group call: ' + error.message)
    } finally {
      setIsLoading(false)
    }
  }

  const isUserInChannel = (channelId) => {
    return userChannels.some(channel => channel.id === channelId)
  }

  return (
    <div className="location-channels">
      <div className="location-header">
        <h3>Location Channels</h3>
        <div className="location-status">
          {isLocationEnabled ? (
            <span className="status-enabled">
              📍 Location: {currentLocation ? `${currentLocation.latitude.toFixed(4)}, ${currentLocation.longitude.toFixed(4)}` : 'Getting location...'}
            </span>
          ) : (
            <span className="status-disabled">
              📍 Location disabled
            </span>
          )}
        </div>
      </div>

      {isLoading && <div className="loading">Loading...</div>}

      <div className="channel-sections">
        {/* User's Channels */}
        <div className="channel-section">
          <h4>Your Channels</h4>
          {userChannels.length === 0 ? (
            <p className="no-channels">No channels joined yet</p>
          ) : (
            <div className="channel-list">
              {userChannels.map(channel => (
                <div key={channel.id} className="channel-item user-channel">
                  <div className="channel-info">
                    <span className="channel-name">{channel.name}</span>
                    <span className="channel-distance">
                      {currentLocation ? `${LocationService.calculateDistance(
                        currentLocation.latitude,
                        currentLocation.longitude,
                        channel.latitude,
                        channel.longitude
                      ).toFixed(2)} km away` : ''}
                    </span>
                  </div>
                  <div className="channel-actions">
                    <button
                      className="btn-small"
                      onClick={() => handleStartGroupCall(channel.id)}
                      disabled={isLoading}
                    >
                      Start Group Call
                    </button>
                    <button
                      className="btn-small leave-btn"
                      onClick={() => handleLeaveChannel(channel.id)}
                      disabled={isLoading}
                    >
                      Leave
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Nearby Channels */}
        <div className="channel-section">
          <h4>Nearby Channels</h4>
          {nearbyChannels.length === 0 ? (
            <p className="no-channels">No nearby channels found</p>
          ) : (
            <div className="channel-list">
              {nearbyChannels.map(channel => (
                <div key={channel.id} className="channel-item nearby-channel">
                  <div className="channel-info">
                    <span className="channel-name">{channel.name}</span>
                    <span className="channel-distance">
                      {channel.distance ? `${channel.distance.toFixed(2)} km away` : ''}
                    </span>
                    <span className="channel-radius">
                      Radius: {channel.radius} km
                    </span>
                  </div>
                  <div className="channel-actions">
                    {isUserInChannel(channel.id) ? (
                      <span className="joined-indicator">Joined</span>
                    ) : (
                      <button
                        className="btn-small"
                        onClick={() => handleJoinChannel(channel.id)}
                        disabled={isLoading}
                      >
                        Join
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Create Channel */}
        <div className="channel-section">
          <button
            className="btn"
            onClick={() => setShowCreateChannel(!showCreateChannel)}
            disabled={!isLocationEnabled}
          >
            {showCreateChannel ? 'Cancel' : 'Create Channel'}
          </button>

          {showCreateChannel && (
            <div className="create-channel-form">
              <input
                type="text"
                placeholder="Channel name"
                value={newChannelName}
                onChange={(e) => setNewChannelName(e.target.value)}
                maxLength={50}
              />
              <div className="radius-input">
                <label>Radius (km):</label>
                <input
                  type="range"
                  min="0.1"
                  max="5"
                  step="0.1"
                  value={newChannelRadius}
                  onChange={(e) => setNewChannelRadius(parseFloat(e.target.value))}
                />
                <span>{newChannelRadius} km</span>
              </div>
              <button
                className="btn"
                onClick={handleCreateChannel}
                disabled={isLoading || !newChannelName.trim()}
              >
                Create
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default LocationChannels

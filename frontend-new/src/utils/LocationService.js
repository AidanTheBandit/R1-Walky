class LocationService {
    constructor() {
        this.currentPosition = null;
        this.watchId = null;
        this.locationChannels = [];
        this.isTracking = false;
    }

    // Request user's current location
    async getCurrentPosition() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Geolocation is not supported by this browser'));
                return;
            }

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    this.currentPosition = {
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                        accuracy: position.coords.accuracy,
                        timestamp: position.timestamp
                    };
                    resolve(this.currentPosition);
                },
                (error) => {
                    reject(this.getLocationErrorMessage(error));
                },
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 300000 // 5 minutes
                }
            );
        });
    }

    // Start watching user's location
    startLocationTracking(callback) {
        if (!navigator.geolocation) {
            throw new Error('Geolocation is not supported by this browser');
        }

        if (this.watchId) {
            this.stopLocationTracking();
        }

        this.watchId = navigator.geolocation.watchPosition(
            (position) => {
                this.currentPosition = {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    accuracy: position.coords.accuracy,
                    timestamp: position.timestamp
                };

                if (callback) {
                    callback(this.currentPosition);
                }
            },
            (error) => {
                console.error('Location tracking error:', this.getLocationErrorMessage(error));
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 30000 // 30 seconds
            }
        );

        this.isTracking = true;
        return this.watchId;
    }

    // Stop watching user's location
    stopLocationTracking() {
        if (this.watchId) {
            navigator.geolocation.clearWatch(this.watchId);
            this.watchId = null;
        }
        this.isTracking = false;
    }

    // Update location on server
    async updateLocationOnServer(userId) {
        if (!this.currentPosition) {
            throw new Error('No current position available');
        }

        const response = await fetch('/api/location/update', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-User-ID': userId
            },
            body: JSON.stringify({
                latitude: this.currentPosition.latitude,
                longitude: this.currentPosition.longitude
            })
        });

        if (!response.ok) {
            throw new Error('Failed to update location on server');
        }

        return await response.json();
    }

    // Get nearby channels
    async getNearbyChannels(latitude, longitude, radius = 1) {
        const response = await fetch(`/api/location/channels/nearby?latitude=${latitude}&longitude=${longitude}&radius=${radius}`, {
            headers: {
                'X-User-ID': window.currentUser?.id
            }
        });

        if (!response.ok) {
            throw new Error('Failed to get nearby channels');
        }

        const data = await response.json();
        this.locationChannels = data.channels;
        return this.locationChannels;
    }

    // Create location channel
    async createLocationChannel(name, latitude, longitude, radius) {
        const response = await fetch('/api/location/channels', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-User-ID': window.currentUser?.id
            },
            body: JSON.stringify({
                name,
                latitude,
                longitude,
                radius
            })
        });

        if (!response.ok) {
            throw new Error('Failed to create location channel');
        }

        return await response.json();
    }

    // Join location channel
    async joinLocationChannel(channelId) {
        const response = await fetch(`/api/location/channels/${channelId}/join`, {
            method: 'POST',
            headers: {
                'X-User-ID': window.currentUser?.id
            }
        });

        if (!response.ok) {
            throw new Error('Failed to join location channel');
        }

        return await response.json();
    }

    // Leave location channel
    async leaveLocationChannel(channelId) {
        const response = await fetch(`/api/location/channels/${channelId}/leave`, {
            method: 'POST',
            headers: {
                'X-User-ID': window.currentUser?.id
            }
        });

        if (!response.ok) {
            throw new Error('Failed to leave location channel');
        }

        return await response.json();
    }

    // Get user's channels
    async getUserChannels() {
        const response = await fetch('/api/location/channels', {
            headers: {
                'X-User-ID': window.currentUser?.id
            }
        });

        if (!response.ok) {
            throw new Error('Failed to get user channels');
        }

        const data = await response.json();
        return data.channels;
    }

    // Get channel participants
    async getChannelParticipants(channelId) {
        const response = await fetch(`/api/location/channels/${channelId}/participants`, {
            headers: {
                'X-User-ID': window.currentUser?.id
            }
        });

        if (!response.ok) {
            throw new Error('Failed to get channel participants');
        }

        const data = await response.json();
        return data.participants;
    }

    // Start group call in channel
    async startGroupCall(channelId) {
        const response = await fetch(`/api/location/channels/${channelId}/group-call/start`, {
            method: 'POST',
            headers: {
                'X-User-ID': window.currentUser?.id
            }
        });

        if (!response.ok) {
            throw new Error('Failed to start group call');
        }

        return await response.json();
    }

    // Calculate distance between two points
    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // Radius of the Earth in km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a =
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c; // Distance in km
    }

    // Get location error message
    getLocationErrorMessage(error) {
        switch(error.code) {
            case error.PERMISSION_DENIED:
                return 'Location access denied by user';
            case error.POSITION_UNAVAILABLE:
                return 'Location information unavailable';
            case error.TIMEOUT:
                return 'Location request timed out';
            default:
                return 'Unknown location error';
        }
    }

    // Get current position
    getCurrentPosition() {
        return this.currentPosition;
    }

    // Check if location tracking is active
    isLocationTrackingActive() {
        return this.isTracking;
    }
}

// Create global instance
window.locationService = new LocationService();

export default LocationService;

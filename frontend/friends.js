// Friends management module for SimpleWalky
class FriendsHandler {
    constructor(app) {
        this.app = app;
    }

    loadFriends() {
        if (!this.app.currentUser || !this.app.currentUser.id) {
            console.log('No current user, skipping loadFriends');
            return;
        }
        
        window.utils.xhrRequest('/api/friends', {
            headers: { 'X-User-ID': this.app.currentUser.id }
        }).then(function(response) {
            console.log('loadFriends response:', response.ok, response.status);
            if (response.ok) {
                response.json().then(function(data) {
                    this.app.friends = data;
                    this.renderFriends();
                }.bind(this)).catch(function(error) {
                    console.error('JSON parse error in loadFriends:', error);
                });
            } else {
                console.error('Load friends failed:', response.status);
            }
        }.bind(this)).catch(function(error) {
            console.error('Load friends error:', error);
        }.bind(this));
    }

    renderFriends() {
        const list = document.getElementById('friends-list');
        if (this.app.friends.length === 0) {
            list.innerHTML = '<div class="friend-item">No friends</div>';
            return;
        }

        let friendHtml = '';
        this.app.friends.forEach(friend => {
            friendHtml += `
                <div class="friend-item" onclick="friendsHandler.callFriend('${friend.username}')">
                    <span class="friend-name">${friend.username}</span>
                    <span class="friend-status" id="status-${friend.id}">●</span>
                    <button class="btn small" onclick="event.stopPropagation(); friendsHandler.unfriend('${friend.id}', '${friend.username}');">×</button>
                </div>`;
        });
        list.innerHTML = friendHtml;
    }

    addFriend() {
        if (!this.app.currentUser || !this.app.currentUser.id) {
            console.log('No current user, cannot add friend');
            utils.updateStatus('Please log in first');
            return;
        }
        
        const username = document.getElementById('friend-username').value.trim();
        if (!username) return;

        window.utils.xhrRequest('/api/friends', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-User-ID': this.app.currentUser.id
            },
            body: JSON.stringify({ friendUsername: username })
        }).then(response => {
            console.log('addFriend response:', response.ok, response.status);
            if (response.ok) {
                document.getElementById('friend-username').value = '';
                utils.updateStatus('Friend request sent!');
                setTimeout(() => this.loadFriends(), 1000);
            } else {
                response.json().then(error => {
                    utils.updateStatus(error.error || 'Failed to add friend');
                }).catch(() => {
                    utils.updateStatus('Failed to add friend');
                });
            }
        }).catch(error => {
            console.error('Add friend error:', error);
            utils.updateStatus('Network error');
        });
    }

    async callFriend(username) {
        if (!this.app.currentUser || !this.app.currentUser.id) {
            console.log('No current user, cannot call friend');
            utils.updateStatus('Please log in first');
            return;
        }
        
        if (this.app.currentCall) {
            utils.updateStatus('Call already in progress');
            return;
        }

        try {
            utils.updateStatus(`Calling ${username}...`);

            // Get user media for recording (server-mediated approach)
            this.app.localStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false,
                    sampleRate: 16000, // Lower sample rate for better compression
                    channelCount: 1
                }
            });

            console.log('🎤 Got microphone for server-mediated call:', this.app.localStream.getAudioTracks().length, 'tracks');

            // Initially disable audio tracks (PTT mode)
            this.app.localStream.getAudioTracks().forEach(track => {
                track.enabled = false;
                console.log('Initially disabled track for server-mediated call:', track.label);
            });

            // Send call initiation to server (server-mediated)
            const response = await window.utils.xhrRequest('/api/calls/initiate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-ID': this.app.currentUser.id
                },
                body: JSON.stringify({
                    targetUsername: username,
                    offer: { type: 'server-mediated' } // Simplified offer for server-mediated
                })
            });

            if (response.ok) {
                const callData = await response.json();
                this.app.currentCall = {
                    id: callData.callId,
                    status: 'calling',
                    targetUsername: username,
                    targetId: callData.targetId,
                    isInitiator: true,
                    mode: 'server-mediated'
                };
                utils.updateStatus(`Calling ${username} (server-mediated)...`);
                console.log('📞 Server-mediated call initiated:', callData.callId);
            } else {
                throw new Error('Failed to initiate call');
            }
        } catch (error) {
            console.error('❌ Call error:', error);
            utils.updateStatus('Call failed');
            this.app.endCall();
        }
    }

    loadFriendRequests() {
        if (!this.app.currentUser || !this.app.currentUser.id) {
            console.log('No current user, skipping loadFriendRequests');
            return;
        }
        
        window.utils.xhrRequest('/api/friends/requests', {
            headers: { 'X-User-ID': this.app.currentUser.id }
        }).then(response => {
            console.log('loadFriendRequests response:', response.ok, response.status);
            if (response.ok) {
                response.json().then(data => {
                    this.app.friendRequests = data.requests || [];
                    this.renderFriendRequests();
                }).catch(error => {
                    console.error('JSON parse error in loadFriendRequests:', error);
                });
            } else {
                console.error('Load friend requests failed:', response.status);
            }
        }).catch(error => {
            console.error('Load friend requests error:', error);
        });
    }

    renderFriendRequests() {
        const container = document.getElementById('friend-requests');
        const list = document.getElementById('friend-requests-list');

        if (this.app.friendRequests.length === 0) {
            container.style.display = 'none';
            return;
        }

        container.style.display = 'block';
        list.innerHTML = this.app.friendRequests.map(request =>
            `<div class="friend-request">
                <span>${request.username}</span>
                <div class="request-buttons">
                    <button class="btn small" onclick="friendsHandler.acceptFriendRequest('${request.friendshipId}')">✓</button>
                    <button class="btn small" onclick="friendsHandler.rejectFriendRequest('${request.friendshipId}')">✗</button>
                </div>
            </div>`
        ).join('');
    }

    async acceptFriendRequest(friendshipId) {
        if (!this.app.currentUser || !this.app.currentUser.id) {
            console.log('No current user, cannot accept friend request');
            utils.updateStatus('Please log in first');
            return;
        }
        
        try {
            const response = await window.utils.xhrRequest(`/api/friends/${friendshipId}/accept`, {
                method: 'POST',
                headers: { 'X-User-ID': this.app.currentUser.id }
            });

            if (response.ok) {
                utils.updateStatus('Friend request accepted!');
                this.loadFriendRequests();
                this.loadFriends();
            } else {
                utils.updateStatus('Failed to accept request');
            }
        } catch (error) {
            console.error('Accept friend request error:', error);
            utils.updateStatus('Network error');
        }
    }

    async rejectFriendRequest(friendshipId) {
        if (!this.app.currentUser || !this.app.currentUser.id) {
            console.log('No current user, cannot reject friend request');
            utils.updateStatus('Please log in first');
            return;
        }
        
        try {
            const response = await window.utils.xhrRequest(`/api/friends/${friendshipId}/reject`, {
                method: 'POST',
                headers: { 'X-User-ID': this.app.currentUser.id }
            });

            if (response.ok) {
                utils.updateStatus('Friend request rejected');
                this.loadFriendRequests();
            } else {
                utils.updateStatus('Failed to reject request');
            }
        } catch (error) {
            console.error('Reject friend request error:', error);
            utils.updateStatus('Network error');
        }
    }

    updateFriendStatus(userId, isOnline) {
        const statusElement = document.getElementById(`status-${userId}`);
        if (statusElement) {
            statusElement.className = isOnline ? 'friend-status online' : 'friend-status';
        }
    }

    async unfriend(friendId, friendUsername) {
        if (!this.app.currentUser || !this.app.currentUser.id) {
            console.log('No current user, cannot unfriend');
            utils.updateStatus('Please log in first');
            return;
        }
        
        if (!confirm(`Remove ${friendUsername} from friends?`)) return;

        try {
            const response = await window.utils.xhrRequest(`/api/friends/${friendId}`, {
                method: 'DELETE',
                headers: {
                    'X-User-ID': this.app.currentUser.id
                }
            });

            if (response.ok) {
                utils.updateStatus(`Removed ${friendUsername}`);
                this.loadFriends();
            } else {
                utils.updateStatus('Failed to remove friend');
            }
        } catch (error) {
            console.error('Unfriend error:', error);
            utils.updateStatus('Network error');
        }
    }
}

// Handler will be instantiated in app.js

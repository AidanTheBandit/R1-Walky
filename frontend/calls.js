// Call handling module for SimpleWalky
class CallsHandler {
    constructor(app) {
        this.app = app;
    }

    async startTalk() {
        if (!this.app.currentCall || this.app.isRecording) return;

        const btn = document.getElementById('ptt-button');
        btn.textContent = 'Talking...';
        btn.classList.add('active');
        utils.updateStatus('Transmitting (server-mediated)...');

        // Start recording audio for server-mediated streaming
        audioHandler.startAudioRecording();

        // Notify server that we're starting audio stream
        this.app.socket.emit('start-audio-stream', {
            callId: this.app.currentCall.id
        });

        // Force call to connected state for server-mediated
        if (this.app.currentCall.status !== 'connected') {
            this.app.currentCall.status = 'connected';
            this.showEndCallButton();
            utils.updateStatus('Connected (server-mediated) - ready to talk');
        }

        console.log('🎤 Started server-mediated audio recording');
    }

    stopTalk() {
        if (!this.app.currentCall || !this.app.isRecording) return;

        const btn = document.getElementById('ptt-button');
        btn.textContent = 'HOLD\nTO TALK';
        btn.classList.remove('active');
        utils.updateStatus('Connected (server-mediated)');

        // Stop recording and send final audio chunk
        audioHandler.stopAudioRecording();

        // Notify server that we're stopping audio stream
        this.app.socket.emit('stop-audio-stream', {
            callId: this.app.currentCall.id
        });

        console.log('🔇 Stopped server-mediated audio recording');
    }

    async answerCall() {
        if (!this.app.currentCall || this.app.currentCall.status !== 'incoming') return;

        try {
            // Hide incoming call UI
            document.getElementById('incoming-call').classList.remove('active');
            this.app.ringtone.pause();
            this.app.ringtone.currentTime = 0;

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

            console.log('🎤 Got microphone for server-mediated answer:', this.app.localStream.getAudioTracks().length, 'tracks');

            // Initially disable audio tracks (PTT mode)
            this.app.localStream.getAudioTracks().forEach(track => {
                track.enabled = false;
                console.log('Initially disabled track for server-mediated answer:', track.label);
            });

            // Send answer via socket (server-mediated)
            this.app.socket.emit('answer-call', {
                callId: this.app.currentCall.id,
                answer: { type: 'server-mediated-accepted' }
            });

            // Set call to connected state
            this.app.currentCall.status = 'connected';
            this.app.currentCall.mode = 'server-mediated';
            this.showEndCallButton();
            utils.updateStatus(`Connected to ${this.app.currentCall.callerUsername} (server-mediated)`);

            console.log('✅ Server-mediated call answered:', this.app.currentCall.id);
        } catch (error) {
            console.error('❌ Answer call error:', error);
            this.rejectCall();
        }
    }

    rejectCall() {
        // Hide incoming call UI
        document.getElementById('incoming-call').classList.remove('active');
        this.app.ringtone.pause();
        this.app.ringtone.currentTime = 0;

        utils.updateStatus('Call rejected');
        this.endCall();
    }

    endCall() {
        // Stop recording if active
        if (this.app.isRecording) {
            audioHandler.stopAudioRecording();
        }

        // Notify other party if call is active
        if (this.app.currentCall && this.app.socket) {
            this.app.socket.emit('end-call', {
                callId: this.app.currentCall.id
            });
        }

        // Stop ringtone
        if (this.app.ringtone) {
            this.app.ringtone.pause();
            this.app.ringtone.currentTime = 0;
        }

        // Stop local stream
        if (this.app.localStream) {
            this.app.localStream.getTracks().forEach(track => track.stop());
            this.app.localStream = null;
        }

        // Reset call state
        this.app.currentCall = null;
        this.app.remoteStream = null;
        this.app.isRecording = false;
        this.app.audioQueue = [];
        this.app.isPlayingAudio = false;

        // Clear remote audio
        if (this.app.remoteAudio) {
            this.app.remoteAudio.srcObject = null;
        }

        // Clean up audio context
        if (this.app.audioContext && this.app.audioContext.state !== 'closed') {
            this.app.audioContext.close().then(() => {
                this.app.audioContext = null;
                this.app.gainNode = null;
                console.log('🔊 Audio context cleaned up');
            });
        }

        // Hide incoming call UI
        document.getElementById('incoming-call').classList.remove('active');

        // Reset PTT button
        const btn = document.getElementById('ptt-button');
        if (btn) {
            btn.innerHTML = '<div>HOLD</div><div>TO TALK</div>';
            btn.classList.remove('active');
        }

        // Hide end call button
        this.hideEndCallButton();

        utils.updateStatus('Call ended');
        setTimeout(() => utils.updateStatus('Ready (server-mediated)'), 2000);
    }

    showEndCallButton() {
        const endCallBtn = document.getElementById('end-call-button');
        endCallBtn.style.display = 'block';
    }

    hideEndCallButton() {
        const endCallBtn = document.getElementById('end-call-button');
        endCallBtn.style.display = 'none';
    }
}

// Handler will be instantiated in app.js

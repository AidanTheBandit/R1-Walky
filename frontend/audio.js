// Audio handling module for SimpleWalky
class AudioHandler {
    constructor(app) {
        this.app = app;
    }

    // Audio recording for server-mediated streaming
    startAudioRecording() {
        if (!this.app.localStream) return;

        this.app.audioChunks = [];

        try {
            this.app.mediaRecorder = new MediaRecorder(this.app.localStream, {
                mimeType: 'audio/webm;codecs=opus'
            });

            this.app.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.app.audioChunks.push(event.data);
                    // Send audio chunk to server immediately
                    this.sendAudioChunk(event.data);
                }
            };

            this.app.mediaRecorder.onstop = () => {
                // Send any remaining audio data
                if (this.app.audioChunks.length > 0) {
                    const audioBlob = new Blob(this.app.audioChunks, { type: 'audio/webm' });
                    this.sendAudioChunk(audioBlob);
                    this.app.audioChunks = [];
                }
            };

            // Start recording with small time slices for real-time streaming
            this.app.mediaRecorder.start(100); // 100ms chunks
            this.app.isRecording = true;
            console.log('✅ Server-mediated audio recording started');

        } catch (error) {
            console.error('❌ Error starting audio recording:', error);
        }
    }

    stopAudioRecording() {
        if (this.app.mediaRecorder && this.app.mediaRecorder.state !== 'inactive') {
            this.app.mediaRecorder.stop();
            this.app.isRecording = false;
            console.log('✅ Server-mediated audio recording stopped');
        }
    }

    // Send audio chunk to server
    sendAudioChunk(audioBlob) {
        if (!this.app.currentCall) return;

        // Convert blob to base64 for transmission
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64Audio = reader.result;

            this.app.socket.emit('audio-data', {
                callId: this.app.currentCall.id,
                audioBlob: base64Audio,
                targetId: this.app.currentCall.targetId
            });
        };
        reader.readAsDataURL(audioBlob);
    }

    // Handle incoming audio data from server (server-mediated)
    handleIncomingAudio(data) {
        if (!this.app.currentCall || data.callId !== this.app.currentCall.id) return;

        try {
            // Convert base64 back to blob
            const audioBlob = this.base64ToBlob(data.audioBlob);

            // Add to audio queue for sequential playback
            this.app.audioQueue.push(audioBlob);

            // Start playing if not already playing
            if (!this.app.isPlayingAudio) {
                this.playNextAudioChunk();
            }

            console.log('🔊 Received audio chunk from server');
        } catch (error) {
            console.error('❌ Error handling incoming audio:', error);
        }
    }

    // Convert base64 to blob
    base64ToBlob(base64Data) {
        const arr = base64Data.split(',');
        const mime = arr[0].match(/:(.*?);/)[1];
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);

        while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
        }

        return new Blob([u8arr], { type: mime });
    }

    // Play next audio chunk in queue
    async playNextAudioChunk() {
        if (this.app.audioQueue.length === 0) {
            this.app.isPlayingAudio = false;
            return;
        }

        this.app.isPlayingAudio = true;
        const audioBlob = this.app.audioQueue.shift();

        try {
            const audioUrl = URL.createObjectURL(audioBlob);
            const audio = new Audio(audioUrl);

            // Set volume boost
            audio.volume = Math.min(this.app.volumeLevel, 1.0);

            // Play immediately
            await audio.play();

            // Clean up the URL after playing
            audio.onended = () => {
                URL.revokeObjectURL(audioUrl);
                // Play next chunk
                this.playNextAudioChunk();
            };

            console.log('▶️ Playing audio chunk with volume boost');
        } catch (error) {
            console.error('❌ Error playing audio chunk:', error);
            // Continue with next chunk
            this.playNextAudioChunk();
        }
    }

    // Handle audio stream started/stopped events
    handleAudioStreamStarted(data) {
        if (!this.app.currentCall || data.callId !== this.app.currentCall.id) return;
        console.log(`🎤 Audio stream started by ${data.fromUserId}`);
        utils.updateStatus(`Receiving audio from ${this.app.currentCall.targetUsername || 'peer'}`);
    }

    handleAudioStreamStopped(data) {
        if (!this.app.currentCall || data.callId !== this.app.currentCall.id) return;
        console.log(`🔇 Audio stream stopped by ${data.fromUserId}`);
        utils.updateStatus(`Connected to ${this.app.currentCall.targetUsername || 'peer'} (server-mediated)`);
    }
}

// Create global audio handler instance
const audioHandler = new AudioHandler(app);

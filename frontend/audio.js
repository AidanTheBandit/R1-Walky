// Audio handling module for SimpleWalky
class AudioHandler {
    constructor(app) {
        this.app = app;
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.scriptProcessor = null;
        this.audioQueue = [];
        this.isPlaying = false;
        this.sampleRate = 48000;
        this.channels = 1;
    }

    // Audio recording for server-mediated streaming using ScriptProcessorNode
    async startAudioRecording() {
        if (!this.app.localStream) return;

        try {
            // Resume audio context if suspended
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }

            // Create media stream source
            const source = this.audioContext.createMediaStreamSource(this.app.localStream);
            
            // Create script processor for raw audio data
            this.scriptProcessor = this.audioContext.createScriptProcessor(4096, 1, 1);
            
            this.scriptProcessor.onaudioprocess = (event) => {
                if (!this.app.currentCall || !this.app.isRecording) return;
                
                const inputBuffer = event.inputBuffer;
                const inputData = inputBuffer.getChannelData(0);
                
                // Convert Float32Array to Int16Array for transmission
                const pcmData = new Int16Array(inputData.length);
                for (let i = 0; i < inputData.length; i++) {
                    pcmData[i] = Math.max(-32768, Math.min(32767, inputData[i] * 32768));
                }
                
                // Send PCM data to server
                this.sendAudioData(pcmData);
            };
            
            // Connect nodes
            source.connect(this.scriptProcessor);
            this.scriptProcessor.connect(this.audioContext.destination);
            
            this.app.isRecording = true;
            console.log('✅ Server-mediated audio recording started');

        } catch (error) {
            console.error('❌ Error starting audio recording:', error);
        }
    }

    stopAudioRecording() {
        if (this.scriptProcessor) {
            this.scriptProcessor.disconnect();
            this.scriptProcessor = null;
        }
        this.app.isRecording = false;
        console.log('✅ Server-mediated audio recording stopped');
    }

    // Send PCM audio data to server
    sendAudioData(pcmData) {
        if (!this.app.currentCall) return;

        // Convert Int16Array to base64 for transmission
        const buffer = pcmData.buffer;
        const base64Data = btoa(String.fromCharCode(...new Uint8Array(buffer)));

        this.app.socket.emit('audio-data', {
            callId: this.app.currentCall.id,
            audioData: base64Data,
            sampleRate: this.sampleRate,
            channels: this.channels,
            targetId: this.app.currentCall.targetId
        });
    }

    // Handle incoming PCM audio data from server
    handleIncomingAudio(data) {
        if (!this.app.currentCall || data.callId !== this.app.currentCall.id) return;

        try {
            // Decode base64 PCM data
            const binaryString = atob(data.audioData);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            
            // Convert to Int16Array
            const pcmData = new Int16Array(bytes.buffer);
            
            // Add to audio queue
            this.audioQueue.push(pcmData);
            
            // Start playing if not already playing
            if (!this.isPlaying) {
                this.startPlayback();
            }

            console.log('🔊 Received PCM audio data from server');
        } catch (error) {
            console.error('❌ Error handling incoming audio:', error);
        }
    }

    // Start continuous audio playback
    async startPlayback() {
        if (this.isPlaying) return;
        
        try {
            // Resume audio context if suspended
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }
            
            this.isPlaying = true;
            this.playAudioQueue();
            console.log('▶️ Started audio playback');
        } catch (error) {
            console.error('❌ Error starting playback:', error);
            this.isPlaying = false;
        }
    }

    // Play audio from queue continuously
    playAudioQueue() {
        if (!this.isPlaying) return;
        
        if (this.audioQueue.length > 0) {
            const pcmData = this.audioQueue.shift();
            this.playPCMData(pcmData);
        }
        
        // Schedule next playback
        setTimeout(() => this.playAudioQueue(), 50); // 20fps audio chunks
    }

    // Play PCM data using Web Audio API
    playPCMData(pcmData) {
        try {
            // Create audio buffer
            const audioBuffer = this.audioContext.createBuffer(
                this.channels, 
                pcmData.length, 
                this.sampleRate
            );
            
            // Fill audio buffer with PCM data
            const channelData = audioBuffer.getChannelData(0);
            for (let i = 0; i < pcmData.length; i++) {
                channelData[i] = pcmData[i] / 32768.0; // Convert back to float
            }
            
            // Create buffer source
            const source = this.audioContext.createBufferSource();
            source.buffer = audioBuffer;
            
            // Apply volume boost
            const gainNode = this.audioContext.createGain();
            gainNode.gain.value = Math.min(this.app.volumeLevel || 1.0, 2.0);
            
            // Connect and play
            source.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            source.start();
            
        } catch (error) {
            console.error('❌ Error playing PCM data:', error);
        }
    }

    stopPlayback() {
        this.isPlaying = false;
        this.audioQueue = [];
        console.log('🔇 Stopped audio playback');
    }

    // Handle audio stream started/stopped events
    handleAudioStreamStarted(data) {
        if (!this.app.currentCall || data.callId !== this.app.currentCall.id) return;
        console.log(`🎤 Audio stream started by ${data.fromUserId}`);
        this.app.updateStatus(`Receiving audio from ${this.app.currentCall.targetUsername || 'peer'}`);
    }

    handleAudioStreamStopped(data) {
        if (!this.app.currentCall || data.callId !== this.app.currentCall.id) return;
        console.log(`🔇 Audio stream stopped by ${data.fromUserId}`);
        this.app.updateStatus(`Connected to ${this.app.currentCall.targetUsername || 'peer'} (server-mediated)`);
        this.stopPlayback();
    }
}

// Legacy function handlers for backward compatibility
function stopAudioRecording(app) {
    if (window.audioHandler) {
        window.audioHandler.stopAudioRecording();
    }
}

function sendAudioChunk(app, audioBlob) {
    // This function is now handled by the AudioHandler class
    console.warn('sendAudioChunk is deprecated - using AudioHandler.sendAudioData instead');
}

function handleIncomingAudio(app, data) {
    if (window.audioHandler) {
        window.audioHandler.handleIncomingAudio(data);
    }
}

function base64ToBlob(base64Data) {
    // This function is no longer needed for PCM audio
    console.warn('base64ToBlob is deprecated for PCM audio streaming');
}

function playNextAudioChunk(app) {
    // This function is now handled by the AudioHandler class
    console.warn('playNextAudioChunk is deprecated - using AudioHandler.playAudioQueue instead');
}

function handleAudioStreamStarted(app, data) {
    if (window.audioHandler) {
        window.audioHandler.handleAudioStreamStarted(data);
    }
}

function handleAudioStreamStopped(app, data) {
    if (window.audioHandler) {
        window.audioHandler.handleAudioStreamStopped(data);
    }
}
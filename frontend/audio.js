// Audio handling module for SimpleWalky
class AudioHandler {
    constructor(app) {
        this.app = app;
        // Create AudioContext with the correct sample rate to match recording
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
            sampleRate: 16000
        });
        this.scriptProcessor = null;
        this.audioQueue = [];
        this.isPlaying = false;
        this.sampleRate = 16000; // Match recording sample rate
        this.channels = 1;
    }

    // Audio recording for server-mediated streaming using ScriptProcessorNode
    async startAudioRecording() {
        if (!this.app.localStream) {
            console.error('❌ No local stream available for recording');
            return;
        }

        try {
            // Resume audio context if suspended
            if (this.audioContext.state === 'suspended') {
                console.log('🔄 Resuming audio context for recording...');
                await this.audioContext.resume();
            }

            console.log(`🎤 Starting recording with audio context state: ${this.audioContext.state}`);

            // Create media stream source
            const source = this.audioContext.createMediaStreamSource(this.app.localStream);
            
            // Create script processor for raw audio data with smaller buffer for lower latency
            this.scriptProcessor = this.audioContext.createScriptProcessor(1024, 1, 1);
            
            this.scriptProcessor.onaudioprocess = (event) => {
                if (!this.app.currentCall || !this.app.isRecording) return;
                
                const inputBuffer = event.inputBuffer;
                const inputData = inputBuffer.getChannelData(0);
                
                // Convert Float32Array to Int16Array for transmission (optimized)
                const pcmData = new Int16Array(inputData.length);
                const len = inputData.length;
                for (let i = 0; i < len; i++) {
                    pcmData[i] = inputData[i] * 32767 | 0; // Fast conversion using bitwise OR
                }
                
                // Send PCM data to server
                console.log(`🎤 Sending ${pcmData.length} PCM samples to server`);
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

        // Convert Int16Array to Uint8Array for proper base64 encoding
        const uint8Array = new Uint8Array(pcmData.buffer);
        
        // Convert to base64 using a more reliable method
        let binary = '';
        const len = uint8Array.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(uint8Array[i]);
        }
        const base64Data = btoa(binary);

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
            // Check if this is old format (audioBlob) or new format (audioData)
            if (data.audioBlob) {
                // Old format - ignore for now, we're using new PCM format
                console.log('🔊 Received old format audio data - ignoring');
                return;
            }
            
            if (!data.audioData) {
                console.error('❌ No audio data received');
                return;
            }

            // Decode base64 PCM data using a more reliable method
            const binaryString = atob(data.audioData);
            const uint8Array = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                uint8Array[i] = binaryString.charCodeAt(i);
            }
            
            // Convert to Int16Array
            const pcmData = new Int16Array(uint8Array.buffer);
            
            // Add to audio queue
            this.audioQueue.push(pcmData);
            
            console.log(`📦 Added PCM data to queue (queue length: ${this.audioQueue.length})`);
            
            // Start playing if not already playing
            if (!this.isPlaying) {
                console.log('🎵 Starting playback...');
                this.startPlayback();
            }

            console.log('🔊 Received PCM audio data from server');
        } catch (error) {
            console.error('❌ Error handling incoming audio:', error);
            console.log('Data received:', data);
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
            console.log('▶️ Started audio playback');
            this.playAudioQueue();
        } catch (error) {
            console.error('❌ Error starting playback:', error);
            this.isPlaying = false;
        }
    }

    // Play audio from queue continuously
    playAudioQueue() {
        if (!this.isPlaying) {
            console.log('🔇 Playback stopped');
            return;
        }
        
        if (this.audioQueue.length > 0) {
            const pcmData = this.audioQueue.shift();
            console.log(`🎵 Playing PCM chunk: ${pcmData.length} samples`);
            this.playPCMData(pcmData);
        } else {
            console.log('📭 Audio queue empty, waiting...');
        }
        
        // Schedule next playback - faster for smaller buffers
        setTimeout(() => this.playAudioQueue(), 30); // ~33fps for lower latency
    }

    // Play PCM data using Web Audio API
    playPCMData(pcmData) {
        try {
            console.log(`🎶 Creating audio buffer for ${pcmData.length} samples`);
            
            // Create audio buffer
            const audioBuffer = this.audioContext.createBuffer(
                this.channels, 
                pcmData.length, 
                this.sampleRate
            );
            
            // Fill audio buffer with PCM data (optimized)
            const channelData = audioBuffer.getChannelData(0);
            const len = pcmData.length;
            for (let i = 0; i < len; i++) {
                channelData[i] = pcmData[i] / 32767.0; // Convert back to float
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
            
            // Add error handling for the source
            source.onended = () => {
                console.log('🔊 PCM audio chunk finished playing');
            };
            
            source.onerror = (error) => {
                console.error('❌ Audio source error:', error);
            };
            
            source.start();
            
            console.log('🔊 PCM audio chunk played successfully');
            
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
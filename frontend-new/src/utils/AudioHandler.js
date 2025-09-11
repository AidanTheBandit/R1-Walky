import { addDebugLog } from './api.js';

export class AudioHandlerClass {
  constructor() {
    this.audioContext = null;
    this.mediaStreamSource = null;
    this.audioWorkletNode = null;
    this.audioQueue = [];
    this.isPlaying = false;
    this.sampleRate = 44100; // Match audio context sample rate
    this.channels = 1;
    this.currentCall = null;
    this.isRecording = false;
    this.workletLoaded = false;
  }

  // Initialize audio context
  async initAudioContext() {
    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 44100 // Match the getUserMedia sample rate
      });

      // Don't try to resume here - wait for user gesture
      if (this.audioContext.state === 'suspended') {
        addDebugLog('Audio context is suspended - will resume when needed');
        return true;
      }

      addDebugLog('Audio context initialized successfully');
      return true;
    } catch (error) {
      addDebugLog(`Failed to initialize audio context: ${error.message}`, 'error');
      return false;
    }
  }

  // Set current call for audio processing
  setCurrentCall(call) {
    this.currentCall = call;
    addDebugLog(`Audio handler call set: ${call?.id}`);
  }

  // Start audio recording and processing
  async startRecording(localStream) {
    if (!this.audioContext) {
      const initialized = await this.initAudioContext();
      if (!initialized) return false;
    }

    if (!localStream) {
      addDebugLog('No local stream available for recording', 'error');
      return false;
    }

    try {
      addDebugLog('Starting audio recording...');

      // Ensure audio context is running
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
        addDebugLog('Resumed suspended audio context');
      }

      // Create media stream source (don't recreate if already exists)
      if (!this.mediaStreamSource) {
        this.mediaStreamSource = this.audioContext.createMediaStreamSource(localStream);
        addDebugLog('Created media stream source');
      }

      // Create script processor for raw audio data (don't recreate if already exists)
      if (!this.scriptProcessor) {
        this.scriptProcessor = this.audioContext.createScriptProcessor(4096, 1, 1);
        addDebugLog('Created script processor');

        this.scriptProcessor.onaudioprocess = (event) => {
          if (!this.currentCall || !this.isRecording) return;

          const inputBuffer = event.inputBuffer;
          const inputData = inputBuffer.getChannelData(0);

          // Convert Float32Array to Int16Array for transmission
          const pcmData = new Int16Array(inputData.length);
          const len = inputData.length;
          for (let i = 0; i < len; i++) {
            pcmData[i] = inputData[i] * 32767 | 0;
          }

          // Send PCM data to server
          this.sendAudioData(pcmData);
        };

        // Connect nodes
        this.mediaStreamSource.connect(this.scriptProcessor);
        this.scriptProcessor.connect(this.audioContext.destination);
        addDebugLog('Connected audio processing nodes');
      }

      // Note: Don't set isRecording here - let PTT control it
      addDebugLog('Audio recording infrastructure ready');
      return true;

    } catch (error) {
      addDebugLog(`Error starting audio recording: ${error.message}`, 'error');
      return false;
    }
  }

  // Stop audio recording
  stopRecording() {
    if (this.scriptProcessor) {
      this.scriptProcessor.disconnect();
      this.scriptProcessor = null;
    }
    if (this.mediaStreamSource) {
      this.mediaStreamSource.disconnect();
      this.mediaStreamSource = null;
    }
    this.isRecording = false;
    addDebugLog('Audio recording stopped');
  }

  // Send PCM audio data to server
  sendAudioData(pcmData) {
    if (!this.currentCall) {
      addDebugLog('No current call, skipping audio data send');
      return;
    }

    if (!window.socketRef?.current) {
      addDebugLog('No socket connection available, skipping audio data send', 'error');
      return;
    }

    if (!window.socketRef.current.connected) {
      addDebugLog('Socket is not connected, skipping audio data send', 'error');
      return;
    }

    try {
      // Convert Int16Array to Uint8Array for base64 encoding
      const uint8Array = new Uint8Array(pcmData.buffer);

      // Convert to base64
      let binary = '';
      const len = uint8Array.byteLength;
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(uint8Array[i]);
      }
      const base64Data = btoa(binary);

      // Send via socket
      window.socketRef.current.emit('audio-data', {
        callId: this.currentCall.id,
        audioData: base64Data,
        sampleRate: this.sampleRate,
        channels: this.channels,
        targetId: this.currentCall.targetId
      });

      addDebugLog(`Sent ${pcmData.length} PCM samples (${base64Data.length} bytes) to ${this.currentCall.targetId}`);
    } catch (error) {
      addDebugLog(`Error sending audio data: ${error.message}`, 'error');
    }
  }

  // Handle incoming audio data
  handleIncomingAudio(data) {
    if (!this.currentCall) {
      addDebugLog('No current call, ignoring incoming audio');
      return;
    }

    if (data.callId !== this.currentCall.id) {
      addDebugLog(`Audio data for different call (${data.callId} vs ${this.currentCall.id}), ignoring`);
      return;
    }

    try {
      // Decode base64 PCM data
      const binaryString = atob(data.audioData);
      const uint8Array = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        uint8Array[i] = binaryString.charCodeAt(i);
      }

      // Convert to Int16Array
      const pcmData = new Int16Array(uint8Array.buffer);

      // Add to audio queue
      this.audioQueue.push(pcmData);

      addDebugLog(`Added PCM data to queue (${pcmData.length} samples, queue length: ${this.audioQueue.length})`);

      // Start playing if not already playing
      if (!this.isPlaying) {
        this.startPlayback();
      }

    } catch (error) {
      addDebugLog(`Error handling incoming audio: ${error.message}`, 'error');
    }
  }

  // Start continuous audio playback
  async startPlayback() {
    if (this.isPlaying) return;

    try {
      if (!this.audioContext) {
        const initialized = await this.initAudioContext();
        if (!initialized) return;
      }

      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      this.isPlaying = true;
      addDebugLog('Started audio playback');
      this.playAudioQueue();

    } catch (error) {
      addDebugLog(`Error starting playback: ${error.message}`, 'error');
      this.isPlaying = false;
    }
  }

  // Play audio from queue continuously
  playAudioQueue() {
    if (!this.isPlaying) {
      addDebugLog('Playback stopped');
      return;
    }

    if (this.audioQueue.length > 0) {
      const pcmData = this.audioQueue.shift();
      addDebugLog(`Playing PCM chunk: ${pcmData.length} samples`);
      this.playPCMData(pcmData);
    } else {
      addDebugLog('Audio queue empty, waiting...');
    }

    // Schedule next playback
    setTimeout(() => this.playAudioQueue(), 30);
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
      const len = pcmData.length;
      for (let i = 0; i < len; i++) {
        channelData[i] = pcmData[i] / 32767.0;
      }

      // Create buffer source
      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;

      // Apply volume boost
      const gainNode = this.audioContext.createGain();
      gainNode.gain.value = Math.min(window.volumeLevel || 2.0, 2.0);

      // Connect and play
      source.connect(gainNode);
      gainNode.connect(this.audioContext.destination);

      source.start(0);

      addDebugLog(`PCM audio chunk played successfully (${pcmData.length} samples)`);

    } catch (error) {
      addDebugLog(`Error playing PCM data: ${error.message}`, 'error');
    }
  }

  // Stop playback
  stopPlayback() {
    this.isPlaying = false;
    this.audioQueue = [];
    addDebugLog('Stopped audio playback');
  }

  // Clean up resources
  cleanup() {
    this.stopRecording();
    this.stopPlayback();

    if (this.audioContext) {
      this.audioContext.close().catch(err => {
        addDebugLog(`Error closing audio context: ${err.message}`, 'error');
      });
      this.audioContext = null;
    }

    this.currentCall = null;
    addDebugLog('Audio handler cleaned up');
  }
}

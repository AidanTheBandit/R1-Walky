// Voice encryption/decryption utility for R1-Walky
// Simplified implementation for demo purposes

class VoiceEncryption {
    constructor() {
        this.encryptionKey = null;
    }

    // Set encryption key
    setKey(key) {
        this.encryptionKey = key;
    }

    // Encrypt audio data (simplified)
    async encryptAudioFrame(audioData) {
        if (!this.encryptionKey) {
            throw new Error('No encryption key set');
        }

        try {
            // Generate random IV for each frame
            const iv = crypto.getRandomValues(new Uint8Array(12));

            const encrypted = await crypto.subtle.encrypt(
                {
                    name: 'AES-GCM',
                    iv: iv
                },
                this.encryptionKey,
                audioData
            );

            // Combine IV and encrypted data
            const result = new Uint8Array(iv.length + encrypted.byteLength);
            result.set(iv);
            result.set(new Uint8Array(encrypted), iv.length);

            return result;
        } catch (error) {
            console.error('Audio encryption failed:', error);
            return audioData; // Return unencrypted on failure
        }
    }

    // Decrypt audio data (simplified)
    async decryptAudioFrame(encryptedData) {
        if (!this.encryptionKey) {
            throw new Error('No encryption key set');
        }

        try {
            // Extract IV and encrypted data
            const iv = encryptedData.slice(0, 12);
            const data = encryptedData.slice(12);

            const decrypted = await crypto.subtle.decrypt(
                {
                    name: 'AES-GCM',
                    iv: iv
                },
                this.encryptionKey,
                data
            );

            return new Uint8Array(decrypted);
        } catch (error) {
            console.error('Audio decryption failed:', error);
            return encryptedData; // Return as-is on failure
        }
    }

    // Compress audio for transmission (simplified)
    compressAudio(audioBuffer) {
        // In a real implementation, this would use proper audio compression
        // For now, just return the buffer
        return audioBuffer;
    }

    // Decompress audio (simplified)
    decompressAudio(compressedBuffer) {
        // In a real implementation, this would decompress the audio
        // For now, just return the buffer
        return compressedBuffer;
    }
}

// Export for use in main app
window.VoiceEncryption = VoiceEncryption;

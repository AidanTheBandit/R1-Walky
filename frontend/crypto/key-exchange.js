// Simple key exchange utility for R1-Walky
// In a real implementation, this would use ECDH with proper crypto APIs

class KeyExchange {
    constructor() {
        this.keyPair = null;
        this.sharedSecret = null;
    }

    // Generate ECDH key pair (simplified for demo)
    async generateKeyPair() {
        try {
            this.keyPair = await crypto.subtle.generateKey(
                {
                    name: 'ECDH',
                    namedCurve: 'P-256'
                },
                true,
                ['deriveKey', 'deriveBits']
            );
            return this.keyPair;
        } catch (error) {
            console.error('Key generation failed:', error);
            // Fallback for browsers without crypto support
            return null;
        }
    }

    // Get public key for sharing
    async getPublicKey() {
        if (!this.keyPair) await this.generateKeyPair();

        try {
            const publicKey = await crypto.subtle.exportKey('spki', this.keyPair.publicKey);
            return btoa(String.fromCharCode(...new Uint8Array(publicKey)));
        } catch (error) {
            console.error('Public key export failed:', error);
            return null;
        }
    }

    // Derive shared secret from peer's public key
    async deriveSharedSecret(peerPublicKey) {
        if (!this.keyPair) await this.generateKeyPair();

        try {
            const peerKeyData = Uint8Array.from(atob(peerPublicKey), c => c.charCodeAt(0));
            const peerPublicKeyImported = await crypto.subtle.importKey(
                'spki',
                peerKeyData,
                {
                    name: 'ECDH',
                    namedCurve: 'P-256'
                },
                false,
                []
            );

            this.sharedSecret = await crypto.subtle.deriveBits(
                {
                    name: 'ECDH',
                    public: peerPublicKeyImported
                },
                this.keyPair.privateKey,
                256
            );

            return this.sharedSecret;
        } catch (error) {
            console.error('Shared secret derivation failed:', error);
            return null;
        }
    }

    // Get encryption key from shared secret
    async getEncryptionKey() {
        if (!this.sharedSecret) {
            throw new Error('No shared secret available');
        }

        try {
            return await crypto.subtle.importKey(
                'raw',
                this.sharedSecret,
                { name: 'AES-GCM' },
                false,
                ['encrypt', 'decrypt']
            );
        } catch (error) {
            console.error('Encryption key derivation failed:', error);
            return null;
        }
    }
}

// Export for use in main app
window.KeyExchange = KeyExchange;

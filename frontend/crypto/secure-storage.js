// Secure storage utility for R1-Walky
// Uses R1's creationStorage API when available

class SecureStorage {
    constructor() {
        this.useSecureStorage = false;
        this.fallbackStorage = new Map();
        this.init();
    }

    init() {
        // Check if R1 creationStorage is available
        if (typeof window !== 'undefined' && window.creationStorage && window.creationStorage.secure) {
            this.useSecureStorage = true;
        }
    }

    // Store data securely
    async setItem(key, value) {
        try {
            if (this.useSecureStorage) {
                await window.creationStorage.secure.setItem(key, value);
            } else {
                // Fallback to localStorage with base64 encoding
                localStorage.setItem(`secure_${key}`, value);
            }
        } catch (error) {
            console.error('Secure storage set failed:', error);
            // Store in memory as last resort
            this.fallbackStorage.set(key, value);
        }
    }

    // Retrieve data securely
    async getItem(key) {
        try {
            if (this.useSecureStorage) {
                return await window.creationStorage.secure.getItem(key);
            } else {
                // Fallback to localStorage
                return localStorage.getItem(`secure_${key}`);
            }
        } catch (error) {
            console.error('Secure storage get failed:', error);
            // Check fallback storage
            return this.fallbackStorage.get(key) || null;
        }
    }

    // Remove data
    async removeItem(key) {
        try {
            if (this.useSecureStorage) {
                await window.creationStorage.secure.removeItem(key);
            } else {
                localStorage.removeItem(`secure_${key}`);
            }
            this.fallbackStorage.delete(key);
        } catch (error) {
            console.error('Secure storage remove failed:', error);
            this.fallbackStorage.delete(key);
        }
    }

    // Clear all data
    async clear() {
        try {
            if (this.useSecureStorage) {
                await window.creationStorage.secure.clear();
            } else {
                // Clear all secure items from localStorage
                const keys = Object.keys(localStorage);
                keys.forEach(key => {
                    if (key.startsWith('secure_')) {
                        localStorage.removeItem(key);
                    }
                });
            }
            this.fallbackStorage.clear();
        } catch (error) {
            console.error('Secure storage clear failed:', error);
            this.fallbackStorage.clear();
        }
    }

    // Store user credentials
    async storeCredentials(username, userId) {
        const credentials = {
            username,
            userId,
            timestamp: Date.now()
        };
        await this.setItem('credentials', btoa(JSON.stringify(credentials)));
    }

    // Retrieve user credentials
    async getCredentials() {
        const data = await this.getItem('credentials');
        if (data) {
            try {
                return JSON.parse(atob(data));
            } catch (error) {
                console.error('Failed to parse credentials:', error);
                return null;
            }
        }
        return null;
    }

    // Store encryption keys (in real app, this would be more secure)
    async storeKeyPair(keyPair) {
        // In a real implementation, only store public key
        // Private key should never be stored persistently
        const keyData = {
            publicKey: keyPair.publicKey ? 'stored' : null,
            timestamp: Date.now()
        };
        await this.setItem('keyPair', btoa(JSON.stringify(keyData)));
    }

    // Check if secure storage is available
    isSecureStorageAvailable() {
        return this.useSecureStorage;
    }
}

// Export for use in main app
window.SecureStorage = SecureStorage;

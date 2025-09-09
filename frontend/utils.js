// Utility functions for SimpleWalky
class Utils {
    constructor(app) {
        this.app = app;
    }

    updateStatus(message) {
        this.app.updateStatus(message);
    }
}

// Create global utils instance
const utils = new Utils(app);

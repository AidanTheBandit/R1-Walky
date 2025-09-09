// Utility functions for SimpleWalky
class Utils {
    constructor(app) {
        this.app = app;
    }

    updateStatus(message) {
        this.app.updateStatus(message);
    }
}

// Handler will be instantiated in app.js

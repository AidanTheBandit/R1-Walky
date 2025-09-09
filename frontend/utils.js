// Utility functions for SimpleWalky
class Utils {
    constructor(app) {
        this.app = app;
    }

    updateStatus(message) {
        this.app.updateStatus(message);
    }

        // XMLHttpRequest wrapper for old browser compatibility
    xhrRequest(url, options = {}, callback) {
        console.log('xhrRequest called with URL:', url);
        
        // Convert relative URLs to absolute
        if (url.startsWith('/')) {
            url = window.location.origin + url;
            console.log('Converted to absolute URL:', url);
        }
        
        if (typeof callback === 'function' || typeof Promise === 'undefined') {
            // Callback-based approach for very old browsers
            console.log('Using callback-based XMLHttpRequest');
            const xhr = new XMLHttpRequest();
            xhr.open(options.method || 'GET', url, true);
            
            // Set headers - compatible with old browsers
            if (options.headers) {
                for (var key in options.headers) {
                    if (options.headers.hasOwnProperty(key)) {
                        xhr.setRequestHeader(key, options.headers[key]);
                    }
                }
            }
            
            xhr.onload = () => {
                console.log('XMLHttpRequest onload, status:', xhr.status);
                const response = {
                    ok: xhr.status >= 200 && xhr.status < 300,
                    status: xhr.status,
                    json: () => {
                        try {
                            return JSON.parse(xhr.responseText || '{}');
                        } catch (e) {
                            throw new Error('Invalid JSON response');
                        }
                    }
                };
                if (typeof callback === 'function') {
                    callback(null, response);
                } else {
                    // For browsers without Promise, return the response directly
                    return response;
                }
            };
            
            xhr.onerror = () => {
                console.log('XMLHttpRequest onerror');
                if (typeof callback === 'function') {
                    callback(new Error('Network error'));
                }
            };
            xhr.ontimeout = () => {
                console.log('XMLHttpRequest ontimeout');
                if (typeof callback === 'function') {
                    callback(new Error('Request timeout'));
                }
            };
            xhr.timeout = 10000; // 10 second timeout
            
            if (options.body) {
                xhr.send(options.body);
            } else {
                xhr.send();
            }
            
            // For browsers without Promise, return undefined and handle in onload
            if (typeof Promise === 'undefined') {
                return;
            }
        } else {
            // Promise-based approach for modern browsers
            console.log('Using Promise-based XMLHttpRequest');
            return new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.open(options.method || 'GET', url, true);
                
                // Set headers - compatible with old browsers
                if (options.headers) {
                    for (var key in options.headers) {
                        if (options.headers.hasOwnProperty(key)) {
                            xhr.setRequestHeader(key, options.headers[key]);
                        }
                    }
                }
                
                xhr.onload = () => {
                    console.log('XMLHttpRequest onload, status:', xhr.status);
                    const response = {
                        ok: xhr.status >= 200 && xhr.status < 300,
                        status: xhr.status,
                        json: () => {
                            try {
                                return Promise.resolve(JSON.parse(xhr.responseText || '{}'));
                            } catch (e) {
                                return Promise.reject(new Error('Invalid JSON response'));
                            }
                        }
                    };
                    resolve(response);
                };
                
                xhr.onerror = () => {
                    console.log('XMLHttpRequest onerror');
                    reject(new Error('Network error'));
                };
                xhr.ontimeout = () => {
                    console.log('XMLHttpRequest ontimeout');
                    reject(new Error('Request timeout'));
                };
                xhr.timeout = 10000; // 10 second timeout
                
                if (options.body) {
                    xhr.send(options.body);
                } else {
                    xhr.send();
                }
            });
        }
    }
}

// Handler will be instantiated in app.js

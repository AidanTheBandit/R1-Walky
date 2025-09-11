// Simple XMLHttpRequest utility for old browsers
export const makeXMLHttpRequest = (url, options = {}) => {
  console.log('R1-Walky Debug: Making XMLHttpRequest to:', url);

  // Convert relative URLs to absolute for old browsers
  if (url.startsWith('/')) {
    url = window.location.protocol + '//' + window.location.host + url;
    console.log('R1-Walky Debug: Converted to absolute URL:', url);
  }

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

    xhr.onload = function() {
      console.log('R1-Walky Debug: XMLHttpRequest onload triggered with status:', xhr.status);
      console.log('R1-Walky Debug: XMLHttpRequest response text:', xhr.responseText);
      console.log('R1-Walky Debug: XMLHttpRequest readyState:', xhr.readyState);
      console.log('R1-Walky Debug: XMLHttpRequest statusText:', xhr.statusText);
      const response = {
        ok: xhr.status >= 200 && xhr.status < 300,
        status: xhr.status,
        json: function() {
          try {
            const parsed = JSON.parse(xhr.responseText || '{}');
            console.log('R1-Walky Debug: XMLHttpRequest parsed response:', JSON.stringify(parsed));
            return Promise.resolve(parsed);
          } catch (e) {
            console.log('R1-Walky Debug: XMLHttpRequest JSON parse error:', e.message);
            console.log('R1-Walky Debug: XMLHttpRequest raw response text:', xhr.responseText);
            return Promise.reject(new Error('Invalid JSON response'));
          }
        }
      };
      console.log('R1-Walky Debug: XMLHttpRequest response object created: ok=', response.ok, ', status=', response.status);
      resolve(response);
    };

    xhr.onerror = function() {
      console.log('R1-Walky Debug: XMLHttpRequest onerror triggered');
      console.log('R1-Walky Debug: XMLHttpRequest error details: readyState=', xhr.readyState, ', status=', xhr.status, ', statusText=', xhr.statusText);
      reject(new Error('Network error'));
    };

    xhr.timeout = 10000;
    xhr.ontimeout = function() {
      console.log('R1-Walky Debug: XMLHttpRequest ontimeout triggered');
      console.log('R1-Walky Debug: XMLHttpRequest timeout details: readyState=', xhr.readyState, ', status=', xhr.status);
      reject(new Error('Request timeout'));
    };

    xhr.onabort = function() {
      console.log('R1-Walky Debug: XMLHttpRequest onabort triggered');
      reject(new Error('Request aborted'));
    };

    if (options.body) {
      xhr.send(options.body);
    } else {
      xhr.send();
    }
  });
};

// Debug logging function
export const addDebugLog = (message, type = 'info') => {
  const timestamp = new Date().toLocaleTimeString();
  const logEntry = `[${timestamp}] ${type.toUpperCase()}: ${message}`;
  console.log(logEntry);
  return logEntry;
};

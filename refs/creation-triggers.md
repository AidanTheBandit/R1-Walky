# R1 Creations SDK
This document describes how to build an r1 creation that integrates with the unique features of the r1 and rabbitos.

At a high level:
- we have access to the scroll wheel and PTT button
- we can read the accellerometer raw values and a simplified version that measures tilt
- we can read and write to secure and insecure storage
- we can use standard mobile web technologies to access the microphone, camera, and speaker
- we can send messages to the llm that powers the r1
- we can receive responses from the llm that powers the r1

## Critical Design Considerations
- All creations MUST fit neatly within a 240x282px portrait screen
- The r1 hardware is very limited; please write optimized code.
  - Use hardware-accelerated CSS properties (`transform`, `opacity`)
  - Minimize DOM operations
  - Limit particle effects
  - Use CSS transitions instead of JavaScript animations

## JavaScript Channels Available to Plugins

### 1. PluginMessageHandler
Send structured plugin messages to the server. The `pluginId` is automatically injected/overridden by the system to prevent spoofing.

```javascript
// Send a structured message to the server
PluginMessageHandler.postMessage(JSON.stringify({
  message: "Hello from my r1 creation",
  }
}));
```

You can also request that the remote server provide an LLM generated response by setting `useLLM` to `true`.
- When `useLLM` is set to `true`, you can use additional flags:
  - `wantsR1Response` : Whether or not the LLM will speak its response through the r1 device speaker. Default: false
  - `wantsJournalEntry`: Whether or not we should log this request to the journal. Default: false

```javascript
// Have the LLM generate a JSON response. You will receive it via window.onPluginMessage().
// The JSON response will be in pluginMessage.data
PluginMessageHandler.postMessage(JSON.stringify({
  message: "Hello, tell me what you know about me. Return only a JSON message formatted as {'facts': ['you like...','...']}",
  useLLM: true
  }

// Have the llm use the r1 speaker to tell you its memories of you
// Does NOT save the interaction to the journal
PluginMessageHandler.postMessage(JSON.stringify({
  message: "Hello, tell me what you know about me.",
  useLLM: true,
  wantsR1Response: true
  }
}))

// Have the llm use the r1 speaker to tell you its memories of you
// Saves the interaction to the journal
PluginMessageHandler.postMessage(JSON.stringify({
  message: "Hello, tell me what you know about me.",
  useLLM: true,
  wantsR1Response: true,
  wantsJournalEntry: true
  }
})
```

### 2. closeWebView
Close the current WebView and return to the home screen. (useful if the webapp has a quit button)

```javascript
// Close the plugin
closeWebView.postMessage("");
```

### 3. TouchEventHandler
Simulate touch events on the device (useful for automation or accessibility).

```javascript
// Simulate a tap at coordinates
TouchEventHandler.postMessage(JSON.stringify({
  type: "tap",
  x: 100,
  y: 200
}));

// Simulate other touch events
TouchEventHandler.postMessage(JSON.stringify({
  type: "down",  // or "up", "move", "cancel"
  x: 100,
  y: 200
}));
```

### 4. CreationStorageHandler
Persistent storage API for plugins with both plain and secure storage options.

```javascript
// Storage API is injected as window.creationStorage

// Plain storage (unencrypted)
await window.creationStorage.plain.setItem('user_prefs', btoa(JSON.stringify({theme: 'dark'})));
const prefs = JSON.parse(atob(await window.creationStorage.plain.getItem('user_prefs')));
await window.creationStorage.plain.removeItem('user_prefs');
await window.creationStorage.plain.clear();

// Secure storage (hardware-encrypted, Android M+)
await window.creationStorage.secure.setItem('api_key', btoa('secret_key_123'));
const apiKey = atob(await window.creationStorage.secure.getItem('api_key'));
await window.creationStorage.secure.removeItem('api_key');
await window.creationStorage.secure.clear();
```

**Notes:**
- All data must be Base64 encoded before storage
- Storage is isolated per plugin ID
- Secure storage requires Android M or higher
- Returns `null` if item doesn't exist

### 5. AccelerometerHandler
Access real-time accelerometer data from the device.

```javascript
// Accelerometer API is injected as window.creationSensors

// Check if accelerometer is available
const isAvailable = await window.creationSensors.accelerometer.isAvailable();

// Start receiving accelerometer data
window.creationSensors.accelerometer.start((data) => {
  console.log('Accelerometer data:', data);
  // data = { x: 0.1, y: -0.2, z: 0.98 }
  // Values are normalized (-1 to 1):
  // x: positive = tilt right, negative = tilt left
  // y: positive = tilt forward, negative = tilt back
  // z: positive = facing up, negative = facing down
}, { frequency: 60 }); // Optional: specify sampling frequency in Hz

// Stop receiving accelerometer data
window.creationSensors.accelerometer.stop();
```

## Hardware Button Events

Plugins have access to the side button (also know as PTT, sideclick) and scroll wheel.
### Side Button (PTT) Events
```javascript
// Single click
window.addEventListener("sideClick", () => {
  console.log("Side button clicked");
});

// Long press start
window.addEventListener("longPressStart", () => {
  console.log("Side button long press started");
});

// Long press end  
window.addEventListener("longPressEnd", () => {
  console.log("Side button long press ended");
});

// Note: Double click triggers two sideClick events ~50ms apart
```

### Scroll Wheel Events
```javascript
// Scroll up
window.addEventListener("scrollUp", () => {
  console.log("Scroll wheel up");
});

// Scroll down
window.addEventListener("scrollDown", () => {
  console.log("Scroll wheel down");
});
```
## Receiving Messages from Server

Plugins can receive messages from the server by implementing:

```javascript
window.onPluginMessage = function(data) {
  console.log("Received message from server:", data);
  // data contains the entire pluginMessage object including:
  // - message: string description
  // - pluginId: the target plugin ID
  // - data: (optional) json string containing response data
  
  // Parse data.data if it contains valid JSON
  if (data.data) {
    try {
      const parsedData = JSON.parse(data.data);
      console.log("Parsed data:", parsedData);
      // Use the parsed data (e.g., LLM responses)
      
      // Handle specific actions from parsed data
      if (parsedData.action === "updateContent") {
        document.getElementById("content").innerHTML = parsedData.content;
      }
    } catch (e) {
      // data.data is not valid JSON, use as plain string
      console.log("Plain string data:", data.data);
    }
  }
};
```
# R1-Walky: P2P Walkie Talkie for Rabbit R1

Always reference these instructions first and fallback to search or bash commands only when you encounter unexpected information that does not match the info here.

## Working Effectively

### Bootstrap and Setup
- Install dependencies and build the application:
  - `cd /home/runner/work/R1-Walky/R1-Walky/backend && npm install` -- takes 8-10 seconds
  - `cd /home/runner/work/R1-Walky/R1-Walky/frontend-new && npm install` -- takes 10-12 seconds
  - `cd /home/runner/work/R1-Walky/R1-Walky/frontend-new && npm run build` -- takes 6-7 seconds
- **NEVER CANCEL build operations** - All build commands complete in under 15 seconds
- **Alternative**: `cd /home/runner/work/R1-Walky/R1-Walky && npm run build` (orchestration script)

### Running the Application
- **Backend server**: `cd /home/runner/work/R1-Walky/R1-Walky/backend && npm start`
  - Starts immediately (under 2 seconds)
  - Runs on port 3000
  - Provides health check at `http://localhost:3000/health`
  - Provides test endpoint at `http://localhost:3000/api/test`
- **Frontend dev server**: `cd /home/runner/work/R1-Walky/R1-Walky/frontend-new && npm run dev`
  - Starts in under 1 second
  - Runs on port 5173
  - **REQUIRES backend running** for full functionality
- **Complete setup**: `cd /home/runner/work/R1-Walky/R1-Walky/backend && npm run full-setup`
  - Builds frontend + starts backend in one command
  - Takes 8-10 seconds total

### Build and Test Commands
- **Frontend build**: `cd /home/runner/work/R1-Walky/R1-Walky/frontend-new && npm run build` -- 6-7 seconds
- **Frontend lint**: `cd /home/runner/work/R1-Walky/R1-Walky/frontend-new && npm run lint` -- 3-4 seconds (expect many errors in development)
- **Preview build**: `cd /home/runner/work/R1-Walky/R1-Walky/frontend-new && npm run preview`
- **Root orchestration**: `cd /home/runner/work/R1-Walky/R1-Walky && npm run dev` (starts frontend only)

## Validation

### Manual Testing Workflow
1. **ALWAYS test the complete application workflow after making changes**
2. Start both backend and frontend servers
3. Navigate to `http://localhost:5173`
4. Enter a unique callsign (e.g., `TestUser123`) and click JOIN
5. Verify login success and main screen appears
6. Test CONTACTS functionality (add/search contacts)
7. Test CONFIG screen (view settings)
8. Verify WebSocket connection works (check console logs)

### Required Health Checks
- Backend health: `curl -s http://localhost:3000/health` should return 200 OK
- Backend API: `curl -s http://localhost:3000/api/test` should return backend connectivity message
- Frontend accessibility: `curl -s -I http://localhost:5173` should return 200 OK

### Known Issues and Workarounds
- Frontend dev server shows proxy errors when backend is not running - this is expected
- ESLint shows 44+ errors in development build - this is current state, not a failure
- Some npm audit vulnerabilities exist (3 vulnerabilities: 1 low, 2 moderate) - acceptable for development

## Application Architecture

### Technology Stack
- **Backend**: Node.js, Express.js, SQLite3, Socket.io, CORS
- **Frontend**: React 18, Vite, Socket.io-client, ESLint  
- **Build System**: Vite with React and legacy browser support
- **Database**: SQLite with automatic initialization

### Project Structure
```
R1-Walky/
├── package.json              # Root orchestration scripts
├── backend/                  # Node.js Express server
│   ├── package.json          # Backend dependencies & scripts  
│   ├── server.js             # Main server file
│   ├── src/                  # Backend source code
│   └── walkie_talkie.db      # SQLite database (auto-created)
├── frontend-new/             # React application (Vite)
│   ├── package.json          # Frontend dependencies & scripts
│   ├── src/                  # React components and utilities
│   ├── dist/                 # Build output (after npm run build)
│   └── vite.config.js        # Vite configuration
├── frontend-react/           # Alternative/legacy frontend
└── refs/                     # R1 device SDK documentation
    ├── creation-triggers.md  # R1 Creations SDK docs
    ├── data.js               # LLM integration example
    ├── hardware.js           # Hardware access example
    └── speak.js              # Text-to-speech example
```

### Key Components
- **Backend API**: RESTful endpoints for user management, friends, calls
- **WebSocket Service**: Real-time communication via Socket.io
- **React Frontend**: Optimized for R1 device (240x282px screen)
- **WebRTC Integration**: P2P audio communication capabilities
- **Hardware Integration**: R1-specific features (PTT button, scroll wheel)

## R1 Device Specifications

### Critical Design Constraints
- **Screen Size**: 240x282px portrait orientation - ALL UI must fit within these dimensions
- **Hardware Buttons**: PTT (Push-to-Talk), scroll wheel, side buttons
- **Performance**: Limited hardware - optimize all code for performance
- **Device Verification**: FF4D06 hex identifier required for authentic R1 devices

### Hardware APIs Available
```javascript
// Button Events
window.addEventListener("sideClick", () => { /* Single click */ });
window.addEventListener("longPressStart", () => { /* Start talking */ });
window.addEventListener("longPressEnd", () => { /* Stop talking */ });
window.addEventListener("scrollUp", () => { /* Navigate up */ });
window.addEventListener("scrollDown", () => { /* Navigate down */ });

// Storage APIs
await window.creationStorage.plain.setItem('key', btoa(JSON.stringify(data)));
await window.creationStorage.secure.setItem('key', btoa(sensitiveData));

// LLM Integration
PluginMessageHandler.postMessage(JSON.stringify({
  message: "Hello from my r1 creation",
  useLLM: true,
  wantsR1Response: false
}));
```

## Development Workflow

### Making Changes
1. **Always start by running the existing application** to understand current functionality
2. **Backend changes**: Restart `npm start` in backend directory
3. **Frontend changes**: Vite hot-reload updates automatically during `npm run dev`
4. **Full rebuild**: Use `npm run build` then restart servers

### Testing Changes
- **CRITICAL**: Always test the complete user flow after any changes
- Start with health checks (`curl` commands above)
- Test login workflow with new callsign
- Verify all screens load correctly (main, contacts, config)
- Check browser console for errors or warnings

### Code Style
- **Frontend**: React functional components, hooks, ESLint configuration
- **Backend**: Express.js REST API patterns, async/await
- **Database**: SQLite with automatic table initialization
- **Error Handling**: Console logging for debugging, user-friendly error messages

## Common Tasks

### Adding New API Endpoints
1. Add route handler in `backend/src/routes/`
2. Import and use in `backend/server.js`
3. Test with curl: `curl -X POST http://localhost:3000/api/your-endpoint -H "Content-Type: application/json" -d '{"test": true}'`

### Frontend Component Changes
1. Edit files in `frontend-new/src/components/`
2. Save and verify hot-reload works in browser
3. Check console for React warnings or errors
4. Test all interactive elements

### Database Schema Changes
1. Modify table creation in `backend/src/config/database.js`
2. Delete `backend/walkie_talkie.db` to force recreation
3. Restart backend server to reinitialize

## Deployment Notes

- **Production Build**: `npm run build` creates optimized assets in `frontend-new/dist/`
- **Static Serving**: Backend can serve static files from dist directory
- **Environment**: Node.js 20.19.5, npm 10.8.2 (confirmed working versions)
- **Database**: SQLite file created automatically on first run
- **Ports**: Backend:3000, Frontend-dev:5173 (configurable in respective package.json)

## Troubleshooting

### Build Failures
- **npm install fails**: Check network connectivity, try `npm cache clean --force`
- **Vite build fails**: Check for syntax errors in React components
- **Server won't start**: Verify port 3000 is available, check for missing dependencies

### Runtime Issues  
- **Frontend proxy errors**: Ensure backend is running on port 3000
- **Login fails**: Check backend logs, verify API endpoints are accessible
- **WebSocket errors**: Confirm Socket.io connection, check network configuration

### Performance Issues
- **Slow loading**: Check bundle size with `npm run build`, optimize imports
- **High memory usage**: Minimize DOM operations, use React.memo for expensive components
- **Battery drain**: Optimize WebRTC connections, reduce background processing

---

**Always validate that your changes work by running through the complete application workflow. The application is designed for R1 devices with specific hardware constraints - respect the 240x282px screen limitation and optimize for performance.**
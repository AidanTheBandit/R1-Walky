# R1-Walky

A peer-to-peer walkie talkie application designed specifically for the Rabbit R1 device, enabling instant voice communication between R1 users.

## What is R1-Walky?

R1-Walky transforms your Rabbit R1 into a powerful walkie talkie, allowing you to communicate with other R1 users through encrypted voice channels. Built specifically for the R1's unique hardware features (PTT button, scroll wheel, 240x282px screen), it provides a seamless push-to-talk experience optimized for the device.

## Key Features

- **Push-to-Talk Communication**: Use the R1's PTT button for natural walkie talkie operation
- **Friends System**: Add friends by username for easy communication
- **Real-time Audio**: High-quality peer-to-peer voice communication using WebRTC
- **R1 Optimized**: Purpose-built for the R1's 240x282px screen and hardware
- **Hardware Integration**: Full support for scroll wheel navigation and physical buttons
- **Cross-Device**: Connect with other R1 users anywhere

## How It Works

1. **Launch** the app on your R1 device
2. **Create account** with a unique username
3. **Add friends** by searching for their usernames
4. **Start a call** by selecting a friend from your list
5. **Hold PTT button** to speak, release to listen
6. **Navigate** using the scroll wheel and touch interface

## Project Structure

```
R1-Walky/
├── frontend-new/          # React frontend optimized for R1
├── backend/              # Node.js/Express API server
├── refs/                 # R1 SDK reference implementations
└── README.md            # This file
```

## Quick Start

### Prerequisites
- Node.js 18+
- Rabbit R1 device for testing

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/AidanTheBandit/R1-Walky.git
   cd R1-Walky
   ```

2. **Install dependencies**
   ```bash
   # Backend
   cd backend
   npm install
   
   # Frontend
   cd ../frontend-new
   npm install
   ```

3. **Start the backend server**
   ```bash
   cd backend
   npm start
   ```
   Server runs on `http://localhost:3000`

4. **Start the frontend development server**
   ```bash
   cd frontend-new
   npm run dev
   ```
   Frontend runs on `http://localhost:5173`

5. **Build for production**
   ```bash
   cd frontend-new
   npm run build
   ```

### Alternative Quick Start
Use the root package.json scripts:
```bash
npm run dev      # Start frontend dev server
npm run build    # Build frontend
npm run start    # Start backend
```

## Development

### Frontend (React)
- **Framework**: React 18 with Vite
- **Styling**: CSS optimized for 240x282px display
- **WebRTC**: Real-time peer-to-peer audio communication
- **Socket.io**: Real-time signaling and presence

### Backend (Node.js)
- **Framework**: Express.js
- **Database**: SQLite for simplicity
- **Real-time**: Socket.io for WebRTC signaling
- **CORS**: Enabled for cross-origin requests

### R1 Integration
The app leverages R1-specific APIs documented in `/refs/`:
- **Hardware Events**: PTT button, scroll wheel
- **Screen Optimization**: 240x282px portrait layout
- **Storage**: R1 secure and plain storage APIs
- **Audio**: Microphone and speaker access

## API Endpoints

### User Management
- `POST /api/users` - Create user account
- `GET /api/users/:username` - Get user profile
- `GET /api/users` - Search users

### Friends System
- `POST /api/friends` - Add friend
- `GET /api/friends/:userId` - Get user's friends
- `DELETE /api/friends/:friendshipId` - Remove friend

### Calls & Signaling
- Real-time WebRTC signaling via Socket.io
- Automatic peer connection management
- Call status and presence updates

## Hardware Integration

### PTT Button
```javascript
// Listen for PTT events
window.addEventListener("longPressStart", () => {
  // Start transmitting
});
window.addEventListener("longPressEnd", () => {
  // Stop transmitting
});
```

### Scroll Wheel Navigation
```javascript
// Navigate through friends list
window.addEventListener("scrollUp", () => {
  // Move selection up
});
window.addEventListener("scrollDown", () => {
  // Move selection down
});
```

## Technology Stack

- **Frontend**: React, Vite, Socket.io-client, WebRTC
- **Backend**: Node.js, Express, Socket.io, SQLite
- **Build**: Vite with legacy browser support
- **Communication**: WebRTC for P2P audio, Socket.io for signaling

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test on R1 hardware
5. Submit a pull request

## Development Notes

- Always test on actual R1 hardware - the 240x282px constraint is critical
- Use the hardware scroll wheel for navigation whenever possible
- Keep bundle sizes small for optimal R1 performance
- Follow the existing UI patterns for consistency

## License

MIT License - See LICENSE file for details

## Support

- **Issues**: [GitHub Issues](https://github.com/AidanTheBandit/R1-Walky/issues)
- **Discord**: Join our community for real-time support

---

Built with ❤️ for the Rabbit R1 community

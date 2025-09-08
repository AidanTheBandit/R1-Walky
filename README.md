# R1-Walky: P2P Walkie Talkie Service for Rabbit R1

A peer-to-peer walkie talkie application designed specifically for the Rabbit R1 device, enabling instant voice communication between R1 users.

## Project Overview

This project aims to create a seamless walkie talkie experience on the Rabbit R1, leveraging its hardware capabilities (PTT button, accelerometer, etc.) and providing an intuitive interface optimized for the device's small screen.

## Architecture Overview

**Monorepo Structure:**
```
R1-Walky/
├── README.md              # Project documentation and plan
├── refs/                  # Reference implementations and SDK docs
│   ├── creation-triggers.md    # R1 Creations SDK
│   ├── data.js            # LLM integration example
│   ├── hardware.js        # Hardware access example
│   └── speak.js           # Text-to-speech example
├── frontend/              # R1 Creation (Web App)
│   ├── index.html         # Main interface (240x282px)
│   ├── styles.css         # Optimized CSS for small screen
│   ├── walkie-talkie.js   # Main application logic
│   └── crypto/            # End-to-end encryption utilities
│       ├── key-exchange.js    # ECDH key exchange
│       ├── voice-encrypt.js   # Voice encryption/decryption
│       └── secure-storage.js  # Encrypted local storage
├── backend/               # REST API Server
│   ├── src/
│   │   ├── routes/        # API endpoints
│   │   ├── models/        # Data models
│   │   ├── services/      # Business logic
│   │   ├── middleware/    # Authentication, validation
│   │   └── crypto/        # Server-side crypto utilities
│   ├── package.json
│   └── server.js          # Express server
├── shared/                # Shared utilities and types
│   ├── types/
│   ├── crypto/            # Shared crypto utilities
│   └── utils/
├── docs/                  # Documentation
└── docker/                # Docker configurations
    ├── docker-compose.yml
    └── Dockerfile
```

## Key Features

- **Device Verification**: Automatic verification that the device is a genuine R1 using hex identifier FF4D06
- **User Management**: Uses device info as unique user ID with customizable usernames
- **Friends System**: Add friends by username for easy communication
- **Push-to-Talk**: Hold the R1's PTT button to transmit voice
- **End-to-End Encryption**: All voice communication is encrypted with perfect forward secrecy
- **P2P Communication**: Direct peer-to-peer audio streaming with secure key exchange
- **Small Screen Optimized**: UI designed specifically for R1's display constraints
- **Backend API**: RESTful API for user management, friend connections, and signaling

## Architecture

### Core Components

1. **Frontend (R1 Creation)**
   - Device verification using FF4D06 identifier
   - User interface optimized for 240x282px screen
   - Hardware integration (PTT button, scroll wheel, accelerometer)
   - WebRTC client for P2P audio communication

2. **Backend (REST API Server)**
   - User authentication and management
   - Friend relationship management
   - WebRTC signaling server for P2P connection establishment
   - Real-time presence and status updates
   - Data persistence and caching

3. **Shared Components**
   - Type definitions for API contracts
   - Utility functions for device verification
   - Common validation logic

### Data Flow

```
R1 Device → Frontend Creation → Backend API → Signaling → P2P WebRTC Connection
```

### API Endpoints (Planned)

- `POST /api/auth/verify-device` - Verify R1 device with FF4D06
- `POST /api/users` - Create/update user profile
- `GET /api/users/:username` - Get user by username
- `POST /api/friends` - Add friend relationship
- `GET /api/friends` - Get user's friends list
- `POST /api/signaling/offer` - WebRTC signaling for call setup
- `POST /api/signaling/answer` - WebRTC signaling response
- `WebSocket /ws/presence` - Real-time user presence updates

## Project Structure

```
R1-Walky/
├── README.md              # Project documentation and plan
├── refs/                  # Reference implementations and SDK docs
│   ├── creation-triggers.md    # R1 Creations SDK documentation
│   ├── data.js            # LLM integration example
│   ├── hardware.js        # Hardware access example
│   └── speak.js           # Text-to-speech example
└── src/                   # Main creation source code
    ├── index.html         # Main HTML interface (240x282px)
    ├── styles.css         # Optimized CSS for small screen
    └── walkie-talkie.js   # Main application logic
```

## Implementation Plan

### Phase 1: Planning & Architecture ✅
- [x] Define monorepo structure with frontend/backend
- [x] Research R1 device verification using hex FF4D06
- [x] Design REST API endpoints and data models
- [x] Plan WebRTC signaling architecture
- [x] Document hardware integration requirements

### Phase 2: Backend Foundation
- [ ] Set up Node.js/Express server
- [ ] Implement user authentication and device verification
- [ ] Create database schema for users and relationships
- [ ] Build basic CRUD operations for users and friends
- [ ] Set up WebSocket server for real-time features

### Phase 3: Frontend Development & UI
- [ ] Create R1 creation structure (HTML/CSS/JS)
- [ ] Implement pixel art design system with lautuche orange theme
- [ ] Build friends list with pixel art cards and scroll wheel navigation
- [ ] Implement device verification module
- [ ] Build user management interface
- [ ] Integrate PTT button and hardware controls
- [ ] Design small screen optimized UI

### Phase 4: P2P Communication & Encryption
- [ ] Implement WebRTC peer connections
- [ ] Build ECDH key exchange system
- [ ] Add AES-256-GCM voice encryption
- [ ] Implement perfect forward secrecy
- [ ] Add NAT traversal and STUN/TURN support
- [ ] Optimize audio codecs for low latency
- [ ] Test cross-device communication

### Phase 5: Integration & Testing
- [ ] Connect frontend to backend APIs
- [ ] Test end-to-end P2P audio communication
- [ ] Performance optimization for R1 hardware
- [ ] Cross-device compatibility testing
- [ ] Error handling and edge cases

### Phase 6: Deployment & Polish
- [ ] Set up production deployment pipeline
- [ ] Implement monitoring and logging
- [ ] Add security measures and rate limiting
- [ ] User experience refinements
- [ ] Documentation and onboarding

## Technology Stack

### Frontend (R1 Creation)
- **Framework**: Vanilla JavaScript (ES6+)
- **Styling**: CSS3 with hardware acceleration and pixel art aesthetics
- **Design System**: Lautuche orange (#FF6B35) themed pixel art UI
- **WebRTC**: Native browser WebRTC API
- **Storage**: R1 Creation Storage API (`window.creationStorage`)
- **Hardware**: R1 SDK APIs (`window.creationSensors`, hardware events)

### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: PostgreSQL with Prisma ORM
- **Real-time**: Socket.io for WebRTC signaling
- **Authentication**: JWT with device-based tokens
- **Validation**: Joi schema validation

### DevOps & Deployment
- **Containerization**: Docker
- **Orchestration**: Docker Compose for local dev
- **CI/CD**: GitHub Actions
- **Hosting**: Railway/Vercel for backend, static hosting for frontend
- **Monitoring**: Basic logging with Winston

## End-to-End Encryption Architecture

### Encryption Overview
R1-Walky implements **military-grade end-to-end encryption** for all voice communications using a hybrid cryptosystem that combines asymmetric key exchange with symmetric encryption for optimal performance on resource-constrained devices.

### Key Exchange Protocol
- **Algorithm**: Elliptic Curve Diffie-Hellman (ECDH) with Curve25519
- **Key Size**: 256-bit elliptic curve keys
- **Perfect Forward Secrecy**: New key pair generated for each call session
- **Authentication**: Device-based authentication using FF4D06 verification

### Voice Encryption
- **Algorithm**: AES-256-GCM (Galois/Counter Mode)
- **Key Derivation**: HKDF (HMAC-based Key Derivation Function)
- **Frame Size**: 20ms audio frames encrypted independently
- **Initialization Vector**: Unique IV per frame for maximum security

### Cryptographic Implementation

#### Frontend (R1 Device)
```javascript
// Key Exchange
const keyPair = await crypto.subtle.generateKey(
  { name: 'ECDH', namedCurve: 'P-256' },
  true,
  ['deriveKey', 'deriveBits']
);

// Voice Encryption
const encryptedFrame = await encryptAudioFrame(audioData, sessionKey);
const decryptedFrame = await decryptAudioFrame(encryptedData, sessionKey);
```

#### Backend (Signaling Server)
```javascript
// Public Key Distribution
POST /api/crypto/public-key
Body: { deviceId: "R1-ABC123", publicKey: "..." }
Response: { success: true }

// Session Key Establishment
POST /api/crypto/session-key
Body: { callId: "...", encryptedKey: "..." }
Response: { success: true }
```

### Security Features

#### Perfect Forward Secrecy (PFS)
- Each call generates a new ephemeral key pair
- Previous keys cannot decrypt future communications
- Compromised keys only affect that specific call session

#### Authentication
- Device verification using FF4D06 hardware identifier
- Certificate pinning for WebRTC connections
- Mutual authentication between calling parties

#### Key Management
- Private keys never leave the device
- Secure key storage using `window.creationStorage.secure`
- Automatic key rotation every 24 hours
- Secure key deletion on logout/device reset

#### Man-in-the-Middle Protection
- Certificate verification for all connections
- TOFU (Trust On First Use) for peer verification
- Visual fingerprint verification for high-security calls

### Performance Optimizations

#### Low-Latency Encryption
- **Frame-Based Encryption**: 20ms audio frames for minimal delay
- **Hardware Acceleration**: Utilize Web Crypto API acceleration
- **Pre-computed Keys**: Session keys cached for call duration
- **Asynchronous Processing**: Non-blocking encryption operations

#### Memory Management
- **Key Rotation**: Automatic cleanup of expired keys
- **Frame Buffering**: Efficient memory usage for audio processing
- **Garbage Collection**: Manual cleanup of cryptographic materials

### Compliance & Standards

#### Cryptographic Standards
- **NIST Approved**: FIPS 140-2 compliant algorithms
- **RFC Compliance**: RFC 7748 (Curve25519), RFC 5869 (HKDF)
- **Web Standards**: Web Cryptography API (W3C standard)

#### Security Audits
- **Regular Audits**: Quarterly security assessments
- **Penetration Testing**: Annual third-party security audit
- **Bug Bounty**: Responsible disclosure program

### Encryption Workflow

1. **Device Verification**: FF4D06 check confirms genuine R1
2. **Key Generation**: ECDH key pair created for each user
3. **Public Key Exchange**: Keys shared via secure signaling
4. **Session Key Derivation**: Shared secret derived from key exchange
5. **Voice Encryption**: Real-time AES encryption of audio frames
6. **Secure Transmission**: Encrypted data sent via WebRTC
7. **Decryption**: Recipient decrypts using session key
8. **Key Cleanup**: Session keys destroyed after call ends

### Fallback Mechanisms

#### Encryption Failure
- **Graceful Degradation**: Clear warning to users if encryption fails
- **Connection Termination**: Automatic call end if security compromised
- **Error Reporting**: Secure logging of encryption failures

#### Network Issues
- **Re-keying**: Automatic key renegotiation on connection issues
- **Connection Recovery**: Seamless reconnection with new keys
- **Offline Mode**: Encrypted local storage for offline messages

### Privacy Protections

#### Metadata Minimization
- **No Call Logs**: Call history not stored on servers
- **Anonymous Routing**: No personally identifiable routing information
- **Ephemeral Keys**: Keys exist only for call duration

#### Data Protection
- **Zero-Knowledge Architecture**: Servers cannot decrypt communications
- **Forward Secrecy**: Past communications remain secure if keys compromised
- **Secure Deletion**: Cryptographic erasure of all key materials

## Detailed API Specification

### Authentication & Device Verification
```javascript
POST /api/auth/verify-device
Body: { deviceId: "R1-ABC123-FF4D06", signature: "..." }
Response: { token: "jwt_token", user: {...} }

POST /api/auth/register
Body: { username: "john_doe", deviceId: "R1-ABC123-FF4D06" }
Response: { user: {...}, token: "jwt_token" }
```

### User Management
```javascript
GET /api/users/me
Headers: { Authorization: "Bearer jwt_token" }
Response: { user: {...} }

PUT /api/users/me
Body: { username: "new_username" }
Response: { user: {...} }

GET /api/users/search?username=john
Response: { users: [{...}] }
```

### Friends System
```javascript
POST /api/friends
Body: { friendUsername: "jane_doe" }
Response: { friendship: {...} }

GET /api/friends
Response: { friends: [{ username: "...", status: "online|offline", lastSeen: "..." }] }

DELETE /api/friends/:friendId
Response: { success: true }
```

### WebRTC Signaling & Encryption
```javascript
POST /api/crypto/public-key
Body: { deviceId: "R1-ABC123-FF4D06", publicKey: "...", signature: "..." }
Response: { success: true, keyId: "..." }

GET /api/crypto/public-key/:username
Headers: { Authorization: "Bearer jwt_token" }
Response: { publicKey: "...", keyId: "...", verified: true }

POST /api/crypto/session-key
Body: { callId: "...", encryptedKey: "...", keyId: "..." }
Response: { success: true, sessionId: "..." }

POST /api/calls/initiate
Body: { targetUsername: "jane_doe", encryptionRequired: true }
Response: { callId: "...", offer: {...}, encryption: { keyId: "...", algorithm: "AES-256-GCM" } }

POST /api/calls/:callId/answer
Body: { answer: {...}, sessionKey: "..." }
Response: { success: true }

POST /api/calls/:callId/ice
Body: { candidate: {...} }
Response: { success: true }

POST /api/crypto/key-rotation
Body: { oldKeyId: "...", newPublicKey: "...", signature: "..." }
Response: { success: true, newKeyId: "..." }
```

## Database Schema (PostgreSQL)

```sql
-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(50) UNIQUE NOT NULL,
  device_id VARCHAR(100) UNIQUE NOT NULL,
  public_key TEXT NOT NULL, -- ECDH public key for encryption
  key_signature TEXT, -- Signature of public key for verification
  encryption_enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Friendships table (many-to-many)
CREATE TABLE friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  friend_id UUID REFERENCES users(id),
  status VARCHAR(20) DEFAULT 'pending', -- pending, accepted, blocked
  shared_secret TEXT, -- Encrypted shared secret for friend verification
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, friend_id)
);

-- Active calls table
CREATE TABLE active_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  caller_id UUID REFERENCES users(id),
  receiver_id UUID REFERENCES users(id),
  status VARCHAR(20) DEFAULT 'ringing', -- ringing, connecting, connected, ended
  session_key_hash TEXT, -- Hash of session key for verification
  encryption_verified BOOLEAN DEFAULT FALSE,
  started_at TIMESTAMP DEFAULT NOW(),
  ended_at TIMESTAMP
);

-- Device verification logs
CREATE TABLE device_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id VARCHAR(100) NOT NULL,
  verification_code VARCHAR(10) NOT NULL, -- FF4D06
  public_key_fingerprint TEXT, -- Fingerprint of device public key
  verified BOOLEAN DEFAULT FALSE,
  verified_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Encryption audit log
CREATE TABLE encryption_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  action VARCHAR(50) NOT NULL, -- key_exchange, call_start, call_end, key_rotation
  call_id UUID REFERENCES active_calls(id),
  success BOOLEAN DEFAULT TRUE,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Security Considerations

### Device Verification
- **FF4D06 Check**: Mandatory hardware identifier verification
- **Device Binding**: Users tied to specific R1 devices
- **Secure Storage**: Use `window.creationStorage.secure` for sensitive data

### API Security
- **JWT Tokens**: Short-lived tokens with device fingerprinting
- **Rate Limiting**: Prevent abuse of signaling endpoints
- **Input Validation**: Comprehensive validation on all endpoints
- **CORS**: Restrict to R1 device origins

### P2P Security
- **End-to-End Encryption**: ECDH key exchange + AES-256-GCM voice encryption
- **Perfect Forward Secrecy**: Ephemeral keys for each call session
- **Certificate Pinning**: Pin WebRTC certificates and device fingerprints
- **Zero-Knowledge Architecture**: Servers cannot decrypt voice communications
- **Mutual Authentication**: Both parties verify each other's device authenticity

## Performance Requirements

### Frontend (R1 Device)
- **Bundle Size**: < 100KB total (critical for R1 performance)
- **Memory Usage**: < 50MB during calls
- **Battery Impact**: Minimize background processing
- **Network**: Efficient signaling, minimal overhead

### Backend
- **Response Time**: < 100ms for API calls
- **Concurrent Calls**: Support 1000+ simultaneous connections
- **Database**: Optimized queries with proper indexing
- **Scalability**: Horizontal scaling with Redis for session storage

## Testing Strategy

### Unit Tests
- **Frontend**: Jest for component logic
- **Backend**: Jest for API endpoints and business logic
- **Integration**: Test API contracts between frontend/backend

### Integration Tests
- **Device Verification**: Test FF4D06 validation
- **WebRTC Signaling**: End-to-end signaling flow
- **Friend Management**: User relationship operations

### E2E Tests
- **R1 Device Testing**: Full user journey on actual hardware
- **Cross-Device Calls**: Test P2P audio between different R1s
- **Network Conditions**: Test under various network scenarios

## Deployment Strategy

### Development
- **Local**: Docker Compose with hot reload
- **Database**: Local PostgreSQL with migrations
- **Frontend**: Live server with R1 device testing

### Staging
- **Infrastructure**: Railway/Vercel staging environment
- **Database**: Separate staging database
- **Testing**: Automated E2E tests against staging

### Production
- **Infrastructure**: Railway for backend, CDN for frontend
- **Database**: Managed PostgreSQL
- **Monitoring**: Error tracking and performance monitoring
- **Backup**: Automated database backups

## Risk Assessment & Mitigation

### Technical Risks
- **R1 Hardware Limitations**: Mitigated by optimizing for 240x282px and limited resources
- **WebRTC Browser Support**: Use WebRTC adapter library for compatibility
- **NAT Traversal Issues**: Implement STUN/TURN servers as fallback

### Business Risks
- **Low User Adoption**: Start with small beta group, gather feedback
- **Privacy Concerns**: Implement end-to-end encryption, transparent data usage
- **Competition**: Focus on R1-specific features and seamless hardware integration

### Operational Risks
- **Server Downtime**: Implement redundancy and monitoring
- **Data Loss**: Regular backups and data validation
- **Security Breaches**: Regular security audits and updates

## User Experience Design

### Core User Journey
1. **Device Verification**: Seamless FF4D06 check on app launch
2. **Onboarding**: Simple username setup with device binding
3. **Friend Discovery**: Easy username-based friend adding
4. **Voice Communication**: One-tap calling with PTT simplicity
5. **Hardware Integration**: Natural use of R1's physical buttons

### UI/UX Principles for R1
- **Pixel Art Style**: Retro 8-bit aesthetic with crisp, blocky graphics
- **Lautuche Orange Theme**: Primary color scheme using lautuche orange (#FF6B35 or similar)
- **Thumb-Friendly**: All interactions within thumb reach on 240x282px screen
- **High Contrast**: Clear visibility with orange accents on dark backgrounds
- **Minimal Text**: Icons and pixel art elements over text
- **Instant Feedback**: Immediate response to all interactions
- **Hardware-First**: Leverage physical buttons for core actions

### Friends List Design
- **Pixel Art Cards**: Each friend displayed as a retro-style card
- **Lautuche Orange Borders**: Orange accent borders and highlights
- **Scroll Wheel Navigation**: Hardware-based scrolling through friend list
- **Visual Status Indicators**: Pixel art icons for online/offline status
- **Touch Selection**: Tap to select, hardware scroll to navigate
- **Compact Layout**: Optimized for small screen real estate

## Pixel Art Design System

### Color Palette
- **Primary**: Lautuche Orange (#FF6B35)
- **Secondary**: Dark Orange (#E55B2B)
- **Accent**: Bright Orange (#FF8534)
- **Background**: Dark Gray (#1a1a1a)
- **Surface**: Medium Gray (#2a2a2a)
- **Text**: White (#ffffff)
- **Text Secondary**: Light Gray (#cccccc)

### Pixel Art Guidelines
- **Grid Size**: 8px base grid for all elements
- **Border Width**: 2px pixel borders
- **Corner Radius**: 4px for modern retro feel
- **Shadow Effects**: 1px offset drop shadows
- **Icon Size**: 16x16px for status indicators
- **Typography**: Pixel-perfect fonts, 12-14px sizes

### Component Specifications

#### Friend Card
```
┌─────────────────────────┐
│ ┌───┐ USERNAME          │
│ │●  │ Online Status     │
│ └───┘                   │
│                         │
│ [CALL] [REMOVE]         │
└─────────────────────────┘
```

- **Dimensions**: 200x60px
- **Border**: 2px lautuche orange
- **Status Icon**: 8x8px pixel circle
- **Buttons**: Pixel-style with hover effects
- **Typography**: 12px pixel font

#### Navigation Indicators
- **Scroll Arrows**: 8x8px pixel arrows
- **Active Selection**: Orange highlight border
- **Hover States**: Subtle orange glow effect
- **Focus States**: Dashed orange border

### Hardware Integration
- **Scroll Wheel**: Smooth pixel-perfect scrolling
- **PTT Button**: Pixel art visual feedback
- **Touch Gestures**: Swipe indicators with pixel art
- **Button States**: Pressed/released pixel animations

### Screen Flow
```
Launch → Device Check → Username Setup → Friend List → Call Interface
```

### Accessibility Considerations
- **Motor Control**: Large touch targets (44px minimum)
- **Visual**: High contrast ratios, scalable text
- **Audio**: Clear audio cues for status changes
- **Hardware**: Alternative navigation without touch

## Development Workflow

### Branching Strategy
```
main (production)
├── develop (integration)
│   ├── feature/device-verification
│   ├── feature/user-management
│   ├── feature/friends-system
│   ├── feature/webrtc-signaling
│   └── feature/ptt-integration
└── hotfix/security-patches
```

### Code Quality Standards
- **Linting**: ESLint for JavaScript, Prettier for formatting
- **Testing**: 80%+ code coverage requirement
- **Documentation**: JSDoc for APIs, inline comments for complex logic
- **Security**: Regular dependency audits, SAST scanning

### Development Environment Setup
```bash
# Clone repository
git clone https://github.com/AidanTheBandit/R1-Walky.git
cd R1-Walky

# Install dependencies
npm install

# Set up development database
docker-compose up -d postgres

# Run database migrations
npm run db:migrate

# Start development servers
npm run dev

# Run tests
npm test
```

### CI/CD Pipeline
```yaml
# GitHub Actions workflow
- Lint & Format Check
- Unit Tests (Frontend & Backend)
- Integration Tests
- E2E Tests (Staging)
- Security Scan
- Deploy to Staging
- Manual Approval for Production
```

## Success Metrics & KPIs

### User Engagement
- **Daily Active Users**: Target 70% of registered users
- **Session Duration**: Average 15+ minutes per session
- **Call Success Rate**: >95% of initiated calls connect
- **Friend Connection Rate**: >60% of users add at least 1 friend

### Technical Performance
- **App Load Time**: <3 seconds on R1 device
- **Call Connection Time**: <2 seconds average
- **Audio Latency**: <100ms one-way latency
- **Encryption Overhead**: <5ms additional latency
- **Key Exchange Time**: <500ms for initial connection
- **Battery Impact**: <10% per hour during calls

### Business Metrics
- **User Retention**: 60% Day 1, 40% Day 7, 25% Day 30
- **User Acquisition**: Target 1000 users in first 3 months
- **Call Volume**: Average 5-10 calls per active user per day
- **Platform Compatibility**: 100% compatibility with R1 devices

### Quality Metrics
- **Crash Rate**: <1% of sessions
- **Error Rate**: <5% of API requests
- **User Satisfaction**: >4.5/5 star rating
- **UI Responsiveness**: <16ms for scroll wheel interactions
- **Visual Consistency**: 100% adherence to pixel art design system
- **Support Tickets**: <5% of user base monthly

## Roadmap & Milestones

### Month 1: Foundation
- ✅ Complete project architecture and planning
- ⏳ Set up development environment
- ⏳ Create pixel art design system with lautuche orange theme
- ⏳ Implement basic backend API structure
- ⏳ Create frontend skeleton with device verification

### Month 2: Core Features
- ⏳ User management and authentication
- ⏳ Friends system implementation
- ⏳ Basic WebRTC signaling
- ⏳ PTT button integration

### Month 3: Audio & P2P
- ⏳ WebRTC audio streaming
- ⏳ ECDH key exchange implementation
- ⏳ AES-256-GCM voice encryption
- ⏳ NAT traversal implementation
- ⏳ Audio optimization for R1
- ⏳ Cross-device testing

### Month 4: Polish & Launch
- ⏳ UI/UX refinements
- ⏳ Performance optimization
- ⏳ Beta testing with real users
- ⏳ Production deployment

### Month 5-6: Growth & Iteration
- ⏳ User feedback integration
- ⏳ Feature enhancements
- ⏳ Community building
- ⏳ Advanced features (groups, encryption, etc.)

## Budget & Resources

### Development Team
- **Lead Developer**: Full-stack development (40 hrs/week)
- **UI/UX Designer**: Pixel art design and R1-specific UI (25 hrs/week)
- **DevOps Engineer**: Infrastructure and deployment (10 hrs/week)
- **QA Tester**: Manual testing and automation (20 hrs/week)

### Infrastructure Costs (Monthly)
- **Backend Hosting**: Railway/Vercel - $20-50
- **Database**: Supabase/PostgreSQL - $25-100
- **CDN**: Cloudflare - $20
- **Monitoring**: Basic logging - $0-20
- **Domain & SSL**: $10-20
- **Total**: ~$75-210/month

### Development Tools
- **Version Control**: GitHub Pro - $45/month
- **Design Tools**: Figma for pixel art design - $144/month
- **Pixel Art Tools**: Aseprite for pixel art creation - $20 (one-time)
- **Testing Tools**: BrowserStack for R1 testing - $39/month
- **CI/CD**: GitHub Actions (included)

## Legal & Compliance

### Privacy Policy Requirements
- **Data Collection**: Device ID, username, friend relationships
- **Data Usage**: P2P communication, user matching
- **Data Retention**: User data retained until account deletion
- **User Rights**: Right to access, modify, delete personal data

### Terms of Service
- **Device Requirements**: Valid R1 device with FF4D06 verification
- **User Conduct**: Appropriate use of voice communication
- **Content Guidelines**: No harassment, explicit content, or illegal activities
- **Service Availability**: Best-effort service with no uptime guarantees

### Intellectual Property
- **Frontend Code**: MIT License for open-source components
- **Backend API**: Proprietary service
- **Branding**: R1-Walky trademark registration
- **Third-party**: WebRTC, Socket.io licenses compliance

## Support & Documentation

### User Documentation
- **Quick Start Guide**: 5-minute setup for new users
- **User Manual**: Comprehensive feature documentation
- **Troubleshooting**: Common issues and solutions
- **FAQ**: Frequently asked questions

### Developer Documentation
- **API Reference**: Complete endpoint documentation
- **SDK Integration**: How to integrate with R1 hardware
- **Contributing Guide**: Development workflow and standards
- **Architecture Docs**: System design and data flow diagrams

### Community Support
- **Discord Server**: Real-time community support
- **GitHub Issues**: Bug reports and feature requests
- **Email Support**: Direct support for premium users
- **Knowledge Base**: Self-service troubleshooting

---

## Getting Started with Development

### Prerequisites
- Node.js 18+
- Docker and Docker Compose
- Git
- Access to R1 device for testing

### Quick Setup
```bash
# Clone and setup
git clone https://github.com/AidanTheBandit/R1-Walky.git
cd R1-Walky
npm install

# Start development environment
docker-compose up -d
npm run dev

# Run tests
npm test
```

### First Development Tasks
1. Set up your development environment
2. Review the API specifications above
3. Start with device verification implementation
4. Test on actual R1 hardware early and often

---

*This document is living and will be updated as the project evolves. Last updated: September 8, 2025*

## Technical Requirements

- Rabbit R1 device with FF4D06 verification
- WebRTC support for P2P communication
- Audio recording/playback APIs
- Hardware button access (PTT, scroll wheel)
- Small screen UI framework (240x282px portrait)

## API Reference

Based on the reference files in `/refs/`:

- **Hardware Access**: `window.creationSensors` for accelerometer, button events
- **Plugin Communication**: `PluginMessageHandler` for LLM and system integration
- **Audio Control**: PTT button integration for push-to-talk functionality
- **Storage**: `window.creationStorage` for persistent data (plain/secure)
- **Events**: Side button events (`sideClick`, `longPressStart`, `longPressEnd`)
- **Screen Size**: 240x282px portrait - all UI must fit within these constraints

### Key Hardware Events for Walkie Talkie:
```javascript
// PTT Button Events
window.addEventListener("sideClick", () => { /* Single click */ });
window.addEventListener("longPressStart", () => { /* Start talking */ });
window.addEventListener("longPressEnd", () => { /* Stop talking */ });

// Scroll Wheel Events
window.addEventListener("scrollUp", () => { /* Navigate up */ });
window.addEventListener("scrollDown", () => { /* Navigate down */ });
```

### Storage API:
```javascript
// Store user data and friends list
await window.creationStorage.plain.setItem('user_profile', btoa(JSON.stringify(profile)));
await window.creationStorage.secure.setItem('device_id', btoa(deviceId));
```

## Usage

1. Launch the creation on your R1 device
2. Creation automatically verifies device compatibility
3. Set your username
4. Add friends by their usernames
5. Click on a friend to initiate call
6. Hold PTT button to speak, release to listen

## Development

This project uses the reference implementations in `/refs/` as examples for:
- Hardware interaction (`hardware.js`)
- Data/API communication (`data.js`)
- Text-to-speech integration (`speak.js`)

## Contributing

Join our Discord: https://discord.gg/pCuX8jfF

## License

[To be determined]

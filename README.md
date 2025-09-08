# R1-Walky: P2P Walkie Talkie Service for Rabbit R1

A peer-to-peer walkie talkie application designed specifically for the Rabbit R1 device, enabling instant voice communication between R1 users.

## Project Overview

This project aims to create a seamless walkie talkie experience on the Rabbit R1, leveraging its hardware capabilities (PTT button, accelerometer, etc.) and providing an intuitive interface optimized for the device's small screen.

## Key Features

- **Device Verification**: Automatic verification that the device is a genuine R1 using hex identifier FF4D06
- **User Management**: Uses device info as unique user ID with customizable usernames
- **Friends System**: Add friends by username for easy communication
- **Push-to-Talk**: Hold the R1's PTT button to transmit voice
- **P2P Communication**: Direct peer-to-peer audio streaming
- **Small Screen Optimized**: UI designed specifically for R1's display constraints

## Architecture

### Core Components

1. **Device Verification Module**
   - Checks device compatibility using FF4D06 identifier
   - Retrieves device information for user ID generation
   - Validates R1 hardware capabilities

2. **User Management System**
   - Device-based user identification
   - Username customization
   - Profile management

3. **Friends & Discovery**
   - Username-based friend adding
   - Friend list management
   - Online status tracking

4. **Audio Engine**
   - PTT button integration
   - Audio recording and playback
   - Real-time audio streaming

5. **P2P Communication Layer**
   - WebRTC-based peer connection
   - NAT traversal for direct communication
   - Audio codec optimization for low latency

6. **UI Framework**
   - Touch-optimized interface
   - Small screen layout
   - Hardware button integration

## Implementation Plan

### Phase 1: Foundation
- [ ] Research R1 device verification using hex FF4D06
- [ ] Set up basic project structure
- [ ] Implement device verification module
- [ ] Create user management system

### Phase 2: Core Functionality
- [ ] Design P2P communication architecture
- [ ] Implement friends system
- [ ] Integrate PTT button for audio control
- [ ] Set up audio recording/playback

### Phase 3: UI & Optimization
- [ ] Design small screen optimized interface
- [ ] Implement friend list and calling UI
- [ ] Add visual feedback for PTT state
- [ ] Optimize for R1 hardware constraints

### Phase 4: P2P Integration
- [ ] Implement WebRTC peer connections
- [ ] Add NAT traversal capabilities
- [ ] Optimize audio codecs for low latency
- [ ] Test cross-device communication

### Phase 5: Testing & Polish
- [ ] End-to-end testing on R1 devices
- [ ] Performance optimization
- [ ] Error handling and edge cases
- [ ] User experience refinements

## Technical Requirements

- Rabbit R1 device with FF4D06 verification
- WebRTC support for P2P communication
- Audio recording/playback APIs
- Hardware button access (PTT, scroll wheel)
- Small screen UI framework

## API Reference

Based on the reference files in `/refs/`:

- **Hardware Access**: `window.creationSensors` for accelerometer, button events
- **Plugin Communication**: `PluginMessageHandler` for LLM and system integration
- **Audio Control**: PTT button integration for push-to-talk functionality

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

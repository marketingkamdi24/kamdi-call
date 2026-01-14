# kamdi24 Video Call System

A real-time video/audio call system for kamdi24 customer support. Customers can directly connect with Berater (consultants) without needing email or phone numbers.

## Features

- **Direct Video/Audio Calls**: Customers enter their name and call instantly
- **Call Queue System**: Automatic queuing when all Berater are busy
- **Multiple Berater Support**: Add several consultants to handle calls
- **Real-time Chat**: Text messaging during calls
- **File Sharing**: Send and receive files during calls
- **Screen Sharing**: Berater can share their screen
- **Peer-to-Peer**: Direct WebRTC connections using PeerJS

## Project Structure

```
kamdi-call/
├── server/
│   └── index.js          # Express + Socket.IO + PeerJS server
├── public/
│   ├── index.html        # Customer portal
│   ├── berater/
│   │   └── index.html    # Berater dashboard
│   ├── css/
│   │   ├── styles.css    # Main styles
│   │   └── berater.css   # Berater-specific styles
│   ├── js/
│   │   ├── customer.js   # Customer-side logic
│   │   └── berater.js    # Berater-side logic
│   └── audio/
│       ├── ringtone.mp3  # Incoming call sound
│       └── waiting.mp3   # Queue waiting music
├── package.json
└── README.md
```

## Installation

1. Make sure you have Node.js installed (v14+)

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the server:
   ```bash
   npm run dev
   ```

4. Open in browser:
   - **Customer Portal**: http://localhost:3000/
   - **Berater Dashboard**: http://localhost:3000/berater

## Usage

### For Berater (Consultants)

1. Open http://localhost:3000/berater
2. Enter your name and click "Anmelden" (Login)
3. Allow camera/microphone access
4. Wait for incoming calls
5. Accept or reject calls as they come in
6. Use chat and file sharing during calls

### For Customers

1. Open http://localhost:3000/
2. Enter your name
3. Click "Videoanruf" (Video Call) or "Audioanruf" (Audio Call)
4. Allow camera/microphone access
5. Wait in queue if all Berater are busy
6. Use chat and file sharing during the call

## Technologies Used

- **PeerJS**: WebRTC peer-to-peer connections
- **Socket.IO**: Real-time signaling and queue management
- **Express**: Web server
- **HTML5/CSS3/JavaScript**: Frontend

## Browser Support

Works best in modern browsers:
- Chrome (recommended)
- Firefox
- Edge
- Safari

## Notes

- Audio files (ringtone.mp3, waiting.mp3) are placeholders - add your own audio files
- For production, consider adding HTTPS and TURN servers for better connectivity
- The system uses the free PeerJS cloud server for signaling

## License

MIT - kamdi24

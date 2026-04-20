# kamdi-call – Required Libraries

Overview of all libraries and dependencies used in the **kamdi24 Video Call System**.

---

## Server-Side Dependencies (npm)

Defined in `package.json` and installed via `npm install`.

| Library | Version (package.json) | Installed Version (lock) | License | Description |
|---------|----------------------|--------------------------|---------|-------------|
| **express** | ^4.18.2 | 4.22.1 | MIT | Fast, minimalist web framework for Node.js. Serves static files, REST API endpoints, and middleware (security headers, HTTPS redirect, JSON parsing). |
| **socket.io** | ^4.7.2 | 4.8.3 | MIT | Real-time bidirectional event-based communication. Handles Berater login, customer call queue, call signaling, chat messages, and live status updates via WebSockets. |
| **peer** | ^1.0.2 | 1.0.2 | MIT | PeerJS server (`ExpressPeerServer`). Provides the signaling server for WebRTC peer-to-peer connections used in video/audio calls. |
| **bcrypt** | ^5.1.1 | 5.1.1 | MIT | Library for hashing and comparing passwords using the bcrypt algorithm. Used for secure Berater authentication (DSGVO Art. 32). |
| **uuid** | ^9.0.0 | 9.0.1 | MIT | Generates RFC-compliant UUIDs. Used for session tokens and call log entry IDs via `randomUUID` (Note: the server actually uses Node.js built-in `crypto.randomUUID`, but uuid is listed as a dependency). |

---

## Client-Side Libraries (bundled / CDN)

Loaded via `<script>` tags in the HTML pages. No npm install required for these – they are served from the `public/` directory or by the server.

| Library | Version | Source | Used In | Description |
|---------|---------|--------|---------|-------------|
| **PeerJS Client** | 1.5.5 | `public/js/peerjs.min.js` (bundled) | `customer.html`, `berater/index.html` | WebRTC peer-to-peer connection library for the browser. Establishes video, audio, and data channels between customers and Beraters. |
| **Socket.IO Client** | 4.8.3 (served by server) | `/socket.io/socket.io.js` (auto-served by `socket.io` server) | `customer.html`, `berater/index.html` | Client-side counterpart to the Socket.IO server. Automatically served by the `socket.io` npm package at runtime – no separate file needed. |

---

## Node.js Built-In Modules

These are part of the Node.js runtime and require no installation.

| Module | Import | Description |
|--------|--------|-------------|
| **http** | `createServer` | Creates the underlying HTTP server for Express and Socket.IO. |
| **url** | `fileURLToPath` | Converts `import.meta.url` to a file path for ES module compatibility. |
| **path** | `dirname`, `join` | File path manipulation for serving static files and locating JSON data files. |
| **fs** | `readFileSync`, `writeFileSync`, `existsSync` | Synchronous file I/O for reading/writing `users.json` and `call-log.json`. |
| **crypto** | `randomUUID` | Generates cryptographically secure UUIDs for session tokens and call log IDs. |

---

## Custom Project Scripts (no external dependency)

These are project-specific JavaScript files, **not** third-party libraries.

| File | Used In | Description |
|------|---------|-------------|
| `public/js/berater.js` | `berater/index.html` | Main Berater dashboard logic – login, call handling, chat, UI state management. |
| `public/js/customer.js` | `customer.html` | Customer-facing call logic – name input, call initiation, queue, video/chat UI. |
| `public/js/drawing-tools.js` | `berater/index.html`, `customer.html` | Canvas-based drawing/measurement overlay for video consultation (custom, no external lib). |
| `public/js/pdf-generator.js` | `berater/index.html` | Consultation summary PDF generation (custom, no external lib). |
| `public/js/products.js` | (referenced internally) | Product data for the fireplace configurator. |

---

## WebRTC / Browser APIs

The application relies heavily on **WebRTC** – a browser-native API (no library needed) for:

- **`getUserMedia`** – Camera & microphone access
- **`RTCPeerConnection`** – Peer-to-peer audio/video/data connections
- **`getDisplayMedia`** – Screen sharing

PeerJS (listed above) is a convenience wrapper around these browser APIs.

---

## Summary

| Category | Count |
|----------|-------|
| npm dependencies (server) | 5 |
| Client-side libraries (bundled) | 2 |
| Node.js built-in modules | 5 |
| Custom project scripts | 5 |

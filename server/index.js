import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { ExpressPeerServer } from 'peer';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';

const SALT_ROUNDS = 10;
const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours (Art. 32 DSGVO)
const MAX_JSON_SIZE = '10mb'; // File upload limit (Art. 32 DSGVO)

// TURN server credentials (served via API, never exposed in client code)
const TURN_CONFIG = {
    host: process.env.TURN_HOST || '46.225.130.183',
    port: process.env.TURN_PORT || '3478',
    tlsHost: process.env.TURN_TLS_HOST || 'kamdi24-call.data-agents.de',
    tlsPort: process.env.TURN_TLS_PORT || '5349',
    username: process.env.TURN_USERNAME || 'kamdi24',
    credential: process.env.TURN_CREDENTIAL || 'K4md1Turn2025!'
};

// Rate limiting for login attempts (Art. 32 DSGVO - Sicherheit)
const loginAttempts = new Map();
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 Minuten

// Session tokens for authenticated users (Art. 32 DSGVO - sichere Auth)
// Stores { username, id, createdAt }
const sessionTokens = new Map();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = createServer(app);
const io = new Server(server);

const peerServer = ExpressPeerServer(server, {
    debug: false,
    path: '/'
});

app.use('/peerjs', peerServer);

// HTTPS redirect (Art. 32 DSGVO - Verschlüsselung)
app.use((req, res, next) => {
    if (req.headers['x-forwarded-proto'] && req.headers['x-forwarded-proto'] !== 'https') {
        return res.redirect(301, `https://${req.headers.host}${req.url}`);
    }
    next();
});

// Security Headers (Art. 32 DSGVO - technische Schutzmaßnahmen)
app.use((req, res, next) => {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(self), microphone=(self), geolocation=()');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
});

app.use(express.static(join(__dirname, '../public')));
app.use(express.json({ limit: MAX_JSON_SIZE }));

// User data file path
const usersFilePath = join(__dirname, 'users.json');

// Load users from JSON file or create default
async function loadUsers() {
    if (existsSync(usersFilePath)) {
        try {
            const data = readFileSync(usersFilePath, 'utf8');
            const loadedUsers = JSON.parse(data);
            // Migrate plaintext passwords to bcrypt hashes
            let migrated = false;
            for (let i = 0; i < loadedUsers.length; i++) {
                if (!loadedUsers[i].password.startsWith('$2b$')) {
                    console.log(`Migrating password for user: ${loadedUsers[i].username}`);
                    loadedUsers[i].password = await bcrypt.hash(loadedUsers[i].password, SALT_ROUNDS);
                    migrated = true;
                }
            }
            if (migrated) {
                saveUsers(loadedUsers);
                console.log('Password migration complete');
            }
            return loadedUsers;
        } catch (e) {
            console.error('Error loading users:', e);
            return await getDefaultUsers();
        }
    }
    const defaultUsers = await getDefaultUsers();
    saveUsers(defaultUsers);
    return defaultUsers;
}

async function getDefaultUsers() {
    const hash = await bcrypt.hash('kamdi2024', SALT_ROUNDS);
    return [
        { id: '1', username: 'Max Mustermann', password: hash, createdAt: new Date().toISOString() },
        { id: '2', username: 'Anna Schmidt', password: hash, createdAt: new Date().toISOString() }
    ];
}

function saveUsers(users) {
    try {
        writeFileSync(usersFilePath, JSON.stringify(users, null, 2));
    } catch (e) {
        console.error('Error saving users:', e);
    }
}

let users = await loadUsers();

// Auth middleware with session token (Art. 32 DSGVO)
function requireAuth(req, res, next) {
    const token = req.headers['x-admin-auth'];
    if (!token || !sessionTokens.has(token)) {
        return res.status(401).json({ success: false, message: 'Nicht autorisiert' });
    }
    const session = sessionTokens.get(token);
    // Check session expiry
    if (Date.now() - session.createdAt > SESSION_TTL_MS) {
        sessionTokens.delete(token);
        return res.status(401).json({ success: false, message: 'Sitzung abgelaufen. Bitte erneut anmelden.' });
    }
    req.authUser = session;
    next();
}

// Clean up expired session tokens periodically
setInterval(() => {
    const now = Date.now();
    for (const [token, session] of sessionTokens) {
        if (now - session.createdAt > SESSION_TTL_MS) {
            sessionTokens.delete(token);
        }
    }
}, 60 * 60 * 1000); // Check every hour

function checkRateLimit(ip) {
    const now = Date.now();
    const attempts = loginAttempts.get(ip) || [];
    // Remove expired attempts
    const recent = attempts.filter(t => now - t < LOGIN_WINDOW_MS);
    loginAttempts.set(ip, recent);
    return recent.length >= MAX_LOGIN_ATTEMPTS;
}

function recordLoginAttempt(ip) {
    const attempts = loginAttempts.get(ip) || [];
    attempts.push(Date.now());
    loginAttempts.set(ip, attempts);
}

// API endpoint for Berater authentication
app.post('/api/berater/login', async (req, res) => {
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    
    // Rate limiting check
    if (checkRateLimit(clientIp)) {
        return res.status(429).json({ success: false, message: 'Zu viele Anmeldeversuche. Bitte warten Sie 15 Minuten.' });
    }
    
    const { username, password } = req.body;
    const user = users.find(u => u.username === username);
    
    if (user && await bcrypt.compare(password, user.password)) {
        // Create session token
        const token = randomUUID();
        sessionTokens.set(token, { username: user.username, id: user.id, createdAt: Date.now() });
        console.log('Berater authenticated successfully');
        res.json({ success: true, name: username, token });
    } else {
        recordLoginAttempt(clientIp);
        console.log('Failed login attempt');
        res.status(401).json({ success: false, message: 'Ungültige Anmeldedaten' });
    }
});

// API endpoints for user management (protected)
app.get('/api/users', requireAuth, (req, res) => {
    const safeUsers = users.map(u => ({
        id: u.id,
        username: u.username,
        createdAt: u.createdAt
    }));
    res.json(safeUsers);
});

app.post('/api/users', requireAuth, async (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Benutzername und Passwort erforderlich' });
    }
    
    if (users.find(u => u.username === username)) {
        return res.status(400).json({ success: false, message: 'Benutzername bereits vergeben' });
    }
    
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    const newUser = {
        id: Date.now().toString(),
        username,
        password: hashedPassword,
        createdAt: new Date().toISOString()
    };
    
    users.push(newUser);
    saveUsers(users);
    
    console.log('New user created');
    res.json({ success: true, user: { id: newUser.id, username: newUser.username, createdAt: newUser.createdAt } });
});

// ICE server config API (DSGVO: TURN credentials only served server-side)
app.get('/api/ice-servers', (req, res) => {
    res.json({
        iceServers: [
            { urls: `stun:${TURN_CONFIG.host}:${TURN_CONFIG.port}` },
            {
                urls: `turn:${TURN_CONFIG.host}:${TURN_CONFIG.port}`,
                username: TURN_CONFIG.username,
                credential: TURN_CONFIG.credential
            },
            {
                urls: `turn:${TURN_CONFIG.host}:${TURN_CONFIG.port}?transport=tcp`,
                username: TURN_CONFIG.username,
                credential: TURN_CONFIG.credential
            },
            {
                urls: `turns:${TURN_CONFIG.tlsHost}:${TURN_CONFIG.tlsPort}`,
                username: TURN_CONFIG.username,
                credential: TURN_CONFIG.credential
            }
        ],
        iceTransportPolicy: 'all',
        iceCandidatePoolSize: 10
    });
});

app.put('/api/users/:id', requireAuth, async (req, res) => {
    const { id } = req.params;
    const { username, password } = req.body;
    
    const userIndex = users.findIndex(u => u.id === id);
    if (userIndex === -1) {
        return res.status(404).json({ success: false, message: 'Benutzer nicht gefunden' });
    }
    
    if (username && username !== users[userIndex].username) {
        if (users.find(u => u.username === username && u.id !== id)) {
            return res.status(400).json({ success: false, message: 'Benutzername bereits vergeben' });
        }
        users[userIndex].username = username;
    }
    
    if (password) {
        users[userIndex].password = await bcrypt.hash(password, SALT_ROUNDS);
    }
    
    saveUsers(users);
    console.log('User updated');
    res.json({ success: true, user: { id: users[userIndex].id, username: users[userIndex].username, createdAt: users[userIndex].createdAt } });
});

app.delete('/api/users/:id', requireAuth, (req, res) => {
    const { id } = req.params;
    
    const userIndex = users.findIndex(u => u.id === id);
    if (userIndex === -1) {
        return res.status(404).json({ success: false, message: 'Benutzer nicht gefunden' });
    }
    
    const deletedUser = users.splice(userIndex, 1)[0];
    saveUsers(users);
    
    console.log('User deleted');
    res.json({ success: true });
});

const beraters = new Map();
const customerQueue = [];
const activeConnections = new Map();

// Debug endpoint to check server state
app.get('/api/debug/state', (req, res) => {
    res.json({
        beraters: Array.from(beraters.values()).map(b => ({ name: b.name, status: b.status, socketId: b.socketId, peerId: b.peerId })),
        queueLength: customerQueue.length,
        activeConnections: activeConnections.size,
        socketCount: io.sockets.sockets.size
    });
});

// Queue configuration
const MAX_QUEUE_SIZE = 20;
const QUEUE_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes max wait time

io.on('connection', (socket) => {
    console.log('New socket connection');

    socket.on('berater-login', (data) => {
        const { name, peerId } = data;
        beraters.set(socket.id, {
            name,
            peerId,
            socketId: socket.id,
            status: 'available',
            currentCustomer: null
        });
        console.log('Berater logged in (ID:', socket.id, ')');
        broadcastBeraterList();
        processQueue();
    });

    socket.on('berater-status', (status) => {
        const berater = beraters.get(socket.id);
        if (berater) {
            berater.status = status;
            broadcastBeraterList();
            if (status === 'available') {
                processQueue();
            }
        }
    });

    socket.on('customer-call', (data) => {
        const { name, peerId, callType } = data;
        console.log('Customer call received:', name, 'type:', callType, 'peerId:', peerId);
        const customer = {
            name,
            peerId,
            socketId: socket.id,
            callType,
            timestamp: Date.now()
        };
        
        activeConnections.set(socket.id, customer);
        
        const availableBerater = findAvailableBerater();
        console.log('Available berater:', availableBerater ? availableBerater.name + ' (' + availableBerater.status + ')' : 'NONE');
        console.log('All beraters:', Array.from(beraters.values()).map(b => b.name + ':' + b.status));
        if (availableBerater) {
            connectCustomerToBerater(customer, availableBerater);
        } else if (customerQueue.length < MAX_QUEUE_SIZE) {
            customerQueue.push(customer);
            socket.emit('queue-position', { position: customerQueue.length });
            notifyBeratersOfQueue();
        } else {
            // Queue is full
            socket.emit('queue-full', { message: 'Alle Leitungen sind belegt. Bitte versuchen Sie es später erneut.' });
        }
    });

    socket.on('customer-cancel', () => {
        const index = customerQueue.findIndex(c => c.socketId === socket.id);
        if (index !== -1) {
            customerQueue.splice(index, 1);
            updateQueuePositions();
        }
        activeConnections.delete(socket.id);
    });

    socket.on('call-ended', (data) => {
        const berater = beraters.get(socket.id);
        if (berater) {
            // Notify the customer that the berater ended the call
            if (berater.currentCustomer && berater.currentCustomer.socketId) {
                io.to(berater.currentCustomer.socketId).emit('berater-disconnected');
            }
            berater.status = 'available';
            berater.currentCustomer = null;
            broadcastBeraterList();
            processQueue();
        }
    });

    socket.on('accept-call', (customerId) => {
        const berater = beraters.get(socket.id);
        if (berater) {
            berater.status = 'busy';
            const customer = activeConnections.get(customerId);
            if (customer) {
                berater.currentCustomer = customer;
                
                // Remove customer from queue if they were in it
                const queueIndex = customerQueue.findIndex(c => c.socketId === customerId);
                if (queueIndex !== -1) {
                    customerQueue.splice(queueIndex, 1);
                    notifyBeratersOfQueue();
                }
                
                io.to(customerId).emit('call-accepted', {
                    beraterName: berater.name,
                    beraterPeerId: berater.peerId,
                    beraterSocketId: berater.socketId
                });
                
                broadcastBeraterList();
            }
        }
    });

    socket.on('reject-call', (customerId) => {
        const customer = activeConnections.get(customerId);
        if (customer) {
            const nextBerater = findAvailableBerater();
            if (nextBerater) {
                connectCustomerToBerater(customer, nextBerater);
            } else {
                customerQueue.unshift(customer);
                io.to(customerId).emit('queue-position', { position: 1 });
                notifyBeratersOfQueue();
            }
        }
    });

    socket.on('chat-message', (data) => {
        const { targetSocketId, message, senderName } = data;
        io.to(targetSocketId).emit('chat-message', {
            senderName,
            message,
            timestamp: Date.now()
        });
    });

    // Note: File sharing uses WebRTC DataChannel (P2P), not Socket.IO

    socket.on('disconnect', () => {
        console.log('Socket disconnected:', socket.id);
        
        if (beraters.has(socket.id)) {
            const berater = beraters.get(socket.id);
            console.log('Berater disconnected (ID:', socket.id, ')');
            
            // Notify the customer if berater was in a call
            if (berater.currentCustomer && berater.currentCustomer.socketId) {
                io.to(berater.currentCustomer.socketId).emit('berater-disconnected');
            }
            
            beraters.delete(socket.id);
            broadcastBeraterList();
        }
        
        // Check if disconnected socket was a customer in an active call with a berater
        for (const [beraterSocketId, berater] of beraters) {
            if (berater.currentCustomer && berater.currentCustomer.socketId === socket.id) {
                console.log('Customer disconnected from berater (ID:', berater.socketId, ')');
                io.to(beraterSocketId).emit('customer-disconnected');
                berater.status = 'available';
                berater.currentCustomer = null;
                broadcastBeraterList();
                processQueue();
                break;
            }
        }
        
        const queueIndex = customerQueue.findIndex(c => c.socketId === socket.id);
        if (queueIndex !== -1) {
            customerQueue.splice(queueIndex, 1);
            updateQueuePositions();
            notifyBeratersOfQueue();
        }
        
        activeConnections.delete(socket.id);
    });
});

function findAvailableBerater() {
    // Round-Robin: pick the available berater who has been idle the longest
    let best = null;
    let oldestTime = Infinity;
    for (const [socketId, berater] of beraters) {
        if (berater.status === 'available') {
            const lastCall = berater.lastCallTime || 0;
            if (lastCall < oldestTime) {
                oldestTime = lastCall;
                best = berater;
            }
        }
    }
    return best;
}

function connectCustomerToBerater(customer, berater) {
    berater.status = 'ringing';
    berater.currentCustomer = customer;
    berater.lastCallTime = Date.now();
    
    io.to(berater.socketId).emit('incoming-call', {
        customerName: customer.name,
        customerPeerId: customer.peerId,
        customerSocketId: customer.socketId,
        callType: customer.callType
    });
    
    io.to(customer.socketId).emit('call-connecting', {
        beraterName: berater.name
    });
    
    broadcastBeraterList();
}

function processQueue() {
    // Process ALL waiting customers that can be matched to available beraters
    while (customerQueue.length > 0) {
        const availableBerater = findAvailableBerater();
        if (!availableBerater) break;
        const customer = customerQueue.shift();
        connectCustomerToBerater(customer, availableBerater);
    }
    updateQueuePositions();
}

function updateQueuePositions() {
    customerQueue.forEach((customer, index) => {
        io.to(customer.socketId).emit('queue-position', { position: index + 1 });
    });
}

function broadcastBeraterList() {
    // Send full list only to other Beraters (Art. 5 DSGVO - Datenminimierung)
    const fullList = Array.from(beraters.values()).map(b => ({
        name: b.name,
        status: b.status
    }));
    beraters.forEach((berater) => {
        io.to(berater.socketId).emit('berater-list', fullList);
    });
    
    // Send anonymized list to customers (only count + availability)
    const customerList = Array.from(beraters.values()).map(b => ({
        name: 'Berater',
        status: b.status
    }));
    // Emit to all non-berater sockets
    const beraterSocketIds = new Set(beraters.keys());
    for (const [id, socket] of io.sockets.sockets) {
        if (!beraterSocketIds.has(id)) {
            socket.emit('berater-list', customerList);
        }
    }
}

function notifyBeratersOfQueue() {
    // Send queue info to beraters (Art. 5 DSGVO - Datenminimierung)
    const queueInfo = customerQueue.map(c => ({
        name: c.name,
        callType: c.callType,
        waitTime: Math.floor((Date.now() - c.timestamp) / 1000),
        peerId: c.peerId,
        socketId: c.socketId
    }));
    
    beraters.forEach((berater) => {
        io.to(berater.socketId).emit('queue-update', queueInfo);
    });
}

// Clean up customers who have been waiting too long
function cleanupStaleQueue() {
    const now = Date.now();
    let removed = false;
    for (let i = customerQueue.length - 1; i >= 0; i--) {
        if (now - customerQueue[i].timestamp > QUEUE_TIMEOUT_MS) {
            const stale = customerQueue.splice(i, 1)[0];
            io.to(stale.socketId).emit('queue-timeout', { 
                message: 'Die Wartezeit wurde überschritten. Bitte versuchen Sie es erneut.' 
            });
            activeConnections.delete(stale.socketId);
            removed = true;
            console.log('Customer removed from queue (timeout, socket:', stale.socketId, ')');
        }
    }
    if (removed) {
        updateQueuePositions();
        notifyBeratersOfQueue();
    }
}

setInterval(() => {
    notifyBeratersOfQueue();
    cleanupStaleQueue();
}, 5000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🎥 kamdi24 Video Call System Started                   ║
║                                                           ║
║   Server running at: http://localhost:${PORT}              ║
║                                                           ║
║   📞 Customer Portal: http://localhost:${PORT}/            ║
║   👔 Berater Dashboard: http://localhost:${PORT}/berater   ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
    `);
});

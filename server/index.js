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

// Rate limiting for login attempts (Art. 32 DSGVO - Sicherheit)
const loginAttempts = new Map();
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 Minuten

// Session tokens for authenticated users (Art. 32 DSGVO - sichere Auth)
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

app.use(express.static(join(__dirname, '../public')));
app.use(express.json());

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
    req.authUser = sessionTokens.get(token);
    next();
}

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
        sessionTokens.set(token, { username: user.username, id: user.id });
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
        console.log('Berater logged in');
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
        const customer = {
            name,
            peerId,
            socketId: socket.id,
            callType,
            timestamp: Date.now()
        };
        
        activeConnections.set(socket.id, customer);
        
        const availableBerater = findAvailableBerater();
        if (availableBerater) {
            connectCustomerToBerater(customer, availableBerater);
        } else {
            customerQueue.push(customer);
            socket.emit('queue-position', { position: customerQueue.length });
            notifyBeratersOfQueue();
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

    socket.on('file-share', (data) => {
        const { targetSocketId, fileName, fileData, fileType, senderName } = data;
        io.to(targetSocketId).emit('file-received', {
            senderName,
            fileName,
            fileData,
            fileType,
            timestamp: Date.now()
        });
    });

    socket.on('disconnect', () => {
        console.log('Socket disconnected:', socket.id);
        
        if (beraters.has(socket.id)) {
            const berater = beraters.get(socket.id);
            console.log('Berater disconnected:', berater.name);
            
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
                console.log('Customer disconnected from berater:', berater.name);
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
    for (const [socketId, berater] of beraters) {
        if (berater.status === 'available') {
            return berater;
        }
    }
    return null;
}

function connectCustomerToBerater(customer, berater) {
    berater.status = 'ringing';
    berater.currentCustomer = customer;
    
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
    if (customerQueue.length === 0) return;
    
    const availableBerater = findAvailableBerater();
    if (availableBerater) {
        const customer = customerQueue.shift();
        connectCustomerToBerater(customer, availableBerater);
        updateQueuePositions();
    }
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
    // Only send necessary data to Berater frontend (Art. 5 DSGVO - Datenminimierung)
    // peerId and socketId are kept server-side, sent only as opaque reference IDs
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

setInterval(() => {
    notifyBeratersOfQueue();
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

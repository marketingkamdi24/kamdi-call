import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { ExpressPeerServer } from 'peer';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, writeFileSync, existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = createServer(app);
const io = new Server(server);

const peerServer = ExpressPeerServer(server, {
    debug: true,
    path: '/'
});

app.use('/peerjs', peerServer);
app.use(express.static(join(__dirname, '../public')));
app.use(express.json());

// User data file path
const usersFilePath = join(__dirname, 'users.json');

// Load users from JSON file or create default
function loadUsers() {
    if (existsSync(usersFilePath)) {
        try {
            const data = readFileSync(usersFilePath, 'utf8');
            return JSON.parse(data);
        } catch (e) {
            console.error('Error loading users:', e);
            return getDefaultUsers();
        }
    }
    const defaultUsers = getDefaultUsers();
    saveUsers(defaultUsers);
    return defaultUsers;
}

function getDefaultUsers() {
    return [
        { id: '1', username: 'Max Mustermann', password: 'kamdi2024', createdAt: new Date().toISOString() },
        { id: '2', username: 'Anna Schmidt', password: 'kamdi2024', createdAt: new Date().toISOString() }
    ];
}

function saveUsers(users) {
    try {
        writeFileSync(usersFilePath, JSON.stringify(users, null, 2));
    } catch (e) {
        console.error('Error saving users:', e);
    }
}

let users = loadUsers();

// API endpoint for Berater authentication
app.post('/api/berater/login', (req, res) => {
    const { username, password } = req.body;
    const user = users.find(u => u.username === username && u.password === password);
    
    if (user) {
        console.log(`Berater ${username} authenticated successfully`);
        res.json({ success: true, name: username });
    } else {
        console.log(`Failed login attempt for: ${username}`);
        res.status(401).json({ success: false, message: 'Ungültige Anmeldedaten' });
    }
});

// API endpoints for user management
app.get('/api/users', (req, res) => {
    const safeUsers = users.map(u => ({
        id: u.id,
        username: u.username,
        password: u.password,
        createdAt: u.createdAt
    }));
    res.json(safeUsers);
});

app.post('/api/users', (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Benutzername und Passwort erforderlich' });
    }
    
    if (users.find(u => u.username === username)) {
        return res.status(400).json({ success: false, message: 'Benutzername bereits vergeben' });
    }
    
    const newUser = {
        id: Date.now().toString(),
        username,
        password,
        createdAt: new Date().toISOString()
    };
    
    users.push(newUser);
    saveUsers(users);
    
    console.log(`New user created: ${username}`);
    res.json({ success: true, user: { id: newUser.id, username: newUser.username, createdAt: newUser.createdAt } });
});

app.put('/api/users/:id', (req, res) => {
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
        users[userIndex].password = password;
    }
    
    saveUsers(users);
    console.log(`User updated: ${users[userIndex].username}`);
    res.json({ success: true, user: { id: users[userIndex].id, username: users[userIndex].username, createdAt: users[userIndex].createdAt } });
});

app.delete('/api/users/:id', (req, res) => {
    const { id } = req.params;
    
    const userIndex = users.findIndex(u => u.id === id);
    if (userIndex === -1) {
        return res.status(404).json({ success: false, message: 'Benutzer nicht gefunden' });
    }
    
    const deletedUser = users.splice(userIndex, 1)[0];
    saveUsers(users);
    
    console.log(`User deleted: ${deletedUser.username}`);
    res.json({ success: true });
});

const beraters = new Map();
const customerQueue = [];
const activeConnections = new Map();

io.on('connection', (socket) => {
    console.log('New socket connection:', socket.id);

    socket.on('berater-login', (data) => {
        const { name, peerId } = data;
        beraters.set(socket.id, {
            name,
            peerId,
            socketId: socket.id,
            status: 'available',
            currentCustomer: null
        });
        console.log(`Berater ${name} logged in with peer ID: ${peerId}`);
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
                io.to(customerId).emit('call-accepted', {
                    beraterName: berater.name,
                    beraterPeerId: berater.peerId
                });
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
        if (beraters.has(socket.id)) {
            const berater = beraters.get(socket.id);
            console.log(`Berater ${berater.name} disconnected`);
            beraters.delete(socket.id);
            broadcastBeraterList();
        }
        
        const queueIndex = customerQueue.findIndex(c => c.socketId === socket.id);
        if (queueIndex !== -1) {
            customerQueue.splice(queueIndex, 1);
            updateQueuePositions();
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
    const beraterList = Array.from(beraters.values()).map(b => ({
        name: b.name,
        status: b.status
    }));
    io.emit('berater-list', beraterList);
}

function notifyBeratersOfQueue() {
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

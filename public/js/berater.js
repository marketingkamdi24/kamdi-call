const socket = io();
let peer = null;
let localStream = null;
let currentCall = null;
let dataConnection = null;
let callStartTime = null;
let callTimerInterval = null;
let currentCustomer = null;
let isVideoEnabled = true;
let isAudioEnabled = true;
let beraterName = '';

const loginSection = document.getElementById('login-section');
const waitingSection = document.getElementById('waiting-section');
const incomingCallSection = document.getElementById('incoming-call-section');
const callSection = document.getElementById('call-section');

const beraterNameInput = document.getElementById('berater-name');
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const toggleStatusBtn = document.getElementById('toggle-status-btn');

const beraterProfile = document.getElementById('berater-profile');
const beraterNameDisplay = document.getElementById('berater-name-display');
const statusDot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');

const callerNameEl = document.getElementById('caller-name');
const callTypeBadgeEl = document.getElementById('call-type-badge');
const acceptCallBtn = document.getElementById('accept-call-btn');
const rejectCallBtn = document.getElementById('reject-call-btn');

const localVideo = document.getElementById('local-video');
const remoteVideo = document.getElementById('remote-video');
const remoteAudioOnly = document.getElementById('remote-audio-only');
const remoteCustomerName = document.getElementById('remote-customer-name');
const activeCallerName = document.getElementById('active-caller-name');
const chatCustomerName = document.getElementById('chat-customer-name');

const toggleVideoBtn = document.getElementById('toggle-video-btn');
const toggleAudioBtn = document.getElementById('toggle-audio-btn');
const toggleScreenBtn = document.getElementById('toggle-screen-btn');
const endCallBtn = document.getElementById('end-call-btn');

const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const sendMessageBtn = document.getElementById('send-message-btn');
const fileInput = document.getElementById('file-input');

const queueList = document.getElementById('queue-list');
const otherBeratersList = document.getElementById('other-beraters-list');

const ringtone = document.getElementById('ringtone');

function initPeer() {
    peer = new Peer(undefined, {
        host: window.location.hostname,
        port: window.location.port || 3000,
        path: '/peerjs'
    });

    peer.on('open', (id) => {
        console.log('Berater peer ID:', id);
        socket.emit('berater-login', {
            name: beraterName,
            peerId: id
        });
    });

    peer.on('call', handleIncomingPeerCall);
    peer.on('connection', handleDataConnection);
    peer.on('error', (err) => {
        console.error('Peer error:', err);
    });
}

function handleIncomingPeerCall(call) {
    currentCall = call;
    
    call.answer(localStream);
    
    call.on('stream', (remoteStream) => {
        remoteVideo.srcObject = remoteStream;
        
        const hasVideo = remoteStream.getVideoTracks().length > 0 && 
                         remoteStream.getVideoTracks()[0].enabled;
        remoteAudioOnly.classList.toggle('hidden', hasVideo);
    });

    call.on('close', () => {
        endCall(false);
    });
}

function handleDataConnection(conn) {
    dataConnection = conn;
    
    conn.on('open', () => {
        console.log('Data connection from customer established');
    });

    conn.on('data', (data) => {
        if (data.type === 'chat') {
            addChatMessage(data.message, data.senderName, false);
        } else if (data.type === 'file') {
            addFileMessage(data.fileName, data.fileData, data.fileType, data.senderName, false);
        }
    });

    conn.on('close', () => {
        console.log('Data connection closed');
    });
}

async function login() {
    const name = beraterNameInput.value.trim();
    if (!name) {
        beraterNameInput.focus();
        return;
    }

    beraterName = name;
    
    try {
        // First try to get both audio and video
        try {
            localStream = await navigator.mediaDevices.getUserMedia({
                audio: true,
                video: true
            });
            console.log('Camera and microphone activated successfully');
            isVideoEnabled = true;
        } catch (videoErr) {
            // If video fails, try audio-only
            console.log('Camera not available, trying audio-only:', videoErr.message);
            localStream = await navigator.mediaDevices.getUserMedia({
                audio: true,
                video: false
            });
            console.log('Microphone activated successfully (audio-only mode)');
            isVideoEnabled = false;
            toggleVideoBtn.classList.remove('active');
            toggleVideoBtn.classList.add('muted');
        }
        
        localVideo.srcObject = localStream;
        
        // Log active tracks for debugging
        console.log('Audio tracks:', localStream.getAudioTracks().length);
        console.log('Video tracks:', localStream.getVideoTracks().length);
        
        initPeer();
        
        beraterNameDisplay.textContent = name;
        beraterProfile.classList.remove('hidden');
        logoutBtn.classList.remove('hidden');
        toggleStatusBtn.classList.remove('hidden');
        
        showSection('waiting');
        updateStatus('available');
        
    } catch (err) {
        console.error('Media access error:', err);
        alert('Bitte erlauben Sie den Zugriff auf das Mikrofon. Fehler: ' + err.message);
    }
}

function logout() {
    if (peer) {
        peer.destroy();
        peer = null;
    }
    
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
    
    socket.disconnect();
    socket.connect();
    
    beraterProfile.classList.add('hidden');
    logoutBtn.classList.add('hidden');
    toggleStatusBtn.classList.add('hidden');
    
    showSection('login');
}

function showSection(section) {
    loginSection.classList.add('hidden');
    waitingSection.classList.add('hidden');
    incomingCallSection.classList.add('hidden');
    callSection.classList.add('hidden');

    switch (section) {
        case 'login':
            loginSection.classList.remove('hidden');
            break;
        case 'waiting':
            waitingSection.classList.remove('hidden');
            break;
        case 'incoming':
            incomingCallSection.classList.remove('hidden');
            break;
        case 'call':
            callSection.classList.remove('hidden');
            break;
    }
}

function updateStatus(status) {
    statusDot.className = 'status-dot ' + status;
    
    switch (status) {
        case 'available':
            statusText.textContent = 'Verfügbar';
            break;
        case 'busy':
            statusText.textContent = 'Im Gespräch';
            break;
        case 'ringing':
            statusText.textContent = 'Eingehender Anruf';
            break;
    }
}

function acceptCall() {
    if (ringtone) {
        ringtone.pause();
        ringtone.currentTime = 0;
    }
    
    socket.emit('accept-call', currentCustomer.customerSocketId);
    
    activeCallerName.textContent = currentCustomer.customerName;
    chatCustomerName.textContent = currentCustomer.customerName;
    remoteCustomerName.textContent = currentCustomer.customerName;
    
    showSection('call');
    startCallTimer();
    updateStatus('busy');
}

function rejectCall() {
    if (ringtone) {
        ringtone.pause();
        ringtone.currentTime = 0;
    }
    
    socket.emit('reject-call', currentCustomer.customerSocketId);
    currentCustomer = null;
    
    showSection('waiting');
    updateStatus('available');
}

function endCall(notifyServer = true) {
    if (currentCall) {
        currentCall.close();
        currentCall = null;
    }
    
    if (dataConnection) {
        dataConnection.close();
        dataConnection = null;
    }
    
    if (callTimerInterval) {
        clearInterval(callTimerInterval);
        callTimerInterval = null;
    }
    
    chatMessages.innerHTML = '';
    currentCustomer = null;
    
    if (notifyServer) {
        socket.emit('call-ended');
    }
    
    showSection('waiting');
    updateStatus('available');
}

function startCallTimer() {
    callStartTime = Date.now();
    const timerEl = document.getElementById('call-timer');
    
    callTimerInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - callStartTime) / 1000);
        const minutes = Math.floor(elapsed / 60).toString().padStart(2, '0');
        const seconds = (elapsed % 60).toString().padStart(2, '0');
        timerEl.textContent = `${minutes}:${seconds}`;
    }, 1000);
}

function toggleVideo() {
    if (localStream) {
        const videoTrack = localStream.getVideoTracks()[0];
        if (videoTrack) {
            isVideoEnabled = !isVideoEnabled;
            videoTrack.enabled = isVideoEnabled;
            toggleVideoBtn.classList.toggle('active', isVideoEnabled);
        }
    }
}

function toggleAudio() {
    if (localStream) {
        const audioTrack = localStream.getAudioTracks()[0];
        if (audioTrack) {
            isAudioEnabled = !isAudioEnabled;
            audioTrack.enabled = isAudioEnabled;
            toggleAudioBtn.classList.toggle('active', isAudioEnabled);
        }
    }
}

async function toggleScreenShare() {
    try {
        if (toggleScreenBtn.classList.contains('active')) {
            const videoTrack = localStream.getVideoTracks()[0];
            if (videoTrack) {
                const newStream = await navigator.mediaDevices.getUserMedia({ video: true });
                const newVideoTrack = newStream.getVideoTracks()[0];
                
                localStream.removeTrack(videoTrack);
                localStream.addTrack(newVideoTrack);
                localVideo.srcObject = localStream;
                
                if (currentCall) {
                    const sender = currentCall.peerConnection.getSenders().find(s => s.track.kind === 'video');
                    if (sender) {
                        sender.replaceTrack(newVideoTrack);
                    }
                }
            }
            toggleScreenBtn.classList.remove('active');
        } else {
            const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
            const screenTrack = screenStream.getVideoTracks()[0];
            
            const videoTrack = localStream.getVideoTracks()[0];
            localStream.removeTrack(videoTrack);
            localStream.addTrack(screenTrack);
            localVideo.srcObject = localStream;
            
            if (currentCall) {
                const sender = currentCall.peerConnection.getSenders().find(s => s.track.kind === 'video');
                if (sender) {
                    sender.replaceTrack(screenTrack);
                }
            }
            
            screenTrack.onended = () => {
                toggleScreenShare();
            };
            
            toggleScreenBtn.classList.add('active');
        }
    } catch (err) {
        console.error('Screen share error:', err);
    }
}

function sendChatMessage() {
    const message = chatInput.value.trim();
    if (!message || !dataConnection) return;

    dataConnection.send({
        type: 'chat',
        message,
        senderName: beraterName
    });

    addChatMessage(message, 'Sie', true);
    chatInput.value = '';
}

function addChatMessage(message, senderName, isSent) {
    const msgEl = document.createElement('div');
    msgEl.className = `chat-message ${isSent ? 'sent' : 'received'}`;
    msgEl.innerHTML = `
        <div class="sender">${senderName}</div>
        <div class="text">${escapeHtml(message)}</div>
    `;
    chatMessages.appendChild(msgEl);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file || !dataConnection) return;

    const reader = new FileReader();
    reader.onload = () => {
        dataConnection.send({
            type: 'file',
            fileName: file.name,
            fileData: reader.result,
            fileType: file.type,
            senderName: beraterName
        });

        addFileMessage(file.name, reader.result, file.type, 'Sie', true);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
}

function addFileMessage(fileName, fileData, fileType, senderName, isSent) {
    const msgEl = document.createElement('div');
    msgEl.className = `chat-message file ${isSent ? 'sent' : 'received'}`;
    msgEl.innerHTML = `
        <div class="sender">${senderName}</div>
        <a href="${fileData}" download="${fileName}" class="file-link">
            📄 ${escapeHtml(fileName)}
        </a>
    `;
    chatMessages.appendChild(msgEl);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function updateQueueDisplay(queue) {
    if (queue.length === 0) {
        queueList.innerHTML = '<p class="empty-queue">Keine wartenden Kunden</p>';
        return;
    }

    queueList.innerHTML = queue.map((customer, index) => `
        <div class="queue-item">
            <div class="name">
                <span>${customer.callType === 'video' ? '📹' : '📞'}</span>
                <span>${escapeHtml(customer.name)}</span>
            </div>
            <span class="wait-time">${formatWaitTime(customer.waitTime)}</span>
        </div>
    `).join('');
}

function formatWaitTime(seconds) {
    if (seconds < 60) return `${seconds}s`;
    return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function updateOtherBeraters(beraters) {
    const others = beraters.filter(b => b.name !== beraterName);
    
    if (others.length === 0) {
        otherBeratersList.innerHTML = '<p class="empty-queue">Keine anderen Berater</p>';
        return;
    }

    otherBeratersList.innerHTML = others.map(b => `
        <div class="berater-item-sidebar">
            <span class="berater-dot ${b.status}"></span>
            <span>${escapeHtml(b.name)}</span>
        </div>
    `).join('');
}

socket.on('incoming-call', (data) => {
    currentCustomer = data;
    
    callerNameEl.textContent = data.customerName;
    callTypeBadgeEl.textContent = data.callType === 'video' ? '📹 Video' : '📞 Audio';
    
    showSection('incoming');
    updateStatus('ringing');
    
    if (ringtone) {
        ringtone.play().catch(e => console.log('Ringtone autoplay blocked'));
    }
});

socket.on('queue-update', updateQueueDisplay);
socket.on('berater-list', updateOtherBeraters);

socket.on('customer-disconnected', () => {
    if (ringtone) {
        ringtone.pause();
        ringtone.currentTime = 0;
    }
    
    if (currentCall) {
        endCall(false);
    } else {
        currentCustomer = null;
        showSection('waiting');
        updateStatus('available');
    }
});

loginBtn.addEventListener('click', login);
logoutBtn.addEventListener('click', logout);
acceptCallBtn.addEventListener('click', acceptCall);
rejectCallBtn.addEventListener('click', rejectCall);
endCallBtn.addEventListener('click', () => endCall(true));

toggleVideoBtn.addEventListener('click', toggleVideo);
toggleAudioBtn.addEventListener('click', toggleAudio);
toggleScreenBtn.addEventListener('click', toggleScreenShare);

sendMessageBtn.addEventListener('click', sendChatMessage);
chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendChatMessage();
});
fileInput.addEventListener('change', handleFileSelect);

beraterNameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') login();
});

toggleStatusBtn.addEventListener('click', () => {
    const currentStatus = statusDot.classList.contains('available') ? 'available' : 'busy';
    const newStatus = currentStatus === 'available' ? 'busy' : 'available';
    socket.emit('berater-status', newStatus);
    updateStatus(newStatus);
});

const socket = io();
let peer = null;
let localStream = null;
let currentCall = null;
let dataConnection = null;
let callStartTime = null;
let callTimerInterval = null;
let currentBeraterSocketId = null;
let isVideoEnabled = true;
let isAudioEnabled = true;

const loginSection = document.getElementById('login-section');
const queueSection = document.getElementById('queue-section');
const connectingSection = document.getElementById('connecting-section');
const callSection = document.getElementById('call-section');
const callEndedSection = document.getElementById('call-ended-section');

const customerNameInput = document.getElementById('customer-name');
const videoCallBtn = document.getElementById('video-call-btn');
const audioCallBtn = document.getElementById('audio-call-btn');
const cancelCallBtn = document.getElementById('cancel-call-btn');
const endCallBtn = document.getElementById('end-call-btn');
const newCallBtn = document.getElementById('new-call-btn');

const beraterListEl = document.getElementById('berater-list');
const queuePositionEl = document.getElementById('queue-position-number');
const connectingBeraterNameEl = document.getElementById('connecting-berater-name');
const callBeraterNameEl = document.getElementById('call-berater-name');

const localVideo = document.getElementById('local-video');
const remoteVideo = document.getElementById('remote-video');
const remoteAudioOnly = document.getElementById('remote-audio-only');

const toggleVideoBtn = document.getElementById('toggle-video-btn');
const toggleAudioBtn = document.getElementById('toggle-audio-btn');

const chatPanel = document.getElementById('chat-panel');
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const sendMessageBtn = document.getElementById('send-message-btn');
const fileInput = document.getElementById('file-input');

const queueAudio = document.getElementById('queue-audio'); // May be null if audio element removed

function initPeer() {
    const isSecure = window.location.protocol === 'https:';
    const peerConfig = {
        host: window.location.hostname,
        path: '/peerjs',
        secure: isSecure
    };
    
    if (window.location.port) {
        peerConfig.port = parseInt(window.location.port);
    } else {
        peerConfig.port = isSecure ? 443 : 80;
    }
    
    console.log('PeerJS config:', peerConfig);
    peer = new Peer(undefined, peerConfig);

    peer.on('open', (id) => {
        console.log('My peer ID:', id);
    });

    peer.on('call', handleIncomingCall);
    peer.on('connection', handleDataConnection);
    peer.on('error', (err) => {
        console.error('Peer error:', err);
        alert('Verbindungsfehler. Bitte versuchen Sie es erneut.');
    });
}

function handleIncomingCall(call) {
    currentCall = call;
    
    call.answer(localStream);
    
    call.on('stream', (remoteStream) => {
        remoteVideo.srcObject = remoteStream;
        
        const hasVideo = remoteStream.getVideoTracks().length > 0 && 
                         remoteStream.getVideoTracks()[0].enabled;
        remoteAudioOnly.classList.toggle('hidden', hasVideo);
        
        // Listen for track changes (e.g., screen sharing)
        if (call.peerConnection) {
            call.peerConnection.ontrack = (event) => {
                console.log('Track received:', event.track.kind);
                if (event.streams && event.streams[0]) {
                    remoteVideo.srcObject = event.streams[0];
                    const hasVideo = event.streams[0].getVideoTracks().length > 0;
                    remoteAudioOnly.classList.toggle('hidden', hasVideo);
                }
            };
        }
    });

    call.on('close', () => {
        endCall();
    });
}

function handleDataConnection(conn) {
    dataConnection = conn;
    
    conn.on('open', () => {
        console.log('Data connection established');
    });

    conn.on('data', (data) => {
        if (data.type === 'chat') {
            addChatMessage(data.message, data.senderName, false);
        } else if (data.type === 'file') {
            addFileMessage(data.fileName, data.fileData, data.fileType, data.senderName, false);
        } else if (data.type === 'config-update') {
            updateConfigPreview(data.config);
        } else if (data.type === 'drawings-update') {
            updateDrawings(data.drawings);
        } else if (data.type === 'appointment-booked') {
            showAppointmentNotification(data.appointment);
        } else if (data.type === 'consultation-summary') {
            showConsultationSummary(data);
        } else if (data.type === 'screen-share-started') {
            console.log('Berater started screen sharing');
            refreshRemoteVideo();
        } else if (data.type === 'screen-share-ended') {
            console.log('Berater stopped screen sharing');
            refreshRemoteVideo();
        }
    });

    conn.on('close', () => {
        console.log('Data connection closed');
    });
}

async function startCall(callType) {
    const name = customerNameInput.value.trim();
    if (!name) {
        customerNameInput.focus();
        customerNameInput.classList.add('error');
        setTimeout(() => customerNameInput.classList.remove('error'), 2000);
        return;
    }

    try {
        // Try to get media based on call type
        if (callType === 'video') {
            try {
                localStream = await navigator.mediaDevices.getUserMedia({
                    audio: true,
                    video: true
                });
                isVideoEnabled = true;
            } catch (videoErr) {
                // Fallback to audio-only if video fails
                console.log('Video not available, trying audio-only:', videoErr.message);
                localStream = await navigator.mediaDevices.getUserMedia({
                    audio: true,
                    video: false
                });
                isVideoEnabled = false;
                toggleVideoBtn.classList.add('muted');
                callType = 'audio';
            }
        } else {
            // Audio-only call
            localStream = await navigator.mediaDevices.getUserMedia({
                audio: true,
                video: false
            });
            isVideoEnabled = false;
            toggleVideoBtn.classList.add('muted');
        }
        
        localVideo.srcObject = localStream;
        console.log('Media access granted - Audio:', localStream.getAudioTracks().length, 'Video:', localStream.getVideoTracks().length);

        showSection('queue');
        
        if (queueAudio) {
            queueAudio.play().catch(e => console.log('Audio autoplay blocked'));
        }

        socket.emit('customer-call', {
            name,
            peerId: peer.id,
            callType
        });

    } catch (err) {
        console.error('Media access error:', err);
        alert('Mikrofon-Zugriff erforderlich. Bitte erlauben Sie den Zugriff in Ihren Browser-Einstellungen und laden Sie die Seite neu.');
    }
}

function cancelCall() {
    socket.emit('customer-cancel');
    
    if (queueAudio) {
        queueAudio.pause();
        queueAudio.currentTime = 0;
    }
    
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
    
    showSection('login');
}

function endCall() {
    if (currentCall) {
        currentCall.close();
        currentCall = null;
    }
    
    if (dataConnection) {
        dataConnection.close();
        dataConnection = null;
    }
    
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
    
    if (callTimerInterval) {
        clearInterval(callTimerInterval);
        callTimerInterval = null;
    }
    
    socket.emit('call-ended');
    showSection('ended');
}

function showSection(section) {
    loginSection.classList.add('hidden');
    queueSection.classList.add('hidden');
    connectingSection.classList.add('hidden');
    callSection.classList.add('hidden');
    callEndedSection.classList.add('hidden');

    switch (section) {
        case 'login':
            loginSection.classList.remove('hidden');
            break;
        case 'queue':
            queueSection.classList.remove('hidden');
            break;
        case 'connecting':
            connectingSection.classList.remove('hidden');
            break;
        case 'call':
            callSection.classList.remove('hidden');
            break;
        case 'ended':
            callEndedSection.classList.remove('hidden');
            break;
    }
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
            toggleVideoBtn.classList.toggle('muted', !isVideoEnabled);
        }
    }
}

function toggleAudio() {
    if (localStream) {
        const audioTrack = localStream.getAudioTracks()[0];
        if (audioTrack) {
            isAudioEnabled = !isAudioEnabled;
            audioTrack.enabled = isAudioEnabled;
            toggleAudioBtn.classList.toggle('muted', !isAudioEnabled);
        }
    }
}

function sendChatMessage() {
    const message = chatInput.value.trim();
    if (!message || !dataConnection) return;

    dataConnection.send({
        type: 'chat',
        message,
        senderName: customerNameInput.value.trim()
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
            senderName: customerNameInput.value.trim()
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

function updateBeraterList(beraters) {
    if (beraters.length === 0) {
        beraterListEl.innerHTML = '<p class="loading">Keine Berater verfügbar</p>';
        return;
    }

    beraterListEl.innerHTML = beraters.map(b => `
        <div class="berater-item">
            <span class="berater-dot ${b.status}"></span>
            <span>${escapeHtml(b.name)}</span>
        </div>
    `).join('');
}

socket.on('berater-list', updateBeraterList);

socket.on('queue-position', (data) => {
    queuePositionEl.textContent = data.position;
});

socket.on('call-connecting', (data) => {
    if (queueAudio) {
        queueAudio.pause();
        queueAudio.currentTime = 0;
    }
    connectingBeraterNameEl.textContent = data.beraterName;
    showSection('connecting');
});

socket.on('call-accepted', (data) => {
    callBeraterNameEl.textContent = data.beraterName;
    currentBeraterSocketId = data.beraterSocketId;
    
    const call = peer.call(data.beraterPeerId, localStream);
    currentCall = call;
    
    call.on('stream', (remoteStream) => {
        remoteVideo.srcObject = remoteStream;
        
        const hasVideo = remoteStream.getVideoTracks().length > 0;
        remoteAudioOnly.classList.toggle('hidden', hasVideo);
        
        // Listen for track changes (e.g., screen sharing)
        if (call.peerConnection) {
            call.peerConnection.ontrack = (event) => {
                console.log('Track received:', event.track.kind);
                if (event.streams && event.streams[0]) {
                    remoteVideo.srcObject = event.streams[0];
                    const hasVideo = event.streams[0].getVideoTracks().length > 0;
                    remoteAudioOnly.classList.toggle('hidden', hasVideo);
                }
            };
        }
    });

    call.on('close', () => {
        endCall();
    });

    const conn = peer.connect(data.beraterPeerId);
    conn.on('open', () => {
        dataConnection = conn;
        console.log('Data connection to berater established');
    });

    conn.on('data', (data) => {
        if (data.type === 'chat') {
            addChatMessage(data.message, data.senderName, false);
        } else if (data.type === 'file') {
            addFileMessage(data.fileName, data.fileData, data.fileType, data.senderName, false);
        }
    });

    showSection('call');
    startCallTimer();
});

socket.on('call-rejected', () => {
    showSection('queue');
    if (queueAudio) {
        queueAudio.play().catch(e => console.log('Audio autoplay blocked'));
    }
});

videoCallBtn.addEventListener('click', () => startCall('video'));
audioCallBtn.addEventListener('click', () => startCall('audio'));
cancelCallBtn.addEventListener('click', cancelCall);
endCallBtn.addEventListener('click', endCall);
newCallBtn.addEventListener('click', () => {
    initPeer();
    showSection('login');
});

toggleVideoBtn.addEventListener('click', toggleVideo);
toggleAudioBtn.addEventListener('click', toggleAudio);

sendMessageBtn.addEventListener('click', sendChatMessage);
chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendChatMessage();
});
fileInput.addEventListener('change', handleFileSelect);

customerNameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') startCall('video');
});

// Close appointment notification
document.getElementById('close-appointment-notification')?.addEventListener('click', () => {
    document.getElementById('appointment-notification')?.classList.add('hidden');
});

// ============================================
// TOOLS - Handle data from Berater
// ============================================

let customerDrawingCanvas = null;

function updateConfigPreview(config) {
    const preview = document.getElementById('config-preview');
    if (!preview) return;

    // Show the preview panel
    preview.classList.add('active');

    // Update brand
    const brand = document.getElementById('preview-brand');
    if (brand) {
        brand.textContent = config.brand?.name || '-';
    }

    // Update model
    const modelName = document.getElementById('preview-model-name');
    if (modelName) {
        modelName.textContent = config.model?.name || '-';
    }

    // Update model power
    const modelPower = document.getElementById('preview-model-power');
    if (modelPower) {
        modelPower.textContent = config.model?.power || '';
    }

    // Update color
    const color = document.getElementById('preview-color');
    if (color) {
        color.textContent = config.color?.name || '-';
    }

    // Update cladding
    const cladding = document.getElementById('preview-cladding');
    if (cladding) {
        cladding.textContent = config.cladding?.name || '-';
    }

    // Update accessories
    const accessories = document.getElementById('preview-accessories');
    if (accessories) {
        if (config.accessories && config.accessories.length > 0) {
            accessories.textContent = config.accessories.map(a => a.name).join(', ');
        } else {
            accessories.textContent = '-';
        }
    }

    // Update price
    const price = document.getElementById('preview-price');
    if (price) {
        price.textContent = `${(config.totalPrice || 0).toLocaleString('de-DE')} €`;
    }
}

function updateDrawings(drawings) {
    // Initialize canvas if not exists
    if (!customerDrawingCanvas && window.DrawingCanvas) {
        const remoteVideo = document.getElementById('remote-video');
        if (remoteVideo) {
            const wrapper = remoteVideo.parentElement;
            if (wrapper) {
                customerDrawingCanvas = new DrawingCanvas();
                customerDrawingCanvas.init(wrapper.offsetWidth, wrapper.offsetHeight);
                customerDrawingCanvas.attachToElement(wrapper);
            }
        }
    }

    // Load drawings from Berater
    if (customerDrawingCanvas) {
        customerDrawingCanvas.loadDrawings(drawings);
    }
}

function showAppointmentNotification(appointment) {
    const notification = document.getElementById('appointment-notification');
    const details = document.getElementById('appointment-details');
    
    if (!notification || !details) return;

    const dateStr = new Date(`${appointment.date}T${appointment.time}`).toLocaleDateString('de-DE', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    details.innerHTML = `
        <strong>${dateStr}</strong><br>
        ${appointment.note || ''}<br>
        <small>Berater: ${appointment.beraterName}</small>
    `;

    notification.classList.remove('hidden');

    // Auto-hide after 10 seconds
    setTimeout(() => {
        notification.classList.add('hidden');
    }, 10000);
}

function showConsultationSummary(summary) {
    // Add summary to chat
    const summaryHtml = `
        <div class="consultation-summary-msg">
            <h4>📋 Beratungs-Zusammenfassung</h4>
            ${summary.config?.model ? `<p><strong>Modell:</strong> ${summary.config.model.name}</p>` : ''}
            ${summary.config?.color ? `<p><strong>Farbe:</strong> ${summary.config.color.name}</p>` : ''}
            ${summary.config?.cladding ? `<p><strong>Verkleidung:</strong> ${summary.config.cladding.name}</p>` : ''}
            ${summary.config?.totalPrice ? `<p><strong>Preis:</strong> ${summary.config.totalPrice.toLocaleString('de-DE')} €</p>` : ''}
            ${summary.nextSteps?.length > 0 ? `
                <p><strong>Nächste Schritte:</strong></p>
                <ul>${summary.nextSteps.map(s => `<li>${s}</li>`).join('')}</ul>
            ` : ''}
        </div>
    `;
    
    const chatMessages = document.getElementById('chat-messages');
    if (chatMessages) {
        const msgEl = document.createElement('div');
        msgEl.className = 'chat-message other system-message';
        msgEl.innerHTML = summaryHtml;
        chatMessages.appendChild(msgEl);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
}

function refreshRemoteVideo() {
    // Force video element to refresh and pick up new track
    if (currentCall && currentCall.peerConnection) {
        const receivers = currentCall.peerConnection.getReceivers();
        const videoReceiver = receivers.find(r => r.track && r.track.kind === 'video');
        
        if (videoReceiver && videoReceiver.track) {
            console.log('Refreshing video with track:', videoReceiver.track.id);
            const stream = new MediaStream([videoReceiver.track]);
            
            // Also add audio track if exists
            const audioReceiver = receivers.find(r => r.track && r.track.kind === 'audio');
            if (audioReceiver && audioReceiver.track) {
                stream.addTrack(audioReceiver.track);
            }
            
            remoteVideo.srcObject = stream;
            remoteAudioOnly.classList.add('hidden');
        }
    }
}

initPeer();

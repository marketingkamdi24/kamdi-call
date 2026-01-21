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
const userManagementBtn = document.getElementById('user-management-btn');

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
    const password = document.getElementById('berater-password').value;
    const loginError = document.getElementById('login-error');
    
    if (!name || !password) {
        if (!name) beraterNameInput.focus();
        else document.getElementById('berater-password').focus();
        return;
    }

    // Authenticate with server
    try {
        const response = await fetch('/api/berater/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: name, password })
        });
        
        const result = await response.json();
        
        if (!result.success) {
            loginError.classList.remove('hidden');
            loginError.textContent = result.message || 'Ungültige Anmeldedaten';
            return;
        }
        
        loginError.classList.add('hidden');
        beraterName = result.name;
    } catch (err) {
        console.error('Auth error:', err);
        loginError.classList.remove('hidden');
        loginError.textContent = 'Verbindungsfehler';
        return;
    }
    
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
        
        beraterNameDisplay.textContent = beraterName;
        beraterProfile.classList.remove('hidden');
        logoutBtn.classList.remove('hidden');
        toggleStatusBtn.classList.remove('hidden');
        userManagementBtn.classList.remove('hidden');
        
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
    userManagementBtn.classList.add('hidden');
    
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
            // Stop screen sharing, return to camera
            const screenTrack = localStream.getVideoTracks()[0];
            if (screenTrack) {
                screenTrack.stop();
                localStream.removeTrack(screenTrack);
            }
            
            try {
                const newStream = await navigator.mediaDevices.getUserMedia({ video: true });
                const newVideoTrack = newStream.getVideoTracks()[0];
                localStream.addTrack(newVideoTrack);
                localVideo.srcObject = localStream;
                
                if (currentCall && currentCall.peerConnection) {
                    const sender = currentCall.peerConnection.getSenders().find(s => s.track && s.track.kind === 'video');
                    if (sender) {
                        await sender.replaceTrack(newVideoTrack);
                    }
                }
                isVideoEnabled = true;
                toggleVideoBtn.classList.add('active');
                toggleVideoBtn.classList.remove('muted');
            } catch (camErr) {
                console.log('Camera not available after screen share');
                isVideoEnabled = false;
                toggleVideoBtn.classList.remove('active');
                toggleVideoBtn.classList.add('muted');
            }
            
            toggleScreenBtn.classList.remove('active');
        } else {
            // Start screen sharing
            const screenStream = await navigator.mediaDevices.getDisplayMedia({ 
                video: { cursor: 'always' },
                audio: false 
            });
            const screenTrack = screenStream.getVideoTracks()[0];
            
            // Remove existing video track if any
            const existingVideoTrack = localStream.getVideoTracks()[0];
            if (existingVideoTrack) {
                existingVideoTrack.stop();
                localStream.removeTrack(existingVideoTrack);
            }
            
            localStream.addTrack(screenTrack);
            localVideo.srcObject = localStream;
            
            if (currentCall && currentCall.peerConnection) {
                const sender = currentCall.peerConnection.getSenders().find(s => s.track && s.track.kind === 'video');
                if (sender) {
                    await sender.replaceTrack(screenTrack);
                    console.log('Screen track replaced successfully');
                } else {
                    // No video sender exists, need to add track
                    currentCall.peerConnection.addTrack(screenTrack, localStream);
                    console.log('Screen track added to connection');
                }
            }
            
            screenTrack.onended = () => {
                console.log('Screen sharing ended by user');
                toggleScreenShare();
            };
            
            toggleScreenBtn.classList.add('active');
        }
    } catch (err) {
        console.error('Screen share error:', err);
        alert('Bildschirmfreigabe fehlgeschlagen: ' + err.message);
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

// ============================================
// TOOLS PANEL FUNCTIONALITY
// ============================================

const toolsToggleBtn = document.getElementById('tools-toggle-btn');
const toolsPanel = document.getElementById('tools-panel');
const toolsPanelClose = document.getElementById('tools-panel-close');
const toolsTabs = document.querySelectorAll('.tools-tab');
const toolsSections = document.querySelectorAll('.tools-section');

// Product Configurator
let configurator = null;
let drawingCanvas = null;
let consultationSummary = null;
let chatHistory = [];

function initTools() {
    // Initialize Drawing Canvas
    if (window.DrawingCanvas) {
        drawingCanvas = new DrawingCanvas('remote-video');
        drawingCanvas.onChange((drawings) => {
            sendDrawingsToCustomer(drawings);
        });
    }

    // Initialize Consultation Summary
    if (window.ConsultationSummary) {
        consultationSummary = new ConsultationSummary();
    }

    // Setup Tools Panel Events
    setupToolsPanelEvents();
}

function sendDrawingsToCustomer(drawings) {
    if (dataConnection && dataConnection.open) {
        dataConnection.send({
            type: 'drawings-update',
            drawings: drawings
        });
    }
}

function setupToolsPanelEvents() {
    // Toggle Panel
    if (toolsToggleBtn) {
        toolsToggleBtn.addEventListener('click', () => {
            toolsPanel.classList.toggle('open');
            toolsToggleBtn.classList.toggle('panel-open');
        });
    }

    if (toolsPanelClose) {
        toolsPanelClose.addEventListener('click', () => {
            toolsPanel.classList.remove('open');
            toolsToggleBtn.classList.remove('panel-open');
        });
    }

    // Tab Switching
    toolsTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabId = tab.dataset.tab;
            toolsTabs.forEach(t => t.classList.remove('active'));
            toolsSections.forEach(s => s.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(`${tabId}-section`)?.classList.add('active');
        });
    });

    // Compare Mode Toggle
    const compareMode = document.getElementById('compare-mode');
    const compareView = document.getElementById('compare-view');
    if (compareMode && compareView) {
        compareMode.addEventListener('change', () => {
            compareView.classList.toggle('active', compareMode.checked);
        });
    }

    // Drawing Tools
    const drawToolBtns = document.querySelectorAll('.draw-tool-btn');
    drawToolBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            drawToolBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            if (drawingCanvas) drawingCanvas.setTool(btn.dataset.tool);
        });
    });

    const colorPicks = document.querySelectorAll('.color-pick');
    colorPicks.forEach(pick => {
        pick.addEventListener('click', () => {
            colorPicks.forEach(p => p.classList.remove('active'));
            pick.classList.add('active');
            if (drawingCanvas) drawingCanvas.setColor(pick.dataset.color);
        });
    });

    document.getElementById('drawing-undo')?.addEventListener('click', () => {
        if (drawingCanvas) drawingCanvas.undo();
    });

    document.getElementById('drawing-clear')?.addEventListener('click', () => {
        if (drawingCanvas) drawingCanvas.clear();
    });

    // Checklist
    const checklistItems = document.querySelectorAll('.checklist-item');
    checklistItems.forEach(item => {
        item.addEventListener('click', () => {
            item.classList.toggle('checked');
        });
    });

    // Follow-up Actions
    document.getElementById('add-step-btn')?.addEventListener('click', () => {
        const stepText = prompt('Neuen Schritt eingeben:');
        if (stepText) {
            const stepsList = document.getElementById('next-steps-list');
            const newStep = document.createElement('div');
            newStep.className = 'next-step-item';
            newStep.innerHTML = `<input type="checkbox"><span>${stepText}</span>`;
            stepsList.appendChild(newStep);
        }
    });

    document.getElementById('export-pdf-btn')?.addEventListener('click', exportPDF);
    document.getElementById('send-summary-btn')?.addEventListener('click', sendSummaryToCustomer);
    document.getElementById('book-appointment-btn')?.addEventListener('click', bookAppointment);
}

function getChecklist() {
    const items = [];
    document.querySelectorAll('.checklist-item').forEach(item => {
        items.push({
            text: item.querySelector('.checklist-text').textContent,
            checked: item.classList.contains('checked')
        });
    });
    return items;
}

function getNextSteps() {
    const steps = [];
    document.querySelectorAll('.next-step-item').forEach(item => {
        if (item.querySelector('input').checked) {
            steps.push(item.querySelector('span').textContent);
        }
    });
    return steps;
}

function exportPDF() {
    if (!consultationSummary) return;

    consultationSummary.setCustomerInfo(currentCustomer?.customerName || 'Unbekannt');
    consultationSummary.setBeraterInfo(beraterName);
    consultationSummary.setCallInfo(document.getElementById('call-timer')?.textContent, currentCustomer?.callType);
    consultationSummary.setChecklist(getChecklist());
    consultationSummary.setChatMessages(chatHistory);
    if (configurator) consultationSummary.setProductConfig(configurator.getConfig());
    consultationSummary.setNotes(document.getElementById('consultation-notes')?.value || '');
    consultationSummary.setNextSteps(getNextSteps());
    
    const appointmentDate = document.getElementById('appointment-date')?.value;
    const appointmentTime = document.getElementById('appointment-time')?.value;
    if (appointmentDate && appointmentTime) {
        consultationSummary.setAppointment(new Date(`${appointmentDate}T${appointmentTime}`));
    }

    consultationSummary.downloadPDF();
}

function sendSummaryToCustomer() {
    if (!dataConnection || !dataConnection.open) {
        alert('Keine Verbindung zum Kunden');
        return;
    }

    const summary = {
        type: 'consultation-summary',
        beraterName: beraterName,
        config: configurator ? configurator.getConfig() : null,
        checklist: getChecklist(),
        nextSteps: getNextSteps(),
        notes: document.getElementById('consultation-notes')?.value || ''
    };

    dataConnection.send(summary);
    alert('Zusammenfassung wurde an den Kunden gesendet!');
}

function bookAppointment() {
    const date = document.getElementById('appointment-date')?.value;
    const time = document.getElementById('appointment-time')?.value;
    const note = document.getElementById('appointment-note')?.value;

    if (!date || !time) {
        alert('Bitte Datum und Uhrzeit auswählen');
        return;
    }

    const appointment = {
        date: date,
        time: time,
        note: note,
        customerName: currentCustomer?.customerName,
        beraterName: beraterName
    };

    // Send to customer
    if (dataConnection && dataConnection.open) {
        dataConnection.send({
            type: 'appointment-booked',
            appointment: appointment
        });
    }

    alert(`Termin gebucht: ${date} um ${time}\n${note || ''}`);
}

// Show tools button when in call
function showToolsButton() {
    if (toolsToggleBtn) toolsToggleBtn.classList.remove('hidden');
}

function hideToolsButton() {
    if (toolsToggleBtn) toolsToggleBtn.classList.add('hidden');
    if (toolsPanel) toolsPanel.classList.remove('open');
}

// Track chat messages for summary
const originalAddMessage = window.addChatMessage;
function addChatMessageWithTracking(text, senderName, isOwn) {
    chatHistory.push({
        text: text,
        sender: senderName,
        isCustomer: !isOwn,
        timestamp: new Date()
    });
    
    // Call original function
    const messageEl = document.createElement('div');
    messageEl.className = `chat-message ${isOwn ? 'own' : 'other'}`;
    messageEl.innerHTML = `
        <span class="sender">${senderName}</span>
        <p>${text}</p>
    `;
    chatMessages.appendChild(messageEl);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Override the section show function to toggle tools
const originalShowSection = showSection;
window.showSection = function(section) {
    originalShowSection(section);
    if (section === 'call') {
        showToolsButton();
        initDrawingCanvas();
    } else {
        hideToolsButton();
    }
};

function initDrawingCanvas() {
    if (drawingCanvas && remoteVideo) {
        setTimeout(() => {
            const videoWrapper = remoteVideo.parentElement;
            if (videoWrapper) {
                drawingCanvas.init(videoWrapper.offsetWidth, videoWrapper.offsetHeight);
                drawingCanvas.attachToElement(videoWrapper);
            }
        }, 500);
    }
}

// Initialize tools on load
document.addEventListener('DOMContentLoaded', initTools);

// ==================== USER MANAGEMENT ====================
const userManagementModal = document.getElementById('user-management-modal');
const userFormModal = document.getElementById('user-form-modal');
const userTableBody = document.getElementById('user-table-body');
const closeUserModal = document.getElementById('close-user-modal');
const closeUserForm = document.getElementById('close-user-form');
const addUserBtn = document.getElementById('add-user-btn');
const cancelUserForm = document.getElementById('cancel-user-form');
const saveUserBtn = document.getElementById('save-user-btn');
const userFormTitle = document.getElementById('user-form-title');
const editUserId = document.getElementById('edit-user-id');
const userUsername = document.getElementById('user-username');
const userPassword = document.getElementById('user-password');
const userPasswordConfirm = document.getElementById('user-password-confirm');
const userFormError = document.getElementById('user-form-error');
const currentPasswordGroup = document.getElementById('current-password-group');
const userCurrentPassword = document.getElementById('user-current-password');
const passwordLabel = document.getElementById('password-label');
const passwordConfirmLabel = document.getElementById('password-confirm-label');

if (userManagementBtn) {
    userManagementBtn.addEventListener('click', openUserManagement);
}

if (closeUserModal) {
    closeUserModal.addEventListener('click', closeUserManagement);
}

if (closeUserForm) {
    closeUserForm.addEventListener('click', closeUserFormModal);
}

if (cancelUserForm) {
    cancelUserForm.addEventListener('click', closeUserFormModal);
}

if (addUserBtn) {
    addUserBtn.addEventListener('click', () => openUserForm());
}

if (saveUserBtn) {
    saveUserBtn.addEventListener('click', saveUser);
}

if (userManagementModal) {
    userManagementModal.addEventListener('click', (e) => {
        if (e.target === userManagementModal) closeUserManagement();
    });
}

if (userFormModal) {
    userFormModal.addEventListener('click', (e) => {
        if (e.target === userFormModal) closeUserFormModal();
    });
}

async function openUserManagement() {
    userManagementModal.classList.remove('hidden');
    await loadUsers();
}

function closeUserManagement() {
    userManagementModal.classList.add('hidden');
}

function openUserForm(user = null) {
    editUserId.value = user ? user.id : '';
    userUsername.value = user ? user.username : '';
    userPassword.value = '';
    userPasswordConfirm.value = '';
    userFormError.classList.add('hidden');
    
    if (user) {
        // Edit mode - show current password
        userFormTitle.textContent = 'Nutzer bearbeiten';
        currentPasswordGroup.style.display = 'block';
        userCurrentPassword.value = user.password || '';
        passwordLabel.textContent = 'Neues Passwort (optional)';
        passwordConfirmLabel.textContent = 'Neues Passwort bestätigen';
        userPassword.placeholder = 'Leer lassen um Passwort zu behalten';
        userPasswordConfirm.placeholder = 'Leer lassen um Passwort zu behalten';
    } else {
        // Add mode
        userFormTitle.textContent = 'Nutzer hinzufügen';
        currentPasswordGroup.style.display = 'none';
        userCurrentPassword.value = '';
        passwordLabel.textContent = 'Passwort';
        passwordConfirmLabel.textContent = 'Passwort bestätigen';
        userPassword.placeholder = 'Passwort eingeben';
        userPasswordConfirm.placeholder = 'Passwort bestätigen';
    }
    
    userFormModal.classList.remove('hidden');
}

function closeUserFormModal() {
    userFormModal.classList.add('hidden');
}

async function loadUsers() {
    try {
        const response = await fetch('/api/users');
        const users = await response.json();
        renderUserTable(users);
    } catch (err) {
        console.error('Error loading users:', err);
    }
}

function renderUserTable(users) {
    userTableBody.innerHTML = users.map(user => `
        <tr>
            <td>${user.username}</td>
            <td>${new Date(user.createdAt).toLocaleDateString('de-DE')}</td>
            <td class="actions">
                <button class="btn-edit" onclick="editUser('${user.id}', '${user.username}', '${user.password}')">✏️ Bearbeiten</button>
                <button class="btn-delete" onclick="deleteUser('${user.id}', '${user.username}')">🗑️ Löschen</button>
            </td>
        </tr>
    `).join('');
}

window.editUser = function(id, username, password) {
    openUserForm({ id, username, password });
};

window.deleteUser = async function(id, username) {
    if (!confirm(`Möchten Sie den Nutzer "${username}" wirklich löschen?`)) {
        return;
    }
    
    try {
        const response = await fetch(`/api/users/${id}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            await loadUsers();
        } else {
            const data = await response.json();
            alert(data.message || 'Fehler beim Löschen');
        }
    } catch (err) {
        console.error('Error deleting user:', err);
        alert('Fehler beim Löschen des Nutzers');
    }
};

async function saveUser() {
    const id = editUserId.value;
    const username = userUsername.value.trim();
    const password = userPassword.value;
    const passwordConfirm = userPasswordConfirm.value;
    
    if (!username) {
        showUserFormError('Bitte Benutzername eingeben');
        return;
    }
    
    if (!id && !password) {
        showUserFormError('Bitte Passwort eingeben');
        return;
    }
    
    if (password && password !== passwordConfirm) {
        showUserFormError('Passwörter stimmen nicht überein');
        return;
    }
    
    try {
        const url = id ? `/api/users/${id}` : '/api/users';
        const method = id ? 'PUT' : 'POST';
        const body = { username };
        if (password) body.password = password;
        
        const response = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            closeUserFormModal();
            await loadUsers();
        } else {
            showUserFormError(data.message || 'Fehler beim Speichern');
        }
    } catch (err) {
        console.error('Error saving user:', err);
        showUserFormError('Fehler beim Speichern des Nutzers');
    }
}

function showUserFormError(message) {
    userFormError.textContent = message;
    userFormError.classList.remove('hidden');
}

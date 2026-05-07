const socket = io({
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000
});
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
let authToken = '';
let peerReconnectTimer = null;

// Persistent black dummy canvas with a redraw timer so captureStream()
// actually emits frames. Without continuous redraw the canvas stays "clean"
// and Chrome produces zero video frames, leaving the remote receiver track
// stuck in `muted: true` state for the whole call.
let _dummyCanvas = null;
let _dummyCtx = null;
let _dummyDrawTimer = null;
function createDummyVideoTrack() {
    if (!_dummyCanvas) {
        _dummyCanvas = document.createElement('canvas');
        _dummyCanvas.width = 640;
        _dummyCanvas.height = 480;
        _dummyCtx = _dummyCanvas.getContext('2d');
    }
    _dummyCtx.fillStyle = '#000000';
    _dummyCtx.fillRect(0, 0, _dummyCanvas.width, _dummyCanvas.height);
    if (!_dummyDrawTimer) {
        _dummyDrawTimer = setInterval(() => {
            _dummyCtx.fillStyle = '#000000';
            _dummyCtx.fillRect(0, 0, _dummyCanvas.width, _dummyCanvas.height);
        }, 100);
    }
    return _dummyCanvas.captureStream(10).getVideoTracks()[0];
}

// ICE servers loaded from server API (DSGVO: keine externen STUN-Server, keine Credentials im Client)
let ICE_SERVERS = {
    iceServers: [
        { urls: 'stun:46.225.130.183:3478' }
    ],
    iceTransportPolicy: 'all',
    iceCandidatePoolSize: 10
};

async function loadIceServers() {
    try {
        const res = await fetch('/api/ice-servers', {
            headers: authToken ? { 'x-admin-auth': authToken } : {}
        });
        if (res.ok) {
            const data = await res.json();
            ICE_SERVERS = data;
        }
    } catch (e) {
        console.warn('Could not load ICE servers, using defaults');
    }
}

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
const flipCameraBtn = document.getElementById('flip-camera-btn');
const endCallBtn = document.getElementById('end-call-btn');

let isVideoSwapped = false;
let currentFacingMode = 'user';
let isScreenSharing = false;
let originalVideoTrack = null;

const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const sendMessageBtn = document.getElementById('send-message-btn');
const fileInput = document.getElementById('file-input');

const queueList = document.getElementById('queue-list');
const otherBeratersList = document.getElementById('other-beraters-list');

// Ringtone using Web Audio API (open-source, no external file needed)
const ringtone = (function() {
    let audioCtx = null;
    let oscillator1 = null;
    let oscillator2 = null;
    let gainNode = null;
    let ringInterval = null;
    let isPlaying = false;

    function createContext() {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
    }

    function startRing() {
        createContext();
        // Classic phone ring: two tones (440Hz + 480Hz) alternating on/off
        gainNode = audioCtx.createGain();
        gainNode.gain.value = 0.3;
        gainNode.connect(audioCtx.destination);

        oscillator1 = audioCtx.createOscillator();
        oscillator1.type = 'sine';
        oscillator1.frequency.value = 440;
        oscillator1.connect(gainNode);
        oscillator1.start();

        oscillator2 = audioCtx.createOscillator();
        oscillator2.type = 'sine';
        oscillator2.frequency.value = 480;
        oscillator2.connect(gainNode);
        oscillator2.start();

        // Ring pattern: 1s on, 2s off
        let ringOn = true;
        gainNode.gain.value = 0.3;
        ringInterval = setInterval(() => {
            ringOn = !ringOn;
            gainNode.gain.value = ringOn ? 0.3 : 0;
        }, ringOn ? 1000 : 2000);

        // More precise pattern: 1s ring, 2s silence
        clearInterval(ringInterval);
        let phase = 0;
        ringInterval = setInterval(() => {
            phase++;
            if (phase % 3 === 1) {
                gainNode.gain.value = 0.3; // ring on
            } else if (phase % 3 === 2) {
                gainNode.gain.value = 0; // silence
            }
        }, 1000);
    }

    function stopRing() {
        if (ringInterval) {
            clearInterval(ringInterval);
            ringInterval = null;
        }
        if (oscillator1) {
            try { oscillator1.stop(); } catch(e) {}
            oscillator1 = null;
        }
        if (oscillator2) {
            try { oscillator2.stop(); } catch(e) {}
            oscillator2 = null;
        }
        if (gainNode) {
            gainNode.disconnect();
            gainNode = null;
        }
    }

    return {
        play: function() {
            if (isPlaying) return Promise.resolve();
            isPlaying = true;
            startRing();
            return Promise.resolve();
        },
        pause: function() {
            isPlaying = false;
            stopRing();
        },
        set currentTime(val) {
            // no-op for API compatibility
        },
        get currentTime() {
            return 0;
        }
    };
})();

function initPeer() {
    // Destroy old peer if exists
    if (peer) {
        try { peer.destroy(); } catch(e) {}
        peer = null;
    }
    
    const isSecure = window.location.protocol === 'https:';
    const peerConfig = {
        host: window.location.hostname,
        path: '/peerjs',
        secure: isSecure,
        config: ICE_SERVERS,
        debug: 1
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
        // Clear any reconnect timer
        if (peerReconnectTimer) {
            clearTimeout(peerReconnectTimer);
            peerReconnectTimer = null;
        }
    });

    peer.on('call', handleIncomingPeerCall);
    peer.on('connection', handleDataConnection);
    
    peer.on('disconnected', () => {
        console.warn('PeerJS disconnected - attempting reconnect...');
        if (peer && !peer.destroyed) {
            peerReconnectTimer = setTimeout(() => {
                try { peer.reconnect(); } catch(e) {
                    console.error('PeerJS reconnect failed:', e);
                }
            }, 2000);
        }
    });
    
    peer.on('error', (err) => {
        console.error('Peer error:', err.type, err);
        if (err.type === 'network' || err.type === 'server-error' || err.type === 'socket-error') {
            console.log('Recoverable peer error, will reconnect...');
            peerReconnectTimer = setTimeout(() => {
                if (peer && !peer.destroyed) {
                    try { peer.reconnect(); } catch(e) {
                        console.error('Reconnect failed:', e);
                    }
                }
            }, 3000);
        }
    });
    
    peer.on('close', () => {
        console.warn('PeerJS connection closed');
    });
}

function resetVideoSwapState() {
    const localWrapper = document.querySelector('.local-video-wrapper');
    const remoteWrapper = document.querySelector('.remote-video-wrapper');
    if (localWrapper) localWrapper.classList.remove('video-large');
    if (remoteWrapper) remoteWrapper.classList.remove('video-small');
    isVideoSwapped = false;
}

function handleIncomingPeerCall(call) {
    // Guard: close any existing call before handling new one
    if (currentCall) {
        console.warn('Already in a call, closing previous call before accepting new one');
        try { currentCall.close(); } catch(e) {}
        currentCall = null;
    }
    
    currentCall = call;
    
    // Clear any leftover state from previous calls
    remoteVideo.srcObject = null;
    resetVideoSwapState();
    _lastRemoteStreamId = null; // Reset so new stream is not skipped
    
    // Ensure local video stays muted (prevent echo)
    localVideo.muted = true;
    
    // Log localStream state before answering
    if (localStream) {
        console.log('Answering with localStream - audio tracks:', localStream.getAudioTracks().length, 
            'video tracks:', localStream.getVideoTracks().length);
        localStream.getAudioTracks().forEach(t => {
            console.log('  Local audio track:', t.id, 'enabled:', t.enabled, 'readyState:', t.readyState);
        });
    } else {
        console.error('WARNING: localStream is null when answering call!');
    }
    
    // Register stream event BEFORE answering to prevent race condition
    call.on('stream', (remoteStream) => {
        console.log('Remote stream from customer - audio:', remoteStream.getAudioTracks().length, 'video:', remoteStream.getVideoTracks().length);
        attachRemoteStream(remoteStream);
    });
    
    // Setup peerConnection monitoring OUTSIDE stream handler
    const setupPCMonitoring = () => {
        if (!call.peerConnection) return;
        
        // Use addEventListener (NOT ontrack=) to avoid overwriting PeerJS internal handler
        call.peerConnection.addEventListener('track', (event) => {
            console.log('PC track event:', event.track.kind, 'readyState:', event.track.readyState);
            if (event.streams && event.streams[0]) {
                attachRemoteStream(event.streams[0]);
            }
        });
        
        // Monitor ICE connection state
        call.peerConnection.addEventListener('iceconnectionstatechange', () => {
            const state = call.peerConnection.iceConnectionState;
            console.log('ICE connection state:', state);
            if (state === 'disconnected' || state === 'failed') {
                console.warn('ICE connection ' + state + ' - attempting restart');
                try { call.peerConnection.restartIce(); } catch(e) { console.error('ICE restart failed:', e); }
            }
            if (state === 'connected' || state === 'completed') {
                // Re-verify audio after ICE reconnection
                remoteVideo.muted = false;
                remoteVideo.volume = 1;
                if (remoteVideo.paused) remoteVideo.play().catch(() => {});
            }
        });
    };
    setTimeout(setupPCMonitoring, 100);

    call.on('close', () => {
        endCall(false);
    });
    
    call.on('error', (err) => {
        console.error('Incoming call error:', err);
    });
    
    // Answer AFTER registering event listeners
    call.answer(localStream);
}

let _lastRemoteStreamId = null;
let _remoteAudioEl = null;
let _remoteAudioElement = null;
let _audioContext = null;
let _webAudioSource = null;
let _gainNode = null;

// Detect platform
const _isAndroid = /Android/i.test(navigator.userAgent);
const _isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
const _isMobile = _isAndroid || _isIOS;

// Must be called from inside a user-gesture handler (button click, etc.)
// so the AudioContext starts in 'running' state. If the AudioContext is
// created later inside an async PeerJS callback it stays 'suspended' and
// resume() is silently rejected — which is why incoming audio was inaudible.
function unlockAudio() {
    if (!_audioContext) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) _audioContext = new AudioCtx();
    }
    if (_audioContext && _audioContext.state === 'suspended') {
        _audioContext.resume()
            .then(() => console.log('AudioContext unlocked (state:', _audioContext.state, ')'))
            .catch(e => console.warn('AudioContext resume failed:', e));
    }
    if (!_remoteAudioElement) {
        _remoteAudioElement = document.createElement('audio');
        _remoteAudioElement.id = 'remote-audio-output';
        _remoteAudioElement.autoplay = true;
        _remoteAudioElement.playsInline = true;
        _remoteAudioElement.style.display = 'none';
        document.body.appendChild(_remoteAudioElement);
    }
    // Prime the element while we still have a user gesture
    _remoteAudioElement.muted = false;
    _remoteAudioElement.volume = 1;
    _remoteAudioElement.play().catch(() => { /* no src yet, that's fine */ });
}

function attachRemoteStream(stream) {
    // Skip if same stream is already attached
    if (_lastRemoteStreamId === stream.id && remoteVideo.srcObject === stream) {
        console.log('Same stream already attached, skipping');
        return;
    }
    _lastRemoteStreamId = stream.id;
    
    console.log('attachRemoteStream: audio tracks:', stream.getAudioTracks().length, 
        'video tracks:', stream.getVideoTracks().length);
    
    // Monitor audio track state
    stream.getAudioTracks().forEach(track => {
        console.log('Remote audio track:', track.id, 'enabled:', track.enabled, 
            'readyState:', track.readyState, 'muted:', track.muted);
        track.onunmute = () => console.log('Audio track unmuted - data flowing');
        track.onmute = () => console.warn('Audio track muted - data stopped');
        track.onended = () => console.warn('Audio track ENDED:', track.id);
    });
    
    // === VIDEO ELEMENT: display only, no audio ===
    remoteVideo.srcObject = stream;
    remoteVideo.muted = true;
    remoteVideo.volume = 0;
    remoteVideo.autoplay = true;
    remoteVideo.playsInline = true;
    
    const hasVideo = stream.getVideoTracks().length > 0 && 
                     stream.getVideoTracks().some(t => t.enabled && t.readyState === 'live');
    remoteAudioOnly.classList.toggle('hidden', hasVideo);
    
    // === AUDIO ROUTING with GainNode boost ===
    // Known Chrome/Android bug: hardware volume buttons control STREAM_VOICE_CALL
    // but Chrome outputs WebRTC audio through STREAM_MUSIC (media volume).
    // Solution: Boost audio via GainNode + compressor to compensate.
    if (stream.getAudioTracks().length > 0) {
        try {
            routeAudioWithBoost(stream);
        } catch(e) {
            console.warn('Boosted audio routing failed, direct fallback:', e);
            routeAudioDirect(stream);
        }
    }
    
    // Play the video element for video frames only
    const playPromise = remoteVideo.play();
    if (playPromise) {
        playPromise.then(() => {
            console.log('Remote video playing (muted — audio via separate element)');
        }).catch(e => {
            console.warn('Play failed:', e.name);
            if (e.name === 'NotAllowedError') {
                showPlayOverlay();
            }
        });
    }
}

// Route audio through AudioContext GainNode for volume boost, then to <audio> element
function routeAudioWithBoost(stream) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) {
        routeAudioDirect(stream);
        return;
    }
    
    if (!_audioContext) {
        _audioContext = new AudioCtx();
    }
    if (_audioContext.state === 'suspended') {
        _audioContext.resume().catch(e => console.warn('AudioContext resume failed:', e));
    }
    
    // Clean up previous connections
    if (_webAudioSource) {
        try { _webAudioSource.disconnect(); } catch(e) {}
    }
    if (_gainNode) {
        try { _gainNode.disconnect(); } catch(e) {}
    }
    
    // Create source from remote stream
    const audioOnlyStream = new MediaStream(stream.getAudioTracks());
    _webAudioSource = _audioContext.createMediaStreamSource(audioOnlyStream);
    
    // Create GainNode to boost volume
    _gainNode = _audioContext.createGain();
    _gainNode.gain.value = _isMobile ? 3.0 : 1.5;
    
    // Create compressor to prevent clipping
    const compressor = _audioContext.createDynamicsCompressor();
    compressor.threshold.setValueAtTime(-10, _audioContext.currentTime);
    compressor.knee.setValueAtTime(30, _audioContext.currentTime);
    compressor.ratio.setValueAtTime(12, _audioContext.currentTime);
    compressor.attack.setValueAtTime(0.003, _audioContext.currentTime);
    compressor.release.setValueAtTime(0.25, _audioContext.currentTime);
    
    // Create destination to get a boosted MediaStream
    const destination = _audioContext.createMediaStreamDestination();
    
    // Chain: source → gain → compressor → destination(MediaStream)
    // Only output via the <audio> element below — don't also wire to
    // _audioContext.destination, otherwise the same audio plays twice
    // and produces a noticeable echo on desktop.
    _webAudioSource.connect(_gainNode);
    _gainNode.connect(compressor);
    compressor.connect(destination);
    
    // Route the boosted stream to the <audio> element
    if (!_remoteAudioElement) {
        _remoteAudioElement = document.createElement('audio');
        _remoteAudioElement.id = 'remote-audio-output';
        _remoteAudioElement.autoplay = true;
        _remoteAudioElement.playsInline = true;
        _remoteAudioElement.style.display = 'none';
        document.body.appendChild(_remoteAudioElement);
    }
    
    _remoteAudioElement.srcObject = destination.stream;
    _remoteAudioElement.muted = false;
    _remoteAudioElement.volume = 1;
    _remoteAudioElement.play().then(() => {
        console.log('Boosted audio: playing via <audio> element (gain:', _gainNode.gain.value, ')');
    }).catch(e => {
        console.warn('Boosted audio play failed:', e.name, '- retrying...');
        setTimeout(() => {
            _remoteAudioElement.play().catch(() => {
                console.warn('Boosted audio retry failed, trying direct...');
                routeAudioDirect(stream);
            });
        }, 500);
    });
    
    console.log('Audio: GainNode boost =', _gainNode.gain.value, 'x, platform:',
        _isAndroid ? 'Android' : _isIOS ? 'iOS' : 'Desktop');
}

// Fallback: route audio directly through <audio> element without boost
function routeAudioDirect(stream) {
    const audioOnlyStream = new MediaStream(stream.getAudioTracks());
    
    if (!_remoteAudioElement) {
        _remoteAudioElement = document.createElement('audio');
        _remoteAudioElement.id = 'remote-audio-output';
        _remoteAudioElement.autoplay = true;
        _remoteAudioElement.playsInline = true;
        _remoteAudioElement.style.display = 'none';
        document.body.appendChild(_remoteAudioElement);
    }
    
    _remoteAudioElement.srcObject = audioOnlyStream;
    _remoteAudioElement.muted = false;
    _remoteAudioElement.volume = 1;
    _remoteAudioElement.play().then(() => {
        console.log('Direct audio: playing via <audio> element');
    }).catch(e => {
        console.warn('Direct audio play failed:', e.name);
        // Last resort: use video element for audio
        remoteVideo.muted = false;
        remoteVideo.volume = 1;
    });
}

function disconnectWebAudio() {
    if (_webAudioSource) {
        try { _webAudioSource.disconnect(); } catch(e) {}
        _webAudioSource = null;
    }
    if (_gainNode) {
        try { _gainNode.disconnect(); } catch(e) {}
        _gainNode = null;
    }
    if (_audioContext) {
        try { _audioContext.close(); } catch(e) {}
        _audioContext = null;
    }
    if (_remoteAudioElement) {
        _remoteAudioElement.srcObject = null;
        _remoteAudioElement.pause();
    }
}

function showPlayOverlay() {
    let overlay = document.getElementById('play-overlay');
    if (overlay) return;
    
    overlay = document.createElement('div');
    overlay.id = 'play-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:9999;cursor:pointer;';
    overlay.innerHTML = '<div style="text-align:center;color:#fff;"><div style="font-size:48px;">🔊</div><p style="font-size:18px;margin-top:12px;">Klicken Sie hier um Audio zu aktivieren</p></div>';
    overlay.addEventListener('click', () => {
        // Re-route audio during user gesture via boosted pipeline
        if (remoteVideo.srcObject) {
            try {
                routeAudioWithBoost(remoteVideo.srcObject);
            } catch(e) {
                routeAudioDirect(remoteVideo.srcObject);
            }
        }
        
        // Also ensure video element is playing (for video display)
        remoteVideo.play().catch(() => {});
        
        overlay.remove();
        console.log('Play overlay dismissed, audio routed via boosted pipeline');
    });
    document.body.appendChild(overlay);
}

function handleDataConnection(conn) {
    dataConnection = conn;
    
    conn.on('open', () => {
        console.log('Data connection from customer established');
        // Send current video state so remote peer knows if this is audio-only
        conn.send({ type: 'video-toggle', videoEnabled: isVideoEnabled });
    });

    conn.on('data', (data) => {
        if (data.type === 'chat') {
            addChatMessage(data.message, data.senderName, false);
        } else if (data.type === 'file') {
            addFileMessage(data.fileName, data.fileData, data.fileType, data.senderName, false);
        } else if (data.type === 'screen-share-started') {
            console.log('Customer started screen sharing');
            remoteVideo.classList.add('screen-share-active');
            // Make video visible even if customer camera was off
            remoteVideo.style.visibility = 'visible';
            remoteAudioOnly.classList.add('hidden');
            // Delay refresh to allow replaceTrack to propagate via WebRTC
            setTimeout(() => refreshRemoteVideo(), 500);
            setTimeout(() => refreshRemoteVideo(), 1500);
        } else if (data.type === 'screen-share-ended') {
            console.log('Customer stopped screen sharing');
            remoteVideo.classList.remove('screen-share-active');
            // Immediately hide video to prevent frozen last frame (show black)
            remoteVideo.style.visibility = 'hidden';
            remoteAudioOnly.classList.remove('hidden');
            setTimeout(() => refreshRemoteVideo(), 500);
            setTimeout(() => refreshRemoteVideo(), 1500);
        } else if (data.type === 'video-toggle') {
            console.log('Customer video toggled:', data.videoEnabled);
            remoteAudioOnly.classList.toggle('hidden', data.videoEnabled);
            // Hide/show video element to prevent frozen frame
            remoteVideo.style.visibility = data.videoEnabled ? 'visible' : 'hidden';
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

    // Login click is the first reliable user gesture — unlock audio output
    // here so incoming-call audio actually plays through the speakers.
    unlockAudio();

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
        authToken = result.token || '';
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
                audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
                video: true
            });
            console.log('Camera and microphone activated successfully');
            isVideoEnabled = true;
        } catch (videoErr) {
            // If video fails, try audio-only with dummy video track
            console.log('Camera not available, trying audio-only:', videoErr.message);
            localStream = await navigator.mediaDevices.getUserMedia({
                audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
                video: false
            });
            
            // Create a persistent dummy video track so screen sharing can replace it later
            const dummyVideoTrack = createDummyVideoTrack();
            localStream.addTrack(dummyVideoTrack);
            
            console.log('Microphone activated successfully (audio-only mode with dummy video)');
            isVideoEnabled = false;
            toggleVideoBtn.classList.remove('active');
            toggleVideoBtn.classList.add('muted');
        }
        
        localVideo.srcObject = localStream;
        localVideo.muted = true; // Ensure local video is always muted
        
        await loadIceServers();
        initPeer();
        
        beraterNameDisplay.textContent = beraterName;
        beraterProfile.classList.remove('hidden');
        logoutBtn.classList.remove('hidden');
        toggleStatusBtn.classList.remove('hidden');
        userManagementBtn.classList.remove('hidden');
        const callLogBtnEl = document.getElementById('call-log-btn');
        if (callLogBtnEl) callLogBtnEl.classList.remove('hidden');
        
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
    const callLogBtnEl = document.getElementById('call-log-btn');
    if (callLogBtnEl) callLogBtnEl.classList.add('hidden');
    
    showSection('login');
}

function showSection(section) {
    loginSection.classList.add('hidden');
    waitingSection.classList.add('hidden');
    incomingCallSection.classList.add('hidden');
    callSection.classList.add('hidden');

    // Hide mobile chat button by default
    const mobileChatBtnEl = document.getElementById('mobile-chat-btn');
    if (mobileChatBtnEl) mobileChatBtnEl.classList.add('hidden');

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
            // Show mobile chat button on mobile when in call
            if (mobileChatBtnEl && window.innerWidth <= 768) {
                mobileChatBtnEl.classList.remove('hidden');
            }
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

    // Re-unlock audio at the moment of accepting (in case the page
    // has been idle long enough that the context was suspended again).
    unlockAudio();

    // Reset all video state for fresh call
    remoteVideo.srcObject = null;
    resetVideoSwapState();
    
    isScreenSharing = false;
    originalVideoTrack = null;
    toggleScreenBtn.classList.remove('active');
    
    // For audio-only calls, disable camera and use dummy video track
    if (currentCustomer.callType === 'audio' && localStream) {
        const videoTrack = localStream.getVideoTracks()[0];
        if (videoTrack && videoTrack.readyState === 'live') {
            videoTrack.stop();
            localStream.removeTrack(videoTrack);
            
            // Add dummy video track for WebRTC negotiation
            localStream.addTrack(createDummyVideoTrack());
            localVideo.srcObject = localStream;
        }
        isVideoEnabled = false;
        toggleVideoBtn.classList.remove('active');
        toggleVideoBtn.classList.add('muted');
        console.log('Audio-only call: camera disabled');
    } else if (currentCustomer.callType === 'video' && localStream) {
        // Always activate real camera for video calls (replace dummy track if present)
        navigator.mediaDevices.getUserMedia({ video: true }).then(newStream => {
            const newVideoTrack = newStream.getVideoTracks()[0];
            localStream.getVideoTracks().forEach(t => { t.stop(); localStream.removeTrack(t); });
            localStream.addTrack(newVideoTrack);
            localVideo.srcObject = localStream;
            isVideoEnabled = true;
            toggleVideoBtn.classList.add('active');
            toggleVideoBtn.classList.remove('muted');
            console.log('Video call: camera activated');
        }).catch(e => {
            console.warn('Could not activate camera for video call:', e);
            isVideoEnabled = false;
            toggleVideoBtn.classList.remove('active');
            toggleVideoBtn.classList.add('muted');
        });
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
    // Stop screen sharing FIRST (before closing call) so we can restore camera
    if (isScreenSharing && localStream) {
        const screenTrack = localStream.getVideoTracks()[0];
        if (screenTrack) {
            screenTrack.stop();
            localStream.removeTrack(screenTrack);
        }
        // Synchronously restore camera
        navigator.mediaDevices.getUserMedia({ video: true }).then(newStream => {
            const newVideoTrack = newStream.getVideoTracks()[0];
            localStream.addTrack(newVideoTrack);
            localVideo.srcObject = localStream;
        }).catch(() => {
            // Camera not available, add dummy track
            localStream.addTrack(createDummyVideoTrack());
            localVideo.srcObject = localStream;
        });
    }
    
    isScreenSharing = false;
    originalVideoTrack = null;
    toggleScreenBtn.classList.remove('active');
    
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
    
    // Clear remote video and audio
    disconnectWebAudio();
    remoteVideo.srcObject = null;
    _lastRemoteStreamId = null;
    
    // Reset video swap state
    resetVideoSwapState();
    
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

async function toggleVideo() {
    if (!localStream) return;
    
    const videoTrack = localStream.getVideoTracks()[0];
    
    if (!isVideoEnabled) {
        // Switching ON: Start real camera (replace dummy track if present)
        try {
            const camStream = await navigator.mediaDevices.getUserMedia({ video: true });
            const newVideoTrack = camStream.getVideoTracks()[0];
            
            // Remove old track (dummy or stopped)
            if (videoTrack) {
                videoTrack.stop();
                localStream.removeTrack(videoTrack);
            }
            localStream.addTrack(newVideoTrack);
            localVideo.srcObject = localStream;
            
            // Replace track in WebRTC connection so remote peer sees video
            if (currentCall && currentCall.peerConnection) {
                const sender = currentCall.peerConnection.getSenders().find(s => s.track && s.track.kind === 'video');
                if (sender) {
                    await sender.replaceTrack(newVideoTrack);
                }
            }
            
            isVideoEnabled = true;
            toggleVideoBtn.classList.add('active');
            toggleVideoBtn.classList.remove('muted');
            
            // Notify remote peer that video is now on
            if (dataConnection && dataConnection.open) {
                dataConnection.send({ type: 'video-toggle', videoEnabled: true });
            }
            console.log('Video enabled: camera started');
        } catch (e) {
            console.warn('Could not start camera:', e);
        }
    } else {
        // Switching OFF: Stop camera, replace with dummy track
        if (videoTrack) {
            videoTrack.stop();
            localStream.removeTrack(videoTrack);
        }
        
        // Create dummy video track
        const dummyTrack = createDummyVideoTrack();
        localStream.addTrack(dummyTrack);
        localVideo.srcObject = localStream;
        
        // Replace track in WebRTC connection
        if (currentCall && currentCall.peerConnection) {
            const sender = currentCall.peerConnection.getSenders().find(s => s.track && s.track.kind === 'video');
            if (sender) {
                await sender.replaceTrack(dummyTrack);
            }
        }
        
        isVideoEnabled = false;
        toggleVideoBtn.classList.remove('active');
        toggleVideoBtn.classList.add('muted');
        
        // Notify remote peer that video is now off
        if (dataConnection && dataConnection.open) {
            dataConnection.send({ type: 'video-toggle', videoEnabled: false });
        }
        console.log('Video disabled: camera stopped');
    }
}

function toggleAudio() {
    if (localStream) {
        const audioTrack = localStream.getAudioTracks()[0];
        if (audioTrack) {
            isAudioEnabled = !isAudioEnabled;
            audioTrack.enabled = isAudioEnabled;
            
            // Also update the WebRTC sender track to ensure mute propagates to remote peer
            if (currentCall && currentCall.peerConnection) {
                const sender = currentCall.peerConnection.getSenders().find(s => s.track && s.track.kind === 'audio');
                if (sender && sender.track) {
                    sender.track.enabled = isAudioEnabled;
                }
            }
            
            toggleAudioBtn.classList.toggle('active', isAudioEnabled);
            toggleAudioBtn.classList.toggle('muted', !isAudioEnabled);
            console.log('Audio toggled:', isAudioEnabled ? 'unmuted' : 'muted');
        }
    }
}

async function flipCamera() {
    if (!localStream || isScreenSharing) return;
    
    try {
        const newFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
        
        // Stop old camera BEFORE requesting new one (Android needs the camera released first)
        const oldVideoTrack = localStream.getVideoTracks()[0];
        if (oldVideoTrack) {
            oldVideoTrack.stop();
            localStream.removeTrack(oldVideoTrack);
        }
        
        // Use { exact: ... } so the browser is forced to pick the other camera (Android ignores ideal hints)
        const newStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { exact: newFacingMode } },
            audio: false
        });
        
        currentFacingMode = newFacingMode;
        const newVideoTrack = newStream.getVideoTracks()[0];
        
        localStream.addTrack(newVideoTrack);
        
        localVideo.srcObject = localStream;
        
        if (currentCall && currentCall.peerConnection) {
            const sender = currentCall.peerConnection.getSenders().find(s => s.track && s.track.kind === 'video');
            if (sender) {
                await sender.replaceTrack(newVideoTrack);
            }
        }
        
        originalVideoTrack = newVideoTrack;
        console.log('Camera flipped to:', currentFacingMode);
    } catch (err) {
        console.error('Error flipping camera:', err);
        currentFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
        // Try to re-acquire the original camera so user isn't left without video
        try {
            const fallbackStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: { exact: currentFacingMode } },
                audio: false
            });
            const fallbackTrack = fallbackStream.getVideoTracks()[0];
            localStream.addTrack(fallbackTrack);
            localVideo.srcObject = localStream;
            if (currentCall && currentCall.peerConnection) {
                const sender = currentCall.peerConnection.getSenders().find(s => s.track && s.track.kind === 'video');
                if (sender) await sender.replaceTrack(fallbackTrack);
            }
        } catch (fallbackErr) {
            console.error('Could not re-acquire camera after flip failure:', fallbackErr);
        }
    }
}

function swapVideos() {
    const localWrapper = document.querySelector('.local-video-wrapper');
    const remoteWrapper = document.querySelector('.remote-video-wrapper');
    
    if (!localWrapper || !remoteWrapper) return;
    
    isVideoSwapped = !isVideoSwapped;
    
    if (isVideoSwapped) {
        localWrapper.classList.add('video-large');
        remoteWrapper.classList.add('video-small');
    } else {
        localWrapper.classList.remove('video-large');
        remoteWrapper.classList.remove('video-small');
    }
}

function setupVideoClickToSwap() {
    const localWrapper = document.querySelector('.local-video-wrapper');
    const remoteWrapper = document.querySelector('.remote-video-wrapper');
    
    if (localWrapper) {
        localWrapper.addEventListener('click', () => {
            if (!isVideoSwapped) swapVideos();
        });
    }
    
    if (remoteWrapper) {
        remoteWrapper.addEventListener('click', () => {
            if (isVideoSwapped) swapVideos();
        });
    }
}

let _screenShareBusy = false;
async function toggleScreenShare() {
    // Guard against double invocation (e.g. onended + manual stop)
    if (_screenShareBusy) {
        console.log('toggleScreenShare: already in progress, skipping');
        return;
    }
    _screenShareBusy = true;
    
    try {
        if (isScreenSharing) {
            console.log('Stopping screen share...');
            
            // Remove onended handler BEFORE stopping to prevent double call
            const screenTrack = localStream.getVideoTracks()[0];
            if (screenTrack) {
                screenTrack.onended = null;
                screenTrack.stop();
                localStream.removeTrack(screenTrack);
            }
            
            // Set state immediately to prevent race conditions
            isScreenSharing = false;
            toggleScreenBtn.classList.remove('active');
            
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
                console.log('Camera not available after screen share, creating dummy track');
                const dummyTrack = createDummyVideoTrack();
                localStream.addTrack(dummyTrack);
                localVideo.srcObject = localStream;
                
                if (currentCall && currentCall.peerConnection) {
                    const sender = currentCall.peerConnection.getSenders().find(s => s.track && s.track.kind === 'video');
                    if (sender) {
                        await sender.replaceTrack(dummyTrack);
                    }
                }
                
                isVideoEnabled = false;
                toggleVideoBtn.classList.remove('active');
                toggleVideoBtn.classList.add('muted');
            }
            
            // Notify customer screen share ended, then send video state so they show/hide video
            if (dataConnection && dataConnection.open) {
                dataConnection.send({ type: 'screen-share-ended' });
                dataConnection.send({ type: 'video-toggle', videoEnabled: isVideoEnabled });
                console.log('Sent screen-share-ended + video-toggle to customer, videoEnabled:', isVideoEnabled);
            }
        } else {
            console.log('Starting screen share...');
            // Start screen sharing
            const screenStream = await navigator.mediaDevices.getDisplayMedia({ 
                video: { cursor: 'always' },
                audio: false 
            });
            const screenTrack = screenStream.getVideoTracks()[0];
            
            // Save and remove existing video track
            originalVideoTrack = localStream.getVideoTracks()[0];
            if (originalVideoTrack) {
                localStream.removeTrack(originalVideoTrack);
            }
            
            localStream.addTrack(screenTrack);
            localVideo.srcObject = localStream;
            
            if (currentCall && currentCall.peerConnection) {
                const pc = currentCall.peerConnection;
                let sender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
                if (!sender && pc.getTransceivers) {
                    const vt = pc.getTransceivers().find(t => t.mid !== null && t.sender);
                    if (vt) sender = vt.sender;
                }
                
                if (sender) {
                    await sender.replaceTrack(screenTrack);
                    console.log('Screen track replaced successfully, sender track now:', sender.track?.id, 'readyState:', sender.track?.readyState);
                } else {
                    console.warn('No video sender found, adding track to PC');
                    pc.addTrack(screenTrack, localStream);
                }
            } else {
                console.warn('No currentCall or peerConnection!');
            }
            
            // Notify customer about screen share
            if (dataConnection && dataConnection.open) {
                dataConnection.send({ type: 'screen-share-started' });
                console.log('Sent screen-share-started to customer');
            } else {
                console.error('Cannot notify customer - dataConnection not ready!');
            }
            
            // Handle browser-initiated stop (user clicks "Stop sharing")
            screenTrack.onended = () => {
                console.log('Screen sharing ended by browser/user');
                toggleScreenShare();
            };
            
            toggleScreenBtn.classList.add('active');
            isScreenSharing = true;
        }
    } catch (err) {
        console.error('Screen share error:', err);
        if (err.name !== 'NotAllowedError') {
            alert('Bildschirmfreigabe fehlgeschlagen: ' + err.message);
        }
    } finally {
        _screenShareBusy = false;
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

// File upload restrictions (Art. 32 DSGVO - Sicherheit)
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
const BLOCKED_EXTENSIONS = ['.exe', '.bat', '.cmd', '.com', '.msi', '.scr', '.ps1', '.vbs', '.js', '.wsf', '.sh'];

function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file || !dataConnection) return;

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
        alert('Die Datei ist zu groß. Maximale Dateigröße: 10 MB.');
        e.target.value = '';
        return;
    }

    // Check for blocked extensions
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    if (BLOCKED_EXTENSIONS.includes(ext)) {
        alert('Dieser Dateityp ist aus Sicherheitsgründen nicht erlaubt.');
        e.target.value = '';
        return;
    }

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
    
    const senderDiv = document.createElement('div');
    senderDiv.className = 'sender';
    senderDiv.textContent = senderName;
    
    const link = document.createElement('a');
    link.href = '#';
    link.className = 'file-link';
    link.textContent = '📄 ' + fileName;
    link.addEventListener('click', (e) => {
        e.preventDefault();
        // Convert data URL to Blob for safe download (prevents page navigation)
        try {
            const byteString = atob(fileData.split(',')[1]);
            const mimeType = fileData.split(',')[0].split(':')[1].split(';')[0];
            const ab = new ArrayBuffer(byteString.length);
            const ia = new Uint8Array(ab);
            for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
            const blob = new Blob([ab], { type: mimeType });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Download error:', err);
        }
    });
    
    msgEl.appendChild(senderDiv);
    msgEl.appendChild(link);
    chatMessages.appendChild(msgEl);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function refreshRemoteVideo() {
    if (!currentCall || !currentCall.peerConnection) return;
    
    const pc = currentCall.peerConnection;
    const receivers = pc.getReceivers();
    const videoReceiver = receivers.find(r => r.track && r.track.kind === 'video');
    
    if (videoReceiver && videoReceiver.track) {
        const track = videoReceiver.track;
        console.log('refreshRemoteVideo - video track:', track.id, 'readyState:', track.readyState);
        
        // Only swap the video track in the existing stream — do NOT rebuild audio pipeline
        const existingStream = remoteVideo.srcObject;
        if (existingStream) {
            const oldVideoTracks = existingStream.getVideoTracks();
            oldVideoTracks.forEach(t => existingStream.removeTrack(t));
            existingStream.addTrack(track);
            console.log('refreshRemoteVideo - swapped video track in existing stream');
        } else {
            // No existing stream, create one with all receiver tracks
            const newStream = new MediaStream();
            receivers.forEach(r => {
                if (r.track && r.track.readyState === 'live') {
                    newStream.addTrack(r.track);
                }
            });
            remoteVideo.srcObject = newStream;
        }
        
        // Show/hide audio-only indicator
        const hasVideo = track.enabled && track.readyState === 'live';
        remoteAudioOnly.classList.toggle('hidden', hasVideo);
        
        // Ensure video element is playing
        if (remoteVideo.paused) {
            remoteVideo.play().catch(e => console.warn('refreshRemoteVideo play:', e.name));
        }
        
        console.log('refreshRemoteVideo - done');
    }
}

function updateQueueDisplay(queue) {
    if (queue.length === 0) {
        queueList.innerHTML = '<p class="empty-queue">Keine wartenden Kunden</p>';
        return;
    }

    queueList.innerHTML = queue.map((customer, index) => `
        <div class="queue-item" data-peer-id="${customer.peerId}" data-socket-id="${customer.socketId}" data-customer-name="${escapeHtml(customer.name)}" data-call-type="${customer.callType}">
            <div class="name">
                <span>${customer.callType === 'video' ? '📹' : '📞'}</span>
                <span>${escapeHtml(customer.name)}</span>
            </div>
            <span class="wait-time">${formatWaitTime(customer.waitTime)}</span>
        </div>
    `).join('');

    // Add click handlers to queue items
    document.querySelectorAll('.queue-item').forEach(item => {
        item.addEventListener('click', () => selectQueueCustomer(item));
    });
}

function selectQueueCustomer(item) {
    const peerId = item.dataset.peerId;
    const socketId = item.dataset.socketId;
    const customerName = item.dataset.customerName;
    const callType = item.dataset.callType;
    
    currentCustomer = {
        peerId: peerId,
        customerSocketId: socketId,
        customerName: customerName,
        callType: callType
    };
    
    callerNameEl.textContent = customerName;
    callTypeBadgeEl.textContent = callType === 'video' ? '📹 Video' : '📞 Audio';
    
    showSection('incoming');
    updateStatus('ringing');
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

socket.on('file-received', (data) => {
    addFileMessage(data.fileName, data.fileData, data.fileType, data.senderName, false);
});

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

// Socket reconnection handling
socket.on('connect', () => {
    console.log('Socket connected:', socket.id);
    // Re-register as berater if we were logged in
    if (beraterName && peer && peer.id) {
        console.log('Re-registering berater after reconnect...');
        socket.emit('berater-login', {
            name: beraterName,
            peerId: peer.id
        });
    }
});

socket.on('disconnect', (reason) => {
    console.warn('Socket disconnected:', reason);
});

socket.on('reconnect', (attemptNumber) => {
    console.log('Socket reconnected after', attemptNumber, 'attempts');
});

loginBtn.addEventListener('click', login);
logoutBtn.addEventListener('click', logout);
acceptCallBtn.addEventListener('click', acceptCall);
rejectCallBtn.addEventListener('click', rejectCall);
endCallBtn.addEventListener('click', () => endCall(true));

toggleVideoBtn.addEventListener('click', toggleVideo);
toggleAudioBtn.addEventListener('click', toggleAudio);
toggleScreenBtn.addEventListener('click', toggleScreenShare);
if (flipCameraBtn) flipCameraBtn.addEventListener('click', flipCamera);

// Chat back button - close chat panel on mobile and scroll back to video
const chatBackBtn = document.getElementById('chat-back-btn');
if (chatBackBtn) {
    chatBackBtn.addEventListener('click', () => {
        const chatAreaEl = document.querySelector('.chat-area');
        if (chatAreaEl) {
            chatAreaEl.classList.remove('open');
        }
        const videoArea = document.querySelector('.video-container-berater');
        if (videoArea) {
            videoArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        chatInput.blur();
    });
}

// Setup click-to-swap on video elements
setupVideoClickToSwap();

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
            
            // Enable/disable drawing canvas based on active tab
            if (drawingCanvas) {
                if (tabId === 'drawing') {
                    drawingCanvas.enable();
                } else {
                    drawingCanvas.disable();
                }
            }
        });
    });
    
    // Also disable drawing when panel is closed
    if (toolsPanelClose) {
        const originalClose = toolsPanelClose.onclick;
        toolsPanelClose.addEventListener('click', () => {
            if (drawingCanvas) drawingCanvas.disable();
        });
    }

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
        const response = await fetch('/api/users', {
            headers: { 'x-admin-auth': authToken }
        });
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
                <button class="btn-edit" onclick="editUser('${user.id}', '${user.username}')">✏️ Bearbeiten</button>
                <button class="btn-delete" onclick="deleteUser('${user.id}', '${user.username}')">🗑️ Löschen</button>
            </td>
        </tr>
    `).join('');
}

window.editUser = function(id, username) {
    openUserForm({ id, username });
};

window.deleteUser = async function(id, username) {
    if (!confirm(`Möchten Sie den Nutzer "${username}" wirklich löschen?`)) {
        return;
    }
    
    try {
        const response = await fetch(`/api/users/${id}`, {
            method: 'DELETE',
            headers: { 'x-admin-auth': authToken }
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
            headers: { 'Content-Type': 'application/json', 'x-admin-auth': authToken },
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

// ==================== CALL LOG ====================
const callLogModal = document.getElementById('call-log-modal');
const callLogTableBody = document.getElementById('call-log-table-body');
const callLogEmpty = document.getElementById('call-log-empty');
const callLogTable = document.getElementById('call-log-table');
const callLogCount = document.getElementById('call-log-count');
const closeCallLogModal = document.getElementById('close-call-log-modal');
const callLogDateInput = document.getElementById('call-log-date');
const callLogFilterBtn = document.getElementById('call-log-filter-btn');
const callLogResetBtn = document.getElementById('call-log-reset-btn');
const callLogClearBtn = document.getElementById('call-log-clear-btn');
const callLogBtn = document.getElementById('call-log-btn');

let _callLogData = [];

if (callLogBtn) {
    callLogBtn.addEventListener('click', openCallLog);
}

if (closeCallLogModal) {
    closeCallLogModal.addEventListener('click', closeCallLog);
}

if (callLogModal) {
    callLogModal.addEventListener('click', (e) => {
        if (e.target === callLogModal) closeCallLog();
    });
}

if (callLogFilterBtn) {
    callLogFilterBtn.addEventListener('click', () => {
        const dateVal = callLogDateInput.value;
        if (dateVal) {
            renderCallLog(_callLogData.filter(entry => {
                const entryDate = new Date(entry.startTime).toISOString().slice(0, 10);
                return entryDate === dateVal;
            }));
        }
    });
}

if (callLogResetBtn) {
    callLogResetBtn.addEventListener('click', () => {
        callLogDateInput.value = '';
        renderCallLog(_callLogData);
    });
}

if (callLogClearBtn) {
    callLogClearBtn.addEventListener('click', async () => {
        if (!confirm('Möchten Sie das gesamte Anruf-Protokoll wirklich löschen?')) return;
        try {
            await fetch('/api/call-log', {
                method: 'DELETE',
                headers: { 'x-admin-auth': authToken }
            });
            _callLogData = [];
            renderCallLog([]);
        } catch (err) {
            console.error('Error clearing call log:', err);
        }
    });
}

async function openCallLog() {
    callLogModal.classList.remove('hidden');
    callLogDateInput.value = '';
    try {
        const response = await fetch('/api/call-log', {
            headers: { 'x-admin-auth': authToken }
        });
        _callLogData = await response.json();
        renderCallLog(_callLogData);
    } catch (err) {
        console.error('Error loading call log:', err);
        _callLogData = [];
        renderCallLog([]);
    }
}

function closeCallLog() {
    callLogModal.classList.add('hidden');
}

function formatCallDuration(seconds) {
    if (!seconds || seconds < 0) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
}

function renderCallLog(entries) {
    if (!entries || entries.length === 0) {
        callLogTableBody.innerHTML = '';
        callLogTable.classList.add('hidden');
        callLogEmpty.classList.remove('hidden');
        callLogCount.textContent = '';
        return;
    }
    
    callLogTable.classList.remove('hidden');
    callLogEmpty.classList.add('hidden');
    callLogCount.textContent = entries.length + ' Anruf' + (entries.length !== 1 ? 'e' : '');
    
    callLogTableBody.innerHTML = entries.map(entry => {
        const start = new Date(entry.startTime);
        const date = start.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const time = start.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
        const typeLabel = entry.callType === 'video' ? '📹 Video' : '📞 Audio';
        const duration = formatCallDuration(entry.duration);
        
        return `<tr>
            <td>${date}</td>
            <td>${time}</td>
            <td>${escapeHtml(entry.beraterName || '-')}</td>
            <td>${escapeHtml(entry.customerName || '-')}</td>
            <td>${typeLabel}</td>
            <td>${duration} min</td>
        </tr>`;
    }).join('');
}

// ========== MOBILE NAVIGATION ==========
const mobileMenuBtn = document.getElementById('mobile-menu-btn');
const sidebar = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebar-overlay');
const mobileChatBtn = document.getElementById('mobile-chat-btn');
const chatArea = document.querySelector('.chat-area');

function toggleMobileMenu() {
    sidebar.classList.toggle('open');
    sidebarOverlay.classList.toggle('active');
}

function closeMobileMenu() {
    sidebar.classList.remove('open');
    sidebarOverlay.classList.remove('active');
}

function toggleMobileChat() {
    if (chatArea) {
        chatArea.classList.toggle('open');
    }
}

if (mobileMenuBtn) {
    mobileMenuBtn.addEventListener('click', toggleMobileMenu);
}

if (sidebarOverlay) {
    sidebarOverlay.addEventListener('click', closeMobileMenu);
}

if (mobileChatBtn) {
    mobileChatBtn.addEventListener('click', toggleMobileChat);
}

// Chat close button for mobile
const chatCloseBtn = document.getElementById('chat-close-btn');
if (chatCloseBtn) {
    chatCloseBtn.addEventListener('click', () => {
        if (chatArea) chatArea.classList.remove('open');
    });
}

// Show mobile chat button when in call
function updateMobileChatButton(show) {
    if (mobileChatBtn) {
        if (show && window.innerWidth <= 768) {
            mobileChatBtn.classList.remove('hidden');
        } else {
            mobileChatBtn.classList.add('hidden');
        }
    }
}

// Update on resize
window.addEventListener('resize', () => {
    if (window.innerWidth > 768) {
        closeMobileMenu();
        if (chatArea) chatArea.classList.remove('open');
        if (mobileChatBtn) mobileChatBtn.classList.add('hidden');
    } else if (!callSection.classList.contains('hidden')) {
        updateMobileChatButton(true);
    }
});

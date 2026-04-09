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
let currentBeraterSocketId = null;
let isVideoEnabled = true;
let isAudioEnabled = true;
let peerReconnectTimer = null;

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
        const res = await fetch('/api/ice-servers');
        if (res.ok) {
            const data = await res.json();
            ICE_SERVERS = data;
        }
    } catch (e) {
        console.warn('Could not load ICE servers, using defaults');
    }
}

const loginSection = document.getElementById('login-section');
const queueSection = document.getElementById('queue-section');
const connectingSection = document.getElementById('connecting-section');
const callSection = document.getElementById('call-section');
const callEndedSection = document.getElementById('call-ended-section');

const customerNameInput = document.getElementById('customer-name');
const startCallBtn = document.getElementById('start-call-btn');
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
const toggleScreenBtn = document.getElementById('toggle-screen-btn');
const flipCameraBtn = document.getElementById('flip-camera-btn');

let isScreenSharing = false;
let currentFacingMode = 'user'; // 'user' = front camera, 'environment' = back camera
let originalVideoTrack = null;
let isVideoSwapped = false;
let _makeCallInProgress = false;
let _audioContext = null;
let _remoteAudioElement = null;
let _gainNode = null;
let _volumeNotificationShown = false;

// Detect platform
const _isAndroid = /Android/i.test(navigator.userAgent);
const _isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
const _isMobile = _isAndroid || _isIOS;

// Unlock audio playback on the page (must be called during user gesture)
function unlockAudio() {
    // Create and resume AudioContext
    if (!_audioContext) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
            _audioContext = new AudioCtx();
        }
    }
    if (_audioContext && _audioContext.state === 'suspended') {
        _audioContext.resume().then(() => {
            console.log('AudioContext unlocked (state:', _audioContext.state, ')');
        }).catch(e => console.warn('AudioContext resume failed:', e));
    }
    
    // Create a hidden <audio> element for audio output
    if (!_remoteAudioElement) {
        _remoteAudioElement = document.createElement('audio');
        _remoteAudioElement.id = 'remote-audio-output';
        _remoteAudioElement.autoplay = true;
        _remoteAudioElement.playsInline = true;
        _remoteAudioElement.style.display = 'none';
        document.body.appendChild(_remoteAudioElement);
    }
    
    // Prime both elements during this user gesture so later play() calls succeed
    remoteVideo.muted = true;
    remoteVideo.volume = 0;
    remoteVideo.play().then(() => {
        console.log('unlockAudio: video element primed for autoplay');
    }).catch(() => {
        console.log('unlockAudio: video element priming noted (no src yet)');
    });
    
    _remoteAudioElement.play().then(() => {
        console.log('unlockAudio: audio element primed');
    }).catch(() => {
        console.log('unlockAudio: audio element priming noted (no src yet)');
    });
    
    console.log('unlockAudio: platform:', _isAndroid ? 'Android' : _isIOS ? 'iOS' : 'Desktop',
        '| AudioContext:', _audioContext ? _audioContext.state : 'none');
}

const chatPanel = document.getElementById('chat-panel');
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const sendMessageBtn = document.getElementById('send-message-btn');
const fileInput = document.getElementById('file-input');

const queueAudio = document.getElementById('queue-audio'); // May be null if audio element removed

// Creates a black dummy video track for WebRTC negotiation
function createDummyVideoTrack() {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const stream = canvas.captureStream(1);
    return stream.getVideoTracks()[0];
}

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
        console.log('My peer ID:', id);
        // Clear any reconnect timer
        if (peerReconnectTimer) {
            clearTimeout(peerReconnectTimer);
            peerReconnectTimer = null;
        }
    });

    peer.on('call', handleIncomingCall);
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
            // Recoverable errors - try to reconnect
            console.log('Recoverable peer error, will reconnect...');
            peerReconnectTimer = setTimeout(() => {
                if (peer && !peer.destroyed) {
                    try { peer.reconnect(); } catch(e) {
                        console.error('Reconnect failed:', e);
                    }
                }
            }, 3000);
        } else if (err.type === 'peer-unavailable') {
            console.error('Remote peer unavailable');
        } else {
            alert('Verbindungsfehler. Bitte laden Sie die Seite neu.');
        }
    });
    
    peer.on('close', () => {
        console.warn('PeerJS connection closed');
    });
}

function handleIncomingCall(call) {
    currentCall = call;
    _lastRemoteStreamId = null; // Reset for new call
    
    // Ensure remote video can play audio
    remoteVideo.muted = false;
    remoteVideo.volume = 1;
    
    // Register stream event BEFORE answering to prevent race condition
    call.on('stream', (remoteStream) => {
        console.log('Remote stream received - audio tracks:', remoteStream.getAudioTracks().length, 'video tracks:', remoteStream.getVideoTracks().length);
        attachRemoteStream(remoteStream);
    });
    
    // Setup peerConnection monitoring OUTSIDE stream handler
    // Wait briefly for PeerJS to create the peerConnection
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
            updateDebugOverlay('ICE: ' + state);
            if (state === 'disconnected' || state === 'failed') {
                console.warn('ICE connection ' + state + ' - attempting restart');
                try { call.peerConnection.restartIce(); } catch(e) { console.error('ICE restart failed:', e); }
            }
            if (state === 'connected' || state === 'completed') {
                // Re-verify audio is playing after ICE reconnection
                ensureAudioPlaying();
            }
        });
    };
    // PeerJS creates peerConnection during answer, check after short delay
    setTimeout(setupPCMonitoring, 100);

    call.on('close', () => {
        endCall();
    });
    
    call.on('error', (err) => {
        console.error('Call error:', err);
    });
    
    // Answer AFTER registering event listeners
    call.answer(localStream);
}

let _lastRemoteStreamId = null;
let _lastRemoteAudioTrackId = null;
let _remoteAudioEl = null;
let _audioHealthInterval = null;
let _webAudioSource = null;

function attachRemoteStream(stream) {
    const newAudioTrackId = stream.getAudioTracks().length > 0 ? stream.getAudioTracks()[0].id : null;
    
    // Skip ONLY if exact same stream AND same audio track (not just stream ID)
    if (_lastRemoteStreamId === stream.id && remoteVideo.srcObject === stream 
        && _lastRemoteAudioTrackId === newAudioTrackId) {
        // Even when skipping, verify audio is still healthy
        const audioTrack = stream.getAudioTracks()[0];
        if (audioTrack && audioTrack.readyState === 'live' && !remoteVideo.paused && !remoteVideo.muted) {
            console.log('Same stream+track already attached and healthy, skipping');
            return;
        }
        console.log('Same stream but audio needs attention, re-processing');
    }
    _lastRemoteStreamId = stream.id;
    _lastRemoteAudioTrackId = newAudioTrackId;
    
    console.log('attachRemoteStream: audio tracks:', stream.getAudioTracks().length, 
        'video tracks:', stream.getVideoTracks().length);
    
    // Monitor audio track state changes (do NOT force track.enabled = true,
    // as this would override the berater's intentional mute)
    stream.getAudioTracks().forEach(track => {
        console.log('Remote audio track:', track.id, 'enabled:', track.enabled, 
            'readyState:', track.readyState, 'muted:', track.muted);
        track.onunmute = () => {
            console.log('Audio track unmuted - data flowing, track:', track.id);
            updateDebugOverlay('Audio: Daten fließen');
        };
        track.onmute = () => {
            console.warn('Audio track muted - data STOPPED, track:', track.id);
            updateDebugOverlay('Audio: Daten gestoppt!');
        };
        track.onended = () => {
            console.warn('Audio track ENDED:', track.id);
            updateDebugOverlay('Audio: Track beendet!');
            // Try to recover audio from peerConnection
            setTimeout(() => tryRecoverAudio(), 1000);
        };
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
    
    // === AUDIO ROUTING ===
    // Known Chrome/Android bug: When getUserMedia() captures the microphone,
    // Chrome switches Android to MODE_IN_COMMUNICATION, making the hardware
    // volume buttons control STREAM_VOICE_CALL. BUT Chrome actually outputs
    // WebRTC audio through STREAM_MUSIC (media volume). If media volume is
    // low/muted, the user can't hear anything despite adjusting the volume.
    //
    // Solution: Use AudioContext GainNode to BOOST the audio signal (2-3x),
    // then output via an <audio> element at max volume. This compensates
    // for potentially low media volume and ensures audio is always audible.
    if (stream.getAudioTracks().length > 0) {
        try {
            routeAudioWithBoost(stream);
        } catch(e) {
            console.warn('Boosted audio routing failed, direct fallback:', e);
            routeAudioDirect(stream);
        }
    }
    
    // Play the video element for video frames only
    remoteVideo.play().then(() => {
        console.log('Remote video playing (muted — audio via separate element)');
    }).catch(e => {
        console.warn('Video play failed:', e.name, '- retrying');
        remoteVideo.muted = true;
        remoteVideo.play().catch(() => {});
    });
    
    // Show Android volume notification
    if (_isAndroid && !_volumeNotificationShown) {
        showVolumeNotification();
    }
    
    // Start audio health monitoring
    startAudioHealthCheck();
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
    
    // Create GainNode to boost volume (compensates for low media volume on Android)
    _gainNode = _audioContext.createGain();
    _gainNode.gain.value = _isMobile ? 3.0 : 1.5; // 3x boost on mobile, 1.5x on desktop
    
    // Create a compressor to prevent clipping from the gain boost
    const compressor = _audioContext.createDynamicsCompressor();
    compressor.threshold.setValueAtTime(-10, _audioContext.currentTime);
    compressor.knee.setValueAtTime(30, _audioContext.currentTime);
    compressor.ratio.setValueAtTime(12, _audioContext.currentTime);
    compressor.attack.setValueAtTime(0.003, _audioContext.currentTime);
    compressor.release.setValueAtTime(0.25, _audioContext.currentTime);
    
    // Create destination to get a boosted MediaStream
    const destination = _audioContext.createMediaStreamDestination();
    
    // Chain: source → gain → compressor → destination
    _webAudioSource.connect(_gainNode);
    _gainNode.connect(compressor);
    compressor.connect(destination);
    
    // Also connect to speakers directly on desktop (dual path for reliability)
    if (!_isMobile) {
        compressor.connect(_audioContext.destination);
    }
    
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
        updateDebugOverlay('Audio: OK (Boost ' + _gainNode.gain.value + 'x)');
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
        updateDebugOverlay('Audio: OK (Direkt)');
    }).catch(e => {
        console.warn('Direct audio play failed:', e.name);
        // Last resort: use video element for audio
        remoteVideo.muted = false;
        remoteVideo.volume = 1;
        updateDebugOverlay('Audio: Fallback (Video)');
    });
}

// Show notification on Android about volume control quirk
function showVolumeNotification() {
    _volumeNotificationShown = true;
    const notification = document.createElement('div');
    notification.id = 'volume-notification';
    notification.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);' +
        'background:#303030;color:#fff;padding:12px 20px;border-radius:12px;z-index:9998;' +
        'font-size:14px;text-align:center;max-width:320px;box-shadow:0 4px 20px rgba(0,0,0,0.3);' +
        'animation:slideUp 0.3s ease;line-height:1.4;';
    notification.innerHTML = '<div style="font-size:20px;margin-bottom:6px;">\uD83D\uDD0A</div>' +
        '<strong>Tipp:</strong> Falls Sie nichts hören, erhöhen Sie die ' +
        '<strong>Medienlautstärke</strong> Ihres Geräts.<br>' +
        '<small style="opacity:0.7;">Lautstärketaste drücken → Schieberegler erweitern</small>';
    notification.addEventListener('click', () => notification.remove());
    document.body.appendChild(notification);
    
    // Auto-dismiss after 8 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.opacity = '0';
            notification.style.transition = 'opacity 0.5s';
            setTimeout(() => notification.remove(), 500);
        }
    }, 8000);
}

// Periodically check audio health and attempt recovery
function startAudioHealthCheck() {
    if (_audioHealthInterval) return;
    _audioHealthInterval = setInterval(() => {
        if (!remoteVideo.srcObject || !currentCall) {
            stopAudioHealthCheck();
            return;
        }
        
        const stream = remoteVideo.srcObject;
        const audioTracks = stream.getAudioTracks();
        
        if (audioTracks.length === 0) {
            console.warn('Audio health: no audio tracks in stream!');
            updateDebugOverlay('Audio: Kein Track!');
            tryRecoverAudio();
            return;
        }
        
        const track = audioTracks[0];
        if (track.readyState === 'ended') {
            console.warn('Audio health: track ended, recovering...');
            updateDebugOverlay('Audio: Track tot - Recovery...');
            tryRecoverAudio();
            return;
        }
        
        // Ensure the <audio> element is still playing
        if (_remoteAudioElement && _remoteAudioElement.paused && _remoteAudioElement.srcObject) {
            console.warn('Audio health: audio element paused, re-playing');
            _remoteAudioElement.play().catch(() => {});
        }
        // Ensure video element stays muted (audio goes through <audio> element)
        if (!remoteVideo.muted) {
            remoteVideo.muted = true;
            remoteVideo.volume = 0;
        }
        if (remoteVideo.paused) {
            remoteVideo.play().catch(() => {});
        }
    }, 5000);
}

function stopAudioHealthCheck() {
    if (_audioHealthInterval) {
        clearInterval(_audioHealthInterval);
        _audioHealthInterval = null;
    }
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
    if (_remoteAudioElement) {
        _remoteAudioElement.srcObject = null;
        _remoteAudioElement.pause();
    }
}

// Try to recover audio from peerConnection receivers
function tryRecoverAudio() {
    if (!currentCall || !currentCall.peerConnection) {
        console.warn('Cannot recover audio - no peerConnection');
        return;
    }
    
    const receivers = currentCall.peerConnection.getReceivers();
    const audioReceiver = receivers.find(r => r.track && r.track.kind === 'audio' && r.track.readyState === 'live');
    
    if (!audioReceiver) {
        console.warn('No live audio receiver found');
        updateDebugOverlay('Audio: Kein Receiver!');
        return;
    }
    
    console.log('Recovering audio from receiver, track:', audioReceiver.track.id, 
        'readyState:', audioReceiver.track.readyState, 'enabled:', audioReceiver.track.enabled);
    
    audioReceiver.track.enabled = true;
    
    const stream = remoteVideo.srcObject;
    if (stream) {
        // Replace dead audio tracks with the live one from receiver
        stream.getAudioTracks().forEach(t => {
            if (t.id !== audioReceiver.track.id || t.readyState === 'ended') {
                stream.removeTrack(t);
            }
        });
        if (!stream.getAudioTracks().find(t => t.id === audioReceiver.track.id)) {
            stream.addTrack(audioReceiver.track);
        }
    }
    
    // Force re-attach via the full attachRemoteStream pipeline
    _lastRemoteStreamId = null;
    _lastRemoteAudioTrackId = null;
    if (stream) {
        attachRemoteStream(stream);
        console.log('Audio recovery: re-attached via boosted audio pipeline');
        updateDebugOverlay('Audio: Wiederhergestellt');
    }
}

// Ensure audio is playing (called after ICE reconnection)
function ensureAudioPlaying() {
    if (!remoteVideo.srcObject) return;
    
    const stream = remoteVideo.srcObject;
    const audioTracks = stream.getAudioTracks();
    audioTracks.forEach(track => {
        track.enabled = true;
        console.log('ensureAudioPlaying - track:', track.id, 'readyState:', track.readyState, 'muted:', track.muted);
    });
    
    if (audioTracks.length === 0 || audioTracks[0].readyState === 'ended') {
        tryRecoverAudio();
        return;
    }
    
    // Re-route through the boosted audio pipeline
    try {
        routeAudioWithBoost(stream);
    } catch(e) {
        routeAudioDirect(stream);
    }
    
    // Keep video element muted — audio goes through <audio> element
    remoteVideo.muted = true;
    remoteVideo.volume = 0;
    
    // Ensure video frames are playing
    if (remoteVideo.paused) {
        remoteVideo.play().catch(() => {});
    }
}

// Visible debug indicator for iPhone (no console access)
function updateDebugOverlay(msg) {
    let dbg = document.getElementById('audio-debug');
    if (!dbg) {
        dbg = document.createElement('div');
        dbg.id = 'audio-debug';
        dbg.style.cssText = 'position:fixed;top:4px;right:4px;background:rgba(0,0,0,0.7);color:#0f0;font-size:11px;padding:4px 8px;border-radius:4px;z-index:99999;pointer-events:none;';
        document.body.appendChild(dbg);
    }
    dbg.textContent = msg;
    console.log('DEBUG:', msg);
}

function showPlayOverlay() {
    // No-op: Audio is handled via Web Audio API which is unlocked during user gesture.
    // The overlay is no longer needed.
    console.log('showPlayOverlay: skipped (Web Audio handles audio)');
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
            console.log('=== SCREEN SHARE STARTED ===');
            console.log('Calling refreshRemoteVideo...');
            refreshRemoteVideo();
        } else if (data.type === 'screen-share-ended') {
            console.log('=== SCREEN SHARE ENDED ===');
            refreshRemoteVideo();
        } else if (data.type === 'video-toggle') {
            console.log('Berater video toggled:', data.videoEnabled);
            remoteAudioOnly.classList.toggle('hidden', data.videoEnabled);
            // Hide/show video element to prevent frozen frame
            remoteVideo.style.visibility = data.videoEnabled ? 'visible' : 'hidden';
        }
    });

    conn.on('close', () => {
        console.log('Data connection closed');
    });
}

// DSGVO consent dialog before camera/microphone access (Art. 6/7 DSGVO)
function showConsentDialog(callType) {
    return new Promise((resolve, reject) => {
        const overlay = document.createElement('div');
        overlay.id = 'consent-overlay';
        overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:9999;padding:20px;';
        
        const mediaText = 'Mikrofon';
        
        overlay.innerHTML = `
            <div style="background:#fff;border-radius:16px;max-width:480px;width:100%;padding:32px;box-shadow:0 20px 60px rgba(0,0,0,0.3);font-family:'Inter',sans-serif;">
                <h3 style="margin:0 0 16px;font-size:1.2rem;color:#303030;">Einwilligung zur Datenverarbeitung</h3>
                <div style="font-size:0.875rem;color:#444;line-height:1.7;">
                    <p style="margin-bottom:12px;">Für die Videoberatung benötigen wir Zugriff auf Ihr <strong>${mediaText}</strong>. Bitte beachten Sie:</p>
                    <ul style="padding-left:20px;margin-bottom:12px;">
                        <li>Die Übertragung erfolgt <strong>verschlüsselt</strong> und <strong>direkt</strong> zwischen den Endgeräten (Peer-to-Peer).</li>
                        <li>Es findet <strong>keine Aufzeichnung</strong> von Video, Audio oder Bildschirmfreigabe statt.</li>
                        <li>Der Anruf startet als <strong>reiner Audioanruf</strong>. Sie können die Kamera jederzeit per Klick auf das Video-Symbol aktivieren.</li>
                    </ul>
                    <p style="margin-bottom:16px;">Weitere Informationen finden Sie in unserer <a href="/datenschutz.html" target="_blank" style="color:#f18800;font-weight:500;">Datenschutzerklärung</a>.</p>
                </div>
                <div style="display:flex;gap:12px;justify-content:flex-end;">
                    <button id="consent-cancel" style="padding:10px 20px;border:1px solid #ddd;border-radius:8px;background:#fff;color:#666;cursor:pointer;font-size:0.875rem;font-family:inherit;">Abbrechen</button>
                    <button id="consent-accept" style="padding:10px 20px;border:none;border-radius:8px;background:#f18800;color:#fff;cursor:pointer;font-weight:600;font-size:0.875rem;font-family:inherit;">Einverstanden</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(overlay);
        
        overlay.querySelector('#consent-accept').addEventListener('click', () => {
            // Unlock audio during this user gesture (closest gesture to call start)
            unlockAudio();
            overlay.remove();
            resolve(true);
        });
        overlay.querySelector('#consent-cancel').addEventListener('click', () => {
            overlay.remove();
            resolve(false);
        });
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

    // DSGVO: Show consent dialog before accessing media devices
    const consent = await showConsentDialog(callType);
    if (!consent) return;

    // Unlock audio during this user gesture so remote audio works later
    unlockAudio();
    
    try {
        // Try to get media based on call type
        if (callType === 'video') {
            // Video call: start with camera ON immediately
            try {
                localStream = await navigator.mediaDevices.getUserMedia({
                    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
                    video: true
                });
                isVideoEnabled = true;
                toggleVideoBtn.classList.remove('muted');
                toggleVideoBtn.classList.add('active');
            } catch (videoErr) {
                // Camera failed — fall back to audio + dummy video
                console.warn('Camera not available, using audio-only:', videoErr.message);
                localStream = await navigator.mediaDevices.getUserMedia({
                    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
                    video: false
                });
                const dummyTrack = createDummyVideoTrack();
                localStream.addTrack(dummyTrack);
                isVideoEnabled = false;
                toggleVideoBtn.classList.add('muted');
            }
        } else {
            // Audio-only call
            localStream = await navigator.mediaDevices.getUserMedia({
                audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
                video: false
            });
            
            // Add dummy video track so WebRTC negotiates video transceivers
            const dummyTrack = createDummyVideoTrack();
            localStream.addTrack(dummyTrack);
            
            isVideoEnabled = false;
            toggleVideoBtn.classList.add('muted');
        }
        
        localVideo.srcObject = localStream;
        localVideo.muted = true; // Local video always muted
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
    _makeCallInProgress = false;
    
    // Stop audio health monitoring
    stopAudioHealthCheck();
    
    if (currentCall) {
        currentCall.close();
        currentCall = null;
    }
    
    if (dataConnection) {
        dataConnection.close();
        dataConnection = null;
    }
    
    // Clean up remote video/audio
    disconnectWebAudio();
    remoteVideo.srcObject = null;
    _lastRemoteStreamId = null;
    _lastRemoteAudioTrackId = null;
    // Remove debug overlay and play overlay
    const dbg = document.getElementById('audio-debug');
    if (dbg) dbg.remove();
    const playOverlay = document.getElementById('play-overlay');
    if (playOverlay) playOverlay.remove();
    
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
    
    if (callTimerInterval) {
        clearInterval(callTimerInterval);
        callTimerInterval = null;
    }
    
    chatMessages.innerHTML = '';
    
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
                let sender = currentCall.peerConnection.getSenders().find(s => s.track && s.track.kind === 'video');
                if (!sender) sender = currentCall.peerConnection.getSenders().find(s => !s.track);
                if (sender) {
                    await sender.replaceTrack(newVideoTrack);
                } else {
                    currentCall.peerConnection.addTrack(newVideoTrack, localStream);
                }
            }
            
            isVideoEnabled = true;
            toggleVideoBtn.classList.remove('muted');
            toggleVideoBtn.classList.add('active');
            
            // Hide local audio-only indicator
            const localAudioOnly = document.getElementById('local-audio-only');
            if (localAudioOnly) localAudioOnly.classList.add('hidden');
            
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
        const canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 480;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        const dummyTrack = canvas.captureStream(1).getVideoTracks()[0];
        localStream.addTrack(dummyTrack);
        localVideo.srcObject = localStream;
        
        // Replace track in WebRTC connection
        if (currentCall && currentCall.peerConnection) {
            let sender = currentCall.peerConnection.getSenders().find(s => s.track && s.track.kind === 'video');
            if (!sender) sender = currentCall.peerConnection.getSenders().find(s => !s.track);
            if (sender) {
                await sender.replaceTrack(dummyTrack);
            }
        }
        
        isVideoEnabled = false;
        toggleVideoBtn.classList.add('muted');
        toggleVideoBtn.classList.remove('active');
        
        // If videos are swapped, swap back to normal before showing audio indicator
        if (isVideoSwapped) swapVideos();
        
        // Show local audio-only indicator
        const localAudioOnly = document.getElementById('local-audio-only');
        if (localAudioOnly) localAudioOnly.classList.remove('hidden');
        
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
            
            toggleAudioBtn.classList.toggle('muted', !isAudioEnabled);
            console.log('Audio toggled:', isAudioEnabled ? 'unmuted' : 'muted');
        }
    }
}

async function flipCamera() {
    if (!localStream || isScreenSharing) return;
    
    // Add flipping animation
    if (flipCameraBtn) {
        flipCameraBtn.classList.add('flipping');
        setTimeout(() => flipCameraBtn.classList.remove('flipping'), 600);
    }
    
    try {
        // Switch facing mode
        currentFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
        
        // Get new video stream with opposite camera
        const newStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: currentFacingMode },
            audio: false
        });
        
        const newVideoTrack = newStream.getVideoTracks()[0];
        const oldVideoTrack = localStream.getVideoTracks()[0];
        
        // Replace track in local stream
        if (oldVideoTrack) {
            oldVideoTrack.stop();
            localStream.removeTrack(oldVideoTrack);
        }
        localStream.addTrack(newVideoTrack);
        
        // Update local video display
        localVideo.srcObject = localStream;
        
        // Replace track in peer connection
        if (currentCall && currentCall.peerConnection) {
            const sender = currentCall.peerConnection.getSenders().find(s => s.track && s.track.kind === 'video');
            if (sender) {
                await sender.replaceTrack(newVideoTrack);
            }
        }
        
        // Update originalVideoTrack reference
        originalVideoTrack = newVideoTrack;
        
        console.log('Camera flipped to:', currentFacingMode);
    } catch (err) {
        console.error('Error flipping camera:', err);
        // Revert facing mode on error
        currentFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
    }
}

async function toggleScreenShare() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        alert('Bildschirmfreigabe wird von diesem Gerät/Browser nicht unterstützt.');
        return;
    }
    
    try {
        if (isScreenSharing) {
            // Stop screen sharing, restore original video
            const screenTrack = localStream.getVideoTracks()[0];
            if (screenTrack) {
                screenTrack.stop();
                localStream.removeTrack(screenTrack);
            }
            
            // Restore original or create new dummy track
            if (originalVideoTrack && originalVideoTrack.readyState === 'live') {
                localStream.addTrack(originalVideoTrack);
            } else {
                const dummyTrack = createDummyVideoTrack();
                localStream.addTrack(dummyTrack);
            }
            
            localVideo.srcObject = localStream;
            
            if (currentCall && currentCall.peerConnection) {
                let sender = currentCall.peerConnection.getSenders().find(s => 
                    s.track ? s.track.kind === 'video' : false
                );
                if (!sender) {
                    sender = currentCall.peerConnection.getSenders().find(s => !s.track);
                }
                if (sender) {
                    await sender.replaceTrack(localStream.getVideoTracks()[0]);
                }
            }
            
            if (dataConnection && dataConnection.open) {
                dataConnection.send({ type: 'screen-share-ended' });
            }
            
            toggleScreenBtn.classList.remove('active');
            localVideo.classList.remove('screen-share-active');
            isScreenSharing = false;
        } else {
            // Start screen sharing
            const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
            const screenTrack = screenStream.getVideoTracks()[0];
            
            // Save original video track
            originalVideoTrack = localStream.getVideoTracks()[0];
            if (originalVideoTrack) {
                localStream.removeTrack(originalVideoTrack);
            }
            
            localStream.addTrack(screenTrack);
            localVideo.srcObject = localStream;
            
            if (currentCall && currentCall.peerConnection) {
                // Find video sender (may have null track if started as audio-only)
                let sender = currentCall.peerConnection.getSenders().find(s => 
                    s.track ? s.track.kind === 'video' : false
                );
                // Also check for senders with no track (transceiver created with dummy)
                if (!sender) {
                    sender = currentCall.peerConnection.getSenders().find(s => !s.track);
                }
                if (sender) {
                    await sender.replaceTrack(screenTrack);
                } else {
                    // No video sender exists at all, add the track
                    currentCall.peerConnection.addTrack(screenTrack, localStream);
                }
            }
            
            if (dataConnection && dataConnection.open) {
                dataConnection.send({ type: 'screen-share-started' });
            }
            
            screenTrack.onended = () => {
                toggleScreenShare();
            };
            
            toggleScreenBtn.classList.add('active');
            localVideo.classList.add('screen-share-active');
            isScreenSharing = true;
        }
    } catch (err) {
        console.log('Screen share cancelled or error:', err.message);
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
        // Local preview is view-only, no click interaction
        localWrapper.style.pointerEvents = 'none';
    }
    
    if (remoteWrapper) {
        remoteWrapper.addEventListener('click', () => {
            if (isVideoSwapped) swapVideos();
        });
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

// File upload restrictions (Art. 32 DSGVO - Sicherheit)
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
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

socket.on('queue-full', (data) => {
    alert(data.message);
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
    showSection('login');
});

socket.on('queue-timeout', (data) => {
    alert(data.message);
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
    showSection('login');
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
    
    // Ensure peer is connected before calling
    if (!peer || peer.destroyed) {
        console.error('Peer not available, reinitializing...');
        initPeer();
        peer.once('open', () => {
            makeCall(data);
        });
        return;
    }
    
    if (!peer.open) {
        console.warn('Peer not yet open, waiting...');
        peer.once('open', () => {
            makeCall(data);
        });
        return;
    }
    
    makeCall(data);
});

function makeCall(data) {
    // Prevent double call
    if (_makeCallInProgress) {
        console.warn('makeCall already in progress, ignoring duplicate');
        return;
    }
    _makeCallInProgress = true;
    
    console.log('Making call to berater peer:', data.beraterPeerId);
    
    // Close any existing call first
    if (currentCall) {
        try { currentCall.close(); } catch(e) {}
        currentCall = null;
    }
    
    // Reset stream tracking for new call
    _lastRemoteStreamId = null;
    
    // Log what we're sending
    if (localStream) {
        console.log('Calling with localStream - audio:', localStream.getAudioTracks().length, 'video:', localStream.getVideoTracks().length);
    } else {
        console.error('WARNING: localStream is null when making call!');
    }
    
    // Small delay to ensure both sides are ready
    setTimeout(() => {
        const call = peer.call(data.beraterPeerId, localStream);
        if (!call) {
            console.error('peer.call() returned null');
            return;
        }
        currentCall = call;
        
        call.on('stream', (remoteStream) => {
            console.log('Remote stream from berater - audio:', remoteStream.getAudioTracks().length, 'video:', remoteStream.getVideoTracks().length);
            attachRemoteStream(remoteStream);
        });
        
        // Setup peerConnection monitoring - use addEventListener to NOT overwrite PeerJS internals
        const setupOutgoingPCMonitoring = () => {
            if (!call.peerConnection) return;
            
            call.peerConnection.addEventListener('track', (event) => {
                console.log('PC track event (outgoing):', event.track.kind, 'readyState:', event.track.readyState);
                if (event.streams && event.streams[0]) {
                    attachRemoteStream(event.streams[0]);
                }
            });
            
            call.peerConnection.addEventListener('iceconnectionstatechange', () => {
                const state = call.peerConnection.iceConnectionState;
                console.log('ICE state (outgoing):', state);
                updateDebugOverlay('ICE: ' + state);
                if (state === 'disconnected' || state === 'failed') {
                    console.warn('ICE ' + state + ' - attempting restart');
                    try { call.peerConnection.restartIce(); } catch(e) {}
                }
                if (state === 'connected' || state === 'completed') {
                    ensureAudioPlaying();
                }
            });
        };
        setTimeout(setupOutgoingPCMonitoring, 100);

        call.on('close', () => {
            endCall();
        });
        
        call.on('error', (err) => {
            console.error('Outgoing call error:', err);
        });

        const conn = peer.connect(data.beraterPeerId, { reliable: true });
        handleDataConnection(conn);
    }, 500);

    showSection('call');
    startCallTimer();
}

socket.on('call-rejected', () => {
    showSection('queue');
    if (queueAudio) {
        queueAudio.play().catch(e => console.log('Audio autoplay blocked'));
    }
});

socket.on('berater-disconnected', () => {
    console.warn('Berater disconnected during call');
    endCall();
});

startCallBtn.addEventListener('click', () => startCall('audio'));
cancelCallBtn.addEventListener('click', cancelCall);
endCallBtn.addEventListener('click', endCall);
newCallBtn.addEventListener('click', () => {
    initPeer();
    showSection('login');
});

toggleVideoBtn.addEventListener('click', toggleVideo);
toggleAudioBtn.addEventListener('click', toggleAudio);
toggleScreenBtn.addEventListener('click', toggleScreenShare);
if (flipCameraBtn) flipCameraBtn.addEventListener('click', flipCamera);

// Chat back button - scroll back to video on mobile
const chatBackBtn = document.getElementById('chat-back-btn');
if (chatBackBtn) {
    chatBackBtn.addEventListener('click', () => {
        // Scroll video area into view on mobile
        const videoArea = document.querySelector('.video-area-customer');
        if (videoArea) {
            videoArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        // Also blur the chat input to hide keyboard
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

customerNameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') startCallBtn.click();
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
    console.log('=== REFRESH REMOTE VIDEO ===');
    
    if (!currentCall) {
        console.log('No currentCall - waiting for new call');
        return;
    }
    
    if (!currentCall.peerConnection) {
        console.log('No peerConnection yet');
        return;
    }
    
    const pc = currentCall.peerConnection;
    const receivers = pc.getReceivers();
    console.log('Total receivers:', receivers.length);
    
    // Use the stream from the receiver directly - do NOT create a new MediaStream()
    // Creating new MediaStream from remote tracks is an anti-pattern that kills audio
    const videoReceiver = receivers.find(r => r.track && r.track.kind === 'video');
    
    if (videoReceiver && videoReceiver.track) {
        const track = videoReceiver.track;
        console.log('Video track found:', track.id, 'readyState:', track.readyState);
        
        // Get the stream that the receiver's track belongs to
        // This preserves the original stream with both audio and video
        let remoteStream = null;
        if (videoReceiver.track.id && pc.getReceivers) {
            // Try to find the original stream from ontrack events
            const existingStream = remoteVideo.srcObject;
            if (existingStream) {
                // Update existing stream's video track instead of replacing the stream
                const oldVideoTracks = existingStream.getVideoTracks();
                oldVideoTracks.forEach(t => existingStream.removeTrack(t));
                existingStream.addTrack(track);
                remoteStream = existingStream;
            }
        }
        
        if (!remoteStream) {
            // Fallback: use streams from the receiver (browser provides the original)
            remoteStream = new MediaStream();
            receivers.forEach(r => {
                if (r.track && r.track.readyState === 'live') {
                    remoteStream.addTrack(r.track);
                }
            });
        }
        
        // Reset stream ID tracking so attachRemoteStream processes it
        _lastRemoteStreamId = null;
        attachRemoteStream(remoteStream);
        console.log('Screen share video refreshed!');
    } else {
        console.log('No video receiver yet');
    }
}

// Socket reconnection handling
socket.on('connect', () => {
    console.log('Socket connected:', socket.id);
});

socket.on('disconnect', (reason) => {
    console.warn('Socket disconnected:', reason);
});

socket.on('reconnect', (attemptNumber) => {
    console.log('Socket reconnected after', attemptNumber, 'attempts');
});

loadIceServers().then(() => initPeer());

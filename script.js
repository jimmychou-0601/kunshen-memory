'use strict';

/* ===================================
   TAPE DATA
=================================== */
const TAPES = [
    {
        id: 0,
        title: '主題曲',
        side: 'SIDE A',
        color: '#1A5A8E',
        bg: '#E8F0F8',
        file: 'audio/主題曲.mp4'
    },
    {
        id: 1,
        title: '台南外海上的奇遇',
        side: 'SIDE A',
        color: '#C85A1A',
        bg: '#F9F0E2',
        file: 'audio/台南外海上的奇遇.MP3'
    },
    {
        id: 2,
        title: '夕陽下的鹽田時光',
        side: 'SIDE A',
        color: '#2A6A3A',
        bg: '#E8F2EA',
        file: 'audio/夕陽下的鹽田時光.MP3'
    },
    {
        id: 3,
        title: '深海底下的神秘古文明',
        side: 'SIDE B',
        color: '#8B2020',
        bg: '#F5EAE2',
        file: 'audio/深海底下的神秘古文明.MP3'
    },
    {
        id: 4,
        title: '面對過去黑暗',
        side: 'SIDE B',
        color: '#4A2A6A',
        bg: '#EAE2F5',
        file: 'audio/面對過去黑暗.MP3'
    },
    {
        id: 5,
        title: '過去與現代的融合',
        side: 'SIDE B',
        color: '#A08020',
        bg: '#F5F0E2',
        file: 'audio/過去與現代的融合.MP3'
    }
];

/* ===================================
   STATE
=================================== */
const S = {
    hasTape:    false,
    tapeId:     null,
    playing:    false,
    volume:     0.7,
    vuLevel:    0,
    audioEl:    new Audio()
};
S.audioEl.addEventListener('ended', () => {
    if (S.playing) {
        setPlaying(false);
        S.audioEl.currentTime = 0;
    }
});

/* ===================================
   DOM REFS
=================================== */
const el = id => document.getElementById(id);
const D = {
    cassette:    el('cassette'),
    deckEmpty:   el('deckEmpty'),
    reelL:       el('reelL'),
    reelR:       el('reelR'),
    labelStripe: el('labelStripe'),
    labelTitle:  el('labelTitle'),
    labelSide:   el('labelSide'),
    tonearm:     el('tonearm'),
    dispTrack:   el('dispTrack'),
    dispStatus:  el('dispStatus'),
    powerLed:    el('powerLed'),
    btnPlay:     el('btnPlay'),
    playIco:     el('playIco'),
    playLbl:     el('playLbl'),
    btnEject:    el('btnEject'),
    btnRew:      el('btnRew'),
    btnFF:       el('btnFF'),
    tapeShelf:   el('tapeShelf'),
    knobVol:     el('knobVol'),
    knobTone:    el('knobTone'),
    vuBars:      document.querySelectorAll('.vu-b'),
};

/* ===================================
   INIT
=================================== */
function init() {
    buildShelf();
    setupKnob(D.knobVol, 70, v => {
        S.volume = v / 100;
        S.audioEl.volume = S.volume;
    });
    setupKnob(D.knobTone, 50, v => {
        // Pitch Control (Playback Rate): 50 is normal (1.0x). Range 0.5x to 1.5x
        const rate = 0.5 + (v / 100);
        S.audioEl.playbackRate = rate;
    });

    D.btnPlay.addEventListener('click', onPlay);
    D.btnEject.addEventListener('click', onEject);
    D.btnRew.addEventListener('click', onRew);
    D.btnFF.addEventListener('click', onFF);

    setupMediaSession();
    setupScratching();

    D.cassette.classList.add('hidden');
    D.deckEmpty.classList.add('visible');
    
    requestAnimationFrame(renderLoop);
}

/* ===================================
   RENDER LOOP & ROTATION
=================================== */
function renderLoop() {
    requestAnimationFrame(renderLoop);
    
    // 2. Sync Platter Rotation with Audio Time
    if (S.hasTape) {
        const angle = (S.audioEl.currentTime * 200) % 360;
        D.reelL.style.transform = `rotate(${angle}deg)`;
    } else {
        D.reelL.style.transform = `rotate(0deg)`;
    }
    
    // 3. VU Meter Animation
    if (S.playing) {
        tickVU();
    } else {
        // Smooth drop to zero
        if (S.vuLevel > 0) {
            S.vuLevel = Math.max(0, S.vuLevel - 0.5);
            const level = Math.round(S.vuLevel);
            D.vuBars.forEach((b, i) => {
                const on = (i + 1) <= level;
                b.classList.toggle('lit', on);
                b.style.height = on ? (4 + (i + 1) * 3) + 'px' : '4px';
            });
        }
    }
}

/* ===================================
   SCRATCHING (DJ Interaction)
=================================== */
function setupScratching() {
    let isDragging = false;
    let startAngle = 0;
    let startAudioTime = 0;
    let center = { x: 0, y: 0 };
    
    function getAngle(e) {
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        const dx = clientX - center.x;
        const dy = clientY - center.y;
        return Math.atan2(dy, dx) * (180 / Math.PI);
    }
    
    const down = (e) => {
        if (!S.hasTape) return;
        if (e.cancelable) e.preventDefault();
        isDragging = true;
        
        const rect = D.reelL.getBoundingClientRect();
        center = {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2
        };
        
        startAngle = getAngle(e);
        startAudioTime = S.audioEl.currentTime;
        
        // Temporarily pause if playing so scrubbing takes over cleanly
        if (S.playing) S.audioEl.pause();
    };
    
    const move = (e) => {
        if (!isDragging) return;
        if (e.cancelable) e.preventDefault();
        
        const currentAngle = getAngle(e);
        let diff = currentAngle - startAngle;
        
        // Wraparound check
        if (diff > 180) diff -= 360;
        if (diff < -180) diff += 360;
        
        // Map angle change directly to time (150 degrees = 1 second for good feel)
        const timeDiff = diff / 150;
        let newTime = startAudioTime + timeDiff;
        newTime = Math.max(0, Math.min(S.audioEl.duration || 0, newTime));
        
        S.audioEl.currentTime = newTime;
        
        startAngle = currentAngle;
        startAudioTime = newTime;
    };
    
    const up = () => {
        if (!isDragging) return;
        isDragging = false;
        if (S.playing) S.audioEl.play().catch(()=>{});
    };
    
    D.reelL.addEventListener('mousedown', down);
    D.reelL.addEventListener('touchstart', down, { passive: false });
    
    window.addEventListener('mousemove', move, { passive: false });
    window.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('mouseup', up);
    window.addEventListener('touchend', up);
}

/* ===================================
   TAPE SHELF
=================================== */
function updateMediaSession(tape) {
    if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
            title: tape.title,
            artist: 'KMN RECORDS',
            album: '鯤鯓記憶'
        });
    }
}

function setupMediaSession() {
    if ('mediaSession' in navigator) {
        navigator.mediaSession.setActionHandler('play', () => {
            if (S.hasTape && !S.playing) onPlay();
        });
        navigator.mediaSession.setActionHandler('pause', () => {
            if (S.hasTape && S.playing) onPlay();
        });
        navigator.mediaSession.setActionHandler('previoustrack', () => {
            if (S.hasTape) onRew();
        });
        navigator.mediaSession.setActionHandler('nexttrack', () => {
            if (S.hasTape) onFF();
        });
    }
}

/* ===================================
   TAPE SHELF
=================================== */
function buildShelf() {
    TAPES.forEach(t => {
        const el = document.createElement('div');
        el.className = 'tape-thumb';
        el.dataset.id = t.id;
        el.innerHTML = `
            <div class="tape-thumb-stripe" style="background:${t.color}"></div>
            <div class="tape-thumb-face" style="background:${t.bg}">
                <div class="tape-thumb-ttl" style="color:${t.color}">${t.title}</div>
                <div class="tape-thumb-reels">
                    <div class="tape-thumb-reel"></div>
                    <div class="tape-thumb-reel"></div>
                </div>
            </div>
        `;
        el.addEventListener('click', () => onSelectTape(t.id));
        D.tapeShelf.appendChild(el);
    });
}

/* ===================================
   SELECT TAPE
=================================== */
function onSelectTape(id) {
    const tape = TAPES[id];

    if (S.playing) {
        stopAudio();
        setPlaying(false);
    }

    // Highlight shelf thumb
    document.querySelectorAll('.tape-thumb').forEach(el => {
        el.classList.toggle('active', +el.dataset.id === id);
    });

    S.tapeId  = id;
    S.hasTape = true;
    
    // Load new audio file
    S.audioEl.src = tape.file;
    S.audioEl.load();
    updateMediaSession(tape);

    // Update visuals
    D.labelStripe.style.background = tape.color;
    D.labelTitle.textContent        = tape.title;
    D.labelTitle.style.color        = tape.color;
    D.labelSide.textContent         = tape.side;
    const labelContent = D.cassette.querySelector('.clabel-content');
    if (labelContent) labelContent.style.background = tape.bg;

    // Animate cassette in only if it was hidden (ejected state)
    const wasHidden = D.cassette.classList.contains('hidden');
    D.deckEmpty.classList.remove('visible');
    D.cassette.classList.remove('hidden', 'is-out');

    if (wasHidden) {
        void D.cassette.offsetWidth; // reflow
        D.cassette.classList.add('is-inserting');
        D.cassette.addEventListener('animationend', () => {
            D.cassette.classList.remove('is-inserting');
        }, { once: true });
    }

    setDisplay(tape.title, '◼ LOADED');
    D.powerLed.classList.add('on');
}

/* ===================================
   EJECT
=================================== */
function onEject() {
    if (!S.hasTape) return;

    if (S.playing) {
        stopAudio();
        setPlaying(false);
    }

    D.cassette.classList.add('is-out');

    setTimeout(() => {
        D.cassette.classList.add('hidden');
        D.cassette.classList.remove('is-out');
        D.deckEmpty.classList.add('visible');

        document.querySelectorAll('.tape-thumb').forEach(e => e.classList.remove('active'));
    }, 560);

    S.hasTape = false;
    S.tapeId  = null;

    setDisplay('── 選擇錄音帶 ──', '◼ NO TAPE');
    D.powerLed.classList.remove('on');
    if (D.tonearm) D.tonearm.classList.remove('playing');
}

/* ===================================
   PLAY / PAUSE
=================================== */
function onPlay() {
    if (!S.hasTape) {
        D.dispTrack.classList.add('shake');
        D.dispTrack.addEventListener('animationend', () => D.dispTrack.classList.remove('shake'), { once: true });
        setDisplay('── 請先放入錄音帶 ──', '◼ NO TAPE');
        setTimeout(() => setDisplay('── 選擇錄音帶 ──', '◼ NO TAPE'), 1600);
        return;
    }

    if (S.playing) {
        pauseAudio();
        setPlaying(false);
    } else {
        startAudio();
        setPlaying(true);
    }
}

function setPlaying(yes) {
    S.playing = yes;
    if (yes) {
        if (D.playIco) D.playIco.textContent = '⏸';
        if (D.playLbl) D.playLbl.textContent = 'PAUSE';
        if (D.dispStatus) D.dispStatus.textContent = '▶ PLAYING';
        if (D.tonearm) D.tonearm.classList.add('playing');
    } else {
        if (D.playIco) D.playIco.textContent = '▶';
        if (D.playLbl) D.playLbl.textContent = 'PLAY';
        if (D.dispStatus) D.dispStatus.textContent = S.hasTape ? '◼ LOADED' : '◼ NO TAPE';
        if (D.tonearm) D.tonearm.classList.remove('playing');
    }
}

/* ===================================
   TRANSPORT (REW / FF)
=================================== */
function onRew() {
    if (!S.hasTape) return;
    const was = S.playing;
    if (was) { pauseAudio(); }
    
    setDisplay(TAPES[S.tapeId].title, '◀◀ REWIND');
    S.audioEl.currentTime = Math.max(0, S.audioEl.currentTime - 15);
    
    setTimeout(() => {
        if (!was) { setDisplay(TAPES[S.tapeId].title, '◼ LOADED'); }
        else { startAudio(); setDisplay(TAPES[S.tapeId].title, '▶ PLAYING'); }
    }, 400);
}

function onFF() {
    if (!S.hasTape) return;
    const was = S.playing;
    if (was) { pauseAudio(); }
    
    setDisplay(TAPES[S.tapeId].title, '▶▶ F.FWD');
    S.audioEl.currentTime = Math.min(S.audioEl.duration || Number.MAX_VALUE, S.audioEl.currentTime + 15);
    
    setTimeout(() => {
        if (!was) { setDisplay(TAPES[S.tapeId].title, '◼ LOADED'); }
        else { startAudio(); setDisplay(TAPES[S.tapeId].title, '▶ PLAYING'); }
    }, 400);
}

/* ===================================
   VU METER
=================================== */
function tickVU() {
    // Generate a rhythmic, pseudo-random bounce to simulate a real VU meter
    // We use Date.now() to create a beat-like pattern
    const time = Date.now();
    const beat = Math.sin(time / 150) * Math.sin(time / 400); // Rhythmic oscillation
    const noise = Math.random() * 0.5; // Random flutter
    
    // Base level depends on volume
    const base = (S.volume * 4); 
    
    // Calculate simulated target level (0 to 8)
    let val = base + (beat * 3) + (noise * 2);
    let target = Math.max(1, Math.min(8, val));
    
    if (S.vuLevel === undefined) S.vuLevel = 0;
    
    // Fast attack, slower release
    if (target > S.vuLevel) {
        S.vuLevel = target;
    } else {
        S.vuLevel = Math.max(0, S.vuLevel - 0.5);
    }
    
    const level = Math.round(S.vuLevel);
    D.vuBars.forEach((b, i) => {
        const on = (i + 1) <= level;
        b.classList.toggle('lit', on);
        b.style.height = on ? (4 + (i + 1) * 3) + 'px' : '4px';
    });
}

/* ===================================
   DISPLAY
=================================== */
function setDisplay(track, status) {
    D.dispTrack.textContent  = track;
    D.dispStatus.textContent = status;
}

/* ===================================
   AUDIO ENGINE
=================================== */
function startAudio() {
    S.audioEl.volume = S.volume;
    S.audioEl.play().catch(e => console.error("Play failed", e));
}

function pauseAudio() {
    S.audioEl.pause();
}

function stopAudio() {
    S.audioEl.pause();
    S.audioEl.currentTime = 0;
}

/* ===================================
   KNOBS
=================================== */
function setupKnob(knobEl, initVal, onChange) {
    let val = initVal;
    let startY, startVal;

    const dot = knobEl.querySelector('.knob-dot');

    function setAngle(v) {
        const angle = (v / 100) * 280 - 140;
        dot.style.transform = `translateX(-50%) rotate(${angle}deg)`;
    }

    setAngle(val);

    const down = e => {
        e.preventDefault();
        startY   = e.type === 'touchstart' ? e.touches[0].clientY : e.clientY;
        startVal = val;

        const move = e => {
            const y = e.type === 'touchmove' ? e.touches[0].clientY : e.clientY;
            val = Math.max(0, Math.min(100, startVal + (startY - y) * 0.6));
            setAngle(val);
            onChange(val);
        };

        const up = () => {
            document.removeEventListener('mousemove', move);
            document.removeEventListener('touchmove', move);
            document.removeEventListener('mouseup', up);
            document.removeEventListener('touchend', up);
        };

        document.addEventListener('mousemove', move);
        document.addEventListener('touchmove', move, { passive: false });
        document.addEventListener('mouseup', up);
        document.addEventListener('touchend', up);
    };

    knobEl.addEventListener('mousedown', down);
    knobEl.addEventListener('touchstart', down, { passive: false });
}

/* ===================================
   START
=================================== */
init();

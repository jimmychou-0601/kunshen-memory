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
    audioCtx:   null,
    nodes:      {},
    vuTimer:    null,
    vuPhase:    0,
    audioEl:    new Audio()
};
S.audioEl.crossOrigin = "anonymous";
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
        if (S.nodes.master) S.nodes.master.gain.value = S.volume * 0.4;
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

    D.cassette.classList.add('hidden');
    D.deckEmpty.classList.add('visible');
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
    stopReels();
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
        startReels();
        startVU();
    } else {
        if (D.playIco) D.playIco.textContent = '▶';
        if (D.playLbl) D.playLbl.textContent = 'PLAY';
        if (D.dispStatus) D.dispStatus.textContent = S.hasTape ? '◼ LOADED' : '◼ NO TAPE';
        if (D.tonearm) D.tonearm.classList.remove('playing');
        stopReels();
        stopVU();
    }
}

/* ===================================
   TRANSPORT (REW / FF)
=================================== */
function onRew() {
    if (!S.hasTape) return;
    const was = S.playing;
    if (was) { pauseAudio(); stopReels(); }
    
    D.reelL.style.animationDuration = '0.35s';
    if (D.reelR) D.reelR.style.animationDuration = '0.35s';
    D.reelL.classList.add('spinning');
    if (D.reelR) D.reelR.classList.add('spinning');
    setDisplay(TAPES[S.tapeId].title, '◀◀ REWIND');
    
    S.audioEl.currentTime = Math.max(0, S.audioEl.currentTime - 15);
    
    setTimeout(() => {
        D.reelL.style.animationDuration = '';
        if (D.reelR) D.reelR.style.animationDuration = '';
        if (!was) { stopReels(); setDisplay(TAPES[S.tapeId].title, '◼ LOADED'); }
        else { startAudio(); startReels(); setDisplay(TAPES[S.tapeId].title, '▶ PLAYING'); }
    }, 1000);
}

function onFF() {
    if (!S.hasTape) return;
    const was = S.playing;
    if (was) { pauseAudio(); stopReels(); }
    
    D.reelL.style.animationDuration = '0.25s';
    if (D.reelR) D.reelR.style.animationDuration = '0.25s';
    D.reelL.classList.add('spinning');
    if (D.reelR) D.reelR.classList.add('spinning');
    setDisplay(TAPES[S.tapeId].title, '▶▶ F.FWD');
    
    S.audioEl.currentTime = Math.min(S.audioEl.duration || Number.MAX_VALUE, S.audioEl.currentTime + 15);
    
    setTimeout(() => {
        D.reelL.style.animationDuration = '';
        if (D.reelR) D.reelR.style.animationDuration = '';
        if (!was) { stopReels(); setDisplay(TAPES[S.tapeId].title, '◼ LOADED'); }
        else { startAudio(); startReels(); setDisplay(TAPES[S.tapeId].title, '▶ PLAYING'); }
    }, 1000);
}

/* ===================================
   REELS
=================================== */
function startReels() {
    D.reelL.classList.add('spinning');
    D.reelR.classList.add('spinning');
}
function stopReels() {
    D.reelL.classList.remove('spinning');
    D.reelR.classList.remove('spinning');
}

/* ===================================
   VU METER
=================================== */
function startVU() {
    if (S.vuTimer) return;
    function render() {
        S.vuTimer = requestAnimationFrame(render);
        tickVU();
    }
    render();
}

function stopVU() {
    cancelAnimationFrame(S.vuTimer);
    S.vuTimer = null;
    S.vuLevel = 0;
    D.vuBars.forEach(b => { b.classList.remove('lit'); b.style.height = '4px'; });
}

function tickVU() {
    if (!S.nodes.analyser) return;
    
    // Use Frequency Data instead of Time Domain for a punchier, beat-accurate meter
    const data = new Uint8Array(S.nodes.analyser.frequencyBinCount);
    S.nodes.analyser.getByteFrequencyData(data);
    
    let sum = 0;
    // Focus on the lower 60% of frequencies (bass and mids) where most music energy lives
    const limit = Math.floor(data.length * 0.6);
    for (let i = 0; i < limit; i++) {
        sum += data[i];
    }
    const avg = sum / limit;
    
    // avg is typically 0 to ~150. Map 0-110 to our 0-8 LED scale.
    // We add a tiny bit of random bounce to make it feel alive like an analog meter
    let val = (avg / 110) * 8;
    if (val > 0.5) val += (Math.random() * 0.8 - 0.4); 
    
    let target = Math.min(8, val);
    
    if (S.vuLevel === undefined) S.vuLevel = 0;
    // Fast attack (jump up quickly), slow release (drop down smoothly)
    if (target > S.vuLevel) {
        S.vuLevel = target;
    } else {
        S.vuLevel = Math.max(0, S.vuLevel - 0.4);
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
function getCtx() {
    if (!S.audioCtx) {
        S.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (S.audioCtx.state === 'suspended') S.audioCtx.resume();
    return S.audioCtx;
}

function startAudio() {
    const ctx = getCtx();
    
    if (!S.nodes.mediaSource) {
        S.nodes.mediaSource = ctx.createMediaElementSource(S.audioEl);
        const master = ctx.createGain();
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        
        S.nodes.mediaSource.connect(master);
        master.connect(analyser);
        analyser.connect(ctx.destination);
        
        S.nodes.master = master;
        S.nodes.analyser = analyser;
    }
    
    S.nodes.master.gain.value = S.volume * 0.4;
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

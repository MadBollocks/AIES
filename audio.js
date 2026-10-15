// ============================================================================
// WUMPUS WORLD - WEB AUDIO SYNTHESIZER
// High quality procedural procedural sound effects using Web Audio API
// ============================================================================

class SoundFX {
    constructor() {
        this.ctx = null;
        this.enabled = true;
        this.volume = 0.6;
        this.ambientGain = null;
    }

    init() {
        if (!this.ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();
            this.startAmbience();
        } else if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    setVolume(val) {
        this.volume = Math.max(0, Math.min(1, val));
        if (this.ambientGain) {
            this.ambientGain.gain.setValueAtTime(this.volume * 0.15, this.ctx.currentTime);
        }
    }

    toggleMute() {
        this.enabled = !this.enabled;
        if (this.ambientGain) {
            this.ambientGain.gain.setValueAtTime(this.enabled ? this.volume * 0.15 : 0, this.ctx.currentTime);
        }
        return this.enabled;
    }

    // Low mysterious cave drone
    startAmbience() {
        if (!this.ctx) return;
        try {
            const osc1 = this.ctx.createOscillator();
            const osc2 = this.ctx.createOscillator();
            const filter = this.ctx.createBiquadFilter();
            this.ambientGain = this.ctx.createGain();

            osc1.type = 'sawtooth';
            osc1.frequency.setValueAtTime(55, this.ctx.currentTime); // A1 note
            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(58.27, this.ctx.currentTime); // Slight detune for beating drone

            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(140, this.ctx.currentTime);

            this.ambientGain.gain.setValueAtTime(this.enabled ? this.volume * 0.15 : 0, this.ctx.currentTime);

            osc1.connect(filter);
            osc2.connect(filter);
            filter.connect(this.ambientGain);
            this.ambientGain.connect(this.ctx.destination);

            osc1.start();
            osc2.start();
        } catch (e) {
            console.warn('Ambient audio could not start:', e);
        }
    }

    // Footstep echo in the cave
    playStep() {
        if (!this.enabled || !this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(110 + Math.random() * 20, now);
        osc.frequency.exponentialRampToValueAtTime(30, now + 0.12);

        gain.gain.setValueAtTime(this.volume * 0.4, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.12);
    }

    // Turning direction sound
    playTurn() {
        if (!this.enabled || !this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(260, now);
        osc.frequency.exponentialRampToValueAtTime(180, now + 0.08);

        gain.gain.setValueAtTime(this.volume * 0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.08);
    }

    // Chilling wind whistling for Breeze
    playBreeze() {
        if (!this.enabled || !this.ctx) return;
        const now = this.ctx.currentTime;
        const bufferSize = this.ctx.sampleRate * 0.6;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(450, now);
        filter.frequency.exponentialRampToValueAtTime(800, now + 0.3);
        filter.frequency.exponentialRampToValueAtTime(300, now + 0.6);
        filter.Q.setValueAtTime(5.0, now);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.01, now);
        gain.gain.linearRampToValueAtTime(this.volume * 0.45, now + 0.2);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);

        noise.start(now);
        noise.stop(now + 0.6);
    }

    // Swampy bubbling hiss for Stench
    playStench() {
        if (!this.enabled || !this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const mod = this.ctx.createOscillator();
        const modGain = this.ctx.createGain();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(85, now);

        mod.type = 'sine';
        mod.frequency.setValueAtTime(14, now);
        modGain.gain.setValueAtTime(35, now);

        mod.connect(modGain);
        modGain.connect(osc.frequency);

        gain.gain.setValueAtTime(0.01, now);
        gain.gain.linearRampToValueAtTime(this.volume * 0.35, now + 0.15);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        mod.start(now);
        osc.start(now);
        mod.stop(now + 0.5);
        osc.stop(now + 0.5);
    }

    // Shimmering chime for Gold Glitter
    playGlitter() {
        if (!this.enabled || !this.ctx) return;
        const freqs = [1046.5, 1318.5, 1567.98, 2093.0]; // C6, E6, G6, C7
        freqs.forEach((freq, idx) => {
            const now = this.ctx.currentTime + idx * 0.08;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now);

            gain.gain.setValueAtTime(this.volume * 0.3, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(now);
            osc.stop(now + 0.4);
        });
    }

    // Bow twang and swoosh for shooting arrow
    playArrow() {
        if (!this.enabled || !this.ctx) return;
        const now = this.ctx.currentTime;
        
        // Twang
        const osc = this.ctx.createOscillator();
        const oscGain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(380, now);
        osc.frequency.exponentialRampToValueAtTime(90, now + 0.18);
        oscGain.gain.setValueAtTime(this.volume * 0.5, now);
        oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
        osc.connect(oscGain);
        oscGain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.18);

        // Whoosh
        const bufferSize = this.ctx.sampleRate * 0.35;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(800, now + 0.05);
        filter.frequency.exponentialRampToValueAtTime(2200, now + 0.2);
        filter.frequency.exponentialRampToValueAtTime(400, now + 0.35);

        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(this.volume * 0.4, now + 0.05);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

        noise.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(this.ctx.destination);
        noise.start(now + 0.05);
        noise.stop(now + 0.35);
    }

    // Monster death scream (FM screech + pitch drop)
    playScream() {
        if (!this.enabled || !this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const mod = this.ctx.createOscillator();
        const modGain = this.ctx.createGain();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(650, now);
        osc.frequency.exponentialRampToValueAtTime(140, now + 1.2);

        mod.type = 'square';
        mod.frequency.setValueAtTime(45, now);
        mod.frequency.linearRampToValueAtTime(15, now + 1.2);
        modGain.gain.setValueAtTime(280, now);

        mod.connect(modGain);
        modGain.connect(osc.frequency);

        gain.gain.setValueAtTime(this.volume * 0.7, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        mod.start(now);
        osc.start(now);
        mod.stop(now + 1.2);
        osc.stop(now + 1.2);
    }

    // Impact thud when bumping into a wall
    playBump() {
        if (!this.enabled || !this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'square';
        osc.frequency.setValueAtTime(80, now);
        osc.frequency.exponentialRampToValueAtTime(30, now + 0.15);

        gain.gain.setValueAtTime(this.volume * 0.5, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.15);
    }

    // Grab Gold chime
    playGrab() {
        if (!this.enabled || !this.ctx) return;
        const notes = [523.25, 659.25, 783.99, 1046.5];
        notes.forEach((freq, idx) => {
            const now = this.ctx.currentTime + idx * 0.07;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, now);

            gain.gain.setValueAtTime(this.volume * 0.45, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(now);
            osc.stop(now + 0.3);
        });
    }

    // Heroic Victory Fanfare
    playVictory() {
        if (!this.enabled || !this.ctx) return;
        const chords = [
            { freqs: [523.25, 659.25, 783.99], time: 0.0, dur: 0.25 },
            { freqs: [587.33, 739.99, 880.00], time: 0.25, dur: 0.25 },
            { freqs: [659.25, 830.61, 987.77], time: 0.5, dur: 0.25 },
            { freqs: [783.99, 987.77, 1174.66, 1567.98], time: 0.75, dur: 0.8 }
        ];

        chords.forEach(chord => {
            const now = this.ctx.currentTime + chord.time;
            chord.freqs.forEach(freq => {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(freq, now);
                gain.gain.setValueAtTime(this.volume * 0.25, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + chord.dur);
                osc.connect(gain);
                gain.connect(this.ctx.destination);
                osc.start(now);
                osc.stop(now + chord.dur);
            });
        });
    }

    // Death / Game Over gloom
    playDeath() {
        if (!this.enabled || !this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(146.83, now); // D3
        osc.frequency.linearRampToValueAtTime(73.42, now + 0.9); // D2

        gain.gain.setValueAtTime(this.volume * 0.6, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 1.2);
    }
}

// Global audio singleton
window.soundFX = new SoundFX();

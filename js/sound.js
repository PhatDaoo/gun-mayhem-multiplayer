// Authentic Gun Mayhem 2 Audio Manager (Web Audio API SFX for iOS/iPadOS + HTML5 Music)

import { SOUND_FILES, WEAPONS } from './gamedata.js';

class SoundManager {
    constructor() {
        this.soundON = localStorage.getItem('gm_soundON') !== 'false';
        this.musicON = localStorage.getItem('gm_musicON') !== 'false';
        this.currentMusic = null;
        this.currentMusicTrack = null;

        this.audioCtx = null;
        this.bufferCache = new Map();
        this.loadingBuffers = new Map();
        this.lastPlayedAt = new Map();

        const unlock = () => {
            this.ensureAudioContext();
            if (this.audioCtx && this.audioCtx.state === 'suspended') {
                this.audioCtx.resume().catch(() => {});
            }
            if (this.musicON && this.currentMusic && this.currentMusic.paused) {
                this.currentMusic.play().catch(() => {});
            }
        };
        window.addEventListener('touchstart', unlock, { passive: true });
        window.addEventListener('pointerdown', unlock, { passive: true });
        window.addEventListener('keydown', unlock, { passive: true });
    }

    ensureAudioContext() {
        if (!this.audioCtx) {
            const Ctx = window.AudioContext || window.webkitAudioContext;
            if (Ctx) {
                this.audioCtx = new Ctx();
            }
        }
        return this.audioCtx;
    }

    setSoundON(val) {
        this.soundON = Boolean(val);
        localStorage.setItem('gm_soundON', String(this.soundON));
    }

    setMusicON(val) {
        this.musicON = Boolean(val);
        localStorage.setItem('gm_musicON', String(this.musicON));
        if (!this.musicON) {
            this.stopMusic();
        } else {
            this.playMusic(this.currentMusicTrack || 'music222.mp3');
        }
    }

    resolveSoundPath(logicalName) {
        if (!logicalName) return null;
        if (SOUND_FILES[logicalName]) return SOUND_FILES[logicalName];
        if (logicalName === 'emp.wav') return SOUND_FILES['ding.wav'];
        for (const [k, v] of Object.entries(SOUND_FILES)) {
            if (k.includes(logicalName)) return v;
        }
        return null;
    }

    async loadBuffer(src) {
        if (this.bufferCache.has(src)) return this.bufferCache.get(src);
        if (this.loadingBuffers.has(src)) return this.loadingBuffers.get(src);

        const ctx = this.ensureAudioContext();
        if (!ctx) return null;

        const promise = fetch(src)
            .then((r) => r.arrayBuffer())
            .then((ab) => ctx.decodeAudioData(ab))
            .then((buf) => {
                this.bufferCache.set(src, buf);
                this.loadingBuffers.delete(src);
                return buf;
            })
            .catch(() => {
                this.loadingBuffers.delete(src);
                return null;
            });

        this.loadingBuffers.set(src, promise);
        return promise;
    }

    play(logicalName, volume = 0.55) {
        if (!this.soundON) return;
        const src = this.resolveSoundPath(logicalName);
        if (!src) return;

        // Throttle identical sound within 35ms to avoid clipping/overhead on rapid fire
        const now = performance.now();
        const prev = this.lastPlayedAt.get(src) || 0;
        if (now - prev < 35) return;
        this.lastPlayedAt.set(src, now);

        const ctx = this.ensureAudioContext();
        if (!ctx) return;
        if (ctx.state === 'suspended') {
            ctx.resume().catch(() => {});
        }

        const buf = this.bufferCache.get(src);
        if (buf) {
            this.playBuffer(ctx, buf, volume);
        } else {
            this.loadBuffer(src).then((decoded) => {
                if (decoded && this.soundON) {
                    this.playBuffer(ctx, decoded, volume);
                }
            });
        }
    }

    playBuffer(ctx, buffer, volume) {
        try {
            const source = ctx.createBufferSource();
            source.buffer = buffer;
            const gain = ctx.createGain();
            gain.gain.value = Math.max(0, Math.min(1, volume));
            source.connect(gain);
            gain.connect(ctx.destination);
            source.start(0);
        } catch (e) {}
    }

    playGunSound(wepId) {
        const wep = WEAPONS[wepId];
        const snd = wep ? wep.sound : 'pistol3.wav';
        this.play(snd, 0.45);
    }

    playDropSound() {
        const idx = Math.floor(Math.random() * 3) + 1;
        this.play(`drop${idx}.wav`, 0.65);
    }

    playExplodeSound() {
        const idx = Math.floor(Math.random() * 4) + 1;
        this.play(`explosion${idx}.wav`, 0.8);
    }

    playHitSound() {
        const idx = Math.floor(Math.random() * 2) + 1;
        this.play(`hit${idx}.wav`, 0.7);
    }

    playDieSound() {
        const idx = Math.floor(Math.random() * 4) + 1;
        this.play(`die${idx}.wav`, 0.8);
    }

    playBtnSound() {
        this.play('btn.wav', 0.65);
    }

    playMusic(trackName = 'music222.mp3') {
        this.currentMusicTrack = trackName;
        if (!this.musicON) return;
        const src = this.resolveSoundPath(trackName);
        if (!src) return;

        if (this.currentMusic && this.currentMusic.dataset.track === trackName) {
            if (this.currentMusic.paused) {
                this.currentMusic.play().catch(() => {});
            }
            return;
        }
        this.stopMusic();
        try {
            const audio = new Audio(src);
            audio.dataset.track = trackName;
            audio.loop = true;
            audio.volume = 0.35;
            this.currentMusic = audio;
            audio.play().catch(() => {});
        } catch (e) {}
    }

    playRandomBattleMusic() {
        const tracks = ['music222.mp3', 'music333.mp3', 'music444.mp3'];
        const pick = tracks[Math.floor(Math.random() * tracks.length)];
        this.playMusic(pick);
    }

    stopMusic() {
        if (this.currentMusic) {
            try {
                this.currentMusic.pause();
                this.currentMusic.currentTime = 0;
            } catch (e) {}
            this.currentMusic = null;
        }
    }
}

export const soundManager = new SoundManager();

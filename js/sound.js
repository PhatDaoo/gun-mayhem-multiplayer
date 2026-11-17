// Authentic Gun Mayhem 2 Audio Manager (Original MP3/WAV Assets)

import { SOUND_FILES, WEAPONS } from './gamedata.js';

class SoundManager {
    constructor() {
        this.soundON = localStorage.getItem('gm_soundON') !== 'false';
        this.musicON = localStorage.getItem('gm_musicON') !== 'false';
        this.currentMusic = null;
        this.currentMusicTrack = null;
        this.audioPool = new Map();
        this.unlocked = false;

        const unlock = () => {
            this.unlocked = true;
            if (this.musicON && this.currentMusic && this.currentMusic.paused) {
                this.currentMusic.play().catch(() => {});
            }
        };
        window.addEventListener('pointerdown', unlock, { passive: true });
        window.addEventListener('keydown', unlock, { passive: true });
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
        // Search by substring
        for (const [k, v] of Object.entries(SOUND_FILES)) {
            if (k.includes(logicalName)) return v;
        }
        return null;
    }

    play(logicalName, volume = 0.55) {
        if (!this.soundON) return;
        const src = this.resolveSoundPath(logicalName);
        if (!src) return;

        try {
            let pool = this.audioPool.get(src);
            if (!pool) {
                pool = [];
                this.audioPool.set(src, pool);
            }
            let audio = pool.find((a) => a.paused || a.ended);
            if (!audio) {
                if (pool.length < 8) {
                    audio = new Audio(src);
                    pool.push(audio);
                } else {
                    audio = pool[0];
                }
            }
            audio.volume = Math.max(0, Math.min(1, volume));
            audio.currentTime = 0;
            audio.play().catch(() => {});
        } catch (e) {
            // Ignore autoplay restriction errors
        }
    }

    playGunSound(wepId) {
        const wep = WEAPONS[wepId];
        const snd = wep ? wep.sound : 'pistol3.wav';
        this.play(snd, 0.5);
    }

    playDropSound() {
        const idx = Math.floor(Math.random() * 3) + 1;
        this.play(`drop${idx}.wav`, 0.7);
    }

    playExplodeSound() {
        const idx = Math.floor(Math.random() * 4) + 1;
        this.play(`explosion${idx}.wav`, 0.85);
    }

    playHitSound() {
        const idx = Math.floor(Math.random() * 2) + 1;
        this.play(`hit${idx}.wav`, 0.75);
    }

    playDieSound() {
        const idx = Math.floor(Math.random() * 4) + 1;
        this.play(`die${idx}.wav`, 0.85);
    }

    playBtnSound() {
        this.play('btn.wav', 0.7);
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
            audio.volume = 0.38;
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

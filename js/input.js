// Unified Input Manager (4 Keyboard Presets + 4 WebRTC Phone Controllers)

export const DEFAULT_CONTROLS = {
    1: {
        label: 'Arrows + Z/X',
        up: ['ArrowUp'],
        left: ['ArrowLeft'],
        down: ['ArrowDown'],
        right: ['ArrowRight'],
        shoot: ['KeyZ', 'BracketLeft'],
        bomb: ['KeyX', 'BracketRight']
    },
    2: {
        label: 'WASD + T/Y',
        up: ['KeyW'],
        left: ['KeyA'],
        down: ['KeyS'],
        right: ['KeyD'],
        shoot: ['KeyT'],
        bomb: ['KeyY']
    },
    3: {
        label: 'IJKL + P/O',
        up: ['KeyI', 'NumpadDivide'],
        left: ['KeyJ', 'Numpad7'],
        down: ['KeyK', 'Numpad8'],
        right: ['KeyL', 'Numpad9'],
        shoot: ['KeyP', 'NumpadMultiply'],
        bomb: ['KeyO', 'NumpadSubtract']
    },
    4: {
        label: 'Numpad 8456 + 1/2',
        up: ['Numpad8', 'Numpad5'],
        left: ['Numpad4', 'Numpad1'],
        down: ['Numpad5', 'Numpad2'],
        right: ['Numpad6', 'Numpad3'],
        shoot: ['Numpad1', 'Numpad0'],
        bomb: ['Numpad2', 'NumpadDecimal']
    }
};

class InputManager {
    constructor() {
        this.keysDown = new Set();
        this.remoteState = {
            1: { up: false, down: false, left: false, right: false, shoot: false, bomb: false },
            2: { up: false, down: false, left: false, right: false, shoot: false, bomb: false },
            3: { up: false, down: false, left: false, right: false, shoot: false, bomb: false },
            4: { up: false, down: false, left: false, right: false, shoot: false, bomb: false }
        };

        this.controls = JSON.parse(JSON.stringify(DEFAULT_CONTROLS));
        this.loadSavedControls();

        window.addEventListener('keydown', (e) => {
            if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
                return;
            }
            this.keysDown.add(e.code);
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
                e.preventDefault();
            }
        });

        window.addEventListener('keyup', (e) => {
            this.keysDown.delete(e.code);
        });

        window.addEventListener('blur', () => {
            this.keysDown.clear();
        });
    }

    loadSavedControls() {
        try {
            const raw = localStorage.getItem('gm_custom_controls');
            if (raw) {
                const parsed = JSON.parse(raw);
                for (let s = 1; s <= 4; s++) {
                    if (parsed[s]) {
                        this.controls[s] = { ...this.controls[s], ...parsed[s] };
                    }
                }
            }
        } catch (e) {}
    }

    saveControls() {
        try {
            localStorage.setItem('gm_custom_controls', JSON.stringify(this.controls));
        } catch (e) {}
    }

    resetControls() {
        this.controls = JSON.parse(JSON.stringify(DEFAULT_CONTROLS));
        this.saveControls();
    }

    setKeyBinding(slot, action, keyCode) {
        if (!this.controls[slot]) return;
        this.controls[slot][action] = [keyCode];
        this.saveControls();
    }

    setRemoteAction(slotNum, action, isPressed) {
        const s = this.remoteState[slotNum];
        if (!s || !(action in s)) return;
        s[action] = Boolean(isPressed);
    }

    clearRemoteSlot(slotNum) {
        const s = this.remoteState[slotNum];
        if (!s) return;
        s.up = false;
        s.down = false;
        s.left = false;
        s.right = false;
        s.shoot = false;
        s.bomb = false;
    }

    isDown(slotNum, action) {
        const remote = this.remoteState[slotNum];
        if (remote && remote[action]) return true;

        const map = this.controls[slotNum];
        if (!map || !map[action]) return false;
        const codes = Array.isArray(map[action]) ? map[action] : [map[action]];
        for (const c of codes) {
            if (this.keysDown.has(c)) return true;
        }
        return false;
    }
}

export const inputManager = new InputManager();

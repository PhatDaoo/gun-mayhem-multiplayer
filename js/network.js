// Host WebRTC (PeerJS) Manager & QR Lobby for Gun Mayhem Multiplayer

import { inputManager, DEFAULT_CONTROLS } from './input.js';
import { SKIN_COLORS_HEX } from './gamedata.js';

export class HostNetworkManager {
    constructor(callbacks = {}) {
        this.onSlotsChanged = callbacks.onSlotsChanged || (() => {});
        this.getSlotConfigs = callbacks.getSlotConfigs || (() => []);

        this.peer = null;
        this.hostId = null;
        this.connections = [];
        this.playerMap = {}; // peerId -> slotNum (1..4)
    }

    init() {
        const connectInfoEl = document.getElementById('connect-info');
        if (typeof window.Peer === 'undefined') {
            if (connectInfoEl) {
                connectInfoEl.innerText = '⚠ Chế độ Offline (Không tải được PeerJS)';
            }
            return;
        }

        try {
            this.peer = new window.Peer();
        } catch (err) {
            if (connectInfoEl) {
                connectInfoEl.innerText = '⚠ Không thể khởi tạo WebRTC';
            }
            return;
        }

        this.peer.on('open', (id) => {
            this.hostId = id;
            const basePath = window.location.pathname.replace(/index\.html$/, '');
            const baseOrigin = window.location.origin + (basePath.endsWith('/') ? basePath : basePath + '/');
            const controllerUrl = `${baseOrigin}controller.html?host=${encodeURIComponent(id)}`;

            if (connectInfoEl) {
                connectInfoEl.innerHTML = `✅ Quét QR hoặc <a href="${controllerUrl}" target="_blank" style="color:#4fc3f7;text-decoration:underline;">mở tab tay cầm</a>`;
            }

            const qrContainer = document.getElementById('qr-container');
            const qrCodeEl = document.getElementById('qrcode');
            if (qrContainer && qrCodeEl && typeof window.QRCode !== 'undefined') {
                qrContainer.style.display = 'flex';
                qrCodeEl.innerHTML = '';
                new window.QRCode(qrCodeEl, {
                    text: controllerUrl,
                    width: 90,
                    height: 90,
                    colorDark: '#000000',
                    colorLight: '#ffffff',
                    correctLevel: window.QRCode.CorrectLevel.L
                });
            }

            this.updateLobbyUI();
        });

        this.peer.on('connection', (conn) => {
            this.handleNewConnection(conn);
        });

        this.peer.on('error', (err) => {
            console.warn('PeerJS Host error:', err);
            if (connectInfoEl) {
                connectInfoEl.innerText = `⚠ Lỗi P2P: ${err.type || 'connection'}`;
            }
        });
    }

    getTakenSlots() {
        return Object.values(this.playerMap);
    }

    getSlotMetaList() {
        const configs = this.getSlotConfigs();
        return configs.map((c) => ({
            slot: c.slot,
            name: c.name,
            color: SKIN_COLORS_HEX[(c.color || 1) - 1] || '#4caf50'
        }));
    }

    broadcast(data) {
        for (const conn of this.connections) {
            if (conn && conn.open) {
                conn.send(data);
            }
        }
    }

    broadcastPlayersUpdate() {
        this.broadcast({
            type: 'playersUpdate',
            taken: this.getTakenSlots(),
            meta: this.getSlotMetaList()
        });
        this.updateLobbyUI();
    }

    sendHapticToSlot(slotNum, pattern = [35]) {
        for (const conn of this.connections) {
            if (conn && conn.open && this.playerMap[conn.peer] === slotNum) {
                conn.send({ type: 'haptic', pattern });
            }
        }
    }

    sendHudToSlot(slotNum, hudData) {
        for (const conn of this.connections) {
            if (conn && conn.open && this.playerMap[conn.peer] === slotNum) {
                conn.send({
                    type: 'hudUpdate',
                    hud: hudData
                });
            }
        }
    }

    handleNewConnection(conn) {
        this.connections.push(conn);

        conn.on('open', () => {
            conn.send({
                type: 'playersUpdate',
                taken: this.getTakenSlots(),
                meta: this.getSlotMetaList()
            });
        });

        conn.on('data', (data) => {
            if (!data || typeof data !== 'object') return;

            if (data.type === 'requestPlayer') {
                const slotNum = Number(data.num);
                if (slotNum < 1 || slotNum > 4) return;

                const taken = this.getTakenSlots();
                const currentSlot = this.playerMap[conn.peer];

                if (taken.includes(slotNum) && currentSlot !== slotNum) {
                    conn.send({
                        type: 'requestPlayerResponse',
                        success: false,
                        message: `Slot Player ${slotNum} đã có người chọn!`
                    });
                    return;
                }

                if (currentSlot && currentSlot !== slotNum) {
                    inputManager.clearRemoteSlot(currentSlot);
                    delete this.playerMap[conn.peer];
                }

                this.playerMap[conn.peer] = slotNum;
                const meta = this.getSlotMetaList().find((m) => m.slot === slotNum);

                conn.send({
                    type: 'requestPlayerResponse',
                    success: true,
                    num: slotNum,
                    meta
                });

                this.broadcastPlayersUpdate();
                this.onSlotsChanged(this.getTakenSlots(), slotNum, true);
            } else if (data.type === 'releasePlayer') {
                const currentSlot = this.playerMap[conn.peer];
                if (currentSlot) {
                    inputManager.clearRemoteSlot(currentSlot);
                    delete this.playerMap[conn.peer];
                    this.broadcastPlayersUpdate();
                    this.onSlotsChanged(this.getTakenSlots(), currentSlot, false);
                }
            } else if (data.type === 'action') {
                const slotNum = this.playerMap[conn.peer];
                if (!slotNum || data.player !== slotNum) return;
                const isPressed = data.state === 'pressed';
                inputManager.setRemoteAction(slotNum, data.action, isPressed);
            }
        });

        conn.on('close', () => {
            this.cleanupConnection(conn);
        });

        conn.on('error', () => {
            this.cleanupConnection(conn);
        });
    }

    cleanupConnection(conn) {
        const slotNum = this.playerMap[conn.peer];
        if (slotNum) {
            inputManager.clearRemoteSlot(slotNum);
            delete this.playerMap[conn.peer];
            this.broadcastPlayersUpdate();
            this.onSlotsChanged(this.getTakenSlots(), slotNum, false);
        }
        this.connections = this.connections.filter((c) => c.peer !== conn.peer);
    }

    updateLobbyUI() {
        const takenSlots = this.getTakenSlots();
        const connectedP = [];

        for (let i = 1; i <= 4; i++) {
            const slotEl = document.getElementById(`slot-${i}`);
            if (!slotEl) continue;
            const isConnected = takenSlots.includes(i);
            const kbLabel = DEFAULT_CONTROLS[i]?.label || '';
            if (isConnected) {
                slotEl.classList.add('connected');
                slotEl.innerHTML = `<div class="dot"></div> P${i}: ĐÃ KẾT NỐI 📱`;
                connectedP.push(`P${i}`);
            } else {
                slotEl.classList.remove('connected');
                slotEl.innerHTML = `<div class="dot"></div> P${i} (${kbLabel})`;
            }
        }

        const miniStatus = document.getElementById('mini-status');
        if (miniStatus) {
            if (connectedP.length > 0) {
                miniStatus.innerHTML = `🎮 Tay cầm: <span style="color:#69f0ae">${connectedP.join(', ')}</span>`;
            } else {
                miniStatus.innerHTML = `📱 Quét QR để kết nối tay cầm`;
            }
        }
    }
}

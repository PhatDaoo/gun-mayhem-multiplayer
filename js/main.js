// Main Game Engine, UI Controller, Modes, Campaign, Weapon Library & HUD

import {
    STAGE_WIDTH,
    STAGE_HEIGHT,
    FPS,
    WEAPONS,
    MAPS,
    SPRITE_METAS,
    HATS,
    SHIRTS,
    EYES,
    PERKS,
    GAME_MODES,
    CAMPAIGN_MISSIONS,
    SKIN_COLORS_HEX
} from './gamedata.js';
import { preloadCoreAssets, preloadPlayerAssets, drawSpriteFrame, getImage } from './assets.js';
import { soundManager } from './sound.js';
import { inputManager } from './input.js';
import { HostNetworkManager } from './network.js';
import {
    Player,
    Crate,
    Powerup,
    MysteryBox,
    hitTestPlatforms
} from './entities.js';
import { ArenaRenderer, renderCharacterPreviewCanvas } from './renderer.js';

const SURVIVAL_WAVES = [
    [{ name: 'Weak Robot', gun: 1, dmg: 1.5 }],
    [{ name: 'SMG Bot', gun: 71, dmg: 1.4 }, { name: 'SMG Bot 2', gun: 71, dmg: 1.4 }],
    [{ name: 'Assault Bot', gun: 75, dmg: 1.3 }],
    [{ name: 'Shotgun Bot', gun: 84, dmg: 1.2 }],
    [{ name: 'Sniper Bot', gun: 16, dmg: 1.2 }],
    [{ name: 'Assault Bot', gun: 62, dmg: 1.1 }, { name: 'Assault Bot 2', gun: 62, dmg: 1.1 }],
    [{ name: 'Shotgun Bot', gun: 45, dmg: 1.1 }, { name: 'Shotgun Bot 2', gun: 45, dmg: 1.1 }],
    [{ name: 'Pistol Bot', gun: 2, dmg: 1.1 }, { name: 'Pistol Bot 2', gun: 2, dmg: 1.1 }, { name: 'Pistol Bot 3', gun: 2, dmg: 1.1 }],
    [{ name: 'De-materializer Bot', gun: 9, dmg: 1.1 }],
    [{ name: 'Terminator Bot', gun: 55, dmg: 1.0 }]
];

class GunMayhemApp {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.renderer = new ArenaRenderer(this.canvas);

        this.state = 'MENU'; // 'MENU' | 'SETUP' | 'CAMPAIGN' | 'PLAYING' | 'PAUSED' | 'SUMMARY'
        this.selectedMap = 1; // 1..21, 22=Random New, 23=Random All
        this.selectedMode = 1;
        this.toggleCrates = true;
        this.togglePowerups = true;
        this.customLives = 10;
        this.selectedMissionId = 1;

        this.slotConfigs = [
            { slot: 1, ptype: 1, name: 'Player 1', color: 15, shirt: 3, hat: 4, eyes: 1, gun: 2, perk: 1, team: 1 },
            { slot: 2, ptype: 2, name: 'Bot 2', color: 4, shirt: 4, hat: 9, eyes: 1, gun: 4, perk: 1, team: 2 },
            { slot: 3, ptype: 0, name: 'Player 3', color: 18, shirt: 5, hat: 5, eyes: 2, gun: 1, perk: 1, team: 1 },
            { slot: 4, ptype: 0, name: 'Player 4', color: 9, shirt: 15, hat: 44, eyes: 11, gun: 3, perk: 1, team: 2 }
        ];
        this.loadSavedSetup();

        this.world = null;
        this.network = new HostNetworkManager({
            getSlotConfigs: () => this.slotConfigs,
            onSlotsChanged: (takenSlots, changedSlot, isConnected) => {
                if (isConnected && changedSlot >= 1 && changedSlot <= 4) {
                    const cfg = this.slotConfigs[changedSlot - 1];
                    if (cfg.ptype !== 1) {
                        cfg.ptype = 1;
                        if (cfg.name.startsWith('Bot ')) {
                            cfg.name = `Player ${changedSlot}`;
                        }
                    }
                }
                this.renderSetupCards();
                this.network.broadcastPlayersUpdate();
            }
        });

        this.initUI();
        this.network.init();
        preloadCoreAssets(1);

        // Start attract-mode background battle on Main Menu
        this.startAttractBattle();

        // Fixed-timestep 35 FPS game loop (matching SWF 35.0 FPS physics & render)
        this.lastTick = performance.now();
        this.accumulator = 0;
        this.stepMs = 1000 / FPS;
        this._hudCache = {};

        const loop = (now) => {
            const dt = Math.min(100, now - this.lastTick);
            this.lastTick = now;
            this.accumulator += dt;

            let didStep = false;
            while (this.accumulator >= this.stepMs) {
                this.accumulator -= this.stepMs;
                this.updateWorldStep();
                didStep = true;
            }

            if (didStep && this.world) {
                this.renderer.render(this.world);
            }
            requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
    }

    loadSavedSetup() {
        try {
            const raw = localStorage.getItem('gm_saved_setup');
            if (raw) {
                const data = JSON.parse(raw);
                if (data.slotConfigs && data.slotConfigs.length === 4) {
                    this.slotConfigs = data.slotConfigs;
                }
                if (data.selectedMap) this.selectedMap = data.selectedMap;
                if (data.selectedMode) this.selectedMode = data.selectedMode;
                if (typeof data.toggleCrates === 'boolean') this.toggleCrates = data.toggleCrates;
                if (typeof data.togglePowerups === 'boolean') this.togglePowerups = data.togglePowerups;
                if (data.customLives) this.customLives = data.customLives;
            }
        } catch (e) {}
    }

    saveSetup() {
        try {
            localStorage.setItem(
                'gm_saved_setup',
                JSON.stringify({
                    slotConfigs: this.slotConfigs,
                    selectedMap: this.selectedMap,
                    selectedMode: this.selectedMode,
                    toggleCrates: this.toggleCrates,
                    togglePowerups: this.togglePowerups,
                    customLives: this.customLives
                })
            );
        } catch (e) {}
    }

    createWorldObject(mapId, gamemode, totalLives, cratesOn, powerupsOn, campaignMission = null, isTest = false) {
        const map = MAPS[mapId] || MAPS[1];
        preloadCoreAssets(map.id);

        const world = {
            map,
            gamemode,
            totalLives,
            toggleCrates: cratesOn,
            togglePowerups: powerupsOn,
            campaignMission,
            isTest,
            isAttract: false,
            teamgame: gamemode === 3 || Boolean(campaignMission),
            speed: 0.7,
            power: 13.5,
            friction: 0.93,
            players: [],
            bullets: [],
            grenades: [],
            crates: [],
            powerups: [],
            particles: [],
            bgParticles: [],
            mysteryBox: gamemode === 5 && map.boxPos ? new MysteryBox(map.boxPos.x, map.boxPos.y) : null,
            cratetime: 200,
            poweruptime: 0,
            shaketime: 0,
            shakeX: 0,
            shakeY: 0,
            camX: 0,
            camY: 0,
            gamewin: false,
            winnerText: '',
            winnerSubText: '',
            wintimer: 0,
            survivalWave: 0,
            survivalSpawnTimer: 60,
            hudSyncCounter: 0,

            triggerHaptic: (slotNum, pattern) => {
                this.network.sendHapticToSlot(slotNum, pattern);
            },
            spawnFloatingText: (x, y, text, color = '#ffeb3b', size = 15, life = 45) => {
                world.particles.push({ kind: 'text', x, y, vx: 0, vy: -1.1, text, color, size, life, maxLife: life, alpha: 1 });
            },
            spawnMuzzleFlash: (x, y, facing) => {
                world.particles.push({
                    kind: 'sprite',
                    meta: SPRITE_METAS.fx_flash,
                    frame: 1,
                    x,
                    y,
                    vx: 0,
                    vy: 0,
                    sx: facing * 0.85,
                    sy: 0.85,
                    rot: 0,
                    life: 3,
                    maxLife: 3,
                    alpha: 1
                });
            },
            spawnShell: (x, y, facing) => {
                world.particles.push({
                    kind: 'circle',
                    x,
                    y,
                    vx: -facing * (2 + Math.random() * 3),
                    vy: -(4 + Math.random() * 4),
                    gravity: 0.55,
                    r: 2.5,
                    color: '#ffd54f',
                    life: 24,
                    maxLife: 24,
                    alpha: 1
                });
            },
            spawnHitSparks: (x, y, isRobot = false) => {
                for (let i = 0; i < 7; i++) {
                    const ang = Math.random() * Math.PI * 2;
                    const spd = 2 + Math.random() * 6;
                    world.particles.push({
                        kind: 'circle',
                        x,
                        y,
                        vx: Math.cos(ang) * spd,
                        vy: Math.sin(ang) * spd - 2,
                        gravity: 0.4,
                        r: 2.5 + Math.random() * 2,
                        color: isRobot ? '#ffd54f' : '#ff1744',
                        life: 18 + Math.floor(Math.random() * 10),
                        maxLife: 28,
                        alpha: 1
                    });
                }
            },
            spawnJumpDust: (x, y) => {
                for (let i = 0; i < 8; i++) {
                    world.particles.push({
                        kind: 'circle',
                        x: x + (Math.random() * 20 - 10),
                        y: y - 2,
                        vx: (Math.random() - 0.5) * 4,
                        vy: -Math.random() * 2.2,
                        gravity: 0.1,
                        r: 3 + Math.random() * 2,
                        color: 'rgba(220, 220, 220, 0.8)',
                        life: 16,
                        maxLife: 16,
                        alpha: 0.85
                    });
                }
            },
            spawnDoubleJumpRing: (x, y) => {
                world.particles.push({
                    kind: 'ring',
                    x,
                    y,
                    vx: 0,
                    vy: 0,
                    rx: 12,
                    ry: 4,
                    growX: 2.2,
                    growY: 0.6,
                    color: '#ffffff',
                    life: 14,
                    maxLife: 14,
                    alpha: 0.9
                });
            },
            spawnJetpackSmoke: (x, y) => {
                world.particles.push({
                    kind: 'circle',
                    x: x + (Math.random() * 6 - 3),
                    y,
                    vx: (Math.random() - 0.5) * 2,
                    vy: 3 + Math.random() * 2,
                    gravity: 0.05,
                    r: 4 + Math.random() * 3,
                    color: Math.random() < 0.4 ? '#ff9800' : '#cfd8dc',
                    life: 14,
                    maxLife: 14,
                    alpha: 0.85
                });
            },
            spawnDropMag: (x, y) => {
                world.bgParticles.push({
                    kind: 'circle',
                    x,
                    y,
                    vx: (Math.random() - 0.5) * 2,
                    vy: -2,
                    gravity: 0.55,
                    r: 3.5,
                    color: '#78909c',
                    life: 32,
                    maxLife: 32,
                    alpha: 1
                });
            },
            spawnDropGun: (x, y, facing, wepId) => {
                const wep = WEAPONS[wepId];
                if (!wep) return;
                world.bgParticles.push({
                    kind: 'sprite',
                    meta: wep,
                    frame: 2,
                    x,
                    y,
                    vx: -facing * 3,
                    vy: -5,
                    gravity: 0.6,
                    sx: facing * 0.8,
                    sy: 0.8,
                    rot: 0,
                    rotSpeed: facing * 8,
                    life: 38,
                    maxLife: 38,
                    alpha: 1
                });
            },
            spawnSpeedTrail: (p) => {
                world.bgParticles.push({
                    kind: 'trail',
                    x: p.x,
                    y: p.y,
                    vx: 0,
                    vy: 0,
                    scale: p.scale,
                    facing: p.facing,
                    snapshot: {
                        color: p.color,
                        shirt: p.shirt,
                        hat: p.hat,
                        eyes: p.eyes,
                        wepnumber: p.wepnumber,
                        bodyY: p.bodyY,
                        eyesY: p.eyesY,
                        legRot: p.legRot
                    },
                    life: 10,
                    maxLife: 10,
                    alpha: 0.6
                });
            },
            spawnCratePickupParticles: (x, y) => {
                for (let i = 0; i < 8; i++) {
                    world.particles.push({
                        kind: 'circle',
                        x,
                        y: y - 15,
                        vx: (Math.random() - 0.5) * 7,
                        vy: -Math.random() * 6 - 1,
                        gravity: 0.35,
                        r: 4,
                        color: '#bcaaa4',
                        life: 22,
                        maxLife: 22,
                        alpha: 1
                    });
                }
            },
            spawnPowerupPickupFX: (x, y) => {
                if (SPRITE_METAS.powerupBeam) {
                    world.particles.push({
                        kind: 'sprite',
                        meta: SPRITE_METAS.powerupBeam,
                        frame: 32,
                        animFrames: 72,
                        x,
                        y,
                        vx: 0,
                        vy: 0,
                        sx: 1,
                        sy: 1,
                        rot: 0,
                        life: 40,
                        maxLife: 40,
                        alpha: 1
                    });
                }
                for (let i = 0; i < 10; i++) {
                    world.particles.push({
                        kind: 'circle',
                        x: x + (Math.random() * 24 - 12),
                        y: y + 36,
                        vx: (Math.random() - 0.5) * 4,
                        vy: -(2 + Math.random() * 5),
                        gravity: 0.15,
                        r: 3 + Math.random() * 2,
                        color: '#40c4ff',
                        life: 24,
                        maxLife: 24,
                        alpha: 1
                    });
                }
            },
            spawnExplosionVisuals: (x, y) => {
                world.particles.push({
                    kind: 'sprite',
                    meta: SPRITE_METAS.fx_ex6,
                    frame: 1,
                    animFrames: SPRITE_METAS.fx_ex6.frames,
                    x,
                    y,
                    vx: 0,
                    vy: 0,
                    sx: 1,
                    sy: 1,
                    rot: 0,
                    life: SPRITE_METAS.fx_ex6.frames,
                    maxLife: SPRITE_METAS.fx_ex6.frames,
                    alpha: 1
                });
                world.particles.push({
                    kind: 'sprite',
                    meta: SPRITE_METAS.fx_ex,
                    frame: 1,
                    animFrames: SPRITE_METAS.fx_ex.frames,
                    x,
                    y,
                    vx: 0,
                    vy: 0,
                    sx: 1,
                    sy: 1,
                    rot: 0,
                    life: SPRITE_METAS.fx_ex.frames,
                    maxLife: SPRITE_METAS.fx_ex.frames,
                    alpha: 1
                });
                for (let i = 0; i < 14; i++) {
                    const ang = Math.random() * Math.PI * 2;
                    const spd = 3 + Math.random() * 9;
                    world.particles.push({
                        kind: 'circle',
                        x,
                        y,
                        vx: Math.cos(ang) * spd,
                        vy: Math.sin(ang) * spd - 2,
                        gravity: 0.35,
                        r: 4 + Math.random() * 4,
                        color: i % 2 === 0 ? '#ff9800' : '#ff5252',
                        life: 24,
                        maxLife: 24,
                        alpha: 1
                    });
                }
            },
            addKillfeed: (killerName, victimName, verb) => {
                if (world.isAttract) return;
                this.pushKillfeedItem(killerName, victimName, verb);
            }
        };

        return world;
    }

    startAttractBattle() {
        const randMap = Math.floor(Math.random() * 9) + 1;
        const w = this.createWorldObject(randMap, 1, 9999, true, true, null, false);
        w.isAttract = true;
        w.players.push(
            new Player(
                {
                    slot: 1,
                    name: 'Bot 1',
                    isAI: true,
                    color: Math.floor(Math.random() * 10) + 1,
                    shirt: Math.floor(Math.random() * 15) + 1,
                    hat: Math.floor(Math.random() * 24) + 1,
                    eyes: Math.floor(Math.random() * 6) + 1,
                    gun: Math.floor(Math.random() * 5) + 1,
                    perk: 1,
                    team: 1,
                    lives: 9999
                },
                w
            ),
            new Player(
                {
                    slot: 2,
                    name: 'Bot 2',
                    isAI: true,
                    color: Math.floor(Math.random() * 10) + 11,
                    shirt: Math.floor(Math.random() * 15) + 1,
                    hat: Math.floor(Math.random() * 24) + 1,
                    eyes: Math.floor(Math.random() * 6) + 1,
                    gun: Math.floor(Math.random() * 5) + 1,
                    perk: 1,
                    team: 2,
                    lives: 9999
                },
                w
            )
        );
        this.world = w;
    }

    startCustomMatch() {
        const activeConfigs = this.slotConfigs.filter((c) => c.ptype > 0);
        if (activeConfigs.length < 2 && this.selectedMode !== 5) {
            alert('Cần ít nhất 2 người chơi (Human hoặc AI) để bắt đầu trận đấu!');
            return;
        }
        if (activeConfigs.length < 1) {
            alert('Hãy chọn ít nhất 1 người chơi!');
            return;
        }

        this.saveSetup();
        let mapId = this.selectedMap;
        if (mapId === 22) mapId = Math.floor(Math.random() * 9) + 1;
        else if (mapId === 23) mapId = Math.floor(Math.random() * 21) + 1;

        const lives = this.selectedMode === 5 ? 5 : (this.selectedMode === 4 || this.selectedMode === 10 ? 9999 : this.customLives);
        const cratesOn = this.selectedMode === 4 || this.selectedMode === 10 ? false : this.toggleCrates;
        const powerupsOn = this.selectedMode === 4 || this.selectedMode === 10 ? false : this.togglePowerups;

        const w = this.createWorldObject(mapId, this.selectedMode, lives, cratesOn, powerupsOn, null, false);
        for (const c of activeConfigs) {
            const team = this.selectedMode === 5 ? 1 : (this.selectedMode === 3 ? c.team : c.slot);
            w.players.push(
                new Player(
                    {
                        slot: c.slot,
                        name: c.name,
                        isAI: c.ptype === 2,
                        color: c.color,
                        shirt: c.shirt,
                        hat: c.hat,
                        eyes: c.eyes,
                        gun: c.gun,
                        perk: c.perk,
                        team,
                        lives
                    },
                    w
                )
            );
        }

        this.world = w;
        this.switchScreen('PLAYING');
        soundManager.playRandomBattleMusic();
    }

    startCampaignMission(missionId) {
        const mission = CAMPAIGN_MISSIONS.find((m) => m.id === missionId);
        if (!mission) return;
        this.selectedMissionId = missionId;

        const w = this.createWorldObject(
            mission.map,
            1,
            mission.lives,
            mission.crates,
            mission.powerups,
            mission,
            false
        );

        // Player 1
        const c1 = this.slotConfigs[0];
        w.players.push(
            new Player(
                {
                    slot: 1,
                    name: c1.name || 'Player 1',
                    isAI: false,
                    color: c1.color,
                    shirt: c1.shirt,
                    hat: c1.hat,
                    eyes: c1.eyes,
                    gun: c1.gun,
                    perk: mission.id === 8 || mission.id === 13 || mission.id === 16 ? 1 : c1.perk,
                    team: 1,
                    lives: mission.lives,
                    damagemulti: mission.playermulti
                },
                w
            )
        );

        // Optional Co-op Player 2
        const coopToggle = document.getElementById('campaign-coop-toggle');
        if (mission.coop && coopToggle && coopToggle.checked) {
            const c2 = this.slotConfigs[1];
            w.players.push(
                new Player(
                    {
                        slot: 2,
                        name: c2.name || 'Player 2',
                        isAI: false,
                        color: c2.color,
                        shirt: c2.shirt,
                        hat: c2.hat,
                        eyes: c2.eyes,
                        gun: c2.gun,
                        perk: mission.id === 8 || mission.id === 13 || mission.id === 16 ? 1 : c2.perk,
                        team: 1,
                        lives: mission.lives,
                        damagemulti: mission.playermulti
                    },
                    w
                )
            );
        }

        // Mission AI Enemies
        mission.enemies.forEach((en, idx) => {
            w.players.push(
                new Player(
                    {
                        slot: 3 + idx,
                        name: en.name,
                        isAI: true,
                        color: en.color,
                        shirt: en.shirt,
                        hat: en.hat,
                        eyes: en.eyes,
                        gun: en.gun,
                        perk: en.perk || 1,
                        team: 2,
                        lives: mission.lives,
                        damagemulti: mission.missionmulti,
                        ghost: en.ghost,
                        mini: en.mini,
                        fast: en.fast
                    },
                    w
                )
            );
        });

        this.world = w;
        this.switchScreen('PLAYING');
        soundManager.playRandomBattleMusic();
    }

    startWeaponTest(wepId) {
        const w = this.createWorldObject(22, 1, 9999, false, false, null, true);
        const c1 = this.slotConfigs[0];
        const p1 = new Player(
            {
                slot: 1,
                name: c1.name || 'Player 1',
                isAI: false,
                color: c1.color,
                shirt: c1.shirt,
                hat: c1.hat,
                eyes: c1.eyes,
                gun: wepId <= 8 ? wepId : 2,
                perk: 1,
                team: 1,
                lives: 9999
            },
            w
        );
        p1.getGun(wepId, w, false);
        p1.bullets = 9999;
        p1.maxBullets = 9999;

        const dummy = new Player(
            {
                slot: 2,
                name: 'Target Dummy',
                isAI: true,
                dummy: true,
                color: 12,
                shirt: 1,
                hat: 1,
                eyes: 7,
                gun: 2,
                perk: 1,
                team: 2,
                lives: 9999
            },
            w
        );

        w.players.push(p1, dummy);
        this.world = w;
        document.getElementById('library-modal').style.display = 'none';
        this.switchScreen('PLAYING');
    }

    updateWorldStep() {
        const w = this.world;
        if (!w || this.state === 'PAUSED') return;

        // 1. Crate spawning (every 350 frames)
        if (w.toggleCrates && !w.gamewin) {
            w.cratetime += 1;
            if (w.cratetime >= 350) {
                const cx = w.map.crateX + Math.random() * w.map.crateW;
                w.crates.push(new Crate(cx, -300));
                w.cratetime = 0;
            }
        }

        // 2. Powerup spawning (every 550 frames)
        if (w.togglePowerups && !w.gamewin && !w.isAttract) {
            w.poweruptime += 1;
            if (w.poweruptime >= 550 && w.map.platforms.length > 0) {
                const plat = w.map.platforms[Math.floor(Math.random() * w.map.platforms.length)];
                const px = plat.x + 20 + Math.random() * Math.max(10, plat.w - 40);
                const py = plat.y - 40;
                const hasClone = w.players.some((p) => p.isClone && !p.dead);
                w.powerups.push(new Powerup(px, py, w.gamemode, hasClone));
                w.poweruptime = 0;
            }
        }

        // 3. Survival Mode Wave Spawner & Mystery Box
        if (w.gamemode === 5 && !w.gamewin) {
            if (w.mysteryBox) w.mysteryBox.update();
            const aliveZombies = w.players.filter((p) => p.isZombie && !p.dead);
            if (aliveZombies.length === 0) {
                w.survivalSpawnTimer -= 1;
                if (w.survivalSpawnTimer <= 0) {
                    w.survivalWave += 1;
                    w.survivalSpawnTimer = 95;
                    this.spawnSurvivalWave(w);
                }
            }
        }

        // 4. Update entities
        for (let i = 0; i < w.players.length; i++) {
            w.players[i].update(w, inputManager);
        }
        for (let i = w.bullets.length - 1; i >= 0; i--) {
            w.bullets[i].update(w);
            if (w.bullets[i].dead) w.bullets.splice(i, 1);
        }
        for (let i = w.grenades.length - 1; i >= 0; i--) {
            w.grenades[i].update(w);
            if (w.grenades[i].dead) w.grenades.splice(i, 1);
        }
        for (let i = w.crates.length - 1; i >= 0; i--) {
            w.crates[i].update(w);
            if (w.crates[i].dead) w.crates.splice(i, 1);
        }
        for (let i = w.powerups.length - 1; i >= 0; i--) {
            w.powerups[i].update(w);
            if (w.powerups[i].dead) w.powerups.splice(i, 1);
        }

        // 5. Update particles
        const stepParticles = (arr) => {
            for (let i = arr.length - 1; i >= 0; i--) {
                const pt = arr[i];
                pt.x += pt.vx || 0;
                pt.y += pt.vy || 0;
                if (pt.gravity) pt.vy = (pt.vy || 0) + pt.gravity;
                if (pt.rotSpeed) pt.rot = (pt.rot || 0) + pt.rotSpeed;
                if (pt.growX) pt.rx += pt.growX;
                if (pt.growY) pt.ry += pt.growY;
                if (pt.animFrames) {
                    pt.frame = Math.min(pt.animFrames, pt.frame + 1);
                }
                pt.life -= 1;
                pt.alpha = Math.max(0, pt.life / (pt.maxLife || 20));
                if (pt.life <= 0) arr.splice(i, 1);
            }
        };
        stepParticles(w.particles);
        stepParticles(w.bgParticles);

        // 6. Camera tracking & screen shake (exact SWF frame_10 lines 713-812)
        if (w.shaketime > 0) {
            w.shaketime -= 1;
            w.shakeX = (Math.random() < 0.5 ? 1 : -1) * w.shaketime;
            w.shakeY = (Math.random() < 0.5 ? 1 : -1) * w.shaketime;
        } else {
            w.shakeX = 0;
            w.shakeY = 0;
        }

        const alivePlayers = w.players.filter((p) => !p.dead && !p.isClone);
        if (alivePlayers.length > 0 && !w.gamewin) {
            let maxleft = alivePlayers[0].x;
            let maxright = alivePlayers[0].x;
            let maxhigh = alivePlayers[0].y;
            let maxlow = alivePlayers[0].y;
            for (const p of alivePlayers) {
                if (p.x < maxleft) maxleft = p.x;
                if (p.x > maxright) maxright = p.x;
                if (p.y < maxhigh) maxhigh = p.y;
                if (p.y > maxlow) maxlow = p.y;
            }
            if (maxleft < -100) maxleft = -100;
            if (maxright > 1000) maxright = 1000;
            if (maxhigh < 50) maxhigh = 50;
            if (maxlow < 50) maxlow = 50;
            if (maxlow > 500) maxlow = 500;
            if (maxhigh > 500) maxhigh = 500;

            w.camX += ((maxleft + maxright) / -2 + 450 - w.camX) / 8;
            w.camY += ((maxhigh + maxlow) / -2 + 280 - w.camY) / 8;
            w.camX = Math.round(w.camX);
            w.camY = Math.round(w.camY);
        }

        // 7. Win / Game Over condition checks
        if (!w.isAttract && !w.isTest && this.state === 'PLAYING') {
            this.checkMatchOutcome(w);
            this.updateHUD(w);
        }
    }

    spawnSurvivalWave(w) {
        const waveIdx = (w.survivalWave - 1) % SURVIVAL_WAVES.length;
        const cycle = Math.floor((w.survivalWave - 1) / SURVIVAL_WAVES.length);
        const defs = SURVIVAL_WAVES[waveIdx];

        soundManager.play('ding.wav', 0.8);
        w.spawnFloatingText(450, 180, `WAVE ${w.survivalWave}`, '#ffeb3b', 24, 65);

        defs.forEach((d, idx) => {
            const z = new Player(
                {
                    slot: 10 + idx,
                    name: d.name,
                    isAI: true,
                    isZombie: true,
                    color: 18,
                    shirt: 25,
                    hat: 1,
                    eyes: 7,
                    gun: d.gun,
                    perk: 1,
                    team: 2,
                    lives: 1,
                    damagemulti: Math.max(0.65, d.dmg - cycle * 0.15)
                },
                w
            );
            w.players.push(z);
        });
    }

    checkMatchOutcome(w) {
        const aliveMain = w.players.filter((p) => !p.dead && !p.isClone && !p.isZombie);

        if (!w.gamewin) {
            if (w.gamemode === 5) {
                if (aliveMain.length === 0) {
                    w.gamewin = true;
                    w.winnerText = 'GAME OVER';
                    w.winnerSubText = `Survived to Wave ${w.survivalWave}`;
                    soundManager.play('fanfare.wav', 0.8);
                }
            } else if (w.campaignMission) {
                const humansAlive = aliveMain.filter((p) => !p.isAI);
                const aiAlive = aliveMain.filter((p) => p.isAI);
                if (aiAlive.length === 0) {
                    w.gamewin = true;
                    w.winnerText = 'MISSION COMPLETE!';
                    w.winnerSubText = w.campaignMission.title;
                    soundManager.play('fanfare.wav', 0.85);
                    this.markCampaignCompleted(w.campaignMission.id);
                } else if (humansAlive.length === 0) {
                    w.gamewin = true;
                    w.winnerText = 'MISSION FAILED';
                    w.winnerSubText = 'Try Again!';
                }
            } else if (w.teamgame) {
                const teams = new Set(aliveMain.map((p) => p.team));
                if (teams.size === 1) {
                    const winTeam = [...teams][0];
                    w.gamewin = true;
                    w.winnerText = winTeam === 1 ? 'TEAM A WINS!' : 'TEAM B WINS!';
                    w.winnerSubText = 'Victory!';
                    soundManager.play('fanfare.wav', 0.85);
                } else if (teams.size === 0) {
                    w.gamewin = true;
                    w.winnerText = 'DRAW GAME!';
                    w.winnerSubText = '';
                }
            } else {
                if (aliveMain.length === 1) {
                    const winner = aliveMain[0];
                    w.gamewin = true;
                    w.winnerText = `${winner.name} WINS!`;
                    w.winnerSubText =
                        winner.deaths === 0
                            ? 'FLAWLESS (LIKE A BOSS)'
                            : winner.lives === 1
                            ? 'CLOSE CALL!'
                            : `${winner.lives} Lives Remaining`;
                    soundManager.play('fanfare.wav', 0.85);
                } else if (aliveMain.length === 0) {
                    w.gamewin = true;
                    w.winnerText = 'DRAW!';
                    w.winnerSubText = 'Double Knockout!';
                }
            }
        } else {
            w.wintimer += 1;
            if (w.wintimer >= 115) {
                this.showSummaryModal(w);
            }
        }
    }

    markCampaignCompleted(missionId) {
        try {
            const done = JSON.parse(localStorage.getItem('gm_campaign_done') || '[]');
            if (!done.includes(missionId)) done.push(missionId);
            localStorage.setItem('gm_campaign_done', JSON.stringify(done));
        } catch (e) {}
    }

    // --- UI & DOM WIRING ---
    initUI() {
        // Lobby minimize toggle
        const toggleBtn = document.getElementById('toggle-btn');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                const lobby = document.getElementById('lobby');
                lobby.classList.toggle('minimized');
                toggleBtn.innerText = lobby.classList.contains('minimized') ? '➕ Hiện QR' : '➖ Thu nhỏ';
            });
        }

        // Main menu buttons
        document.getElementById('btn-menu-custom').addEventListener('click', () => {
            soundManager.playBtnSound();
            this.switchScreen('SETUP');
        });
        document.getElementById('btn-menu-campaign').addEventListener('click', () => {
            soundManager.playBtnSound();
            this.renderCampaignList();
            this.switchScreen('CAMPAIGN');
        });
        document.getElementById('btn-menu-library').addEventListener('click', () => {
            soundManager.playBtnSound();
            this.openWeaponLibrary('HANDGUNS');
        });
        document.getElementById('btn-menu-options').addEventListener('click', () => {
            soundManager.playBtnSound();
            this.openOptionsModal();
        });

        // Setup Screen Controls
        document.getElementById('btn-setup-back').addEventListener('click', () => {
            soundManager.playBtnSound();
            this.saveSetup();
            this.switchScreen('MENU');
        });
        document.getElementById('btn-setup-start').addEventListener('click', () => {
            soundManager.playBtnSound();
            this.startCustomMatch();
        });

        // Campaign Screen Back
        document.getElementById('btn-campaign-back').addEventListener('click', () => {
            soundManager.playBtnSound();
            this.switchScreen('MENU');
        });

        // HUD buttons
        document.getElementById('btn-hud-pause').addEventListener('click', () => {
            this.togglePause();
        });
        document.getElementById('btn-hud-exit').addEventListener('click', () => {
            this.exitMatch();
        });
        document.getElementById('btn-pause-resume').addEventListener('click', () => {
            this.togglePause();
        });
        document.getElementById('btn-pause-exit').addEventListener('click', () => {
            document.getElementById('pause-modal').style.display = 'none';
            this.exitMatch();
        });

        // Summary Modal buttons
        document.getElementById('btn-summary-rematch').addEventListener('click', () => {
            soundManager.playBtnSound();
            document.getElementById('summary-modal').style.display = 'none';
            if (this.world && this.world.campaignMission) {
                this.startCampaignMission(this.world.campaignMission.id);
            } else {
                this.startCustomMatch();
            }
        });
        document.getElementById('btn-summary-setup').addEventListener('click', () => {
            soundManager.playBtnSound();
            document.getElementById('summary-modal').style.display = 'none';
            if (this.world && this.world.campaignMission) {
                this.renderCampaignList();
                this.switchScreen('CAMPAIGN');
            } else {
                this.switchScreen('SETUP');
            }
        });

        // Global Escape key to pause/exit test
        window.addEventListener('keydown', (e) => {
            if (e.code === 'Escape') {
                if (this.state === 'PLAYING') {
                    if (this.world && this.world.isTest) {
                        this.exitMatch();
                    } else {
                        this.togglePause();
                    }
                } else if (this.state === 'PAUSED') {
                    this.togglePause();
                }
            }
        });

        this.renderSetupSelectors();
        this.renderSetupCards();
    }

    switchScreen(nextState) {
        this.state = nextState;
        document.getElementById('menu-screen').style.display = nextState === 'MENU' ? 'flex' : 'none';
        document.getElementById('setup-screen').style.display = nextState === 'SETUP' ? 'flex' : 'none';
        document.getElementById('campaign-screen').style.display = nextState === 'CAMPAIGN' ? 'flex' : 'none';
        document.getElementById('hud-layer').style.display = nextState === 'PLAYING' || nextState === 'PAUSED' ? 'flex' : 'none';

        const lobby = document.getElementById('lobby');
        if (nextState === 'PLAYING') {
            lobby.classList.add('minimized');
            document.getElementById('toggle-btn').innerText = '➕ Hiện QR';
            document.getElementById('killfeed').innerHTML = '';
            this._hudCache = {};
            if (this.world && this.world.players) {
                this.world.players.forEach((p) => preloadPlayerAssets(p));
            }
        } else if (nextState === 'MENU') {
            this.startAttractBattle();
            if (this.world && this.world.players) {
                this.world.players.forEach((p) => preloadPlayerAssets(p));
            }
        } else if (nextState === 'SETUP') {
            this.renderSetupCards();
        }
    }

    togglePause() {
        if (this.state === 'PLAYING') {
            this.state = 'PAUSED';
            document.getElementById('pause-modal').style.display = 'flex';
        } else if (this.state === 'PAUSED') {
            this.state = 'PLAYING';
            document.getElementById('pause-modal').style.display = 'none';
        }
    }

    exitMatch() {
        soundManager.playBtnSound();
        if (this.world && this.world.isTest) {
            this.switchScreen('MENU');
            this.openWeaponLibrary('HANDGUNS');
        } else if (this.world && this.world.campaignMission) {
            this.renderCampaignList();
            this.switchScreen('CAMPAIGN');
        } else {
            this.switchScreen('SETUP');
        }
    }

    renderSetupSelectors() {
        const mapSel = document.getElementById('select-map');
        mapSel.innerHTML = '';
        for (let i = 1; i <= 21; i++) {
            const m = MAPS[i];
            const opt = document.createElement('option');
            opt.value = i;
            opt.textContent = `${i}. ${m.name} (${m.isNew ? 'New' : 'Classic'})`;
            if (i === this.selectedMap) opt.selected = true;
            mapSel.appendChild(opt);
        }
        const optRndNew = document.createElement('option');
        optRndNew.value = 22;
        optRndNew.textContent = '🎲 Random Map (New Maps)';
        if (this.selectedMap === 22) optRndNew.selected = true;
        mapSel.appendChild(optRndNew);

        const optRndAll = document.createElement('option');
        optRndAll.value = 23;
        optRndAll.textContent = '🎲 Random Map (All Maps)';
        if (this.selectedMap === 23) optRndAll.selected = true;
        mapSel.appendChild(optRndAll);

        mapSel.addEventListener('change', () => {
            this.selectedMap = Number(mapSel.value);
            this.updateMapPreview();
        });

        const modeSel = document.getElementById('select-mode');
        modeSel.innerHTML = '';
        for (const gm of GAME_MODES) {
            const opt = document.createElement('option');
            opt.value = gm.id;
            opt.textContent = gm.name;
            if (gm.id === this.selectedMode) opt.selected = true;
            modeSel.appendChild(opt);
        }
        modeSel.addEventListener('change', () => {
            this.selectedMode = Number(modeSel.value);
            const gm = GAME_MODES.find((g) => g.id === this.selectedMode);
            document.getElementById('mode-desc').textContent = gm ? gm.desc : '';
            this.renderSetupCards();
        });

        const gm = GAME_MODES.find((g) => g.id === this.selectedMode);
        document.getElementById('mode-desc').textContent = gm ? gm.desc : '';

        const livesInput = document.getElementById('input-lives');
        livesInput.value = this.customLives;
        livesInput.addEventListener('change', () => {
            this.customLives = Math.max(1, Math.min(99, Number(livesInput.value) || 10));
            livesInput.value = this.customLives;
        });

        const cratesChk = document.getElementById('chk-crates');
        cratesChk.checked = this.toggleCrates;
        cratesChk.addEventListener('change', () => {
            this.toggleCrates = cratesChk.checked;
        });

        const powerupsChk = document.getElementById('chk-powerups');
        powerupsChk.checked = this.togglePowerups;
        powerupsChk.addEventListener('change', () => {
            this.togglePowerups = powerupsChk.checked;
        });

        this.updateMapPreview();
    }

    updateMapPreview() {
        const previewEl = document.getElementById('map-preview-label');
        if (!previewEl) return;
        if (this.selectedMap === 22) {
            previewEl.textContent = '🎲 Ngẫu nhiên (9 bản đồ mới)';
        } else if (this.selectedMap === 23) {
            previewEl.textContent = '🎲 Ngẫu nhiên (Tất cả 21 bản đồ)';
        } else {
            const m = MAPS[this.selectedMap];
            previewEl.textContent = m ? `🗺️ ${m.name} (${m.platforms.length} bậc nhảy)` : '';
            preloadCoreAssets(this.selectedMap);
        }
    }

    renderSetupCards() {
        const container = document.getElementById('player-cards-grid');
        if (!container) return;
        container.innerHTML = '';
        const takenPhoneSlots = this.network ? this.network.getTakenSlots() : [];

        this.slotConfigs.forEach((cfg, idx) => {
            const card = document.createElement('div');
            card.className = `setup-card ${cfg.ptype === 0 ? 'empty' : ''}`;
            const isPhone = takenPhoneSlots.includes(cfg.slot);

            const ptypeLabel =
                cfg.ptype === 0
                    ? 'SLOT EMPTY'
                    : cfg.ptype === 1
                    ? isPhone
                        ? `📱 PHONE P${cfg.slot}`
                        : `⌨️ HUMAN P${cfg.slot}`
                    : `🤖 AI BOT`;

            const hatObj = HATS[(cfg.hat || 1) - 1] || HATS[0];
            const eyeObj = EYES[(cfg.eyes || 1) - 1] || EYES[0];
            const shirtObj = SHIRTS[(cfg.shirt || 1) - 1] || SHIRTS[0];
            const wepObj = WEAPONS[cfg.gun || 1] || WEAPONS[1];
            const perkObj = PERKS[(cfg.perk || 1) - 1] || PERKS[0];

            card.innerHTML = `
                <div class="setup-card-header">
                    <button class="ptype-btn ptype-${cfg.ptype}" data-slot="${cfg.slot}">${ptypeLabel}</button>
                    ${
                        this.selectedMode === 3 && cfg.ptype > 0
                            ? `<button class="team-btn team-${cfg.team}" data-slot="${cfg.slot}">TEAM ${cfg.team === 1 ? 'A' : 'B'}</button>`
                            : ''
                    }
                </div>
                ${
                    cfg.ptype === 0
                        ? `<div class="empty-slot-placeholder">Bấm để thêm Người chơi hoặc AI Bot</div>`
                        : `
                <div class="setup-preview-wrap">
                    <canvas id="preview-canvas-${cfg.slot}" width="130" height="125"></canvas>
                    <input type="text" class="player-name-input" data-slot="${cfg.slot}" value="${cfg.name}" maxlength="14" />
                </div>
                <div class="custom-rows">
                    <div class="custom-row">
                        <span>Màu:</span>
                        <div class="cycle-ctrl">
                            <button class="cyc-btn" data-slot="${cfg.slot}" data-prop="color" data-dir="-1">◀</button>
                            <span class="color-swatch" style="background:${SKIN_COLORS_HEX[(cfg.color || 1) - 1]}"></span>
                            <button class="cyc-btn" data-slot="${cfg.slot}" data-prop="color" data-dir="1">▶</button>
                        </div>
                    </div>
                    <div class="custom-row">
                        <span>Mũ:</span>
                        <div class="cycle-ctrl">
                            <button class="cyc-btn" data-slot="${cfg.slot}" data-prop="hat" data-dir="-1">◀</button>
                            <span class="cyc-val" title="${hatObj.name}">${hatObj.name}</span>
                            <button class="cyc-btn" data-slot="${cfg.slot}" data-prop="hat" data-dir="1">▶</button>
                        </div>
                    </div>
                    <div class="custom-row">
                        <span>Mặt:</span>
                        <div class="cycle-ctrl">
                            <button class="cyc-btn" data-slot="${cfg.slot}" data-prop="eyes" data-dir="-1">◀</button>
                            <span class="cyc-val" title="${eyeObj.name}">${eyeObj.name}</span>
                            <button class="cyc-btn" data-slot="${cfg.slot}" data-prop="eyes" data-dir="1">▶</button>
                        </div>
                    </div>
                    <div class="custom-row">
                        <span>Áo:</span>
                        <div class="cycle-ctrl">
                            <button class="cyc-btn" data-slot="${cfg.slot}" data-prop="shirt" data-dir="-1">◀</button>
                            <span class="cyc-val" title="${shirtObj.name}">${shirtObj.name}</span>
                            <button class="cyc-btn" data-slot="${cfg.slot}" data-prop="shirt" data-dir="1">▶</button>
                        </div>
                    </div>
                    <div class="custom-row">
                        <span>Súng:</span>
                        <div class="cycle-ctrl">
                            <button class="cyc-btn" data-slot="${cfg.slot}" data-prop="gun" data-dir="-1">◀</button>
                            <span class="cyc-val" title="${wepObj.name}">${wepObj.name}</span>
                            <button class="cyc-btn" data-slot="${cfg.slot}" data-prop="gun" data-dir="1">▶</button>
                        </div>
                    </div>
                    <div class="custom-row">
                        <span>Perk:</span>
                        <div class="cycle-ctrl">
                            <button class="cyc-btn" data-slot="${cfg.slot}" data-prop="perk" data-dir="-1">◀</button>
                            <span class="cyc-val" title="${perkObj.desc}">${perkObj.title}</span>
                            <button class="cyc-btn" data-slot="${cfg.slot}" data-prop="perk" data-dir="1">▶</button>
                        </div>
                    </div>
                </div>`
                }
            `;
            container.appendChild(card);

            if (cfg.ptype > 0) {
                const cvs = card.querySelector(`#preview-canvas-${cfg.slot}`);
                renderCharacterPreviewCanvas(cvs, cfg);
                setTimeout(() => renderCharacterPreviewCanvas(cvs, cfg), 120);
            }
        });

        // Wire events
        container.querySelectorAll('.ptype-btn, .empty-slot-placeholder').forEach((el) => {
            el.addEventListener('click', (e) => {
                soundManager.playBtnSound();
                const cardEl = e.target.closest('.setup-card');
                const btn = cardEl.querySelector('.ptype-btn');
                const slot = Number(btn.dataset.slot);
                const cfg = this.slotConfigs[slot - 1];
                cfg.ptype = (cfg.ptype + 1) % 3;
                if (cfg.ptype === 1 && cfg.name.startsWith('Bot ')) cfg.name = `Player ${slot}`;
                if (cfg.ptype === 2 && cfg.name.startsWith('Player ')) cfg.name = `Bot ${slot}`;
                this.renderSetupCards();
                if (this.network) this.network.broadcastPlayersUpdate();
            });
        });

        container.querySelectorAll('.team-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                soundManager.playBtnSound();
                const slot = Number(btn.dataset.slot);
                const cfg = this.slotConfigs[slot - 1];
                cfg.team = cfg.team === 1 ? 2 : 1;
                this.renderSetupCards();
            });
        });

        container.querySelectorAll('.player-name-input').forEach((inp) => {
            inp.addEventListener('input', () => {
                const slot = Number(inp.dataset.slot);
                this.slotConfigs[slot - 1].name = inp.value || `Player ${slot}`;
                if (this.network) this.network.broadcastPlayersUpdate();
            });
        });

        const limits = { color: 20, hat: 48, eyes: 12, shirt: 27, gun: 7, perk: 13 };
        container.querySelectorAll('.cyc-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                soundManager.playBtnSound();
                const slot = Number(btn.dataset.slot);
                const prop = btn.dataset.prop;
                const dir = Number(btn.dataset.dir);
                const max = limits[prop] || 10;
                const cfg = this.slotConfigs[slot - 1];
                cfg[prop] = ((cfg[prop] - 1 + dir + max) % max) + 1;
                this.renderSetupCards();
                if (this.network) this.network.broadcastPlayersUpdate();
            });
        });
    }

    renderCampaignList() {
        const listEl = document.getElementById('campaign-grid');
        if (!listEl) return;
        listEl.innerHTML = '';
        let done = [];
        try {
            done = JSON.parse(localStorage.getItem('gm_campaign_done') || '[]');
        } catch (e) {}

        CAMPAIGN_MISSIONS.forEach((m) => {
            const isDone = done.includes(m.id);
            const mapName = MAPS[m.map]?.name || `Map ${m.map}`;
            const item = document.createElement('div');
            item.className = `campaign-card ${isDone ? 'completed' : ''}`;
            item.innerHTML = `
                <div class="camp-header">
                    <span class="camp-num">#${m.id}</span>
                    <span class="camp-title">${m.title}</span>
                    ${isDone ? '<span class="camp-badge">✅ CLEAR</span>' : ''}
                </div>
                <div class="camp-meta">🗺️ ${mapName} • ❤️ ${m.lives} Lives ${m.coop ? '• 👥 Co-op OK' : '• 👤 Solo'}</div>
                <p class="camp-desc">${m.desc}</p>
                <button class="primary-btn camp-start-btn" data-id="${m.id}">▶ BẮT ĐẦU NHIỆM VỤ</button>
            `;
            item.querySelector('.camp-start-btn').addEventListener('click', () => {
                soundManager.playBtnSound();
                this.startCampaignMission(m.id);
            });
            listEl.appendChild(item);
        });
    }

    openWeaponLibrary(category = 'HANDGUNS') {
        const modal = document.getElementById('library-modal');
        modal.style.display = 'flex';

        const tabsEl = document.getElementById('lib-tabs');
        const categories = ['HANDGUNS', 'SMGs', 'SNIPERS', 'SHOTGUNS', 'ARs/LMGs', 'OTHER'];
        tabsEl.innerHTML = categories
            .map((c) => `<button class="lib-tab ${c === category ? 'active' : ''}" data-cat="${c}">${c}</button>`)
            .join('');
        tabsEl.querySelectorAll('.lib-tab').forEach((btn) => {
            btn.addEventListener('click', () => {
                soundManager.playBtnSound();
                this.openWeaponLibrary(btn.dataset.cat);
            });
        });

        const gridEl = document.getElementById('lib-weapons-grid');
        gridEl.innerHTML = '';
        const list = Object.values(WEAPONS).filter((w) => w.category === category);
        list.forEach((w) => {
            const card = document.createElement('div');
            card.className = 'lib-wep-card';
            const rofPct = Math.min(100, Math.round((40 / Math.max(2, w.rof)) * 20));
            const fpPct = Math.min(100, Math.round(((w.shotgun > 0 ? w.firepower * w.shotgun : w.firepower) / 70) * 100));
            const idleFrame = w.frames >= 2 ? 2 : 1;

            card.innerHTML = `
                <div class="lib-wep-top">
                    <img src="${w.folder}/${idleFrame}.png" alt="${w.name}" />
                    <div>
                        <div class="lib-wep-name">#${w.id} ${w.name}</div>
                        <div class="lib-wep-sub">Ammo: ${w.bullets > 1000 ? '∞' : w.bullets} • Weight: ${Math.round(w.weight * 100)}%</div>
                    </div>
                </div>
                <div class="lib-bars">
                    <div class="lib-bar-row"><span>Knockback</span><div class="bar"><div style="width:${fpPct}%"></div></div></div>
                    <div class="lib-bar-row"><span>Fire Rate</span><div class="bar"><div style="width:${rofPct}%"></div></div></div>
                </div>
                <div class="lib-actions">
                    <button class="secondary-btn lib-snd-btn" data-id="${w.id}">🔊 Nghe tiếng</button>
                    <button class="primary-btn lib-test-btn" data-id="${w.id}">🎯 Bắn thử</button>
                </div>
            `;
            card.querySelector('.lib-snd-btn').addEventListener('click', () => {
                soundManager.playGunSound(w.id);
            });
            card.querySelector('.lib-test-btn').addEventListener('click', () => {
                soundManager.playBtnSound();
                this.startWeaponTest(w.id);
            });
            gridEl.appendChild(card);
        });

        document.getElementById('btn-lib-close').onclick = () => {
            soundManager.playBtnSound();
            modal.style.display = 'none';
        };
    }

    openOptionsModal() {
        const modal = document.getElementById('options-modal');
        modal.style.display = 'flex';

        const sndChk = document.getElementById('opt-sound');
        const musChk = document.getElementById('opt-music');
        sndChk.checked = soundManager.soundON;
        musChk.checked = soundManager.musicON;

        sndChk.onchange = () => soundManager.setSoundON(sndChk.checked);
        musChk.onchange = () => soundManager.setMusicON(musChk.checked);

        document.getElementById('btn-opt-close').onclick = () => {
            soundManager.playBtnSound();
            modal.style.display = 'none';
        };
    }

    pushKillfeedItem(killer, victim, verb) {
        const container = document.getElementById('killfeed');
        if (!container) return;
        const item = document.createElement('div');
        item.className = 'killfeed-item';
        if (killer) {
            item.innerHTML = `<span class="kf-killer">${killer}</span> <span class="kf-verb">${verb}</span> <span class="kf-victim">${victim}</span>`;
        } else {
            item.innerHTML = `<span class="kf-victim">${victim}</span> <span class="kf-verb">${verb}</span>`;
        }
        container.appendChild(item);
        while (container.children.length > 4) {
            container.removeChild(container.firstChild);
        }
        setTimeout(() => {
            if (item.parentNode) item.remove();
        }, 4500);
    }

    updateHUD(w) {
        const bannerEl = document.getElementById('hud-mode-banner');
        if (bannerEl) {
            let bannerText;
            if (w.isTest) {
                bannerText = '🎯 WEAPON TESTING ARENA (Nhấn ESC để thoát)';
            } else if (w.gamemode === 5) {
                bannerText = `🤖 SURVIVAL — WAVE ${w.survivalWave}`;
            } else if (w.campaignMission) {
                bannerText = `⚔️ MISSION #${w.campaignMission.id}: ${w.campaignMission.title}`;
            } else {
                const gm = GAME_MODES.find((g) => g.id === w.gamemode);
                bannerText = `${gm ? gm.name : 'Match'} • ${w.map.name}`;
            }
            if (this._hudCache.banner !== bannerText) {
                this._hudCache.banner = bannerText;
                bannerEl.textContent = bannerText;
            }
        }

        const cardsContainer = document.getElementById('hud-cards');
        if (!cardsContainer) return;

        const mainPlayers = w.players.filter((p) => !p.isClone && !p.isZombie);
        if (cardsContainer.children.length !== mainPlayers.length) {
            this._hudCache.cards = {};
            cardsContainer.innerHTML = mainPlayers
                .map(
                    (p, idx) => `
                <div class="hud-card" id="hud-card-${idx}">
                    <div class="hud-card-top">
                        <span class="hud-dot" id="hud-dot-${idx}"></span>
                        <span class="hud-pname" id="hud-pname-${idx}"></span>
                        <span class="hud-lives" id="hud-lives-${idx}"></span>
                    </div>
                    <div class="hud-card-bot">
                        <span class="hud-gun" id="hud-gun-${idx}"></span>
                        <span class="hud-ammo" id="hud-ammo-${idx}"></span>
                    </div>
                </div>`
                )
                .join('');
        }

        w.hudSyncCounter = (w.hudSyncCounter || 0) + 1;
        if (!this._hudCache.cards) this._hudCache.cards = {};

        mainPlayers.forEach((p, idx) => {
            const card = document.getElementById(`hud-card-${idx}`);
            if (!card) return;
            const prev = this._hudCache.cards[idx] || (this._hudCache.cards[idx] = {});

            const opacity = p.dead ? '0.4' : '1';
            if (prev.opacity !== opacity) {
                prev.opacity = opacity;
                card.style.opacity = opacity;
            }

            const col = SKIN_COLORS_HEX[(p.color || 1) - 1] || '#4caf50';
            if (prev.col !== col) {
                prev.col = col;
                document.getElementById(`hud-dot-${idx}`).style.background = col;
            }

            if (prev.name !== p.name) {
                prev.name = p.name;
                document.getElementById(`hud-pname-${idx}`).textContent = p.name;
            }

            const isGunGame = w.gamemode === 4 || w.gamemode === 10;
            const livesLabel = isGunGame
                ? `LV ${p.currentlevel}`
                : p.lives > 900
                ? '❤️ ∞'
                : `❤️ ${p.lives}`;
            if (prev.lives !== livesLabel) {
                prev.lives = livesLabel;
                document.getElementById(`hud-lives-${idx}`).textContent = livesLabel;
            }

            const gunLabel = p.reloading ? 'RELOADING...' : p.gunName;
            if (prev.gun !== gunLabel) {
                prev.gun = gunLabel;
                document.getElementById(`hud-gun-${idx}`).textContent = gunLabel;
            }

            const ammoLabel = p.bullets > 900 ? '∞' : p.bullets;
            const bombLabel = p.offhandnumber > 0 ? ` • 💣${p.offhandammo > 900 ? '∞' : p.offhandammo}` : '';
            const ammoText = `🔋 ${ammoLabel}${bombLabel}`;
            if (prev.ammoText !== ammoText) {
                prev.ammoText = ammoText;
                document.getElementById(`hud-ammo-${idx}`).textContent = ammoText;
            }

            if (!p.isAI && w.hudSyncCounter % 6 === 0) {
                this.network.sendHudToSlot(p.slot, {
                    gun: gunLabel,
                    ammo: ammoLabel,
                    bombs: p.offhandnumber > 0 ? (p.offhandammo > 900 ? '∞' : p.offhandammo) : 0,
                    lives: isGunGame ? `LV ${p.currentlevel}` : p.lives > 900 ? '∞' : p.lives
                });
            }
        });
    }

    showSummaryModal(w) {
        this.state = 'SUMMARY';
        const modal = document.getElementById('summary-modal');
        modal.style.display = 'flex';
        document.getElementById('summary-winner-title').textContent = w.winnerText || 'MATCH OVER';
        document.getElementById('summary-winner-sub').textContent = w.winnerSubText || '';

        const tbody = document.getElementById('summary-tbody');
        const mainPlayers = w.players.filter((p) => !p.isClone && !p.isZombie);
        tbody.innerHTML = mainPlayers
            .map((p) => {
                const kd = p.deaths === 0 ? p.kills.toFixed(1) : (p.kills / p.deaths).toFixed(2);
                const acc = p.shotsFired === 0 ? '0%' : `${Math.round((p.shotsHit / p.shotsFired) * 100)}%`;
                return `
                <tr>
                    <td><span class="sum-dot" style="background:${SKIN_COLORS_HEX[(p.color || 1) - 1]}"></span>${p.name}</td>
                    <td>${p.kills}</td>
                    <td>${p.deaths}</td>
                    <td>${kd}</td>
                    <td>${acc}</td>
                    <td>${p.cratesPicked + p.powerupsPicked}</td>
                </tr>`;
            })
            .join('');
    }
}

window.addEventListener('DOMContentLoaded', () => {
    window.gunMayhemApp = new GunMayhemApp();
});

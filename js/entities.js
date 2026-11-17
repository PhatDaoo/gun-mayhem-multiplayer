// Authentic Gun Mayhem 2 Entities, Physics, Weapons, Perks, Crates & Powerups

import {
    WEAPONS,
    GUN_GAME_PROGRESSION,
    GUN_GAME_REVERSED_PROGRESSION
} from './gamedata.js';
import { soundManager } from './sound.js';
import { updateAI } from './ai.js';

export const POWERUP_NAMES = [
    'EXTRA LIFE',
    'INVISIBILITY',
    'SHIELD',
    'JET PACK!',
    'DOUBLE TEAM',
    'SPEED BOOST',
    'MINIMIZE'
];

export function hitTestPlatforms(platforms, x, y) {
    for (let i = 0; i < platforms.length; i++) {
        const p = platforms[i];
        if (x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h) {
            return p;
        }
    }
    return null;
}

export class Player {
    constructor(config, world) {
        this.slot = config.slot || 1;
        this.name = config.name || `Player ${this.slot}`;
        this.isAI = Boolean(config.isAI);
        this.isClone = Boolean(config.isClone);
        this.isZombie = Boolean(config.isZombie);
        this.dummy = Boolean(config.dummy);
        this.ghostMode = Boolean(config.ghost);
        this.permMini = Boolean(config.mini);
        this.permFast = Boolean(config.fast);

        this.color = config.color || 1;
        this.shirt = this.isZombie ? 25 : (config.shirt || 1);
        this.hat = config.hat || 1;
        this.eyes = this.isZombie ? 7 : (config.eyes || 1);
        this.defaultGun = config.gun || 1;
        this.perk = config.perk || 1;
        this.team = config.team ?? this.slot;

        this.lives = config.lives ?? world.totalLives;
        this.kills = 0;
        this.deaths = 0;
        this.shotsFired = 0;
        this.shotsHit = 0;
        this.cratesPicked = 0;
        this.powerupsPicked = 0;

        this.x = 450;
        this.y = -400;
        this.vx = 0;
        this.vy = 0;
        this.facing = 1;
        this.jumpnum = 1;
        this.triplejump = this.perk === 3;
        this.freepass = false;
        this.downkey = false;
        this.jumpkey = false;
        this.nadekey = false;
        this.nadepower = 0;

        this.offhandnumber = 1;
        if (world.gamemode === 4 || world.gamemode === 10) {
            this.offhandnumber = -1;
        } else if (this.perk === 10) {
            this.offhandnumber = 2; // Duck bombs
        } else if (this.perk === 13) {
            this.offhandnumber = 4; // Suicide explosive
        }
        this.offhandammo = 3;

        this.wepnumber = 1;
        this.gunName = 'COOL PISTOL';
        this.rof = 10;
        this.firepower = 20;
        this.recoil = 1;
        this.blowback = 20;
        this.bullets = 9;
        this.maxBullets = 9;
        this.idlerotate = 40;
        this.pushback = 0;
        this.weight = 1;
        this.shotgun = 0;

        this.waittime = 100;
        this.idletime = 40;
        this.idlemax = 40;
        this.reloading = false;
        this.reloadTimer = 0;
        this.reloadDuration = 48;
        this.gunAnimFrame = 2;

        this.invisibletime = 0;
        this.shieldtime = 0;
        this.shieldFrame = 1;
        this.shieldAlpha = 0;
        this.jetfuel = 0;
        this.speedtime = -1;
        this.minitime = -1;
        this.minimulti = this.permMini ? 0.6 : 1;
        this.scale = this.permMini ? 50 : 80;
        this.alpha = 1;

        this.playerspeed = world.speed;
        this.damagemulti = config.damagemulti ?? 1;
        this.doubletime = this.isClone ? 550 : -1;

        this.gothitby = 'none';
        this.gothitbySlot = 0;
        this.hitbynade = false;
        this.greedykill = false;
        this.cheapshottimer = 0;
        this.hitnumber = 0;
        this.hittimer = 0;
        this.dead = false;

        // Visual animation state matching SWF
        this.walkFrame = 1;
        this.walkanim = 0;
        this.legRot = 0;
        this.bodyY = -60;
        this.bodyRot = 0;
        this.headFrame = Math.floor(Math.random() * 50) + 2;
        this.eyesY = -46;
        this.hand1X = -5;
        this.hand1Y = -35;
        this.hand2X = 20;
        this.hand2Y = -25;
        this.hand1LocalX = -5;
        this.hand1LocalY = 10.5;
        this.hand2LocalX = 20;
        this.hand2LocalY = -3.75;
        this.gunLocalX = -5.5;
        this.gunLocalY = 10.85;
        this.gunRot = 0;

        // AI state
        this.target = null;
        this.targetplayer = true;
        this.targettime = 40;
        this.lockleft = 0;
        this.lockright = 0;
        this.lockup = 0;
        this.idletime2 = 0;
        this.prevx = 0;
        this.aiKeys = { up: false, down: false, left: false, right: false, shoot: false, bomb: false };

        this.currentlevel = 0;
        this.currentgun = world.gamemode === 10 ? 55 : 2;
        if (world.gamemode === 4 || world.gamemode === 10) {
            this.upgrade(world, true);
        }

        this.respawn(world, true);
    }

    getHitbox() {
        const hw = 20 * this.minimulti;
        const hh = 56 * this.minimulti;
        return {
            x: this.x - hw,
            y: this.y - hh,
            w: hw * 2,
            h: hh
        };
    }

    hitTestPoint(px, py) {
        const b = this.getHitbox();
        return px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h;
    }

    getGun(wepnum, world, fromCrate = false) {
        const w = WEAPONS[wepnum] || WEAPONS[1];
        this.wepnumber = w.id;
        this.gunName = w.name;
        this.rof = w.rof;
        this.firepower = w.firepower;
        this.recoil = w.recoil;
        this.blowback = w.blowback;
        this.bullets = w.bullets;
        this.maxBullets = w.bullets;
        this.idlerotate = w.idlerotate;
        this.pushback = w.pushback;
        this.weight = w.weight;
        this.shotgun = w.shotgun;
        this.reloading = false;
        this.reloadTimer = 0;
        this.gunAnimFrame = 2;

        if (this.wepnumber === 8) {
            this.idletime = this.idlemax;
        }
        if (this.wepnumber <= 8 && this.perk === 11) {
            this.bullets = 9999;
            this.maxBullets = 9999;
        }
        if (this.perk === 7 && this.bullets < 9000) {
            this.bullets += Math.ceil(this.bullets * 0.333);
            this.maxBullets = this.bullets;
        }
        if (world && world.gamemode === 5 && this.wepnumber >= 10 && this.bullets < 9000) {
            this.bullets *= 2;
            this.maxBullets = this.bullets;
        }

        this.waittime = this.wepnumber < 10 ? this.rof : Math.max(0, this.rof - 2);
        if (world && (world.gamemode === 4 || world.gamemode === 10)) {
            this.waittime = this.rof;
        }

        if (this.wepnumber >= 9) {
            this.greedykill = true;
        }

        if (fromCrate && world && this.wepnumber >= 10 && world.gamemode !== 4 && world.gamemode !== 10) {
            world.spawnFloatingText(this.x, this.y - 72, this.gunName, '#ffeb3b', 15, 55);
        }
    }

    respawn(world, initial = false) {
        this.cheapshottimer = 0;
        this.gothitby = 'none';
        this.gothitbySlot = 0;
        this.hitbynade = false;
        this.greedykill = false;

        if (world.gamemode === 2) {
            this.getGun(9, world, false);
        } else if (world.gamemode === 4 || world.gamemode === 10) {
            this.getGun(this.currentgun, world, false);
        } else if (world.campaignMission && world.campaignMission.dynamiteOnly && !this.isAI) {
            this.getGun(8, world, false);
        } else {
            this.getGun(this.defaultGun, world, false);
        }

        if (this.perk === 9 && world.gamemode !== 4 && world.gamemode !== 2 && world.gamemode !== 10 && !(world.campaignMission && world.campaignMission.dynamiteOnly)) {
            const randgun = Math.floor(Math.random() * 57) + 10;
            this.getGun(randgun, world, false);
        }

        const map = world.map;
        this.y = -420;
        this.x = map.spawnX + Math.random() * map.spawnW;
        this.vx = 0;
        this.vy = 0;
        this.jumpnum = 1;
        this.triplejump = this.perk === 3;

        this.offhandammo = 3;
        if (this.perk === 8) {
            this.offhandammo += 2;
        }
        if (world.campaignMission && world.campaignMission.dynamiteOnly && !this.isAI) {
            this.offhandammo = 9999;
        }

        this.invisibletime = this.ghostMode ? 999999 : 0;
        this.shieldtime = initial ? 70 : (world.gamemode === 5 ? 140 : 100);
        this.shieldFrame = 2;
        this.shieldAlpha = 1;
        this.jetfuel = world.gamemode === 11 ? 100 : 0;
        this.speedtime = this.permFast ? 999999 : -1;
        this.minitime = this.permMini ? 999999 : -1;
        this.minimulti = this.permMini ? 0.6 : 1;
        this.scale = this.permMini ? 50 : 80;
    }

    upgrade(world, silent = false) {
        this.currentlevel += 1;
        if (world.gamemode === 4) {
            const prog = GUN_GAME_PROGRESSION;
            if (this.currentlevel <= prog.length) {
                this.currentgun = prog[this.currentlevel - 1];
                this.getGun(this.currentgun, world, false);
                if (!silent) {
                    soundManager.play('ding.wav', 0.8);
                    world.spawnFloatingText(this.x, this.y - 80, `TIER ${this.currentlevel}: ${this.gunName}`, '#69f0ae', 16, 60);
                }
            } else {
                // Won Gun Game!
                for (const p of world.players) {
                    if (p !== this && !p.dead) {
                        p.lives = 0;
                        p.selfDestruct(world);
                    }
                }
            }
        } else if (world.gamemode === 10) {
            const prog = GUN_GAME_REVERSED_PROGRESSION;
            if (this.currentlevel <= prog.length) {
                this.currentgun = prog[this.currentlevel - 1];
                this.getGun(this.currentgun, world, false);
                if (!silent) {
                    soundManager.play('ding.wav', 0.8);
                    world.spawnFloatingText(this.x, this.y - 80, `TIER ${this.currentlevel}: ${this.gunName}`, '#69f0ae', 16, 60);
                }
            } else {
                for (const p of world.players) {
                    if (p !== this && !p.dead) {
                        p.lives = 0;
                        p.selfDestruct(world);
                    }
                }
            }
        }
    }

    onShieldHit() {
        if (this.shieldAlpha >= 0.9) {
            this.shieldFrame = 23;
        }
    }

    selfDestruct(world) {
        world.spawnExplosionVisuals(this.x, this.y - 20);
        soundManager.playExplodeSound();
        this.gotKilled(world);
    }

    selfExplosive(world) {
        for (const p of world.players) {
            if (p.dead) continue;
            const dx = p.x - this.x;
            const dy = p.y - 30 - this.y;
            const dist = Math.round(Math.sqrt(dx * dx + dy * dy));
            if (dist <= 200) {
                const rad = Math.atan2(dy, dx);
                let pushx, pushy;
                if (p.perk === 6 || p.shieldtime > 0) {
                    pushx = (Math.cos(rad) * (350 - dist)) / 25;
                    pushy = (Math.sin(rad) * (350 - dist)) / 50;
                    p.onShieldHit();
                } else {
                    pushx = (Math.cos(rad) * (350 - dist)) / 5;
                    pushy = (Math.sin(rad) * (350 - dist)) / 10;
                }
                p.vx += pushx;
                p.vy += pushy;
                if (p !== this) {
                    p.gothitby = this.name;
                    p.gothitbySlot = this.slot;
                    p.hitbynade = true;
                }
            }
        }
        this.gothitby = 'none';
        this.gothitbySlot = 0;
        world.shaketime = 15;
        world.spawnExplosionVisuals(this.x, this.y - 20);
        soundManager.playExplodeSound();
        world.spawnFloatingText(this.x, this.y - 60, 'BOOM!', '#ff5252', 18, 45);
        this.gotKilled(world);
    }

    spawnFriend(world) {
        const clone = new Player(
            {
                slot: 0,
                name: `${this.name} Clone`,
                isAI: true,
                isClone: true,
                color: this.color,
                shirt: this.shirt,
                hat: this.hat,
                eyes: this.eyes,
                gun: this.defaultGun,
                perk: 1,
                team: this.team,
                lives: 1
            },
            world
        );
        clone.x = this.x;
        clone.y = this.y;
        clone.shieldtime = 60;
        world.players.push(clone);
    }

    gotKilled(world) {
        if (this.dead) return;
        soundManager.playDieSound();
        world.shaketime = 15;
        this.deaths += 1;
        this.lives -= 1;
        if (this.lives < 0) this.lives = 0;

        if (!this.isAI) {
            world.triggerHaptic(this.slot, [80, 40, 120]);
        }

        let killer = null;
        if (this.gothitby !== 'none') {
            killer = world.players.find((p) => p.name === this.gothitby || (this.gothitbySlot && p.slot === this.gothitbySlot));
        }
        if (killer && killer !== this) {
            killer.kills += 1;
            if (world.gamemode === 4 || world.gamemode === 10) {
                killer.upgrade(world, false);
            }
            let modText = '+100';
            let feedType = 'KILLED';
            if (this.cheapshottimer < 120) {
                modText = 'CHEAPSHOT +200';
                feedType = "CHEAPSHOT'd";
            } else if (this.hitbynade) {
                modText = 'XPLOSIV KILL +500';
                feedType = 'EXPLODED';
            } else if (this.greedykill) {
                modText = 'GREEDY KILL +300';
                feedType = 'GREEDYKILLED';
            }
            world.spawnFloatingText(killer.x, killer.y - 75, modText, '#ffeb3b', 15, 55);
            world.addKillfeed(killer.name, this.name, feedType);
        } else {
            world.addKillfeed(null, this.name, 'SELF-DESTRUCT');
        }

        if (this.lives > 0 && !this.isClone && !this.isZombie) {
            this.respawn(world, false);
        } else {
            this.dead = true;
            this.x = 0;
            this.y = 1100;
            this.alpha = 0;
            this.shieldtime = 0;
            this.invisibletime = 0;
            this.jetfuel = 0;
        }
    }

    fireBullet(world) {
        const w = WEAPONS[this.wepnumber] || WEAPONS[1];
        this.shotsFired += 1;

        if (!this.isAI) {
            world.triggerHaptic(this.slot, [25]);
        }

        if (this.firepower === 0) {
            // Grenade launcher (e.g. gun_D1..D5)
            world.bullets.push(
                new LauncherGrenade({
                    x: this.x + 30 * this.facing,
                    y: this.y - 20 * this.minimulti,
                    facing: this.facing,
                    ownerSlot: this.slot,
                    ownerName: this.name,
                    team: this.team
                })
            );
            soundManager.playGunSound(this.wepnumber);
            return;
        }

        // Muzzle flash
        world.spawnMuzzleFlash(
            this.x + w.flashX * this.facing * this.minimulti,
            this.y - (this.wepnumber === 55 ? 25 : 38) * this.minimulti,
            this.facing
        );
        // Shell casing
        world.spawnShell(
            this.x + w.shellX * this.facing * this.minimulti,
            this.y - (this.wepnumber === 55 ? 27 : 38) * this.minimulti,
            this.facing
        );

        if (this.wepnumber === 55) {
            const spreadY = Math.random() * 14 - 7;
            world.bullets.push(
                new Bullet({
                    type: 'bullet6',
                    x: this.x + 23 * this.minimulti * this.facing,
                    y: this.y - 25 * this.minimulti + spreadY,
                    angleDeg: this.facing === 1 ? 0 : 180,
                    firepower: this.firepower + Math.floor(Math.random() * 8) - 4,
                    ownerSlot: this.slot,
                    ownerName: this.name,
                    team: this.team
                })
            );
        } else if (this.wepnumber === 9) {
            const spreadY = Math.random() * 6 - 3;
            world.bullets.push(
                new Bullet({
                    type: 'bullet3',
                    x: this.x + 23 * this.minimulti * this.facing,
                    y: this.y - 38 * this.minimulti + spreadY,
                    angleDeg: this.facing === 1 ? 0 : 180,
                    firepower: this.firepower + Math.floor(Math.random() * 8) - 4,
                    ownerSlot: this.slot,
                    ownerName: this.name,
                    team: this.team,
                    instagib: true
                })
            );
        } else if (this.shotgun > 0) {
            for (let i = 0; i < this.shotgun; i++) {
                const angleDeg = -90 + 90 * this.facing - this.shotgun / 1.9 + i * 2;
                world.bullets.push(
                    new Bullet({
                        type: 'bullet2',
                        x: this.x + 23 * this.minimulti * this.facing,
                        y: this.y - 38 * this.minimulti,
                        angleDeg,
                        firepower: this.firepower,
                        ownerSlot: this.slot,
                        ownerName: this.name,
                        team: this.team,
                        isShotgunPellet: true
                    })
                );
            }
        } else {
            const spreadY = Math.random() * 6 - 3;
            world.bullets.push(
                new Bullet({
                    type: 'bullet',
                    x: this.x + 23 * this.minimulti * this.facing,
                    y: this.y - 38 * this.minimulti + spreadY,
                    angleDeg: this.facing === 1 ? 0 : 180,
                    firepower: this.firepower + Math.floor(Math.random() * 8) - 4,
                    ownerSlot: this.slot,
                    ownerName: this.name,
                    team: this.team
                })
            );
        }

        soundManager.playGunSound(this.wepnumber);
    }

    update(world, inputManager) {
        if (this.dead) return;

        if (this.doubletime >= 0) {
            this.doubletime -= 1;
            if (this.doubletime <= 30) {
                this.selfDestruct(world);
                return;
            }
        }

        if (world.gamewin) {
            this.vx = 0;
            this.vy = 0;
        }

        const platforms = world.map.platforms;
        this.x += this.vx;
        this.y += this.vy;

        // One-way platform collision (exact SWF sub-stepping)
        if (!this.freepass) {
            if (hitTestPlatforms(platforms, this.x, this.y) && this.vy > 0) {
                if (Math.abs(this.vx) < 3) {
                    this.gothitby = 'none';
                    this.gothitbySlot = 0;
                    this.hitbynade = false;
                    this.greedykill = false;
                }
                this.jumpnum = 2;
                if (this.perk === 3) {
                    this.triplejump = true;
                }
                this.y -= this.vy * 1.01;
                for (let i = 1; i <= 5; i++) {
                    if (hitTestPlatforms(platforms, this.x, this.y + i * (this.vy / 5))) {
                        this.y += (this.vy / 5) * (i - 0.5);
                        break;
                    }
                }
                if (Math.abs(this.vy) > 3) {
                    this.eyesY += 10;
                    this.hand1Y += 10;
                    this.hand2Y += 8;
                    world.spawnJumpDust(this.x, this.y);
                    soundManager.playDropSound();
                }
                this.vy = 0;
            } else if (this.jumpnum === 2) {
                this.jumpnum = 1;
            }
        }

        if (!hitTestPlatforms(platforms, this.x, this.y - 8) && !hitTestPlatforms(platforms, this.x, this.y)) {
            this.freepass = false;
        }
        if (hitTestPlatforms(platforms, this.x, this.y - 8) && !this.freepass) {
            this.freepass = true;
        }

        if (this.y > 1000 || this.x < -600 || this.x > 1500) {
            this.gotKilled(world);
            return;
        }

        // Determine inputs (Human vs AI)
        let kUp = false, kDown = false, kLeft = false, kRight = false, kShoot = false, kBomb = false;
        if (this.isAI) {
            updateAI(this, world);
            kUp = this.aiKeys.up;
            kDown = this.aiKeys.down;
            kLeft = this.aiKeys.left;
            kRight = this.aiKeys.right;
            kShoot = this.aiKeys.shoot;
            kBomb = this.aiKeys.bomb;
        } else {
            kUp = inputManager.isDown(this.slot, 'up');
            kDown = inputManager.isDown(this.slot, 'down');
            kLeft = inputManager.isDown(this.slot, 'left');
            kRight = inputManager.isDown(this.slot, 'right');
            kShoot = inputManager.isDown(this.slot, 'shoot');
            kBomb = inputManager.isDown(this.slot, 'bomb');
        }

        if (!world.gamewin) {
            // Drop through platform or interact with Survival Mystery Box
            const nearMysteryBox = world.mysteryBox && world.mysteryBox.hitTest(this.x, this.y - 15);
            if (kDown && this.jumpnum === 2 && !this.freepass && !this.downkey && !nearMysteryBox) {
                if (this.y < world.map.lowestY) {
                    this.freepass = true;
                    this.vy += 1;
                    this.y += 5;
                    this.jumpnum = 1;
                    this.downkey = true;
                }
            } else if (!kDown && this.downkey) {
                this.downkey = false;
            }

            if (kDown && nearMysteryBox) {
                world.mysteryBox.interact(this, world);
            }

            // Jump & Double/Triple Jump
            if (kUp && !this.jumpkey && this.jumpnum > 0) {
                this.jumpkey = true;
                this.jumpnum -= 1;
                if (this.jumpnum === 1) {
                    this.vy = -world.power * 1;
                    world.spawnJumpDust(this.x, this.y);
                } else if (this.jumpnum === 0) {
                    this.vy = -world.power * 0.83;
                    world.spawnDoubleJumpRing(this.x, this.y);
                    if (this.triplejump && this.jumpnum === 0) {
                        this.jumpnum = 11;
                        this.triplejump = false;
                    }
                }
                if (this.jumpnum === 10) {
                    this.jumpnum = 0;
                    if (this.vy < -4) {
                        this.vy -= world.power * 0.2;
                    } else {
                        this.vy = -world.power * 0.6;
                    }
                    world.spawnDoubleJumpRing(this.x, this.y);
                }
                this.y -= 1;
            }
            if (!kUp) {
                this.jumpkey = false;
            }

            // Jetpack thrust
            if (kUp && this.jumpnum <= 0 && this.jetfuel > 0 && !this.jumpkey) {
                this.vy += (-15 - this.vy) / 4;
                world.spawnJetpackSmoke(this.x - 22 * this.facing, this.y - 18);
                this.jetfuel -= world.gamemode === 11 ? 2.0 : 1.5;
            }

            const effWeight = this.perk === 2 ? 1 : this.weight;

            if (kLeft) {
                if (this.jumpnum === 2) {
                    this.vx -= this.playerspeed * effWeight;
                } else if (world.map.lowFriction) {
                    this.vx -= this.playerspeed / 1.4;
                } else {
                    this.vx -= (this.playerspeed / 1.1) * effWeight;
                }
                if (this.facing === 1) {
                    this.legRot *= -1;
                }
                this.facing = -1;
            }

            if (kRight) {
                if (this.jumpnum === 2) {
                    this.vx += this.playerspeed * effWeight;
                } else if (world.map.lowFriction) {
                    this.vx += this.playerspeed / 1.4;
                } else {
                    this.vx += (this.playerspeed / 1.1) * effWeight;
                }
                if (this.facing === -1) {
                    this.legRot *= -1;
                }
                this.facing = 1;
            }

            // Offhand Explosives (Dynamite / Duck Bomb / Suicide Explosive)
            if (world.gamemode !== 2) {
                if (this.offhandnumber === 1 && this.offhandammo > 0) {
                    if (kBomb && !this.nadekey) {
                        this.nadekey = true;
                        this.nadepower = 1;
                    } else if (!kBomb && this.nadekey) {
                        this.nadekey = false;
                        world.grenades.push(
                            new Grenade({
                                x: this.x + 30 * this.facing,
                                y: this.y - 35,
                                facing: this.facing,
                                power: this.nadepower,
                                ownerSlot: this.slot,
                                ownerName: this.name
                            })
                        );
                        if (this.offhandammo < 9000) this.offhandammo -= 1;
                        soundManager.play('whoosh.wav', 0.6);
                    }
                    if (kBomb && this.nadepower < 14) {
                        this.nadepower += 0.5;
                    }
                } else if (this.offhandnumber === 2 && this.offhandammo > 0) {
                    if (kBomb && !this.nadekey) {
                        this.nadekey = true;
                        world.grenades.push(
                            new DuckyBomb({
                                x: this.x + 35 * this.facing,
                                y: this.y - 25,
                                vxInit: Math.abs(this.vx + this.facing) * this.facing,
                                ownerSlot: this.slot,
                                ownerName: this.name
                            })
                        );
                        if (this.offhandammo < 9000) this.offhandammo -= 1;
                        soundManager.play('whoosh.wav', 0.6);
                    } else if (!kBomb && this.nadekey) {
                        this.nadekey = false;
                    }
                } else if (this.offhandnumber === 4) {
                    if (kBomb && !this.nadekey) {
                        this.nadekey = true;
                        this.selfExplosive(world);
                        return;
                    } else if (!kBomb && this.nadekey) {
                        this.nadekey = false;
                    }
                }
            }

            // Reloading & Shooting
            if (this.reloading) {
                this.reloadTimer += 1;
                if (this.reloadTimer === 10) {
                    world.spawnDropMag(this.x + 15 * this.facing, this.y - 22);
                }
                if (this.reloadTimer === 28) {
                    soundManager.play('pistol_mag.wav', 0.5);
                }
                if (this.reloadTimer === 38) {
                    soundManager.play('pistol_slide.wav', 0.5);
                }
                if (this.reloadTimer >= this.reloadDuration) {
                    this.reloading = false;
                    this.reloadTimer = 0;
                    this.bullets = this.maxBullets;
                    this.idletime = 20;
                }
            } else {
                if (this.waittime < this.rof) {
                    this.waittime += 1;
                }
                if (kShoot && this.waittime >= this.rof && this.bullets > 0 && this.wepnumber !== 8) {
                    const w = WEAPONS[this.wepnumber] || WEAPONS[1];
                    this.waittime = 0;
                    this.idletime = 0;
                    const effRecoil = this.perk === 5 ? 0 : this.recoil;
                    this.vx -= effRecoil * this.facing;

                    this.gunRot = -this.blowback;
                    this.hand1LocalX = w.shootx - this.pushback;
                    this.hand1LocalY = w.shooty;
                    this.hand2LocalX = w.handx - this.pushback;
                    this.hand2LocalY = this.blowback >= 20 && w.handx > 40 ? -this.blowback : w.handy;
                    this.gunLocalX = w.shootx;
                    this.gunLocalY = w.shooty;
                    this.gunAnimFrame = 3;

                    this.fireBullet(world);

                    if (this.bullets < 9000) {
                        this.bullets -= 1;
                    }
                    if (this.bullets <= 0) {
                        if (this.wepnumber >= 9) {
                            if (world.gamemode !== 4 && world.gamemode !== 10) {
                                world.spawnDropGun(this.x + 20 * this.facing, this.y - 40, this.facing, this.wepnumber);
                            }
                            if (world.gamemode === 2) {
                                this.getGun(8, world, false);
                            } else if (world.gamemode !== 4 && world.gamemode !== 10) {
                                this.getGun(this.defaultGun, world, false);
                            }
                        } else {
                            this.reloading = true;
                            this.reloadTimer = 0;
                        }
                    }
                }
            }
        }

        // Physics damping & gravity
        this.vx *= world.friction;
        if (this.vy > 30) this.vy = 30;
        if (this.vy < -30) this.vy = -30;
        if (this.vy < 24) {
            this.vy += world.map.gravity;
        }
        if (Math.abs(this.vx) <= 0.1) this.vx = 0;

        if (this.jetfuel > 0 && world.gamemode !== 11) {
            this.jetfuel -= 0.12;
            if (this.jetfuel <= 0) {
                this.jetfuel = 0;
            }
        } else if (world.gamemode === 11 && this.jetfuel < 100) {
            this.jetfuel = Math.min(100, this.jetfuel + 0.24);
        }

        // Hand & Gun procedural animation (exact SWF interpolation)
        const w = WEAPONS[this.wepnumber] || WEAPONS[1];
        if (this.idletime <= this.idlemax) {
            this.idletime += 1;
        }
        if (this.gunAnimFrame > 2) {
            this.gunAnimFrame += 1;
            if (this.gunAnimFrame > 6) this.gunAnimFrame = 2;
        }

        if (this.idletime >= this.idlemax && this.wepnumber !== 55 && !this.reloading) {
            this.gunLocalX += (-5.5 - this.gunLocalX) / 3;
            this.gunLocalY += (10.85 - this.gunLocalY) / 3;
            this.gunRot += (this.idlerotate - this.gunRot) / 3;

            if (this.walkanim === 1) {
                this.hand1LocalX += (0 - this.hand1LocalX) / 3;
                this.hand2LocalX += (15 - this.hand2LocalX) / 3;
            } else if (this.walkanim === 2) {
                this.hand1LocalX += (-10 - this.hand1LocalX) / 3;
                this.hand2LocalX += (25 - this.hand2LocalX) / 3;
            } else {
                this.hand1LocalX += (-5 - this.hand1LocalX) / 3;
                this.hand2LocalX += (20 - this.hand2LocalX) / 3;
            }
            this.hand1LocalY += (10.5 - this.hand1LocalY) / 3;
            this.hand2LocalY += (-3.75 - this.hand2LocalY) / 3;
            this.gunLocalX = this.hand1LocalX;
        } else {
            this.hand1LocalX += (w.shootx - this.hand1LocalX) / 3;
            this.hand1LocalY += (w.shooty - this.hand1LocalY) / 3;
            this.hand2LocalX += (w.handx - this.hand2LocalX) / 3;
            this.hand2LocalY += (w.handy - this.hand2LocalY) / 3;
            this.gunLocalX += (w.shootx - this.gunLocalX) / 3;
            this.gunLocalY += (w.shooty - this.gunLocalY) / 3;
            this.gunRot += (0 - this.gunRot) / 3;
        }

        // Walk & Leg rotation
        if (Math.abs(this.vx) > 1.5 && this.jumpnum === 2) {
            this.walkFrame = (this.walkFrame % 18) + 1;
            if (this.walkFrame === 6) this.walkanim = 2;
            else if (this.walkFrame === 15) this.walkanim = 1;
        } else {
            this.walkFrame = 1;
            this.walkanim = 0;
        }

        if (this.vy <= -2) {
            this.legRot += (80 - this.legRot) / 3;
            this.bodyY += (-70 - this.bodyY) / 5;
        } else if (this.vy >= 2) {
            this.legRot += (-10 - this.legRot) / 3;
            this.bodyY += (-55 - this.bodyY) / 5;
        } else {
            this.legRot += (0 - this.legRot) / 1.5;
            this.bodyY += (-60 - this.bodyY) / 2;
        }

        this.eyesY += (-46 - this.eyesY) / 5;
        this.hand1Y += (-35 - this.hand1Y) / 5;
        this.hand2Y += (-25 - this.hand2Y) / 5;

        // Timers (combo, cheapshot, powerups)
        if (this.hittimer <= 40) this.hittimer += 1;
        else this.hitnumber = 0;
        if (this.cheapshottimer < 120) this.cheapshottimer += 1;

        if (this.invisibletime > 0) {
            this.invisibletime -= 1;
            this.alpha = Math.max(0.08, this.alpha - 0.1);
        } else if (this.invisibletime < 0) {
            // Temporarily revealed ghost
            this.invisibletime += 1;
            if (this.invisibletime === 0 && this.ghostMode) this.invisibletime = 999999;
            this.alpha = Math.min(1, this.alpha + 0.15);
        } else {
            this.alpha = Math.min(1, this.alpha + 0.1);
        }

        if (this.shieldtime > 0) {
            this.shieldtime -= 1;
            this.shieldAlpha = 1;
            if (this.shieldFrame < 22) {
                this.shieldFrame += 1;
            } else if (this.shieldFrame >= 23) {
                this.shieldFrame += 1;
                if (this.shieldFrame > 30) {
                    this.shieldFrame = 22;
                }
            }
        } else if (this.shieldAlpha > 0) {
            this.shieldAlpha = Math.max(0, this.shieldAlpha - 0.1);
            if (this.shieldAlpha <= 0.01) {
                this.shieldAlpha = 0;
                this.shieldFrame = 1;
            }
        }

        if (this.speedtime >= 0) {
            this.speedtime -= 1;
            this.playerspeed = world.speed * 2;
            if (this.speedtime % 3 === 0) {
                world.spawnSpeedTrail(this);
            }
        } else {
            this.playerspeed = world.speed;
        }

        if (this.minitime >= 0 && !this.permMini) {
            this.minitime -= 1;
            if (this.minitime > 40) {
                this.minimulti += (0.6 - this.minimulti) / 6;
                this.scale += (50 - this.scale) / 3;
            } else {
                this.minimulti += (1 - this.minimulti) / 6;
                this.scale += (80 - this.scale) / 3;
            }
        } else if (!this.permMini) {
            this.minimulti = 1;
            this.scale = 80;
        }
    }
}

export class Bullet {
    constructor(opts) {
        this.type = opts.type || 'bullet';
        this.x = opts.x;
        this.y = opts.y;
        this.angleDeg = opts.angleDeg || 0;
        const speed = this.type === 'bullet2' ? 25 + Math.floor(Math.random() * 6) - 3 : 25;
        const rad = (this.angleDeg * Math.PI) / 180;
        this.vx = Math.cos(rad) * speed;
        this.vy = Math.sin(rad) * speed;
        this.facing = this.vx >= 0 ? 1 : -1;
        this.firepower = opts.firepower || 20;
        this.ownerSlot = opts.ownerSlot;
        this.ownerName = opts.ownerName;
        this.team = opts.team;
        this.instagib = Boolean(opts.instagib);
        this.isShotgunPellet = Boolean(opts.isShotgunPellet);
        this.time = 0;
        this.alpha = 1;
        this.dead = false;
    }

    update(world) {
        if (this.dead) return;
        this.x += this.vx;
        this.y += this.vy;
        this.time += 1;

        for (let i = 0; i < world.players.length; i++) {
            const p = world.players[i];
            if (p.dead || p.team === this.team || p.slot === this.ownerSlot) continue;

            if (p.hitTestPoint(this.x, this.y)) {
                if (this.instagib) {
                    p.vx += this.firepower * this.facing * p.damagemulti;
                    p.gothitby = this.ownerName;
                    p.gothitbySlot = this.ownerSlot;
                    p.hitbynade = false;
                    soundManager.playHitSound();
                    p.gotKilled(world);
                    this.dead = true;
                    return;
                }

                if (p.shieldtime > 0) {
                    p.vx += this.firepower * this.facing * 0.33;
                    p.onShieldHit();
                } else {
                    p.vx += this.firepower * this.facing * p.damagemulti;
                }

                if (!p.isAI) {
                    world.triggerHaptic(p.slot, [45]);
                }

                p.hitnumber += 1;
                p.hittimer = 0;
                p.gothitby = this.ownerName;
                p.gothitbySlot = this.ownerSlot;
                p.hitbynade = false;

                if (p.ghostMode) {
                    p.invisibletime = -35;
                }

                const shooter = world.players.find((pl) => pl.slot === this.ownerSlot);
                if (shooter) shooter.shotsHit += 1;

                world.spawnHitSparks(this.x, this.y, p.isZombie);

                if (!this.isShotgunPellet || p.hitnumber === 1) {
                    soundManager.playHitSound();
                }

                if (this.isShotgunPellet && p.hitnumber === 6 && this.firepower >= 7) {
                    world.spawnFloatingText(this.x, this.y - 50, 'POINT BLANK!', '#ff5252', 15, 40);
                } else if (!this.isShotgunPellet || p.hitnumber === 1) {
                    const label = this.firepower >= 40 ? 'CRITICAL!' : (p.hitnumber > 1 ? `HIT x${p.hitnumber}` : 'HIT');
                    world.spawnFloatingText(this.x, this.y - 48, label, this.firepower >= 40 ? '#ff5252' : '#ffffff', 13, 32);
                }

                this.dead = true;
                return;
            }

            // AI bullet jump-dodge probe (exact SWF lines 139-152)
            if (p.isAI && (p.hitTestPoint(this.x + this.vx * 4, this.y) || p.hitTestPoint(this.x + this.vx * 6, this.y))) {
                if (p.jumpnum === 2 || (this.firepower >= 40 && p.vy > -8 && p.jumpnum === 1)) {
                    p.aiKeys.up = true;
                }
            }
        }

        if (this.isShotgunPellet) {
            const maxTime = this.firepower >= 7 ? 9 : 11;
            if (this.time > maxTime - 3) this.alpha -= 0.25;
            if (this.time > maxTime) this.dead = true;
        }

        if (this.x < -600 || this.x > 1500 || this.y < -800 || this.y > 1100) {
            this.dead = true;
        }
    }
}

export class Grenade {
    constructor(opts) {
        this.x = opts.x;
        this.y = opts.y;
        this.facing = opts.facing || 1;
        this.power = opts.power || 6;
        this.vx = this.facing * this.power;
        this.vy = -this.power;
        this.rotation = this.facing * 50;
        this.rotSpeed = (Math.random() * 10 + 5) * (Math.random() < 0.5 ? 1 : -1);
        this.fusetime = 0;
        this.freepass = false;
        this.hitground = false;
        this.ownerSlot = opts.ownerSlot;
        this.ownerName = opts.ownerName;
        this.dead = false;
    }

    update(world) {
        if (this.dead) return;
        if (!this.hitground) {
            this.rotation += this.rotSpeed;
        } else {
            const targetRot = Math.abs(90 - this.rotation) < Math.abs(-90 - this.rotation) ? 90 : -90;
            this.rotation += (targetRot - this.rotation) / 5;
        }

        if (this.vy < 24) {
            this.vy += world.map.gravity + 0.12;
        }

        this.x += this.vx;
        this.y += this.vy;

        const platforms = world.map.platforms;
        if (!this.freepass && hitTestPlatforms(platforms, this.x, this.y + 8) && this.vy > 0) {
            this.y -= this.vy;
            for (let i = 1; i <= 5; i++) {
                if (hitTestPlatforms(platforms, this.x, this.y + 8 + i * (this.vy / 5))) {
                    this.y += (this.vy / 5) * (i - 1);
                    this.rotSpeed *= 0.5;
                    this.vx *= 0.4;
                    this.vy *= -0.4;
                    this.hitground = true;
                    break;
                }
            }
        }
        if (!hitTestPlatforms(platforms, this.x, this.y) && !hitTestPlatforms(platforms, this.x, this.y + 10)) {
            this.freepass = false;
        }
        if (hitTestPlatforms(platforms, this.x, this.y) && !this.freepass) {
            this.freepass = true;
        }

        this.fusetime += 1;

        // AI grenade evasion at fusetime == 40
        if (this.fusetime === 40) {
            for (const p of world.players) {
                if (p.isAI && !p.dead) {
                    const dist = Math.hypot(p.x - this.x, p.y - 30 - this.y);
                    if (p.y < this.y + 20 && dist <= 150) {
                        p.aiKeys.up = true;
                        if (p.x < this.x) p.lockleft = 12;
                        else p.lockright = 12;
                    }
                }
            }
        }

        if (this.fusetime > 50 && Math.abs(this.vx) < 1.2 && Math.abs(this.vy) < 1.2) {
            this.explode(world);
        } else if (this.fusetime > 110) {
            this.explode(world);
        }

        if (this.y >= 900 || this.x < -500 || this.x > 1400) {
            this.dead = true;
        }
    }

    explode(world) {
        if (this.dead) return;
        this.dead = true;
        for (const p of world.players) {
            if (p.dead) continue;
            const dx = p.x - this.x;
            const dy = p.y - 30 - this.y;
            const dist = Math.round(Math.hypot(dx, dy));
            if (dist <= 200) {
                const rad = Math.atan2(dy, dx);
                let pushx, pushy;
                if (p.perk === 6 || p.shieldtime > 0) {
                    pushx = (Math.cos(rad) * (350 - dist)) / 25;
                    pushy = (Math.sin(rad) * (350 - dist)) / 50;
                    p.onShieldHit();
                } else {
                    pushx = (Math.cos(rad) * (350 - dist)) / 5;
                    pushy = (Math.sin(rad) * (350 - dist)) / 10;
                }
                p.vx += pushx;
                p.vy += pushy;
                p.gothitby = this.ownerName;
                p.gothitbySlot = this.ownerSlot;
                p.hitbynade = true;
                if (!p.isAI) {
                    world.triggerHaptic(p.slot, [70, 30, 90]);
                }
            }
        }
        world.shaketime = 15;
        world.spawnExplosionVisuals(this.x, this.y - 20);
        soundManager.playExplodeSound();
    }
}

export class DuckyBomb extends Grenade {
    constructor(opts) {
        super(opts);
        this.isDucky = true;
        this.vx = opts.vxInit >= 0 ? 2 + opts.vxInit * 1.8 : -2 + opts.vxInit * 1.8;
        this.vy = -5;
        this.facing = this.vx >= 0 ? 1 : -1;
        this.rotation = 0;
        this.rotSpeed = 0;
        this.freepass = true;
    }

    update(world) {
        if (this.dead) return;
        if (this.vy < 24) this.vy += world.map.gravity;
        if (this.facing > 0 && this.vx > 2) this.vx += (2 - this.vx) / 10;
        else if (this.facing < 0 && this.vx < -2) this.vx += (-2 - this.vx) / 10;

        this.x += this.vx;
        this.y += this.vy;

        const platforms = world.map.platforms;
        if (!this.freepass && hitTestPlatforms(platforms, this.x, this.y + 8) && this.vy > 0) {
            this.y -= this.vy;
            for (let i = 1; i <= 5; i++) {
                if (hitTestPlatforms(platforms, this.x, this.y + 8 + i * (this.vy / 5))) {
                    this.y += (this.vy / 5) * (i - 1);
                    this.vy *= -0.4;
                    break;
                }
            }
        }
        if (!hitTestPlatforms(platforms, this.x, this.y) && !hitTestPlatforms(platforms, this.x, this.y + 10)) {
            this.freepass = false;
        }
        if (hitTestPlatforms(platforms, this.x, this.y) && !this.freepass) {
            this.freepass = true;
        }

        this.fusetime += 1;
        if (this.fusetime > 80) {
            this.explode(world);
        }
        if (this.y >= 900 || this.x < -500 || this.x > 1400) {
            this.dead = true;
        }
    }
}

export class LauncherGrenade extends Grenade {
    constructor(opts) {
        super({ ...opts, power: 20 });
        this.vx = (opts.facing || 1) * 20;
        this.vy = -8;
        this.isLauncher = true;
    }

    update(world) {
        super.update(world);
        if (this.dead) return;
        for (const p of world.players) {
            if (p.dead || p.slot === this.ownerSlot) continue;
            if (Math.hypot(p.x - this.x, p.y - 30 - this.y) < 40) {
                this.explode(world);
                return;
            }
        }
        if (this.fusetime > 40) {
            this.explode(world);
        }
    }
}

export class Crate {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.vy = 10;
        this.falling = true;
        this.time = 0;
        this.isCrate = true;
        this.dead = false;
    }

    update(world) {
        if (this.dead) return;
        if (this.falling) {
            if (this.vy < 18) this.vy += 1;
            this.y += this.vy;
            const platforms = world.map.platforms;
            if (hitTestPlatforms(platforms, this.x, this.y)) {
                this.falling = false;
                this.y -= this.vy;
                for (let i = 1; i <= 5; i++) {
                    if (hitTestPlatforms(platforms, this.x, this.y + i * (this.vy / 5))) {
                        this.y += (this.vy / 5) * (i - 1);
                        break;
                    }
                }
            }
        }

        for (const p of world.players) {
            if (p.dead || p.isZombie) continue;
            if (Math.abs(p.x - this.x) < 28 && Math.abs(p.y - 25 - this.y) < 34) {
                let randgun = Math.floor(Math.random() * 77) + 10;
                if (p.perk === 4 && Math.floor(Math.random() * 3) === 0) {
                    randgun = 55; // Minigun
                }
                if (p.perk === 12) {
                    randgun = 44; // Gangster Shotgun
                }
                if (world.gamemode === 2) {
                    randgun = 9;
                }
                p.getGun(randgun, world, true);
                p.cratesPicked += 1;
                soundManager.play('bolt2.wav', 0.75);
                world.spawnCratePickupParticles(this.x, this.y);
                this.dead = true;
                return;
            }
        }

        this.time += 1;
        if (this.time >= 420) {
            this.dead = true;
        }
    }
}

export class Powerup {
    constructor(x, y, gamemode, hasActiveClone = false) {
        this.x = x;
        this.y = y;
        this.time = 0;
        this.dead = false;
        this.isPowerup = true;

        let pnum;
        do {
            pnum = Math.floor(Math.random() * 7);
        } while (pnum === 1 || (gamemode === 11 && pnum === 3));
        if (pnum === 4 && hasActiveClone) {
            pnum = 2; // Fallback to Shield if a Double Team clone is already active
        }
        this.powerupnumber = pnum;
    }

    update(world) {
        if (this.dead) return;
        this.time += 1;

        if (this.time >= 20) {
            for (const p of world.players) {
                if (p.dead || p.isZombie || p.isClone) continue;
                if (Math.abs(p.x - this.x) < 32 && Math.abs((p.y - 28) - this.y) < 38) {
                    p.powerupsPicked += 1;
                    soundManager.play('emp.wav', 0.8);
                    const pName = POWERUP_NAMES[this.powerupnumber] || 'POWERUP';
                    world.spawnFloatingText(this.x, this.y - 20, pName, '#40c4ff', 16, 55);
                    if (world.spawnPowerupPickupFX) {
                        world.spawnPowerupPickupFX(this.x, this.y);
                    }

                    switch (this.powerupnumber) {
                        case 0:
                            p.lives += 1;
                            world.spawnFloatingText(p.x, p.y - 60, '1-UP!', '#69f0ae', 18, 55);
                            break;
                        case 1:
                            p.invisibletime = 200;
                            break;
                        case 2:
                            p.shieldtime = 300;
                            if (p.shieldFrame < 2) p.shieldFrame = 2;
                            p.shieldAlpha = 1;
                            break;
                        case 3:
                            p.jetfuel = 100;
                            break;
                        case 4:
                            p.spawnFriend(world);
                            break;
                        case 5:
                            p.speedtime = 300;
                            break;
                        case 6:
                            p.minitime = 400;
                            break;
                    }
                    this.dead = true;
                    return;
                }
            }
        }

        if (this.time >= 420) {
            this.dead = true;
        }
    }
}

export class MysteryBox {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.state = 'idle'; // 'idle' | 'rolling' | 'ready'
        this.timer = 0;
        this.offeredGun = 10;
    }

    hitTest(px, py) {
        return Math.abs(px - this.x) < 42 && Math.abs(py - this.y) < 42;
    }

    interact(player, world) {
        if (this.state === 'idle') {
            this.state = 'rolling';
            this.timer = 0;
            this.offeredGun = Math.floor(Math.random() * 77) + 10;
            soundManager.play('bolt1.wav', 0.7);
        } else if (this.state === 'ready' && this.timer > 8) {
            player.getGun(this.offeredGun, world, true);
            soundManager.play('bolt2.wav', 0.8);
            this.state = 'idle';
            this.timer = 0;
        }
    }

    update() {
        if (this.state === 'rolling') {
            this.timer += 1;
            if (this.timer % 4 === 0) {
                this.offeredGun = Math.floor(Math.random() * 77) + 10;
            }
            if (this.timer >= 45) {
                this.state = 'ready';
                this.timer = 0;
            }
        } else if (this.state === 'ready') {
            this.timer += 1;
            if (this.timer >= 180) {
                this.state = 'idle';
                this.timer = 0;
            }
        }
    }
}

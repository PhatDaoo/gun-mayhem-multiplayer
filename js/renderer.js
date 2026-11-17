// Authentic Gun Mayhem 2 Canvas 2D Renderer (Original SWF Sprites + Parallax + Part-based Characters)

import {
    STAGE_WIDTH,
    STAGE_HEIGHT,
    SPRITE_METAS,
    WEAPONS,
    SKIN_COLORS_HEX
} from './gamedata.js';
import { drawSpriteFrame, getImage } from './assets.js';
import { POWERUP_NAMES } from './entities.js';

/**
 * Draw a Gun Mayhem character using the exact SWF part coordinates & registration points.
 */
export function drawCharacter(ctx, p, x, y, scalePct = 80, facing = 1, alpha = 1) {
    ctx.save();
    ctx.translate(x, y);
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));

    const s = scalePct / 100;
    ctx.scale(s * facing, s);

    const colorFrame = Math.max(1, Math.min(20, p.color || 1));
    const shirtFrame = Math.max(1, Math.min(27, p.shirt || 1));
    const hatFrame = Math.max(1, Math.min(48, p.hat || 1));
    const eyesFrame = Math.max(1, Math.min(12, p.eyes || 1));
    const bodyY = p.bodyY ?? -60;
    const eyesY = (p.eyesY ?? -46) + (bodyY + 60);
    const hatY = -75 + (bodyY + 60);
    const legRot = p.legRot ?? 0;

    const hand1Y = p.hand1Y ?? -35;
    const hand2Y = p.hand2Y ?? -25;
    const hand1LX = p.hand1LocalX ?? -5;
    const hand1LY = p.hand1LocalY ?? 10.5;
    const hand2LX = p.hand2LocalX ?? 20;
    const hand2LY = p.hand2LocalY ?? -3.75;
    const gunLX = p.gunLocalX ?? -5.5;
    const gunLY = p.gunLocalY ?? 10.85;
    const gunRot = p.gunRot ?? 25;

    // 1. Back Hand (hand2)
    drawSpriteFrame(ctx, SPRITE_METAS.hand, colorFrame, hand2LX, hand2Y + hand2LY);

    // 2. Back Leg (leg2 at tx=9, ty=-5.6, child leg at tx=-5, ty=-6.6)
    ctx.save();
    ctx.translate(9, -5.6);
    ctx.rotate(((legRot * 0.65) * Math.PI) / 180);
    drawSpriteFrame(ctx, SPRITE_METAS.leg, colorFrame, -5, -6.6);
    ctx.restore();

    // 3. Body group (at ty=bodyY)
    ctx.save();
    ctx.translate(0, bodyY);
    if (p.jetfuel && p.jetfuel > 0) {
        drawSpriteFrame(ctx, SPRITE_METAS.jetpack, 1, 0, 14.6);
    }
    // Torso skin (cid 174 at ty = 53.2 - 27.9 = 25.3)
    drawSpriteFrame(ctx, SPRITE_METAS.body, colorFrame, 0, 25.3);
    // Shirt (cid 201 at ty = 53.2 - 27.1 = 26.1)
    drawSpriteFrame(ctx, SPRITE_METAS.shirt, shirtFrame, 0, 26.1);
    // Head (cid 223 at tx = 9.45, ty = 4.0)
    drawSpriteFrame(ctx, SPRITE_METAS.head, colorFrame, 9.45, 4.0);
    ctx.restore();

    // 4. Eyes / Face (cid 291 at tx=0, ty=eyesY)
    drawSpriteFrame(ctx, SPRITE_METAS.eyes, eyesFrame, 0, eyesY);

    // 5. Hat (cid 279 at tx=9.55, ty=hatY)
    drawSpriteFrame(ctx, SPRITE_METAS.hat, hatFrame, 9.55, hatY);

    // 6. Front Leg (leg1 at tx=-12, ty=-0.2, child leg at tx=-5, ty=-6.6)
    ctx.save();
    ctx.translate(-12, -0.2);
    ctx.rotate(((-legRot * 0.65) * Math.PI) / 180);
    drawSpriteFrame(ctx, SPRITE_METAS.leg, colorFrame, -5, -6.6);
    ctx.restore();

    // 7. Front Hand + Gun (hand1 at ty=hand1Y)
    const wep = WEAPONS[p.wepnumber || p.gun || 1] || WEAPONS[1];
    const gunFrame = p.gunAnimFrame || (wep.frames >= 2 ? 2 : 1);
    drawSpriteFrame(ctx, wep, gunFrame, gunLX, hand1Y + gunLY, 1, 1, gunRot);
    drawSpriteFrame(ctx, SPRITE_METAS.hand, colorFrame, hand1LX, hand1Y + hand1LY);

    // 8. Shield bubble (frames 2..22 expand, 22 steady full bubble, 23..30 hit bounce)
    if ((p.shieldtime && p.shieldtime > 0) || (p.shieldAlpha && p.shieldAlpha > 0)) {
        const shFrame = Math.max(2, Math.min(30, p.shieldFrame || 22));
        const baseAlpha = p.shieldAlpha ?? 1;
        const shieldAlpha =
            p.shieldtime > 0 && p.shieldtime < 30
                ? p.shieldtime % 6 < 3
                    ? 0.9
                    : 0.4
                : baseAlpha * 0.9;
        drawSpriteFrame(ctx, SPRITE_METAS.shield, shFrame, 0, -35, 1, 1, 0, shieldAlpha);
    }

    ctx.restore();
}

/**
 * Draw character preview on a setup card canvas.
 */
export function renderCharacterPreviewCanvas(canvas, config) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Subtle platform pedestal
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.beginPath();
    ctx.ellipse(w / 2, h - 18, 38, 9, 0, 0, Math.PI * 2);
    ctx.fill();

    const wep = WEAPONS[config.gun || 1] || WEAPONS[1];
    const mockPlayer = {
        color: config.color || 1,
        shirt: config.shirt || 1,
        hat: config.hat || 1,
        eyes: config.eyes || 1,
        wepnumber: wep.id,
        bodyY: -60,
        eyesY: -46,
        hand1Y: -35,
        hand2Y: -25,
        hand1LocalX: wep.shootx,
        hand1LocalY: wep.shooty,
        hand2LocalX: wep.handx,
        hand2LocalY: wep.handy,
        gunLocalX: wep.shootx,
        gunLocalY: wep.shooty,
        gunRot: 0,
        legRot: 0,
        jetfuel: 0,
        shieldtime: 0
    };

    drawCharacter(ctx, mockPlayer, w / 2 - 6, h - 18, 95, 1, 1);
}

export class ArenaRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.weatherParticles = [];
        for (let i = 0; i < 70; i++) {
            this.weatherParticles.push({
                x: Math.random() * 1100 - 100,
                y: Math.random() * 700 - 50,
                speed: 4 + Math.random() * 5,
                size: 2 + Math.random() * 3
            });
        }
    }

    render(world) {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, STAGE_WIDTH, STAGE_HEIGHT);

        // Sky backdrop fallback
        ctx.fillStyle = '#18202c';
        ctx.fillRect(0, 0, STAGE_WIDTH, STAGE_HEIGHT);

        const mapId = world.map.id;
        const camX = world.camX + world.shakeX;
        const camY = world.camY + world.shakeY;

        // 1. Far Parallax Layer (scene1: moves at 0.1x camera offset)
        drawSpriteFrame(ctx, SPRITE_METAS.scene1, mapId, camX * 0.1, camY * 0.1);

        // 2. Mid Parallax Layer (scene2: moves at 0.5x camera offset)
        drawSpriteFrame(ctx, SPRITE_METAS.scene2, mapId, camX * 0.5, camY * 0.5);

        // 3. Foreground Map Art (DefineSprite_1835 placed at tx=51.1, ty=192.6 in world space)
        const fgDrawn = drawSpriteFrame(ctx, SPRITE_METAS.foreground, mapId, 51.1 + camX, 192.6 + camY);

        ctx.save();
        ctx.translate(camX, camY);

        // Fallback platform drawing only if foreground PNG hasn't finished loading yet
        if (!fgDrawn) {
            ctx.fillStyle = '#455a64';
            ctx.strokeStyle = '#cfd8dc';
            ctx.lineWidth = 2;
            for (const p of world.map.platforms) {
                ctx.fillRect(p.x, p.y, p.w, p.h);
                ctx.strokeRect(p.x, p.y, p.w, p.h);
            }
        }

        // 4. Survival Mode Mystery Box
        if (world.mysteryBox) {
            const mb = world.mysteryBox;
            drawSpriteFrame(ctx, SPRITE_METAS.mysteryBox, 2, mb.x, mb.y);
            if (mb.state === 'rolling' || mb.state === 'ready') {
                const wep = WEAPONS[mb.offeredGun] || WEAPONS[10];
                drawSpriteFrame(ctx, wep, 2, mb.x, mb.y - 48, 0.85, 0.85, 0);
                ctx.fillStyle = mb.state === 'ready' ? '#69f0ae' : '#ffeb3b';
                ctx.font = 'bold 11px "Segoe UI", sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(mb.state === 'ready' ? `[DOWN] TAKE ${wep.name}` : wep.name, mb.x, mb.y - 72);
            } else {
                ctx.fillStyle = '#ffeb3b';
                ctx.font = 'bold 10px "Segoe UI", sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('[DOWN] MYSTERY BOX', mb.x, mb.y - 42);
            }
        }

        // 5. Background particles (speed trails, dropped mags/guns)
        for (const pt of world.bgParticles) {
            this.drawParticle(ctx, pt);
        }

        // 6. Crates & Powerups
        for (const c of world.crates) {
            if (!c.dead) {
                drawSpriteFrame(ctx, SPRITE_METAS.crate, 1, c.x, c.y);
            }
        }
        for (const pw of world.powerups) {
            if (!pw.dead) {
                // Ground shadow (DefineSprite_853 placed at tx=-20, ty=38)
                if (SPRITE_METAS.powerupShadow) {
                    drawSpriteFrame(ctx, SPRITE_METAS.powerupShadow, 1, pw.x - 20, pw.y + 38);
                }
                if (pw.time >= 2) {
                    const bobY = pw.time < 20 ? 2 : 4.5 + Math.sin((pw.time - 20) * 0.08) * 4.5;
                    // Glowing aura behind icon (DefineSprite_855)
                    if (SPRITE_METAS.powerupAura) {
                        drawSpriteFrame(ctx, SPRITE_METAS.powerupAura, 1, pw.x, pw.y + bobY);
                    }
                    // Authentic powerup icon (DefineSprite_851 frame = powerupnumber + 1)
                    const iconFrame = (pw.powerupnumber ?? 0) + 1;
                    drawSpriteFrame(ctx, SPRITE_METAS.powerupIcon, iconFrame, pw.x, pw.y + bobY);
                }
                // Spawn beam effect (DefineSprite_831 frames 1..31)
                if (pw.time <= 31 && SPRITE_METAS.powerupBeam) {
                    drawSpriteFrame(ctx, SPRITE_METAS.powerupBeam, Math.max(1, pw.time), pw.x, pw.y);
                }
            }
        }

        // 7. Players
        for (const p of world.players) {
            if (p.dead) continue;
            drawCharacter(ctx, p, p.x, p.y, p.scale, p.facing, p.alpha);

            // Jetpack fuel gauge if active
            if (p.jetfuel > 0) {
                ctx.fillStyle = 'rgba(0,0,0,0.6)';
                ctx.fillRect(p.x - 18, p.y - 88 * p.minimulti, 36, 5);
                ctx.fillStyle = '#ff9800';
                ctx.fillRect(p.x - 17, p.y - 88 * p.minimulti + 1, (34 * Math.min(100, p.jetfuel)) / 100, 3);
            }

            // Dynamite charge bar
            if (p.nadekey && p.offhandnumber === 1) {
                const pct = Math.min(1, p.nadepower / 14);
                ctx.fillStyle = 'rgba(0,0,0,0.7)';
                ctx.fillRect(p.x - 20, p.y - 96 * p.minimulti, 40, 6);
                ctx.fillStyle = '#ff5252';
                ctx.fillRect(p.x - 19, p.y - 96 * p.minimulti + 1, 38 * pct, 4);
            }

            // Reload progress bar
            if (p.reloading) {
                const pct = Math.min(1, p.reloadTimer / p.reloadDuration);
                ctx.fillStyle = 'rgba(0,0,0,0.7)';
                ctx.fillRect(p.x - 20, p.y - 96 * p.minimulti, 40, 5);
                ctx.fillStyle = '#ffeb3b';
                ctx.fillRect(p.x - 19, p.y - 96 * p.minimulti + 1, 38 * pct, 3);
            }

            // Nametag above player (hidden if invisible enemy)
            if (p.alpha > 0.25) {
                this.drawNametag(ctx, p, world.teamgame);
            }
        }

        // 8. Bullets & Grenades
        for (const b of world.bullets) {
            if (b.dead) continue;
            ctx.save();
            ctx.translate(b.x, b.y);
            ctx.rotate((b.angleDeg * Math.PI) / 180);
            ctx.globalAlpha = Math.max(0, b.alpha);
            if (b.instagib) {
                ctx.strokeStyle = '#00e5ff';
                ctx.lineWidth = 4;
                ctx.beginPath();
                ctx.moveTo(-28, 0);
                ctx.lineTo(10, 0);
                ctx.stroke();
            } else {
                ctx.strokeStyle = b.firepower >= 40 ? '#ff5252' : '#ffeb3b';
                ctx.lineWidth = b.type === 'bullet2' ? 2 : 3;
                ctx.beginPath();
                ctx.moveTo(-22, 0);
                ctx.lineTo(6, 0);
                ctx.stroke();
            }
            ctx.restore();
        }

        for (const g of world.grenades) {
            if (g.dead) continue;
            if (g.isDucky) {
                drawSpriteFrame(ctx, SPRITE_METAS.ducky, 1, g.x, g.y, g.facing * 0.8, 0.8, g.rotation);
            } else if (g.isLauncher) {
                drawSpriteFrame(ctx, SPRITE_METAS.bullet5, 1, g.x, g.y, 0.8, 0.8, g.rotation);
            } else {
                drawSpriteFrame(ctx, SPRITE_METAS.grenade, 1, g.x, g.y, 0.8, 0.8, g.rotation);
            }
        }

        // 9. Foreground Particles & Floating Text
        for (const pt of world.particles) {
            this.drawParticle(ctx, pt);
        }

        ctx.restore();

        // 10. Weather Overlay (Rain / Snow)
        if (world.map.weather === 'rain' || world.map.weather === 'snow') {
            this.drawWeather(ctx, world.map.weather);
        }

        // 11. Off-screen Player Indicators (player_arrow)
        this.drawOffscreenArrows(ctx, world, camX, camY);
    }

    drawNametag(ctx, p, isTeamGame) {
        const tagY = p.y - 80 * p.minimulti;
        ctx.save();
        ctx.font = 'bold 11px "Segoe UI", sans-serif';
        const text = p.name;
        const tw = ctx.measureText(text).width;
        const bw = tw + 12;
        const bh = 16;

        let bg = 'rgba(15, 18, 24, 0.78)';
        let border = SKIN_COLORS_HEX[(p.color || 1) - 1] || '#ffffff';
        if (isTeamGame) {
            bg = p.team === 1 ? 'rgba(21, 101, 192, 0.85)' : 'rgba(198, 40, 40, 0.85)';
            border = p.team === 1 ? '#64b5f6' : '#ef5350';
        }

        ctx.fillStyle = bg;
        ctx.strokeStyle = border;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(p.x - bw / 2, tagY - bh, bw, bh, 4);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, p.x, tagY - bh / 2);
        ctx.restore();
    }

    drawParticle(ctx, pt) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, pt.alpha ?? 1));
        if (pt.kind === 'text') {
            ctx.font = `900 ${pt.size || 15}px "Segoe UI", sans-serif`;
            ctx.textAlign = 'center';
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 3;
            ctx.strokeText(pt.text, pt.x, pt.y);
            ctx.fillStyle = pt.color || '#ffeb3b';
            ctx.fillText(pt.text, pt.x, pt.y);
        } else if (pt.kind === 'sprite') {
            drawSpriteFrame(ctx, pt.meta, pt.frame, pt.x, pt.y, pt.sx || 1, pt.sy || 1, pt.rot || 0, pt.alpha);
        } else if (pt.kind === 'trail') {
            drawCharacter(ctx, pt.snapshot, pt.x, pt.y, pt.scale, pt.facing, pt.alpha * 0.35);
        } else if (pt.kind === 'ring') {
            ctx.strokeStyle = pt.color || '#ffffff';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.ellipse(pt.x, pt.y, pt.rx, pt.ry, 0, 0, Math.PI * 2);
            ctx.stroke();
        } else {
            ctx.fillStyle = pt.color || '#ffeb3b';
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, pt.r || 3, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }

    drawWeather(ctx, type) {
        ctx.save();
        for (const wp of this.weatherParticles) {
            if (type === 'rain') {
                wp.x -= 2.5;
                wp.y += wp.speed * 2.2;
                ctx.strokeStyle = 'rgba(180, 215, 255, 0.45)';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(wp.x, wp.y);
                ctx.lineTo(wp.x - 4, wp.y + 12);
                ctx.stroke();
            } else {
                wp.x += Math.sin(wp.y * 0.03) * 0.8;
                wp.y += wp.speed * 0.45;
                ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
                ctx.beginPath();
                ctx.arc(wp.x, wp.y, wp.size, 0, Math.PI * 2);
                ctx.fill();
            }
            if (wp.y > STAGE_HEIGHT + 20) {
                wp.y = -15;
                wp.x = Math.random() * (STAGE_WIDTH + 100);
            }
            if (wp.x < -20) wp.x = STAGE_WIDTH + 10;
        }
        ctx.restore();
    }

    drawOffscreenArrows(ctx, world, camX, camY) {
        for (const p of world.players) {
            if (p.dead || p.alpha < 0.25) continue;
            const sx = p.x + camX;
            const sy = p.y - 30 + camY;
            if (sx >= 20 && sx <= STAGE_WIDTH - 20 && sy >= 20 && sy <= STAGE_HEIGHT - 20) {
                continue;
            }
            const cx = Math.max(28, Math.min(STAGE_WIDTH - 28, sx));
            const cy = Math.max(28, Math.min(STAGE_HEIGHT - 28, sy));
            const angle = Math.atan2(sy - cy, sx - cx);
            const col = SKIN_COLORS_HEX[(p.color || 1) - 1] || '#ffeb3b';

            ctx.save();
            ctx.translate(cx, cy);
            ctx.fillStyle = 'rgba(0,0,0,0.75)';
            ctx.strokeStyle = col;
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.arc(0, 0, 16, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 11px "Segoe UI", sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`P${p.slot || 'AI'}`, 0, 0);

            ctx.rotate(angle);
            ctx.fillStyle = col;
            ctx.beginPath();
            ctx.moveTo(22, 0);
            ctx.lineTo(15, -6);
            ctx.lineTo(15, 6);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        }
    }
}

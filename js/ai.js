// Authentic Gun Mayhem 2 AI Controller (Ported 1:1 from DefineSprite_826_playerAI)

import { hitTestPlatforms } from './entities.js';

export function updateAI(ai, world) {
    ai.aiKeys.up = false;
    ai.aiKeys.down = false;
    ai.aiKeys.left = false;
    ai.aiKeys.right = false;
    ai.aiKeys.shoot = false;
    ai.aiKeys.bomb = false;

    if (ai.dummy) return;

    const map = world.map;
    const platforms = map.platforms;
    const groundleft = map.groundLeft;
    const groundright = map.groundRight;
    const groundmiddle = map.groundMiddle;

    // 1. Target selection every 40 frames (or when target is gone)
    ai.targettime += 1;
    if (ai.targettime >= 40 || !ai.target || ai.target.dead) {
        let low = 5000;
        ai.target = null;
        ai.targetplayer = true;

        for (let i = 0; i < world.players.length; i++) {
            const p = world.players[i];
            if (p.dead || p === ai || p.team === ai.team) continue;
            const dist = Math.round(Math.hypot(p.x - ai.x, p.y - 30 - ai.y));
            if (dist < low) {
                low = dist;
                ai.target = p;
                ai.targetplayer = true;
            }
        }

        if (!ai.isZombie) {
            const items = [...world.crates, ...world.powerups];
            for (let i = 0; i < items.length; i++) {
                const it = items[i];
                if (it.dead) continue;
                const dist = Math.round(Math.hypot(it.x - ai.x, it.y - 30 - ai.y));
                if (dist < low) {
                    low = dist;
                    ai.target = it;
                    ai.targetplayer = false;
                }
                if (!ai.isClone && (it.powerupnumber === 0 || it.powerupnumber === 3)) {
                    ai.target = it;
                    ai.targetplayer = false;
                    break;
                }
            }
        }
        ai.targettime = 0;
    }

    const target = ai.target;

    // 2. Edge probes matching DefineSprite_826_playerAI (land1=-64,+16, land2=+64,+16, noland=0,+24)
    const land1x = ai.x - 64;
    const land1y = ai.y + 16;
    const land2x = ai.x + 64;
    const land2y = ai.y + 16;
    const noland = ai.y + 24;

    // Anti-stuck check
    if (ai.prevx === Math.round(ai.x)) {
        ai.idletime2 += 1;
        if (ai.idletime2 >= 6) {
            ai.idletime2 = 0;
            if (ai.jumpnum === 2) ai.aiKeys.up = true;
            if (target && target.x < ai.x) ai.lockleft = 10;
            else ai.lockright = 10;
        }
    } else {
        ai.idletime2 = 0;
    }
    ai.prevx = Math.round(ai.x);

    // 3. Horizontal & Vertical navigation toward target
    if (target) {
        if (target.y <= ai.y + 10 && target.y >= ai.y - 80 && ai.jumpnum === 2) {
            let optimalx = target.x;
            if (ai.targetplayer) {
                const dir = target.x >= groundmiddle ? 1 : -1;
                optimalx = target.x - 150 * dir;
            }
            if (ai.x > groundleft + 200 && optimalx < ai.x - 40) {
                ai.aiKeys.left = true;
            }
            if (ai.x < groundright - 200 && optimalx > ai.x + 40) {
                ai.aiKeys.right = true;
            }
            if (ai.x > optimalx - 40 && ai.x < optimalx + 40) {
                if (target.x > ai.x && ai.facing === -1) ai.aiKeys.right = true;
                if (target.x <= ai.x && ai.facing === 1) ai.aiKeys.left = true;
            }
        } else if (target.y > ai.y + 10) {
            if ((ai.x > groundleft + 50 && target.jumpnum === 2) || (ai.x > groundleft - 10 && !ai.targetplayer)) {
                if (target.x < ai.x - 30) ai.aiKeys.left = true;
            }
            if ((ai.x < groundright - 50 && target.jumpnum === 2) || (ai.x < groundright + 10 && !ai.targetplayer)) {
                if (target.x > ai.x + 30) ai.aiKeys.right = true;
            }
            if (ai.x > target.x - 30 && ai.x < target.x + 30) {
                ai.aiKeys.down = true;
            }
            if (hitTestPlatforms(platforms, ai.x, ai.y + 95) && target.jumpnum === 2) {
                ai.aiKeys.down = true;
            }
        } else if (target.y < ai.y - 80) {
            if (ai.vy < 0 && ai.jumpnum === 1 && hitTestPlatforms(platforms, ai.x, ai.y - 30) && Math.abs(ai.vx) <= 5) {
                ai.aiKeys.up = true;
            }
            if (
                ai.jumpnum === 2 &&
                Math.abs(ai.vx) <= 5 &&
                (hitTestPlatforms(platforms, ai.x, ai.y - 75) || hitTestPlatforms(platforms, ai.x, ai.y - 120))
            ) {
                ai.aiKeys.up = true;
            } else if (
                ai.jumpnum === 2 &&
                ai.lockleft === 0 &&
                ai.vx >= -5 &&
                (hitTestPlatforms(platforms, ai.x - 100, ai.y - 80) || hitTestPlatforms(platforms, ai.x - 100, ai.y - 120))
            ) {
                ai.aiKeys.up = true;
                ai.lockleft = 20;
            } else if (
                ai.jumpnum === 2 &&
                ai.lockright === 0 &&
                ai.vx <= 5 &&
                (hitTestPlatforms(platforms, ai.x + 100, ai.y - 80) || hitTestPlatforms(platforms, ai.x + 100, ai.y - 120))
            ) {
                ai.aiKeys.up = true;
                ai.lockright = 20;
            } else if (ai.jumpnum === 2) {
                if (target.x < ai.x && ai.lockright === 0) ai.lockleft = 10;
                else if (target.x > ai.x && ai.lockleft === 0) ai.lockright = 10;
            }
        }
    }

    // 4. Stage boundary recovery & edge safety
    if (ai.x < groundleft + 100 || ai.x > groundright - 100) {
        if (groundmiddle < ai.x - 40) ai.aiKeys.left = true;
        if (groundmiddle > ai.x + 40) ai.aiKeys.right = true;
    }

    if (Math.abs(ai.vx) > 15 && ai.jumpnum === 2) {
        ai.aiKeys.up = true;
    }
    if (!hitTestPlatforms(platforms, land2x, land2y) && ai.vx > 10 && ai.jumpnum === 2) {
        ai.aiKeys.up = true;
    }
    if (!hitTestPlatforms(platforms, land1x, land1y) && ai.vx < -10 && ai.jumpnum === 2) {
        ai.aiKeys.up = true;
    }

    if ((ai.x > groundright - 100 && ai.targetplayer) || (ai.x > groundright && !ai.targetplayer)) {
        if (ai.jetfuel > 0 && ai.x > groundright && ai.vy > -1) ai.lockup = 10;
        if (ai.jumpnum === 2) ai.aiKeys.up = true;
        if (ai.vy > 0 && ai.vx < -1 && (ai.jumpnum === 1 || ai.jumpnum === 11) && ai.x < groundright + 140) {
            ai.aiKeys.up = true;
        }
        if (
            ai.x > groundright &&
            !hitTestPlatforms(platforms, ai.x, noland) &&
            (ai.jumpnum === 1 || ai.jumpnum === 11) &&
            ai.y > map.lowestY - 100
        ) {
            ai.aiKeys.up = true;
        }
    }

    if ((ai.x < groundleft + 100 && ai.targetplayer) || (ai.x < groundleft && !ai.targetplayer)) {
        if (ai.jetfuel > 0 && ai.x < groundleft && ai.vy > -1) ai.lockup = 10;
        if (ai.jumpnum === 2) ai.aiKeys.up = true;
        if (ai.vy > 0 && ai.vx > 1 && (ai.jumpnum === 1 || ai.jumpnum === 11) && ai.x > groundleft - 140) {
            ai.aiKeys.up = true;
        }
        if (
            ai.x < groundleft &&
            !hitTestPlatforms(platforms, ai.x, noland) &&
            (ai.jumpnum === 1 || ai.jumpnum === 11) &&
            ai.y > map.lowestY - 100
        ) {
            ai.aiKeys.up = true;
        }
    }

    if (!hitTestPlatforms(platforms, land2x, land2y) && ai.jumpnum === 2) {
        ai.aiKeys.right = false;
    }
    if (!hitTestPlatforms(platforms, land1x, land1y) && ai.jumpnum === 2) {
        ai.aiKeys.left = false;
    }
    if (!hitTestPlatforms(platforms, land2x - 15, land2y) && ai.jumpnum === 2) {
        ai.aiKeys.right = false;
        ai.aiKeys.left = true;
    }
    if (!hitTestPlatforms(platforms, land1x + 15, land1y) && ai.jumpnum === 2) {
        ai.aiKeys.left = false;
        ai.aiKeys.right = true;
    }

    if (ai.lockright >= ai.lockleft) ai.lockleft = 0;
    if (ai.lockleft > ai.lockright) ai.lockright = 0;

    if (ai.lockright > 0) {
        ai.aiKeys.right = true;
        ai.lockright -= 1;
    }
    if (ai.lockleft > 0) {
        ai.aiKeys.left = true;
        ai.lockleft -= 1;
    }
    if (ai.lockup > 0) {
        ai.aiKeys.up = true;
        ai.lockup -= 1;
    }

    // 5. Shooting & Grenade decision
    if (target && ai.targetplayer && target.y < ai.y + 20 && target.y > ai.y - 80) {
        if ((target.x > ai.x && ai.facing === 1) || (target.x < ai.x && ai.facing === -1)) {
            const dist = Math.abs(target.x - ai.x);
            if (ai.shotgun > 0) {
                if (dist > 15 && dist < 175) {
                    ai.aiKeys.shoot = true;
                }
            } else {
                ai.aiKeys.shoot = true;
            }
            if (!ai.isZombie && ai.offhandammo > 0 && dist > 110 && dist < 260 && Math.random() < 0.015) {
                ai.aiKeys.bomb = true;
            }
        }
    }
}

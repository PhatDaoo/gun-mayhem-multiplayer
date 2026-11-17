// Image & Sprite Loader + Sub-pixel SWF Registration Point Renderer

import { SPRITE_METAS, WEAPONS } from './gamedata.js';

const imageCache = new Map();

export function getImage(src) {
    if (!src) return null;
    let entry = imageCache.get(src);
    if (entry) return entry;

    const img = new Image();
    entry = { img, loaded: false, error: false };
    img.onload = () => {
        entry.loaded = true;
    };
    img.onerror = () => {
        entry.error = true;
    };
    img.src = src;
    imageCache.set(src, entry);
    return entry;
}

/**
 * Draw a frame from a sprite directory using its exact SWF registration point (meta.ox, meta.oy).
 */
export function drawSpriteFrame(ctx, meta, frameNum = 1, x = 0, y = 0, scaleX = 1, scaleY = 1, rotationDeg = 0, alpha = 1) {
    if (!meta || !meta.folder) return false;
    const f = Math.max(1, Math.min(meta.frames || 1, Math.floor(frameNum)));
    const src = `${meta.folder}/${f}.png`;
    const entry = getImage(src);
    if (!entry || !entry.loaded) return false;

    ctx.save();
    if (alpha < 1) ctx.globalAlpha *= Math.max(0, alpha);
    ctx.translate(x, y);
    if (rotationDeg !== 0) {
        ctx.rotate((rotationDeg * Math.PI) / 180);
    }
    if (scaleX !== 1 || scaleY !== 1) {
        ctx.scale(scaleX, scaleY);
    }
    ctx.drawImage(entry.img, meta.ox, meta.oy, meta.w, meta.h);
    ctx.restore();
    return true;
}

/**
 * Preload essential character parts, map 1, and starter weapons for instant rendering.
 */
export function preloadCoreAssets(mapId = 1) {
    // Map layers
    if (SPRITE_METAS.scene1) getImage(`${SPRITE_METAS.scene1.folder}/${mapId}.png`);
    if (SPRITE_METAS.scene2) getImage(`${SPRITE_METAS.scene2.folder}/${mapId}.png`);
    if (SPRITE_METAS.foreground) getImage(`${SPRITE_METAS.foreground.folder}/${mapId}.png`);

    // Character parts (colors, hats, shirts, eyes)
    for (let i = 1; i <= 20; i++) {
        getImage(`${SPRITE_METAS.head.folder}/${i}.png`);
        getImage(`${SPRITE_METAS.body.folder}/${i}.png`);
        getImage(`${SPRITE_METAS.hand.folder}/${i}.png`);
        getImage(`${SPRITE_METAS.leg.folder}/${i}.png`);
    }
    for (let i = 1; i <= 48; i++) getImage(`${SPRITE_METAS.hat.folder}/${i}.png`);
    for (let i = 1; i <= 27; i++) getImage(`${SPRITE_METAS.shirt.folder}/${i}.png`);
    for (let i = 1; i <= 12; i++) getImage(`${SPRITE_METAS.eyes.folder}/${i}.png`);

    // Common gameplay sprites
    getImage(`${SPRITE_METAS.jetpack.folder}/1.png`);
    for (let i = 2; i <= 30; i++) {
        getImage(`${SPRITE_METAS.shield.folder}/${i}.png`);
    }
    getImage(`${SPRITE_METAS.crate.folder}/1.png`);
    if (SPRITE_METAS.powerupIcon) {
        for (let i = 1; i <= 7; i++) {
            getImage(`${SPRITE_METAS.powerupIcon.folder}/${i}.png`);
        }
    }
    if (SPRITE_METAS.powerupShadow) getImage(`${SPRITE_METAS.powerupShadow.folder}/1.png`);
    if (SPRITE_METAS.powerupAura) getImage(`${SPRITE_METAS.powerupAura.folder}/1.png`);
    getImage(`${SPRITE_METAS.grenade.folder}/1.png`);
    getImage(`${SPRITE_METAS.ducky.folder}/1.png`);
    getImage(`${SPRITE_METAS.bullet.folder}/1.png`);
    getImage(`${SPRITE_METAS.bullet2.folder}/1.png`);
    getImage(`${SPRITE_METAS.bullet3.folder}/1.png`);
    getImage(`${SPRITE_METAS.bullet6.folder}/1.png`);
    getImage(`${SPRITE_METAS.fx_flash.folder}/1.png`);

    // Preload idle frame (2.png) of all 86 weapons
    for (const wep of Object.values(WEAPONS)) {
        const idleFrame = wep.frames >= 2 ? 2 : 1;
        getImage(`${wep.folder}/${idleFrame}.png`);
    }
}

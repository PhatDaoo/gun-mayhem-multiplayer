// Image & Sprite Loader + Sub-pixel SWF Registration Point Renderer + Offscreen Map Cache

import { SPRITE_METAS, WEAPONS } from './gamedata.js';

const imageCache = new Map();
const mapCanvasCache = new Map();

// Detect touch/tablet devices (including iPadOS where navigator.platform may be MacIntel)
const IS_TOUCH_DEVICE =
    typeof navigator !== 'undefined' &&
    (navigator.maxTouchPoints > 1 || /iPad|iPhone|iPod|Android/i.test(navigator.userAgent));

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
 * Draw a large map layer using an offscreen canvas cache (downscaled slightly on iPad/mobile for 60fps compositing).
 */
export function drawCachedMapLayer(ctx, meta, mapId, x = 0, y = 0) {
    if (!meta || !meta.folder) return false;
    const f = Math.max(1, Math.min(meta.frames || 1, Math.floor(mapId)));
    const src = `${meta.folder}/${f}.png`;
    const entry = getImage(src);
    if (!entry || !entry.loaded) return false;

    let cached = mapCanvasCache.get(src);
    if (!cached) {
        const scale = IS_TOUCH_DEVICE ? 0.65 : 1;
        const cw = Math.max(1, Math.round(meta.w * scale));
        const ch = Math.max(1, Math.round(meta.h * scale));
        const off = document.createElement('canvas');
        off.width = cw;
        off.height = ch;
        const octx = off.getContext('2d');
        octx.drawImage(entry.img, 0, 0, cw, ch);
        cached = off;
        // Keep cache bounded to avoid memory bloat across many map switches
        if (mapCanvasCache.size > 12) {
            const firstKey = mapCanvasCache.keys().next().value;
            mapCanvasCache.delete(firstKey);
        }
        mapCanvasCache.set(src, cached);
    }

    ctx.drawImage(cached, x + meta.ox, y + meta.oy, meta.w, meta.h);
    return true;
}

/**
 * Preload only the specific character parts and weapon used by an active player.
 */
export function preloadPlayerAssets(config) {
    if (!config) return;
    const color = Math.max(1, Math.min(20, config.color || 1));
    const hat = Math.max(1, Math.min(48, config.hat || 1));
    const shirt = Math.max(1, Math.min(27, config.shirt || 1));
    const eyes = Math.max(1, Math.min(12, config.eyes || 1));

    getImage(`${SPRITE_METAS.head.folder}/${color}.png`);
    getImage(`${SPRITE_METAS.body.folder}/${color}.png`);
    getImage(`${SPRITE_METAS.hand.folder}/${color}.png`);
    getImage(`${SPRITE_METAS.leg.folder}/${color}.png`);
    getImage(`${SPRITE_METAS.hat.folder}/${hat}.png`);
    getImage(`${SPRITE_METAS.shirt.folder}/${shirt}.png`);
    getImage(`${SPRITE_METAS.eyes.folder}/${eyes}.png`);

    const wep = WEAPONS[config.gun || 1];
    if (wep) {
        const idleFrame = wep.frames >= 2 ? 2 : 1;
        getImage(`${wep.folder}/${idleFrame}.png`);
    }
}

/**
 * Preload only the requested map layers and essential gameplay sprites (lazy-load everything else).
 */
export function preloadCoreAssets(mapId = 1) {
    if (SPRITE_METAS.scene1) getImage(`${SPRITE_METAS.scene1.folder}/${mapId}.png`);
    if (SPRITE_METAS.scene2) getImage(`${SPRITE_METAS.scene2.folder}/${mapId}.png`);
    if (SPRITE_METAS.foreground) getImage(`${SPRITE_METAS.foreground.folder}/${mapId}.png`);

    getImage(`${SPRITE_METAS.jetpack.folder}/1.png`);
    getImage(`${SPRITE_METAS.shield.folder}/22.png`);
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
    getImage(`${SPRITE_METAS.fx_flash.folder}/1.png`);
}

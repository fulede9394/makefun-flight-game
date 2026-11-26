// Everything the player sees: the sky, the sun, drifting clouds, distant
// mountains, the scrolling hills with trees and houses, the runway, the plane,
// the rings and stars, the storm clouds, birds and balloons, and the HUD — the
// instrument panel with altitude, speed, heading, fuel, score, lives and the
// current mission. Title, pause and game-over screens are drawn over the world.

import { FIELD, PLANE, PALETTE, FONT, FEET_PER_PIXEL, KNOTS_PER_SPEED } from './config.js';
import { hillYAt } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

function drawStar(ctx, x, y, radius, rotation) {
  ctx.beginPath();
  for (let index = 0; index < 10; index += 1) {
    const angle = rotation + (index * Math.PI) / 5 - Math.PI / 2;
    const r = index % 2 === 0 ? radius : radius * 0.45;
    const px = x + Math.cos(angle) * r;
    const py = y + Math.sin(angle) * r;
    if (index === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = FIELD.width;
  canvas.height = FIELD.height;

  function drawSky(state) {
    const gradient = ctx.createLinearGradient(0, 0, 0, FIELD.height);
    gradient.addColorStop(0, PALETTE.skyTop);
    gradient.addColorStop(0.55, PALETTE.skyMid);
    gradient.addColorStop(1, PALETTE.skyLow);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);

    // Sun, top right, with a soft glow.
    const sunX = FIELD.width - 170;
    const sunY = 92;
    ctx.fillStyle = PALETTE.sunGlow;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 66, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.sun;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 38, 0, Math.PI * 2);
    ctx.fill();

    // Distant mountains, parallax-slow.
    ctx.fillStyle = 'rgba(90, 120, 160, 0.45)';
    ctx.beginPath();
    ctx.moveTo(0, 470);
    for (let x = 0; x <= FIELD.width; x += 40) {
      const peak = 430 - Math.abs(Math.sin((x + state.distance * 0.08) / 260)) * 90;
      ctx.lineTo(x, peak);
    }
    ctx.lineTo(FIELD.width, 470);
    ctx.closePath();
    ctx.fill();
  }

  function drawClouds(state) {
    // A few soft background clouds drifting with the world.
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    for (let index = 0; index < 6; index += 1) {
      const span = FIELD.width + 400;
      const x = (((index * 317 - state.distance * 0.25) % span) + span) % span - 200;
      const y = 60 + index * 52;
      const scale = 0.7 + (index % 3) * 0.25;
      ctx.beginPath();
      ctx.arc(x, y, 26 * scale, 0, Math.PI * 2);
      ctx.arc(x + 28 * scale, y + 6 * scale, 20 * scale, 0, Math.PI * 2);
      ctx.arc(x - 30 * scale, y + 8 * scale, 18 * scale, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawTerrain(state, screen) {
    // Near hills: a filled silhouette following the hill line.
    ctx.fillStyle = PALETTE.hillNear;
    ctx.beginPath();
    ctx.moveTo(0, FIELD.height);
    for (let x = 0; x <= FIELD.width; x += 8) {
      ctx.lineTo(x, hillYAt(state.distance + x));
    }
    ctx.lineTo(FIELD.width, FIELD.height);
    ctx.closePath();
    ctx.fill();

    // A darker far hill band behind it, for depth.
    ctx.fillStyle = PALETTE.hillFar;
    ctx.beginPath();
    ctx.moveTo(0, FIELD.height);
    for (let x = 0; x <= FIELD.width; x += 8) {
      const y = hillYAt(state.distance * 0.6 + x * 0.6 + 500) - 60;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(FIELD.width, FIELD.height);
    ctx.closePath();
    ctx.fill();

    // Trees, houses and rocks planted on the hill line.
    for (const mark of state.terrainMarks) {
      const screenX = mark.x - state.distance;
      if (screenX < -60 || screenX > FIELD.width + 60) continue;
      const y = hillYAt(mark.x);
      const size = mark.size;
      if (mark.kind === 'tree') {
        ctx.fillStyle = '#5a3a21';
        ctx.fillRect(screenX - 2 * size, y - 14 * size, 4 * size, 14 * size);
        ctx.fillStyle = PALETTE.tree;
        ctx.beginPath();
        ctx.arc(screenX, y - 22 * size, 13 * size, 0, Math.PI * 2);
        ctx.fill();
      } else if (mark.kind === 'house') {
        ctx.fillStyle = PALETTE.house;
        ctx.fillRect(screenX - 18 * size, y - 22 * size, 36 * size, 22 * size);
        ctx.fillStyle = PALETTE.houseRoof;
        ctx.beginPath();
        ctx.moveTo(screenX - 21 * size, y - 22 * size);
        ctx.lineTo(screenX, y - 34 * size);
        ctx.lineTo(screenX + 21 * size, y - 22 * size);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.fillStyle = '#6b7280';
        ctx.beginPath();
        ctx.arc(screenX, y - 4 * size, 7 * size, 0, Math.PI);
        ctx.fill();
      }
    }

    // The runway: on the title screen it stays under the parked plane; once
    // flying it is a dark strip near the start of the world, with centre dashes.
    if (screen === SCREEN_TITLE) {
      const y = hillYAt(state.distance + PLANE.x + PLANE.width / 2) - 4;
      ctx.fillStyle = PALETTE.runway;
      ctx.fillRect(PLANE.x - 210, y, 420, 10);
      ctx.fillStyle = PALETTE.runwayLine;
      for (let x = PLANE.x - 190; x < PLANE.x + 190; x += 60) {
        ctx.fillRect(x, y + 3, 30, 4);
      }
      return;
    }
    const runwayStart = -state.distance;
    if (runwayStart < FIELD.width && runwayStart + 420 > 0) {
      const y = hillYAt(210) - 4;
      ctx.fillStyle = PALETTE.runway;
      ctx.fillRect(runwayStart, y, 420, 10);
      ctx.fillStyle = PALETTE.runwayLine;
      for (let x = runwayStart + 20; x < runwayStart + 400; x += 60) {
        ctx.fillRect(x, y + 3, 30, 4);
      }
    }
  }

  function drawPlane(state) {
    const plane = state.plane;
    if (plane.invulnerable > 0 && Math.floor(state.time * 12) % 2 === 0) return;
    const x = PLANE.x;
    const y = plane.y;
    const pitch = Math.max(-0.35, Math.min(0.35, -plane.climbSpeed / 700));
    ctx.save();
    ctx.translate(x + PLANE.width / 2, y + PLANE.height / 2);
    ctx.rotate(pitch);
    // Tail wing.
    ctx.fillStyle = PALETTE.planeWing;
    ctx.beginPath();
    ctx.moveTo(-34, -2);
    ctx.lineTo(-48, -16);
    ctx.lineTo(-38, -2);
    ctx.closePath();
    ctx.fill();
    // Main wing.
    ctx.fillStyle = PALETTE.planeWing;
    ctx.beginPath();
    ctx.moveTo(-6, 4);
    ctx.lineTo(6, 26);
    ctx.lineTo(16, 26);
    ctx.lineTo(10, 2);
    ctx.closePath();
    ctx.fill();
    // Fuselage.
    ctx.fillStyle = PALETTE.planeBody;
    ctx.beginPath();
    ctx.ellipse(0, 0, 46, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    // Red belly stripe.
    ctx.fillStyle = PALETTE.planeBelly;
    ctx.fillRect(-40, 4, 78, 5);
    // Cockpit windows.
    ctx.fillStyle = PALETTE.planeWindow;
    ctx.beginPath();
    ctx.ellipse(28, -5, 12, 6, -0.2, 0, Math.PI * 2);
    ctx.fill();
    // Propeller, spinning.
    const spin = state.time * 28;
    ctx.strokeStyle = 'rgba(40, 40, 40, 0.7)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(48, -14 * Math.abs(Math.sin(spin)));
    ctx.lineTo(48, 14 * Math.abs(Math.sin(spin)));
    ctx.stroke();
    ctx.restore();
  }

  function drawItems(state) {
    for (const item of state.items) {
      if (!item.active) continue;
      if (item.kind === 'cloud') {
        ctx.fillStyle = PALETTE.storm;
        ctx.beginPath();
        ctx.arc(item.x + 40, item.y + 30, 34, 0, Math.PI * 2);
        ctx.arc(item.x + 80, item.y + 22, 40, 0, Math.PI * 2);
        ctx.arc(item.x + 115, item.y + 34, 30, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = PALETTE.stormDark;
        ctx.beginPath();
        ctx.moveTo(item.x + 58, item.y + 52);
        ctx.lineTo(item.x + 68, item.y + 72);
        ctx.lineTo(item.x + 78, item.y + 52);
        ctx.closePath();
        ctx.fill();
      } else if (item.kind === 'bird') {
        const flap = Math.sin(item.flap) * 8;
        ctx.strokeStyle = PALETTE.bird;
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(item.x, item.y + 10);
        ctx.quadraticCurveTo(item.x + 11, item.y - flap, item.x + 22, item.y + 10);
        ctx.moveTo(item.x + 22, item.y + 10);
        ctx.quadraticCurveTo(item.x + 33, item.y - flap, item.x + 44, item.y + 10);
        ctx.stroke();
      } else if (item.kind === 'balloon') {
        ctx.fillStyle = PALETTE.balloon;
        ctx.beginPath();
        ctx.ellipse(item.x + 31, item.y + 30, 30, 36, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#f8f9fa';
        ctx.beginPath();
        ctx.ellipse(item.x + 31, item.y + 30, 10, 36, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = PALETTE.balloonBasket;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(item.x + 16, item.y + 60);
        ctx.lineTo(item.x + 22, item.y + 82);
        ctx.moveTo(item.x + 46, item.y + 60);
        ctx.lineTo(item.x + 40, item.y + 82);
        ctx.stroke();
        ctx.fillStyle = PALETTE.balloonBasket;
        ctx.fillRect(item.x + 20, item.y + 80, 22, 12);
      } else if (item.kind === 'star') {
        ctx.fillStyle = PALETTE.star;
        ctx.save();
        ctx.translate(item.x + item.width / 2, item.y + item.height / 2);
        ctx.rotate(item.spin * 0.4);
        drawStar(ctx, 0, 0, 14, 0);
        ctx.restore();
      } else if (item.kind === 'ring') {
        const cx = item.x + item.width / 2;
        const cy = item.y + item.height / 2;
        ctx.strokeStyle = PALETTE.ring;
        ctx.lineWidth = 9;
        ctx.beginPath();
        ctx.arc(cx, cy, 42, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = PALETTE.ringInner;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(cx, cy, 42, 0, Math.PI * 2);
        ctx.stroke();
      } else if (item.kind === 'fuel') {
        const bob = Math.sin(item.bob) * 4;
        ctx.fillStyle = PALETTE.fuel;
        roundRect(ctx, item.x, item.y + bob, item.width, item.height, 6);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 20px ' + FONT;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('F', item.x + item.width / 2, item.y + bob + item.height / 2 + 1);
      }
    }
  }

  function drawHud(state, mission, best, screen) {
    const plane = state.plane;
    const panelY = 14;
    const panelH = 64;
    ctx.fillStyle = PALETTE.panel;
    roundRect(ctx, 14, panelY, FIELD.width - 28, panelH, 12);
    ctx.fill();
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.lineWidth = 2;
    roundRect(ctx, 14, panelY, FIELD.width - 28, panelH, 12);
    ctx.stroke();

    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = PALETTE.muted;
    ctx.font = '12px ' + FONT;
    ctx.textAlign = 'left';
    const altitude = Math.max(
      0,
      Math.round((hillYAt(state.distance + PLANE.x + PLANE.width / 2) - (plane.y + PLANE.height)) * FEET_PER_PIXEL),
    );
    // Parked on the title screen, the plane reads 0 kt: it is not flying yet.
    const speed = screen === SCREEN_TITLE ? 0 : Math.round(plane.speed * KNOTS_PER_SPEED);
    const heading = 90 + Math.round((-plane.climbSpeed / PLANE.climbMax) * 12);
    const cells = [
      ['ALT', altitude.toLocaleString('en-US') + ' ft'],
      ['SPD', speed + ' kt'],
      ['HDG', String(heading).padStart(3, '0') + '°'],
      ['FUEL', Math.round(plane.fuel) + '%'],
      ['SCORE', String(Math.floor(state.score))],
      ['BEST', String(Math.floor(Math.max(best, state.score)))],
    ];
    let x = 34;
    for (const [label, value] of cells) {
      ctx.fillStyle = PALETTE.muted;
      ctx.fillText(label, x, panelY + 22);
      ctx.fillStyle = label === 'FUEL' && plane.fuel < 25 ? PALETTE.danger : PALETTE.text;
      ctx.font = 'bold 20px ' + FONT;
      ctx.fillText(value, x, panelY + 50);
      ctx.font = '12px ' + FONT;
      x += label === 'ALT' || label === 'SCORE' ? 150 : 110;
    }

    // Fuel gauge bar under the FUEL cell.
    const fuelX = 34 + 150 + 110 + 110;
    const fuelW = 90;
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    roundRect(ctx, fuelX, panelY + 56, fuelW, 7, 3);
    ctx.fill();
    ctx.fillStyle = plane.fuel < 25 ? PALETTE.danger : PALETTE.good;
    roundRect(ctx, fuelX, panelY + 56, (fuelW * plane.fuel) / 100, 7, 3);
    ctx.fill();

    // Lives, top right, as little planes.
    ctx.fillStyle = PALETTE.text;
    ctx.font = '12px ' + FONT;
    ctx.textAlign = 'right';
    ctx.fillText('LIVES', FIELD.width - 34, panelY + 22);
    for (let index = 0; index < state.lives; index += 1) {
      const lx = FIELD.width - 44 - index * 34;
      ctx.fillStyle = PALETTE.planeBelly;
      ctx.beginPath();
      ctx.ellipse(lx, panelY + 40, 13, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PALETTE.planeWing;
      ctx.fillRect(lx - 4, panelY + 40, 8, 9);
    }
    ctx.textAlign = 'left';

    // Mission line under the panel, with progress.
    ctx.fillStyle = 'rgba(12, 20, 34, 0.72)';
    roundRect(ctx, 14, panelY + panelH + 8, 460, 34, 9);
    ctx.fill();
    ctx.fillStyle = PALETTE.ring;
    ctx.font = 'bold 14px ' + FONT;
    const missionText = `MISSION ${state.missionDone + 1}: ${mission.label}`;
    ctx.fillText(missionText, 28, panelY + panelH + 31);
    ctx.fillStyle = PALETTE.text;
    ctx.textAlign = 'right';
    ctx.fillText(`${Math.min(state.missionProgress, mission.target)} / ${mission.target}`, 458, panelY + panelH + 31);
    ctx.textAlign = 'left';

    // Artificial horizon: a small lit instrument, bottom left.
    const hx = 62;
    const hy = FIELD.height - 62;
    ctx.fillStyle = PALETTE.panel;
    ctx.beginPath();
    ctx.arc(hx, hy, 40, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(hx, hy, 40, 0, Math.PI * 2);
    ctx.stroke();
    ctx.save();
    ctx.beginPath();
    ctx.arc(hx, hy, 36, 0, Math.PI * 2);
    ctx.clip();
    const pitchOffset = Math.max(-18, Math.min(18, plane.climbSpeed / 16));
    ctx.fillStyle = '#3f8fd2';
    ctx.fillRect(hx - 40, hy - 40 + pitchOffset, 80, 40 - pitchOffset);
    ctx.fillStyle = '#8a6b46';
    ctx.fillRect(hx - 40, hy + pitchOffset, 80, 40 - pitchOffset);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(hx - 36, hy + pitchOffset);
    ctx.lineTo(hx + 36, hy + pitchOffset);
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = PALETTE.text;
    ctx.font = '11px ' + FONT;
    ctx.textAlign = 'center';
    ctx.fillText('ATTITUDE', hx, hy + 56);
    ctx.textAlign = 'left';

    // Throttle gauge, bottom right.
    const tx = FIELD.width - 190;
    const ty = FIELD.height - 90;
    ctx.fillStyle = PALETTE.panel;
    roundRect(ctx, tx, ty, 176, 76, 10);
    ctx.fill();
    ctx.fillStyle = PALETTE.muted;
    ctx.font = '12px ' + FONT;
    ctx.fillText('THROTTLE', tx + 14, ty + 22);
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    roundRect(ctx, tx + 14, ty + 34, 148, 12, 6);
    ctx.fill();
    ctx.fillStyle = '#4dabf7';
    const throttleFrac = (plane.speed - 150) / (430 - 150);
    roundRect(ctx, tx + 14, ty + 34, 148 * throttleFrac, 12, 6);
    ctx.fill();
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 13px ' + FONT;
    ctx.fillText(plane.fuel <= 0 ? 'ENGINE OUT' : `${Math.round(throttleFrac * 100)}%`, tx + 14, ty + 64);
  }

  function drawTitle(state) {
    ctx.fillStyle = 'rgba(10, 18, 32, 0.45)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 84px ' + FONT;
    ctx.fillText('SKY COURIER', FIELD.width / 2, 210);
    ctx.fillStyle = PALETTE.ring;
    ctx.font = 'bold 26px ' + FONT;
    ctx.fillText('Ring Run — a little flight game', FIELD.width / 2, 258);
    ctx.fillStyle = PALETTE.text;
    ctx.font = '20px ' + FONT;
    ctx.fillText('Fly through the golden rings, grab stars and fuel, dodge storms, birds and balloons.', FIELD.width / 2, 320);
    ctx.fillText('Watch your fuel — an empty tank means a dead-stick glide.', FIELD.width / 2, 350);
    ctx.fillStyle = PALETTE.good;
    ctx.font = 'bold 24px ' + FONT;
    ctx.fillText('↑ / W climb    ↓ / S descend    ← → throttle    P pause', FIELD.width / 2, 410);
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 28px ' + FONT;
    ctx.fillText('Press SPACE or click to take off', FIELD.width / 2, 480);
    ctx.textAlign = 'left';
  }

  function drawPaused() {
    ctx.fillStyle = 'rgba(10, 18, 32, 0.6)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 56px ' + FONT;
    ctx.fillText('PAUSED', FIELD.width / 2, 330);
    ctx.font = '22px ' + FONT;
    ctx.fillText('Press P or Space to keep flying', FIELD.width / 2, 380);
    ctx.textAlign = 'left';
  }

  function drawOver(state, best) {
    ctx.fillStyle = 'rgba(10, 18, 32, 0.62)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 64px ' + FONT;
    ctx.fillText('FLIGHT OVER', FIELD.width / 2, 260);
    ctx.font = 'bold 30px ' + FONT;
    ctx.fillStyle = PALETTE.ring;
    ctx.fillText(`Score ${Math.floor(state.score)}   •   Best ${Math.floor(Math.max(best, state.score))}`, FIELD.width / 2, 330);
    ctx.fillStyle = PALETTE.text;
    ctx.font = '22px ' + FONT;
    const distanceKm = (state.distance / 1000).toFixed(1);
    ctx.fillText(
      `Distance ${distanceKm} km   •   Missions done ${state.missionDone}   •   Level ${state.level}`,
      FIELD.width / 2,
      380,
    );
    ctx.font = 'bold 26px ' + FONT;
    ctx.fillText('Press SPACE or click to fly again', FIELD.width / 2, 450);
    ctx.textAlign = 'left';
  }

  function draw(state, screen, mission, best) {
    drawSky(state);
    drawClouds(state);
    drawTerrain(state, screen);
    drawItems(state);
    drawPlane(state);
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY || screen === SCREEN_PAUSED) {
      drawHud(state, mission, best, screen);
    }
    if (screen === SCREEN_TITLE) drawTitle(state);
    else if (screen === SCREEN_PAUSED) drawPaused();
    else if (screen === SCREEN_OVER) drawOver(state, best);
  }

  return { draw };
}

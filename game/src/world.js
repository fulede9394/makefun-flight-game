// The flight model and the world it flies through. The plane holds a fixed x and
// the world scrolls past it; altitude is the gap between the plane and the hill
// line under it. The world owns the plane, the scrolling terrain, the obstacles
// (storm clouds, birds, balloons), the pickups (stars, rings, fuel cans), the
// mission checklist, the fuel gauge and the score. It steps in fixed 1/60 s
// increments and reports what happened as event bits.

import {
  FIELD,
  STEP,
  PLANE,
  LIVES,
  TERRAIN,
  OBSTACLE,
  PICKUP,
  LEVEL,
  SCORE,
  MISSIONS,
  POOL_SIZE,
  FEET_PER_PIXEL,
} from './config.js';
import { randomInt, randomRange } from './random.js';

export const EVENT_NONE = 0;
export const EVENT_HIT = 1;
export const EVENT_OVER = 2;
export const EVENT_MISSION = 4;
export const EVENT_PICKUP = 8;

export const KIND_CLOUD = 'cloud';
export const KIND_BIRD = 'bird';
export const KIND_BALLOON = 'balloon';
export const KIND_STAR = 'star';
export const KIND_RING = 'ring';
export const KIND_FUEL = 'fuel';

/** Height of the hill line at world-x `x`, in screen pixels from the top. */
export function hillYAt(x) {
  const wave =
    Math.sin(x / TERRAIN.waveA) * TERRAIN.ampA +
    Math.sin(x / TERRAIN.waveB + 1.7) * TERRAIN.ampB;
  return FIELD.groundY - 46 - wave;
}

export function createWorld(random) {
  const state = freshState();

  function freshState() {
    return {
      time: 0,
      distance: 0,
      score: 0,
      level: 1,
      lives: LIVES,
      plane: {
        // Parked on the hill line under the plane, not at a fixed height: the
        // hills rise and fall, and a fixed y could start the plane underground.
        y: hillYAt(PLANE.x + PLANE.width / 2) - PLANE.height - 2,
        climbSpeed: 0,
        speed: PLANE.speedStart,
        fuel: PLANE.fuelStart,
        invulnerable: 0,
        onGround: true,
      },
      items: [],
      terrainMarks: [],
      missionIndex: 0,
      missionLap: 0,
      missionProgress: 0,
      missionDone: 0,
      ringsFlown: 0,
      starsCaught: 0,
      distanceSinceCrash: 0,
      spawnObstacleIn: 1.2,
      spawnRingIn: 1.4,
      spawnStarIn: 0.6,
      spawnFuelIn: 5,
      nextMarkX: 0,
    };
  }

  function currentMission() {
    const base = MISSIONS[state.missionIndex % MISSIONS.length];
    const lap = state.missionLap;
    return {
      kind: base.kind,
      // Each lap asks for a little more.
      target: base.target + (base.kind === 'rings' || base.kind === 'stars' ? lap * 2 : lap * 500),
      label: base.label + (lap > 0 ? ` (lap ${lap + 1})` : ''),
    };
  }

  function reset() {
    const kept = state.items;
    Object.assign(state, freshState());
    state.items = kept;
    state.items.length = 0;
    state.terrainMarks.length = 0;
    state.nextMarkX = 0;
    seedTerrain();
  }

  /** Plant the first stretch of trees and houses so the title screen has scenery. */
  function seedTerrain() {
    for (let x = -40; x < FIELD.width + 200; x += TERRAIN.treeEvery) {
      plantMark(x + randomRange(random, -20, 20));
    }
  }

  function plantMark(worldX) {
    const roll = random();
    const kind = roll < 0.62 ? 'tree' : roll < 0.85 ? 'house' : 'rock';
    state.terrainMarks.push({ x: worldX, kind, size: randomRange(random, 0.8, 1.3) });
  }

  function levelSpeed() {
    return 1 + 0.09 * (state.level - 1);
  }

  function spawnObstacle() {
    const roll = random();
    const kind = roll < 0.45 ? KIND_CLOUD : roll < 0.75 ? KIND_BIRD : KIND_BALLOON;
    const speed = levelSpeed();
    if (kind === KIND_CLOUD) {
      state.items.push({
        kind,
        x: FIELD.width + 80,
        y: randomRange(random, 60, FIELD.groundY - 260),
        width: OBSTACLE.cloudWidth,
        height: OBSTACLE.cloudHeight,
        speed: OBSTACLE.cloudSpeed * speed,
        drift: randomRange(random, -14, 14),
        active: true,
      });
    } else if (kind === KIND_BIRD) {
      state.items.push({
        kind,
        x: FIELD.width + 60,
        y: randomRange(random, 90, FIELD.groundY - 180),
        width: OBSTACLE.birdWidth,
        height: OBSTACLE.birdHeight,
        speed: OBSTACLE.birdSpeed * speed,
        flap: randomRange(random, 0, Math.PI * 2),
        active: true,
      });
    } else {
      state.items.push({
        kind,
        x: FIELD.width + 80,
        y: randomRange(random, 120, FIELD.groundY - 320),
        width: OBSTACLE.balloonWidth,
        height: OBSTACLE.balloonHeight,
        speed: OBSTACLE.balloonSpeed * speed,
        drift: randomRange(random, -8, 8),
        active: true,
      });
    }
  }

  function spawnPickup(kind) {
    const y = randomRange(random, 80, FIELD.groundY - 140);
    if (kind === KIND_RING) {
      state.items.push({
        kind, x: FIELD.width + 60, y,
        width: PICKUP.ringRadius * 2, height: PICKUP.ringRadius * 2,
        speed: 0, active: true,
      });
    } else if (kind === KIND_STAR) {
      state.items.push({
        kind, x: FIELD.width + 60, y,
        width: PICKUP.starSize, height: PICKUP.starSize,
        speed: 0, spin: randomRange(random, 0, Math.PI * 2), active: true,
      });
    } else {
      state.items.push({
        kind, x: FIELD.width + 60, y,
        width: PICKUP.fuelWidth, height: PICKUP.fuelHeight,
        speed: 0, bob: randomRange(random, 0, Math.PI * 2), active: true,
      });
    }
  }

  /** True when the plane's box overlaps the item's box (rings use their centre hole). */
  function overlaps(item) {
    const plane = state.plane;
    const px = PLANE.x;
    const py = plane.y;
    if (item.kind === KIND_RING) {
      const cx = item.x + item.width / 2;
      const cy = item.y + item.height / 2;
      const centreX = px + PLANE.width / 2;
      const centreY = py + PLANE.height / 2;
      const dx = centreX - cx;
      const dy = centreY - cy;
      return dx * dx + dy * dy < PICKUP.ringRadius * PICKUP.ringRadius;
    }
    return (
      px < item.x + item.width &&
      px + PLANE.width > item.x &&
      py < item.y + item.height &&
      py + PLANE.height > item.y
    );
  }

  function advanceMission() {
    const mission = currentMission();
    state.missionDone += 1;
    state.score += SCORE.missionBonus;
    state.missionIndex += 1;
    if (state.missionIndex % MISSIONS.length === 0) state.missionLap += 1;
    state.missionProgress = 0;
    state.ringsFlown = 0;
    state.starsCaught = 0;
    state.distanceSinceCrash = 0;
    return mission;
  }

  function checkMission() {
    const mission = currentMission();
    let progress = state.missionProgress;
    if (mission.kind === 'climb') {
      progress = Math.max(progress, altitudeFeet());
    } else if (mission.kind === 'rings') {
      progress = state.ringsFlown;
    } else if (mission.kind === 'stars') {
      progress = state.starsCaught;
    } else {
      progress = state.distanceSinceCrash;
    }
    state.missionProgress = progress;
    if (progress >= mission.target) {
      advanceMission();
      return EVENT_MISSION;
    }
    return EVENT_NONE;
  }

  function altitudeFeet() {
    const plane = state.plane;
    const ground = hillYAt(state.distance + PLANE.x + PLANE.width / 2);
    return Math.max(0, Math.round((ground - (plane.y + PLANE.height)) * FEET_PER_PIXEL));
  }

  function loseLife() {
    const plane = state.plane;
    state.lives -= 1;
    state.distanceSinceCrash = 0;
    plane.invulnerable = PLANE.invulnerable;
    plane.fuel = Math.max(plane.fuel, PLANE.fuelMax * 0.6);
    if (state.lives <= 0) return EVENT_OVER;
    return EVENT_HIT;
  }

  /**
   * Advance the world one fixed step. `climb` is -1/0/1 (down/still/up),
   * `throttle` is -1/0/1. `attract` (title screen) keeps the plane parked on the
   * runway while the scenery drifts. Returns event bits.
   */
  function step(stepSeconds, climb, throttle, attract) {
    const plane = state.plane;
    let events = EVENT_NONE;
    state.time += stepSeconds;

    const nextLevel = Math.min(LEVEL.max, 1 + Math.floor(state.time / LEVEL.seconds));
    if (nextLevel !== state.level) state.level = nextLevel;

    if (attract) {
      // Parked on the runway: the world still scrolls slowly behind the title,
      // and the plane stays glued to the hill line under it as the hills roll by.
      state.distance += 40 * stepSeconds;
      plane.y = hillYAt(state.distance + PLANE.x + PLANE.width / 2) - PLANE.height - 2;
      for (const item of state.items) item.x -= 40 * stepSeconds;
      return EVENT_NONE;
    }

    // Throttle and climb.
    plane.speed = Math.max(
      PLANE.speedMin,
      Math.min(PLANE.speedMax, plane.speed + throttle * PLANE.throttleAccel * stepSeconds),
    );
    const wantClimb = climb * PLANE.climbMax * (0.55 + 0.45 * (plane.speed / PLANE.speedMax));
    plane.climbSpeed += (wantClimb - plane.climbSpeed) * Math.min(1, 6 * stepSeconds);
    plane.y -= plane.climbSpeed * stepSeconds;
    if (plane.y < 24) {
      plane.y = 24;
      plane.climbSpeed = Math.min(plane.climbSpeed, 0);
    }

    // Fuel burns faster at full throttle; an empty tank means a dead stick glide.
    const burn = PLANE.fuelDrain * (0.5 + plane.speed / PLANE.speedMax) * stepSeconds;
    plane.fuel = Math.max(0, plane.fuel - burn);
    if (plane.fuel <= 0) {
      plane.climbSpeed -= 140 * stepSeconds;
      // A dead-stick glide still has a terminal sink rate: never let the
      // descent build up past the plane's fastest climb, or the ground
      // arrives before the player can flare out of it.
      plane.climbSpeed = Math.max(-PLANE.climbMax, plane.climbSpeed);
    }

    // Scroll the world and bank the distance. The score keeps its fraction
    // (a step's share is under a point); the HUD floors it for display.
    const scroll = plane.speed * stepSeconds;
    state.distance += scroll;
    state.distanceSinceCrash += scroll;
    state.score += scroll * 0.06;

    // Terrain marks: plant ahead, drop behind.
    while (state.nextMarkX < state.distance + FIELD.width + 200) {
      plantMark(state.nextMarkX);
      state.nextMarkX += TERRAIN.treeEvery;
    }
    state.terrainMarks = state.terrainMarks.filter((mark) => mark.x > state.distance - 120);

    // Spawning, paced by level.
    state.spawnObstacleIn -= stepSeconds;
    if (state.spawnObstacleIn <= 0 && state.items.length < POOL_SIZE) {
      spawnObstacle();
      state.spawnObstacleIn =
        OBSTACLE.interval * Math.pow(OBSTACLE.intervalScale, state.level - 1) *
        randomRange(random, 0.8, 1.25);
    }
    state.spawnRingIn -= stepSeconds;
    if (state.spawnRingIn <= 0 && state.items.length < POOL_SIZE) {
      spawnPickup(KIND_RING);
      state.spawnRingIn = PICKUP.ringInterval * randomRange(random, 0.9, 1.2);
    }
    state.spawnStarIn -= stepSeconds;
    if (state.spawnStarIn <= 0 && state.items.length < POOL_SIZE) {
      spawnPickup(KIND_STAR);
      state.spawnStarIn = PICKUP.starInterval * randomRange(random, 0.8, 1.3);
    }
    state.spawnFuelIn -= stepSeconds;
    if (state.spawnFuelIn <= 0 && state.items.length < POOL_SIZE) {
      spawnPickup(KIND_FUEL);
      state.spawnFuelIn = PICKUP.fuelInterval * randomRange(random, 0.9, 1.2);
    }

    // Move everything with the scroll, plus its own drift.
    for (const item of state.items) {
      item.x -= (plane.speed + (item.speed ?? 0)) * stepSeconds;
      if (item.kind === KIND_CLOUD || item.kind === KIND_BALLOON) {
        item.y += (item.drift ?? 0) * stepSeconds;
      } else if (item.kind === KIND_BIRD) {
        item.flap += stepSeconds * 9;
        item.y += Math.sin(item.flap) * 22 * stepSeconds;
      } else if (item.kind === KIND_FUEL) {
        item.bob += stepSeconds * 3;
      } else if (item.kind === KIND_STAR) {
        item.spin += stepSeconds * 2;
      }
    }
    state.items = state.items.filter((item) => item.active && item.x + item.width > -120);

    if (plane.invulnerable > 0) plane.invulnerable -= stepSeconds;

    // Pickups and collisions.
    for (const item of state.items) {
      if (!item.active || !overlaps(item)) continue;
      if (item.kind === KIND_STAR) {
        item.active = false;
        state.starsCaught += 1;
        state.score += PICKUP.starPoints;
        events |= EVENT_PICKUP;
      } else if (item.kind === KIND_RING) {
        item.active = false;
        state.ringsFlown += 1;
        state.score += PICKUP.ringPoints;
        events |= EVENT_PICKUP;
      } else if (item.kind === KIND_FUEL) {
        item.active = false;
        plane.fuel = Math.min(PLANE.fuelMax, plane.fuel + PLANE.fuelCanBonus);
        events |= EVENT_PICKUP;
      } else if (plane.invulnerable <= 0) {
        item.active = false;
        events |= loseLife();
        if (events & EVENT_OVER) return events;
      }
    }

    // The ground: a gentle touchdown on the runway strip is a landing, anywhere
    // else is a crash. (The runway only exists near the start, so after take-off
    // the ground always bites.)
    const ground = hillYAt(state.distance + PLANE.x + PLANE.width / 2);
    if (plane.y + PLANE.height >= ground) {
      plane.y = ground - PLANE.height;
      plane.onGround = true;
      if (plane.invulnerable <= 0) {
        events |= loseLife();
        if (events & EVENT_OVER) return events;
      }
    } else {
      plane.onGround = false;
    }

    events |= checkMission();
    return events;
  }

  return {
    state,
    reset,
    step,
    currentMission,
    altitudeFeet,
    hillYAt,
  };
}

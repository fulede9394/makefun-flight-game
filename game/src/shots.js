// The screenshot scenes behind ?shot=start|play|end. Each one plays the real
// rules forward from a fresh world for a fixed number of steps, steered by an
// autopilot that looks ahead: for each way it could fly (climb, level, dive)
// it works out how soon that way runs into something, then takes the way that
// stays clear longest — chasing the nearest ring or star only when that way is
// clear. The frame is what a short game really looks like, and the same seed
// always gives the same frame.
import { PLANE, STEP } from './config.js';
import { EVENT_OVER, hillYAt } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 26;
const END_LIMIT_SECONDS = 600;
const SAMPLE = 1 / 30;
/** How far ahead, in seconds, the autopilot checks each way it could fly. */
const HORIZON_PLAY = 1.6;
const HORIZON_END = 0.3;
/** Extra room, each side, it keeps around an obstacle: clouds drift and birds flap. */
const MARGIN = 18;

/** Seconds until flying with `climb` (-1, 0, 1) runs into something; Infinity when it never does. */
function timeToHit(state, climb, horizon) {
  const plane = state.plane;
  let y = plane.y;
  let climbSpeed = plane.climbSpeed;
  for (let t = SAMPLE; t <= horizon; t += SAMPLE) {
    // The same climb dynamics the world uses: the climb speed eases toward the
    // wanted climb, faster at full throttle, then the plane moves by it.
    const wantClimb = climb * PLANE.climbMax * (0.55 + 0.45 * (plane.speed / PLANE.speedMax));
    climbSpeed += (wantClimb - climbSpeed) * Math.min(1, 6 * SAMPLE);
    y -= climbSpeed * SAMPLE;
    if (y < 24) {
      y = 24;
      climbSpeed = Math.min(climbSpeed, 0);
    }
    const ground = hillYAt(state.distance + plane.speed * t + PLANE.x + PLANE.width / 2);
    if (y + PLANE.height >= ground) return t;
    for (const item of state.items) {
      if (!item.active) continue;
      if (item.kind === 'star' || item.kind === 'ring' || item.kind === 'fuel') continue;
      const itemX = item.x - (plane.speed + (item.speed ?? 0)) * t;
      if (
        itemX - MARGIN < PLANE.x + PLANE.width &&
        itemX + item.width + MARGIN > PLANE.x &&
        item.y - MARGIN < y + PLANE.height &&
        item.y + item.height + MARGIN > y
      ) {
        return t;
      }
    }
  }
  return Infinity;
}

/** Steer toward the nearest ring or star ahead when that way is clear; else take the way that is hit last. */
function autopilot(state, horizon) {
  let target = null;
  for (const item of state.items) {
    if (!item.active) continue;
    if (item.kind !== 'ring' && item.kind !== 'star') continue;
    if (item.x < PLANE.x) continue;
    if (target === null || item.x < target.x) target = item;
  }
  const centre = state.plane.y + PLANE.height / 2;
  let wanted = 0;
  if (target !== null) {
    const targetY = target.y + target.height / 2;
    wanted = targetY < centre - 12 ? 1 : targetY > centre + 12 ? -1 : 0;
  }
  if (timeToHit(state, wanted, horizon) === Infinity) return wanted;
  let best = wanted;
  let bestTime = timeToHit(state, wanted, horizon);
  for (const direction of [1, 0, -1]) {
    const time = timeToHit(state, direction, horizon);
    if (time > bestTime) {
      bestTime = time;
      best = direction;
    }
  }
  return best;
}

/**
 * Set `world` to the named scene (start, play or end; any other name is start)
 * and return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  if (name !== 'play' && name !== 'end') {
    for (let index = 0; index < START_SECONDS / STEP; index += 1) {
      world.step(STEP, 0, 0, true);
    }
    return { screen: SCREEN_TITLE, best: 0 };
  }
  const limit = name === 'end' ? END_LIMIT_SECONDS : PLAY_SECONDS;
  const horizon = name === 'end' ? HORIZON_END : HORIZON_PLAY;
  for (let index = 0; index < limit / STEP; index += 1) {
    // Throttle 0: the plane holds its cruising speed, so the autopilot flies
    // a steady line instead of chasing full throttle into the scenery.
    const events = world.step(STEP, autopilot(world.state, horizon), 0, false);
    if (events & EVENT_OVER) break;
  }
  const over = world.state.lives === 0;
  return { screen: over ? SCREEN_OVER : SCREEN_PLAY, best: world.state.score };
}

// A tiny seeded random source (mulberry32), so ?seed=N replays the same sky.
// The world takes one of these at boot; nothing else in the game calls Math.random
// for gameplay, which keeps screenshots deterministic.

/** Make a random function seeded by a 32-bit integer. */
export function createRandom(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** An integer in [min, max] from a random function. */
export function randomInt(random, min, max) {
  return min + Math.floor(random() * (max - min + 1));
}

/** A float in [min, max) from a random function. */
export function randomRange(random, min, max) {
  return min + random() * (max - min);
}

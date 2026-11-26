// Sky Courier — every tuning number and colour in one place.
// The playfield is a fixed 1280x720 logical area; the renderer scales it to the
// window, so no rule below depends on the screen size. The plane flies left to
// right over scrolling terrain: climb with Up/W, descend with Down/S, throttle
// with Left/Right (A/D). Altitude is measured in feet above the ground line.

export const FIELD = { width: 1280, height: 720, groundY: 628 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display rate. */
export const STEP = 1 / 60;

/** Feet per logical pixel, for the altimeter. */
export const FEET_PER_PIXEL = 4;

/** Knots per pixel-per-second of airspeed, for the speed tape. */
export const KNOTS_PER_SPEED = 0.55;

export const PLANE = {
  x: 250,
  width: 92,
  height: 30,
  // Vertical speed range (px/s): positive climbs.
  climbMax: 260,
  climbAccel: 900,
  // Airspeed range (px/s of world scroll) and how fast the throttle moves it.
  speedMin: 150,
  speedMax: 430,
  speedStart: 250,
  throttleAccel: 120,
  // Fuel: units, drained per second, scaled by throttle.
  fuelMax: 100,
  fuelStart: 100,
  fuelDrain: 1.6,
  fuelCanBonus: 30,
  // Seconds of flashing invulnerability after a hit.
  invulnerable: 2,
};

export const LIVES = 3;

export const TERRAIN = {
  // Hills are a sum of two sines; the numbers below are their wavelengths (px)
  // and heights (px). Trees and houses are planted on the hill line.
  waveA: 420,
  waveB: 173,
  ampA: 34,
  ampB: 16,
  treeEvery: 90,
  houseEvery: 620,
};

export const OBSTACLE = {
  cloudWidth: 150,
  cloudHeight: 70,
  cloudSpeed: 40,
  birdWidth: 44,
  birdHeight: 22,
  birdSpeed: 120,
  balloonWidth: 62,
  balloonHeight: 92,
  balloonSpeed: 12,
  // Seconds between spawns at level 1; shrinks as levels rise.
  interval: 1.15,
  intervalScale: 0.9,
  minInterval: 0.45,
};

export const PICKUP = {
  starSize: 26,
  starPoints: 10,
  ringRadius: 46,
  ringPoints: 25,
  fuelWidth: 34,
  fuelHeight: 40,
  // Rings are the mission currency; stars are the score filler.
  ringInterval: 2.6,
  starInterval: 1.1,
  fuelInterval: 7.5,
};

/** Seconds of play per level; difficulty stops growing at the last level. */
export const LEVEL = { seconds: 18, max: 10 };

/** Points for each metre of ground covered, and for finishing a mission. */
export const SCORE = { perMetre: 1, missionBonus: 100 };

/** Missions in order; the list repeats, harder each lap (more rings, more stars). */
export const MISSIONS = [
  { kind: 'climb', target: 800, label: 'Climb above 800 ft' },
  { kind: 'rings', target: 5, label: 'Fly through 5 rings' },
  { kind: 'stars', target: 8, label: 'Collect 8 stars' },
  { kind: 'distance', target: 2500, label: 'Fly 2,500 m without a crash' },
];

/** How many obstacles, pickups and terrain features can exist at once. */
export const POOL_SIZE = 96;

export const PALETTE = {
  skyTop: '#2f6fb2',
  skyMid: '#7db8e8',
  skyLow: '#cfe8f7',
  sun: '#ffd94d',
  sunGlow: 'rgba(255, 217, 77, 0.35)',
  cloud: '#ffffff',
  storm: '#5a6274',
  stormDark: '#3c4252',
  hillFar: '#7ba05b',
  hillNear: '#4e7a37',
  ground: '#3d5c2a',
  runway: '#3a3f47',
  runwayLine: '#f5f5f5',
  tree: '#2c5420',
  house: '#b85c38',
  houseRoof: '#7a3b22',
  planeBody: '#e8eef5',
  planeBelly: '#d94f3d',
  planeWing: '#2f6fb2',
  planeWindow: '#1d3557',
  star: '#ffc93d',
  ring: '#ffb400',
  ringInner: '#ffe9a8',
  fuel: '#37b24d',
  bird: '#2b2b2b',
  balloon: '#e8590c',
  balloonBasket: '#7a4a21',
  panel: 'rgba(12, 20, 34, 0.82)',
  panelEdge: '#4d7ea8',
  text: '#f2f6fa',
  muted: '#9db4c8',
  danger: '#ff5d5d',
  good: '#7ee081',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'sky-courier.best';

// Keyboard and pointer input. Arrow keys and WASD fly the plane; Space or a click
// confirms (take off, restart); P pauses. The game reads a direction each frame
// (-1, 0, 1 for climb and for throttle) and takes one-shot actions.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;

const CLIMB_KEYS = { ArrowUp: 1, KeyW: 1, ArrowDown: -1, KeyS: -1 };
const THROTTLE_KEYS = { ArrowRight: 1, KeyD: 1, ArrowLeft: -1, KeyA: -1 };

export function createInput(canvas) {
  const held = new Set();
  let actions = 0;

  function onKeyDown(event) {
    if (event.code in CLIMB_KEYS || event.code in THROTTLE_KEYS) {
      held.add(event.code);
      event.preventDefault();
    } else if (event.code === 'Space' || event.code === 'Enter') {
      actions |= ACTION_CONFIRM;
      event.preventDefault();
    } else if (event.code === 'KeyP' || event.code === 'Escape') {
      actions |= ACTION_PAUSE;
    }
  }

  function onKeyUp(event) {
    held.delete(event.code);
  }

  function onPointerDown() {
    actions |= ACTION_CONFIRM;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('pointerdown', onPointerDown);

  /** -1 to climb down, 0, or 1 to climb up, from the keys currently held. */
  function climb() {
    let value = 0;
    for (const code of held) value += CLIMB_KEYS[code] ?? 0;
    return Math.max(-1, Math.min(1, value));
  }

  /** -1 to throttle down, 0, or 1 to throttle up, from the keys currently held. */
  function throttle() {
    let value = 0;
    for (const code of held) value += THROTTLE_KEYS[code] ?? 0;
    return Math.max(-1, Math.min(1, value));
  }

  /** Take and clear the actions pressed since the last call. */
  function takeActions() {
    const taken = actions;
    actions = 0;
    return taken;
  }

  return { climb, throttle, takeActions };
}

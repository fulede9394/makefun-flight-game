// Sky Courier — Ring Run: the hand-in program for make.fun's best flight game
// bounty (best-flight-game-20261126-0057). The game itself is the static files
// under game/ (a desktop browser opens game/index.html and plays, offline, no
// network request); the screenshots under screenshots/ are real renders of that
// code. This program copies both folders to the output directory and writes
// dossier.json, the summary the judge reads, with make.fun's vendored library.
//
// Run it outside the grader with MAKEFUN_OUTPUT_DIR standing in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Serve the game locally with `node serve.ts`, then open http://localhost:8080.

import { cp, mkdir, readdir, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

/** Everything this hand-in needs to know, in one place. */
const HANDIN = {
  competition: 'best-flight-game-20261126-0057',
  gameDir: 'game',
  shotsDir: 'screenshots',
  dossierName: 'dossier.json',
  outputEnv: 'MAKEFUN_OUTPUT_DIR',
  outputFallback: '/output',
  // The scorer's own caps (from the kit's gate): only text_max_bytes shapes the
  // bytes; the others refuse an entry the scorer would refuse, so passing them
  // here makes this program fail where the scorer would.
  caps: {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  },
  shotMaxBytes: 262144,
  shotMinCount: 3,
};

/** Fail with a plain message when the entry folder is not shaped like an entry. */
async function validate(here: string): Promise<void> {
  const gameIndex = join(here, HANDIN.gameDir, 'index.html');
  const indexStats = await stat(gameIndex).catch(() => null);
  if (indexStats === null || !indexStats.isFile()) {
    throw new Error(`no playable game: ${HANDIN.gameDir}/index.html is missing`);
  }
  const shots = await readdir(join(here, HANDIN.shotsDir)).catch(() => []);
  const images = shots.filter((name) => /\.(png|jpe?g)$/i.test(name) && !name.startsWith('.'));
  if (images.length < HANDIN.shotMinCount || images.length > HANDIN.caps.screenshots.max) {
    throw new Error(
      `screenshots/ must hold ${HANDIN.shotMinCount} to ${HANDIN.caps.screenshots.max} images, found ${images.length}`,
    );
  }
  for (const name of images) {
    const size = (await stat(join(here, HANDIN.shotsDir, name))).size;
    if (size > HANDIN.shotMaxBytes) {
      throw new Error(`screenshot ${name} is ${size} bytes, over the ${HANDIN.shotMaxBytes} cap`);
    }
  }
}

/** Copy the game and its screenshots out, then write the dossier beside them. */
async function handIn(): Promise<void> {
  const here = fileURLToPath(new URL('.', import.meta.url));
  const out = process.env[HANDIN.outputEnv] ?? HANDIN.outputFallback;
  await validate(here);
  await mkdir(out, { recursive: true });
  await cp(join(here, HANDIN.gameDir), join(out, HANDIN.gameDir), { recursive: true });
  await cp(join(here, HANDIN.shotsDir), join(out, HANDIN.shotsDir), { recursive: true });
  const dossier = buildDossier(out, HANDIN.caps);
  await writeFile(join(out, HANDIN.dossierName), dossier);
  console.log(`handed in ${HANDIN.competition} to ${out}`);
}

await handIn();

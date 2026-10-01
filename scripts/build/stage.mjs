import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { rmrf, linkOrCopy } from './fs.mjs';
import {
  adapterSrc,
  here,
  packagingDir,
  stageDir,
  upstream,
  upstreamLib,
} from './paths.mjs';

/** Stage Upstream lib + Adapter under `.build/stage` (Upstream tree stays pristine). */
export function prepareStage() {
  rmrf(stageDir);
  const stageLib = join(stageDir, 'src/lib');
  mkdirSync(join(stageDir, 'src'), { recursive: true });
  cpSync(upstreamLib, stageLib, { recursive: true });

  const forkbombDir = join(stageLib, 'forkbomb');
  mkdirSync(forkbombDir, { recursive: true });
  // Adapter lives in root `src/` alongside Kit `app.html` — only copy package sources.
  for (const ent of readdirSync(adapterSrc, { withFileTypes: true })) {
    if (ent.name === 'app.html') continue;
    cpSync(join(adapterSrc, ent.name), join(forkbombDir, ent.name), { recursive: true });
  }

  const rootPkg = JSON.parse(readFileSync(join(here, 'package.json'), 'utf8'));
  writeFileSync(
    join(stageDir, 'package.json'),
    `${JSON.stringify(
      {
        name: '@forkbombeu/temporal-ui-stage',
        private: true,
        type: 'module',
        version: '0.0.0',
        peerDependencies: {
          ...(rootPkg.peerDependencies ?? {}),
        },
      },
      null,
      2,
    )}\n`,
  );

  cpSync(join(packagingDir, 'stage.svelte.config.js'), join(stageDir, 'svelte.config.js'));
  cpSync(join(packagingDir, 'stage.tsconfig.json'), join(stageDir, 'tsconfig.json'));

  linkOrCopy(join(here, 'node_modules'), join(stageDir, 'node_modules'));
  linkOrCopy(join(here, '.svelte-kit'), join(stageDir, '.svelte-kit'));
  // Upstream postcss loads `./tailwind.config.ts` from cwd — stage links that file below.
  linkOrCopy(join(upstream, 'postcss.config.cjs'), join(stageDir, 'postcss.config.cjs'));
  linkOrCopy(join(upstream, 'tailwind.config.ts'), join(stageDir, 'tailwind.config.ts'));
  // $components/* and app.css live outside lib; link for preprocess / rare imports.
  linkOrCopy(join(upstream, 'src/components'), join(stageDir, 'src/components'));
  linkOrCopy(join(upstream, 'src/app.css'), join(stageDir, 'src/app.css'));

  if (!existsSync(join(stageLib, 'forkbomb/index.ts'))) {
    throw new Error(`Stage missing Adapter entry: ${join(stageLib, 'forkbomb/index.ts')}`);
  }
  return stageLib;
}

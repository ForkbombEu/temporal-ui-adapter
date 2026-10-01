import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Host Vite 7 SSR breaks `import * as x from 'date-fns-tz'` (CJS): named members
 * are undefined. Rewrite to default-import + normalize so Hosts don't need a Vite quirk.
 */
export function fixDateFnsTzInterop(dir) {
  const rewrite = (file) => {
    const src = readFileSync(file, 'utf8');
    const next = src.replace(
      /import \* as (\w+) from ['"]date-fns-tz['"];/g,
      (_m, id) =>
        `import ${id}Default from 'date-fns-tz';\n` +
        `const ${id} = ${id}Default?.utcToZonedTime ? ${id}Default : (${id}Default?.default ?? ${id}Default);`,
    );
    if (next !== src) writeFileSync(file, next);
  };
  const walk = (d) => {
    for (const ent of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, ent.name);
      if (ent.isDirectory()) walk(p);
      else if (ent.name.endsWith('.js')) rewrite(p);
    }
  };
  walk(dir);
}

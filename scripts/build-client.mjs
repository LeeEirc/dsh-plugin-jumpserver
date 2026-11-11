import { build } from 'esbuild';
import { writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const result = await build({ entryPoints: ['src/client.js'], bundle: true, write: false,
  format: 'cjs', platform: 'browser', target: 'es2022', external: ['react', 'zod'], legalComments: 'inline' });
await writeFile('lib/client.js', `// Built from src/client.js by npm run build.\nwindow.__ModuleLoader__.load({\n  id: 'dsh-plugin-jumpserver',\n  factory: (require) => {\n    const module = { exports: {} };\n    const exports = module.exports;\n${result.outputFiles[0].text}\n    return module.exports;\n  }\n});\n`);

let info = { commit: null, development: false };
try {
  const options = { encoding: 'utf8', timeout: 5000, stdio: ['ignore', 'pipe', 'ignore'] };
  info = {
    commit: execFileSync('git', ['rev-parse', 'HEAD'], options).trim(),
    development: execFileSync('git', ['status', '--porcelain', '--untracked-files=normal'], options).trim() !== '',
  };
} catch { /* A source archive without Git must not claim a commit. */ }
await writeFile('lib/build-info.json', JSON.stringify(info, null, 2) + '\n');

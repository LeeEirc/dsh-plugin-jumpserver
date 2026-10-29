import { build } from 'esbuild';
import { writeFile } from 'node:fs/promises';

const result = await build({ entryPoints: ['src/client.js'], bundle: true, write: false,
  format: 'cjs', platform: 'browser', target: 'es2022', external: ['react', 'zod'], legalComments: 'inline' });
await writeFile('lib/client.js', `// Built from src/client.js by npm run build.\nwindow.__ModuleLoader__.load({\n  id: 'dsh-plugin-jumpserver',\n  factory: (require) => {\n    const module = { exports: {} };\n    const exports = module.exports;\n${result.outputFiles[0].text}\n    return module.exports;\n  }\n});\n`);

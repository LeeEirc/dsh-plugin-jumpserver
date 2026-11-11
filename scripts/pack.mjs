import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';

const destination = resolve('dist');
await mkdir(destination, { recursive: true });
const staging = await mkdtemp(join(destination, '.package-'));
try {
  const manifest = JSON.parse(await readFile('package.json', 'utf8'));
  for (const path of ['lib', 'locale', 'cordis.patch.yml', 'LICENSE', 'THIRD_PARTY_NOTICES']) {
    await cp(path, join(staging, path), { recursive: true });
  }
  await cp('docs/usage.md', join(staging, 'README.md'));
  delete manifest.scripts;
  delete manifest.devDependencies;
  await writeFile(join(staging, 'package.json'), JSON.stringify(manifest, null, 2) + '\n');
  await new Promise((resolve, reject) => {
    const command = process.env.npm_execpath ? process.execPath : process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const args = [...process.env.npm_execpath ? [process.env.npm_execpath] : [], 'pack', '--ignore-scripts', '--pack-destination', destination, staging];
    const child = spawn(command, args, { stdio: 'inherit', shell: false });
    child.once('error', reject);
    child.once('exit', code => code === 0 ? resolve() : reject(new Error(`npm pack failed (${code})`)));
  });
} finally { await rm(staging, { recursive: true, force: true }); }

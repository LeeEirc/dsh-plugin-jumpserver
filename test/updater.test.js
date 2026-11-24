import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { PluginUpdater } from '../lib/updater.js';
import { PLUGIN_PACKAGE } from '../lib/identity.js';
import { JumpServerService } from '../lib/index.js';

async function fixture(t, { version = '0.1.2', checksum, application = 'restart-required', installer = true, scope } = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'jumpserver-update-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const credentials = join(directory, 'jumpserver.json');
  const original = JSON.stringify({ connection: { client: { id: 'existing-client' }, tokens: { accessToken: 'existing-token' } } });
  await writeFile(credentials, original, { mode: 0o600 });
  const bytes = Buffer.from('isolated updater transfer fixture');
  const digest = createHash('sha256').update(bytes).digest('hex');
  const filename = `${PLUGIN_PACKAGE}-${version}.tgz`;
  const base = `https://github.com/LeeEirc/dsh-plugin-jumpserver/releases/download/v${version}/`;
  const release = { tag_name: `v${version}`, assets: [filename, 'SHA256SUMS'].map(name => ({ name, browser_download_url: base + name })) };
  const requests = [], installs = [];
  const nativeInstaller = { async installBundle(file, options) {
    installs.push({ file, options });
    assert.deepEqual(await readFile(file), bytes);
    return { application, bundle: PLUGIN_PACKAGE, error: application === 'failed' ? { code: 'incompatible-version' } : undefined };
  } };
  const updater = new PluginUpdater({ directory: join(directory, 'updates'), version: '0.1.1', scope,
    getInstaller: () => installer ? nativeInstaller : null,
    fetchImpl: async (url, options) => {
      requests.push({ url: String(url), options });
      if (String(url).startsWith('https://api.github.com/')) return Response.json(release);
      if (String(url) === base + 'SHA256SUMS') return new Response(`${checksum || digest}  ${filename}\n`);
      if (String(url) === base + filename) return new Response(bytes);
      assert.fail('Unexpected download host: ' + url);
    },
  });
  return { updater, directory, credentials, original, bytes, release, requests, installs, nativeInstaller };
}

test('verified updates use native installation once and preserve OAuth state and the package archive', async t => {
  const { updater, credentials, original, requests, installs } = await fixture(t);
  const [first, second] = await Promise.all([updater.check(), updater.check()]);
  assert.deepEqual(first, second);
  assert.equal(requests.length, 1);
  assert.equal(first.available, true);
  const [result] = await Promise.all([updater.install('0.1.2'), updater.install('0.1.2')]);
  assert.equal(installs.length, 1);
  assert.deepEqual(installs[0].options, { enabled: true, saveExact: true, expected: { name: PLUGIN_PACKAGE, version: '0.1.2' } });
  assert.equal((await stat(installs[0].file)).mode & 0o777, 0o600);
  assert.equal(result.needsRestart, true);
  assert.equal(result.available, false);
  assert.equal(result.installedVersion, '0.1.2');
  assert.equal(updater.status().needsRestart, true);
  assert.equal(await readFile(credentials, 'utf8'), original);
});

test('a bad checksum never reaches the installer or modifies credentials', async t => {
  const { updater, credentials, original, installs } = await fixture(t, { checksum: '0'.repeat(64) });
  await updater.check();
  await assert.rejects(updater.install('0.1.2'), { code: 'checksum_mismatch' });
  assert.equal(installs.length, 0);
  assert.equal(await readFile(credentials, 'utf8'), original);
});

test('stale targets, downgrades, and nonofficial release assets are refused', async t => {
  const current = await fixture(t, { version: '0.1.0' });
  assert.equal((await current.updater.check()).available, false);
  await assert.rejects(current.updater.install('0.1.0'), { code: 'stale_update' });
  const newer = await fixture(t);
  await newer.updater.check();
  await assert.rejects(newer.updater.install('9.9.9'), { code: 'stale_update' });
  newer.release.assets[0].browser_download_url = 'https://other.example/plugin.tgz';
  await assert.rejects(newer.updater.check(), { code: 'invalid_release' });
  assert.equal(newer.installs.length, 0);
});

test('failed native installation leaves authorization usable and update available', async t => {
  const { updater, credentials, original } = await fixture(t, { application: 'failed' });
  await updater.check();
  await assert.rejects(updater.install('0.1.2'), { code: 'update_install_failed' });
  assert.equal(updater.status().available, true);
  assert.equal(updater.status().installedVersion, null);
  assert.equal(updater.status().installing, false);
  assert.equal(await readFile(credentials, 'utf8'), original);
  const missing = await fixture(t, { installer: false });
  assert.equal((await missing.updater.check()).canInstall, false);
  await assert.rejects(missing.updater.install('0.1.2'), { code: 'update_unavailable' });
});

test('download redirects and advertised response sizes stay bounded', async t => {
  for (const oversized of [false, true]) {
    const { updater, requests, installs } = await fixture(t);
    await updater.check();
    const originalFetch = updater.fetch;
    updater.fetch = async (url, options) => String(url).endsWith('SHA256SUMS')
      ? oversized ? new Response('body', { headers: { 'content-length': 65537 } })
        : new Response(null, { status: 302, headers: { location: 'https://other.example/checksum' } })
      : originalFetch(url, options);
    await assert.rejects(updater.install('0.1.2'), { code: oversized ? 'update_too_large' : 'invalid_release' });
    assert.equal(installs.length, 0);
    assert.ok(requests.every(item => !item.url.includes('other.example')));
  }
});


async function hmrFixture(t) {
  const scope = {};
  const f = await fixture(t, { scope });
  const packageDirectory = join(f.directory, 'installed');
  await mkdir(join(packageDirectory, 'lib'), { recursive: true });
  await mkdir(join(packageDirectory, 'locale'));
  await writeFile(join(packageDirectory, 'package.json'), JSON.stringify({ name: PLUGIN_PACKAGE, version: '0.1.1',
    main: 'lib/index.js', scripts: { prepack: 'must-not-run' }, devDependencies: { esbuild: '*' } }));
  await writeFile(join(packageDirectory, 'lib/index.js'), 'previous installed bytes');
  for (const name of ['cordis.patch.yml', 'README.md', 'LICENSE', 'THIRD_PARTY_NOTICES']) await writeFile(join(packageDirectory, name), name);
  f.updater.packageDirectory = packageDirectory;
  f.updater.isHmr = () => true;
  const inventory = [{ name: PLUGIN_PACKAGE, version: '0.1.1', enabled: true, installed: true, removable: true }];
  const operations = [];
  Object.assign(f.nativeInstaller, {
    async listBundles() { return inventory.map(row => ({ ...row })); },
    async removeBundle(name) {
      assert.equal(name, PLUGIN_PACKAGE); operations.push('remove'); inventory.splice(0);
      return { application: 'applied' };
    },
    async setBundleEnabled(name, enabled) {
      assert.equal(name, PLUGIN_PACKAGE); operations.push('enable'); inventory[0].enabled = enabled;
      return { application: 'applied' };
    },
    async installBundle(file, options) {
      const version = options.expected.version;
      operations.push(`install:${version}`);
      if (version === '0.1.2') assert.deepEqual(await readFile(file), f.bytes);
      else {
        assert.ok(file.startsWith('file:'), 'restoration must install dependencies, not link the snapshot');
        file = file.slice(5);
        const manifest = JSON.parse(await readFile(join(file, 'package.json'), 'utf8'));
        assert.equal(manifest.version, '0.1.1');
        assert.equal(Object.hasOwn(manifest, 'scripts'), false);
        assert.equal(Object.hasOwn(manifest, 'devDependencies'), false);
        assert.equal(await readFile(join(file, 'lib/index.js'), 'utf8'), 'previous installed bytes');
      }
      inventory.push({ name: PLUGIN_PACKAGE, version, enabled: options.enabled, installed: true, removable: true });
      return { application: 'applied', bundle: PLUGIN_PACKAGE, version };
    },
  });
  return { ...f, scope, packageDirectory, inventory, operations };
}

test('HMR updates survive unloading, share their result after remount, and retain authorization', { timeout: 5000 }, async t => {
  const f = await hmrFixture(t);
  let release, remounted, ready;
  const remountReady = new Promise(resolve => { ready = resolve; });
  const gate = new Promise(resolve => { release = resolve; });
  t.after(() => release());
  const install = f.nativeInstaller.installBundle;
  f.nativeInstaller.installBundle = async (...args) => { await gate; return install(...args); };
  const remove = f.nativeInstaller.removeBundle;
  f.nativeInstaller.removeBundle = async (...args) => {
    const result = await remove(...args);
    f.updater.getInstaller = f.updater.isHmr = () => { throw new Error('Old plugin context was disposed'); };
    remounted = new PluginUpdater({ directory: f.updater.directory, scope: f.scope, version: '0.1.2',
      getInstaller: () => f.nativeInstaller, isHmr: () => true });
    ready();
    return result;
  };
  await f.updater.check();
  const pending = f.updater.install('0.1.2');
  await Promise.race([remountReady, pending]);
  assert.equal(remounted.status().installing, true);
  assert.equal(remounted.install('0.1.2'), pending);
  const independent = new PluginUpdater({ directory: f.updater.directory, scope: {} });
  assert.equal(independent.status().installing, false);
  release();
  await pending;
  assert.equal(remounted.status().installedVersion, '0.1.2');
  assert.equal(remounted.status().installing, false);
  assert.equal(remounted.status().updateError, null);
  assert.deepEqual(f.operations, ['remove', 'install:0.1.2']);
  assert.equal(await readFile(f.credentials, 'utf8'), f.original);
});

test('HMR checksum, backup and profile mismatches stop before removal', async t => {
  for (const fault of ['checksum', 'backup', 'profile']) {
    const f = await hmrFixture(t);
    await f.updater.check();
    if (fault === 'checksum') f.bytes[0] ^= 1;
    if (fault === 'backup') await rm(join(f.packageDirectory, 'lib'), { recursive: true });
    if (fault === 'profile') f.inventory[0].version = '9.0.0';
    await assert.rejects(f.updater.install('0.1.2'));
    assert.deepEqual(f.operations, []);
    assert.equal(await readFile(f.credentials, 'utf8'), f.original);
  }
});

test('failed HMR installs restore the old package, including a target that failed to start', async t => {
  for (const stage of ['install', 'enable']) {
    const f = await hmrFixture(t);
    const install = f.nativeInstaller.installBundle;
    f.nativeInstaller.installBundle = async (file, options) => {
      if (options.expected.version === '0.1.2') {
        f.operations.push('failed-install');
        if (stage === 'enable') f.inventory.push({ name: PLUGIN_PACKAGE, version: '0.1.2', installed: true });
        return { application: 'failed', stage, error: { code: 'incompatible-version' } };
      }
      return install(file, options);
    };
    await f.updater.check();
    await assert.rejects(f.updater.install('0.1.2'), { code: 'update_install_failed' });
    assert.deepEqual(f.operations, ['remove', 'failed-install', ...(stage === 'enable' ? ['remove'] : []), 'install:0.1.1']);
    assert.equal(f.inventory[0].version, '0.1.1');
    assert.equal(f.updater.status().installedVersion, null);
    assert.equal(f.updater.status().available, true);
    assert.equal(await readFile(f.credentials, 'utf8'), f.original);
  }
});

test('a removal failure restores the original enabled state without reinstalling', async t => {
  const f = await hmrFixture(t);
  f.nativeInstaller.removeBundle = async () => {
    f.operations.push('failed-remove'); f.inventory[0].enabled = false;
    return { application: 'failed' };
  };
  await f.updater.check();
  await assert.rejects(f.updater.install('0.1.2'), { code: 'update_install_failed' });
  assert.deepEqual(f.operations, ['failed-remove', 'enable']);
  assert.equal(f.inventory[0].enabled, true);
  assert.equal(await readFile(f.credentials, 'utf8'), f.original);
});

test('failed HMR restoration exposes a persistent local recovery package', async t => {
  const f = await hmrFixture(t);
  f.nativeInstaller.installBundle = async () => ({ application: 'failed' });
  await f.updater.check();
  const response = await JumpServerService.prototype.request.call({ updater: f.updater }, { action: 'install-update', version: '0.1.2' });
  const error = f.updater.status().updateError;
  assert.equal(response.ok, false);
  assert.equal(response.error.code, 'update_restore_failed');
  assert.ok(response.error.message.includes(error.recoveryPath));
  assert.deepEqual(JSON.parse(await readFile(join(f.updater.directory, 'last-update-error.json'), 'utf8')), error);
  assert.equal(error.code, 'update_restore_failed');
  assert.equal(JSON.parse(await readFile(join(error.recoveryPath.slice(5), 'package.json'), 'utf8')).version, '0.1.1');
  const remounted = new PluginUpdater({ directory: f.updater.directory, scope: f.scope });
  assert.deepEqual(remounted.status().updateError, error);
  assert.equal(await readFile(f.credentials, 'utf8'), f.original);
});

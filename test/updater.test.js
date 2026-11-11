import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { PluginUpdater } from '../lib/updater.js';
import { PLUGIN_PACKAGE } from '../lib/identity.js';

async function fixture(t, { version = '0.1.2', checksum, application = 'restart-required', installer = true } = {}) {
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
  const updater = new PluginUpdater({ directory: join(directory, 'updates'), version: '0.1.1',
    getInstaller: () => installer ? { async installBundle(file, options) {
      installs.push({ file, options });
      assert.deepEqual(await readFile(file), bytes);
      return { application, bundle: PLUGIN_PACKAGE, error: application === 'failed' ? { code: 'incompatible-version' } : undefined };
    } } : null,
    fetchImpl: async (url, options) => {
      requests.push({ url: String(url), options });
      if (String(url).startsWith('https://api.github.com/')) return Response.json(release);
      if (String(url) === base + 'SHA256SUMS') return new Response(`${checksum || digest}  ${filename}\n`);
      if (String(url) === base + filename) return new Response(bytes);
      assert.fail('Unexpected download host: ' + url);
    },
  });
  return { updater, directory, credentials, original, bytes, release, requests, installs };
}

test('verified updates use native installation once and preserve OAuth state and the package archive', async t => {
  const { updater, credentials, original, requests, installs } = await fixture(t);
  const [first, second] = await Promise.all([updater.check(), updater.check()]);
  assert.deepEqual(first, second);
  assert.equal(requests.length, 1);
  assert.equal(first.available, true);
  const [result] = await Promise.all([updater.install('0.1.2'), updater.install('0.1.2')]);
  assert.equal(installs.length, 1);
  assert.deepEqual(installs[0].options, { enabled: true, saveExact: true });
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

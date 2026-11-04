import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { setupConnection } from '../lib/cli.js';
import { StateStore } from '../lib/store.js';
import { provider } from './fixtures/provider.js';

async function fixture(t) {
  const remote = await provider();
  const directory = await mkdtemp(join(tmpdir(), 'jumpserver-setup-'));
  const store = new StateStore(join(directory, 'jumpserver.json'));
  t.after(async () => { await remote.close(); await rm(directory, { recursive: true, force: true }); });
  const url = remote.base + '/koko/mcp';
  const onAuthorize = async url => {
    const consent = await fetch(url, { redirect: 'manual' });
    const callback = await fetch(consent.headers.get('location'));
    assert.equal(callback.status, 200);
  };
  return { remote, store, url, onAuthorize };
}

test('setup reuses one connection, client registration and OAuth tokens without asset calls', async t => {
  const { remote, store, url, onAuthorize } = await fixture(t);
  const connected = await setupConnection(url, { store, onAuthorize });
  assert.equal(connected.status, 'connected');
  assert.equal(connected.tool_count, remote.tools.length);
  const saved = await readFile(store.path, 'utf8');
  assert.equal((await stat(store.path)).mode & 0o777, 0o600);
  await setupConnection(url, { store, onAuthorize: () => assert.fail('Working OAuth was not reused') });
  assert.equal(await readFile(store.path, 'utf8'), saved);
  assert.equal(remote.state.registrations, 1);
  assert.equal(remote.state.calls, 0);
  assert.equal(remote.state.registration.client_name, 'DeepSeek Harness');
  await store.transaction(state => { state.connection.tokens.refreshAt = 0; });
  await setupConnection(url, { store, onAuthorize: () => assert.fail('Refresh should reuse the grant') });
  assert.equal(remote.state.refreshes, 1);
  assert.equal(remote.state.registrations, 1);
});

test('setup preserves conflicting, disabled and corrupt configurations', async t => {
  const { store, url, onAuthorize } = await fixture(t);
  await setupConnection(url, { store, onAuthorize });
  let saved = await readFile(store.path, 'utf8');
  await assert.rejects(setupConnection('https://other.example/koko/mcp', { store }), { code: 'configuration_conflict' });
  assert.equal(await readFile(store.path, 'utf8'), saved);
  await store.transaction(state => { state.connection.enabled = false; });
  saved = await readFile(store.path, 'utf8');
  await assert.rejects(setupConnection(url, { store }), { code: 'disabled' });
  assert.equal(await readFile(store.path, 'utf8'), saved);
  await writeFile(store.path, 'invalid state');
  await assert.rejects(setupConnection(url, { store }), { code: 'state_read_failed' });
  assert.equal(await readFile(store.path, 'utf8'), 'invalid state');
});

test('setup reuses registration with DCR disabled and stops new registration or expired browser flows', async t => {
  const { remote, store, url, onAuthorize } = await fixture(t);
  await setupConnection(url, { store, onAuthorize });
  remote.state.registrationDisabled = true;
  await store.transaction(state => { delete state.connection.tokens; });
  await setupConnection(url, { store, onAuthorize });
  assert.equal(remote.state.registrations, 1);
  const fresh = new StateStore(join(store.path, '..', 'fresh.json'));
  await assert.rejects(setupConnection(url, { store: fresh, onAuthorize }), { code: 'registration_disabled' });
  assert.equal(remote.state.registrations, 1);
  await store.transaction(state => { delete state.connection.tokens; });
  let callback;
  await assert.rejects(setupConnection(url, { store, timeoutMs: 30,
    onAuthorize: value => { callback = new URL(value).searchParams.get('redirect_uri'); } }), { code: 'authorization_expired' });
  await assert.rejects(fetch(callback));
  assert.equal(remote.state.registrations, 1);
});

test('setup cancellation closes its loopback listener while retaining the reusable client ID', async t => {
  const { remote, store, url } = await fixture(t);
  const controller = new AbortController();
  let callback;
  await assert.rejects(setupConnection(url, { store, signal: controller.signal, onAuthorize: url => {
    callback = new URL(url).searchParams.get('redirect_uri');
    controller.abort();
  } }), { name: 'AbortError' });
  await assert.rejects(fetch(callback));
  assert.equal((await store.read()).connection.client.id, 'public-client');
  assert.equal(remote.state.registrations, 1);
  assert.equal((await store.read()).connection.tokens, undefined);
});

test('standalone CLI stays alive for OAuth and verifies discovery without exposing tokens', async t => {
  const { remote, store, url } = await fixture(t);
  const bin = join(dirname(store.path), 'jumpserver-mcp');
  await symlink(fileURLToPath(new URL('../lib/cli.js', import.meta.url)), bin);
  const child = spawn(bin, ['setup', '--url', url, '--state-path', store.path],
    { stdio: ['ignore', 'pipe', 'pipe'] });
  t.after(() => { if (child.exitCode === null) child.kill('SIGTERM'); });
  let output = '', errors = '', handled = false;
  const consent = new Promise((resolve, reject) => {
    child.stdout.on('data', chunk => {
      output += chunk;
      const link = /Browser authorization: (https?:\/\/[^\r\n]+)/.exec(output)?.[1];
      if (!link || handled) return;
      handled = true;
      (async () => {
        await new Promise(resolve => setTimeout(resolve, 30));
        const response = await fetch(link, { redirect: 'manual' });
        const completed = await fetch(response.headers.get('location'));
        assert.equal(completed.status, 200);
      })().then(resolve, reject);
    });
    child.on('error', reject);
    child.on('exit', code => { if (!handled) reject(new Error('CLI exited before authorization: ' + code)); });
  });
  child.stderr.on('data', chunk => { errors += chunk; });
  const [closed] = await Promise.all([once(child, 'close'), consent]);
  assert.equal(closed[0], 0, errors);
  assert.match(output, /"status":"connected"/);
  assert.ok(!output.includes(remote.state.access) && !output.includes(remote.state.refresh));
  assert.equal(remote.state.calls, 0);
});

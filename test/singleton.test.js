import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Context } from '@deepseek-ai/cordis';
import * as plugin from '../lib/index.js';
import { StateStore } from '../lib/store.js';
import { JumpServerManager } from '../lib/manager.js';
import { provider } from './fixtures/provider.js';

async function directory(t) {
  const path = await mkdtemp(join(tmpdir(), 'dsh-jumpserver-singleton-'));
  t.after(() => rm(path, { recursive: true, force: true }));
  return path;
}

test('concurrent configuration across managers creates exactly one connection', async t => {
  const path = join(await directory(t), 'state.json');
  const managers = Array.from({ length: 2 }, () => new JumpServerManager({ store: new StateStore(path) }));
  t.after(() => Promise.all(managers.map(manager => manager.dispose())));
  const results = await Promise.allSettled(Array.from({ length: 8 }, (_, index) => managers[index % 2].add({ url: `https://site${index}.example.com` })));
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.ok(results.filter(result => result.status === 'rejected').every(result => result.reason.code === 'already_configured'));
  const state = JSON.parse(await readFile(path, 'utf8'));
  assert.equal(state.version, 2);
  assert.ok(state.connection.id);
  assert.equal(Object.hasOwn(state, 'instances'), false);
  assert.equal(Object.hasOwn(state.connection, 'name'), false);
  await assert.rejects(managers[0].update(state.connection.id, { name: 'another' }), { code: 'fixed_name' });
  const response = await managers[0].dispatch({ action: 'add', values: { url: 'https://another.example.com' } });
  assert.equal(response.ok, false);
  assert.equal(response.error.code, 'already_configured');
  assert.equal((await managers[1].dispatch({ action: 'status' })).value.id, state.connection.id);
});

test('clearing a connection makes old identifiers unusable', async t => {
  const manager = new JumpServerManager({ store: new StateStore(join(await directory(t), 'state.json')) });
  t.after(() => manager.dispose());
  const old = await manager.add({ url: 'https://old.example.com' });
  await manager.remove(old.id);
  assert.equal(await manager.status(), null);
  const current = await manager.add({ url: 'https://new.example.com' });
  assert.notEqual(old.id, current.id);
  await assert.rejects(manager.remove(old.id), { code: 'not_found' });
  await assert.rejects(manager.update(old.id, { enabled: false }), { code: 'not_found' });
  assert.equal((await manager.status()).id, current.id);
});

test('simultaneous OAuth flows share one persisted client registration', async t => {
  const remote = await provider();
  t.after(() => remote.close());
  const path = join(await directory(t), 'state.json');
  const managers = Array.from({ length: 2 }, () => new JumpServerManager({ store: new StateStore(path) }));
  t.after(() => Promise.all(managers.map(manager => manager.dispose())));
  const row = await managers[0].add({ url: `${remote.base}/koko/mcp` });
  let release;
  remote.state.registrationGate = new Promise(resolve => { release = resolve; });
  const registering = new Promise(resolve => { remote.state.registering = resolve; });
  const first = managers[0].oauth.begin(row.id);
  await registering;
  const second = managers[1].oauth.begin(row.id);
  release();
  const flows = await Promise.all([first, second]);
  assert.equal(remote.state.registrations, 1);
  assert.equal(remote.state.registration.client_name, 'DeepSeek Harness');
  assert.ok(flows.every(flow => new URL(flow.authorizeUrl).searchParams.get('client_id') === 'public-client'));
  assert.notEqual(new URL(flows[0].authorizeUrl).searchParams.get('state'), new URL(flows[1].authorizeUrl).searchParams.get('state'));
});

test('duplicate plugin loading is rejected and unloading releases ownership', async t => {
  const path = await directory(t);
  const roots = [new Context(), new Context()];
  t.after(() => Promise.all(roots.map(ctx => ctx.fiber.dispose())));
  for (const root of roots) await root.plugin(ctx => { ctx.provide('tools', { register: () => () => {} }); });
  const first = roots[0].plugin(plugin, { statePath: join(path, 'first.json') });
  await first;
  const duplicate = roots[0].plugin(plugin, { statePath: join(path, 'duplicate.json') });
  await assert.rejects(Promise.resolve(duplicate), { code: 'already_loaded' });
  await duplicate.dispose();
  const independent = roots[1].plugin(plugin, { statePath: join(path, 'independent.json') });
  await independent;
  await first.dispose();
  await roots[0].plugin(plugin, { statePath: join(path, 'replacement.json') });
});

test('unsupported multi-connection state is rejected without rewriting it', async t => {
  const path = join(await directory(t), 'state.json');
  const original = JSON.stringify({ version: 1, instances: [{ id: 'first' }, { id: 'second' }] });
  await writeFile(path, original);
  await assert.rejects(new StateStore(path).transaction(() => {}), { code: 'state_read_failed' });
  assert.equal(await readFile(path, 'utf8'), original);
});

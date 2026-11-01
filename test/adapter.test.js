import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { StateStore } from '../lib/store.js';
import { JumpServerManager } from '../lib/manager.js';
import { toolDefinition, renderResult } from '../lib/tools.js';
import { mcpUrl, loopbackOrigin, redact } from '../lib/http.js';
import { provider } from './fixtures/provider.js';

async function setup(t) {
  const remote = await provider();
  const directory = await mkdtemp(join(tmpdir(), 'dsh-jumpserver-test-'));
  const store = new StateStore(join(directory, 'state.json'));
  const manager = new JumpServerManager({ store, retryBaseMs: 10000 });
  t.after(async () => { await manager.dispose(); await remote.close(); await rm(directory, { recursive: true, force: true }); });
  const row = await manager.add({ url: `${remote.base}/koko/mcp` });
  async function authorize() {
    const auth = await manager.authorize(row.id);
    const response = await fetch(auth.authorizeUrl, { redirect: 'manual' });
    const callback = new URL(response.headers.get('location'));
    await manager.oauth.complete(row.id, callback);
    return callback;
  }
  return { remote, store, manager, row, authorize };
}

test('public PKCE authorization discovers tools and preserves action evidence', async t => {
  const { remote, store, manager, row, authorize } = await setup(t);
  await authorize();
  assert.equal(remote.state.registration.token_endpoint_auth_method, 'none');
  assert.equal(remote.state.registration.client_name, 'DeepSeek Harness');
  assert.equal(remote.state.authorization.scope, 'agent:access');
  assert.equal(remote.state.authorization.resource, `${remote.base}/koko/mcp`);
  assert.equal(remote.state.authorization.code_challenge_method, 'S256');
  const view = (await manager.status());
  assert.equal(view.status, 'connected');
  assert.equal(view.toolCount, 3);
  assert.ok(!JSON.stringify(view).includes('access-0'));
  const entry = manager.connections.get(row.id);
  const definition = toolDefinition(manager, entry, entry.tools.find(tool => tool.name === 'execute_command'));
  const value = await definition.execute({ command: 'pwd', idempotency_key: 'operation-1' }, { signal: new AbortController().signal });
  assert.equal(value.structuredContent.status, 'awaiting_approval');
  assert.equal(value.structuredContent.action_id, 'action-1');
  assert.equal(value.structuredContent.evidence_pending, true);
  assert.equal(value.structuredContent.next_offset, 3);
  assert.equal(definition.isConcurrencySafe(), false);
  assert.equal(definition.name, 'mcp__jumpserver__execute_command');
  assert.equal((await stat(store.path)).mode & 0o777, 0o600);
  assert.match(renderResult({}, { content: [], structuredContent: { action_id: 'a' } })[0].text, /action_id/);
});

test('forged OAuth state is rejected without consuming the legitimate flow', async t => {
  const { manager, row } = await setup(t);
  const auth = await manager.authorize(row.id);
  const url = new URL(auth.authorizeUrl);
  const callback = new URL(url.searchParams.get('redirect_uri'));
  callback.searchParams.set('state', 'forged'); callback.searchParams.set('code', 'code');
  await assert.rejects(manager.oauth.complete(row.id, callback), { code: 'invalid_state' });
  assert.ok(manager.oauth.pending.has(row.id));
  assert.equal((await manager.store.get(row.id)).tokens, undefined);
});

test('equivalent JSON tool content is rendered once despite escaping and key order', () => {
  const structuredContent = { command: 'echo <ready> & done', action_id: 'a' };
  const content = [{ type: 'text', text: '{"action_id":"a","command":"echo \\u003cready\\u003e \\u0026 done"}' }];
  assert.equal(renderResult({}, { content, structuredContent })[0].text, JSON.stringify(structuredContent));
});

test('grouped tools expose object parameters without wrapping MCP arguments', async () => {
  const operation = value => ({ type: 'string', const: value });
  const branch = (value, properties, required = []) => ({ type: 'object', properties: {
    operation: operation(value), session_id: { type: 'string' }, ...properties,
  }, required: ['operation', 'session_id', ...required], additionalProperties: false });
  const inputSchema = { type: 'object', oneOf: [
    branch('list', { limit: { type: 'integer', description: 'Directory limit' } }),
    { oneOf: [
      branch('read', { path: { type: 'string' }, limit: { type: 'integer', description: 'Read limit' } }, ['path']),
      branch('read', { idempotency_key: { type: 'string' } }, ['idempotency_key']),
    ] },
  ] };
  const original = JSON.stringify(inputSchema);
  const calls = [];
  const manager = { call: async (...args) => { calls.push(args); return { content: [] }; } };
  const tool = toolDefinition(manager, { row: { id: 'connection', timeoutMs: 1000 } }, { name: 'file_read', inputSchema });
  assert.equal(tool.parameters.type, 'object');
  assert.equal(tool.parameters.oneOf, undefined);
  assert.deepEqual(tool.parameters.properties.operation.enum, ['list', 'read']);
  assert.deepEqual(tool.parameters.properties.limit, { type: 'integer', description: 'Directory limit' });
  assert.deepEqual(tool.parameters.required, ['operation', 'session_id']);
  assert.ok(tool.parameters.properties.path && tool.parameters.properties.idempotency_key);
  const args = { operation: 'list', session_id: 'session', limit: 10 };
  await tool.execute(args);
  assert.deepEqual(calls[0].slice(0, 3), ['connection', 'file_read', args]);
  assert.equal(JSON.stringify(inputSchema), original);
});

test('concurrent requests serialize refresh rotation across manager instances', async t => {
  const { remote, store, manager, row, authorize } = await setup(t);
  await authorize();
  await store.transaction(state => { state.connection.tokens.refreshAt = 0; });
  const other = new JumpServerManager({ store: new StateStore(store.path) });
  t.after(() => other.dispose());
  const tokens = await Promise.all(Array.from({ length: 12 }, (_, i) => (i % 2 ? manager : other).oauth.token(row.id)));
  assert.equal(new Set(tokens).size, 1);
  assert.equal(remote.state.refreshes, 1);
  assert.equal((await store.get(row.id)).tokens.refreshToken, 'refresh-1');
  await manager.call(row.id, 'search_assets', {});
});

test('invalid_grant stops spent-token retries and requires reauthorization', async t => {
  const { remote, store, manager, row, authorize } = await setup(t);
  await authorize();
  remote.state.denyRefresh = true;
  await store.transaction(state => { state.connection.tokens.refreshAt = 0; });
  await assert.rejects(manager.oauth.token(row.id), { code: 'invalid_grant' });
  await assert.rejects(manager.oauth.token(row.id), { code: 'needs_auth' });
  assert.equal(remote.state.refreshes, 1);
  assert.equal((await manager.status()).status, 'needs-auth');
});

test('401 refreshes once; an uncertain command response is never replayed', async t => {
  const { remote, store, manager, row, authorize } = await setup(t);
  await authorize();
  remote.state.access = 'server-requires-new-token';
  assert.ok(!(await manager.call(row.id, 'search_assets', {})).isError);
  assert.equal(remote.state.refreshes, 1);
  remote.state.dropCommand = true;
  const before = remote.state.calls;
  await assert.rejects(manager.call(row.id, 'execute_command', { command: 'pwd', idempotency_key: 'stable' }));
  assert.equal(remote.state.calls, before + 1);
  assert.equal((await store.get(row.id)).needsReauth, false);
});

test('disable and restart preserve credentials; endpoint edits invalidate them', async t => {
  const { store, manager, row, authorize } = await setup(t);
  await authorize();
  const clientId = (await store.get(row.id)).client.id;
  await manager.update(row.id, { enabled: false });
  assert.equal((await manager.status()).status, 'disabled');
  assert.ok((await store.get(row.id)).tokens);
  await manager.update(row.id, { enabled: true });
  assert.equal((await manager.status()).status, 'connected');
  assert.equal((await store.get(row.id)).client.id, clientId);
  const restart = new JumpServerManager({ store });
  t.after(() => restart.dispose());
  await manager.dispose(); await restart.start();
  assert.equal((await restart.status()).status, 'connected');
  await restart.update(row.id, { url: 'http://127.0.0.1:9/koko/mcp' });
  assert.equal((await store.get(row.id)).tokens, undefined);
  assert.equal((await store.get(row.id)).client, undefined);
});

test('revocation clears local tokens and client registration is reused', async t => {
  const { remote, store, manager, row, authorize } = await setup(t);
  await authorize();
  await authorize();
  assert.equal(remote.state.registrations, 1);
  await manager.logout(row.id);
  assert.equal(remote.state.revoked, true);
  assert.equal((await store.get(row.id)).tokens, undefined);
  assert.equal((await manager.status()).status, 'needs-auth');
});

test('a handshake completing after disable cannot restore tools', async t => {
  const { remote, manager, row, authorize } = await setup(t);
  await authorize();
  let release;
  remote.state.initializeGate = new Promise(resolve => { release = resolve; });
  const initializing = new Promise(resolve => { remote.state.initializing = resolve; });
  const connecting = manager.connect(row.id);
  const outcome = connecting.catch(error => error);
  await initializing;
  await manager.update(row.id, { enabled: false });
  release();
  await outcome;
  const view = (await manager.status());
  assert.equal(view.status, 'disabled');
  assert.equal(view.toolCount, 0);
  assert.equal(manager.retries.size, 0);
});

test('unloading during client registration closes the provisional callback listener', async t => {
  const { remote, manager, row } = await setup(t);
  let release;
  remote.state.registrationGate = new Promise(resolve => { release = resolve; });
  const registering = new Promise(resolve => { remote.state.registering = resolve; });
  const authorization = manager.authorize(row.id);
  const outcome = authorization.catch(error => error);
  await registering;
  await manager.dispose();
  release();
  assert.equal((await outcome).code, 'stale_authorization');
  assert.equal(manager.oauth.pending.size, 0);
});

test('native rendering includes structured action fields even with a short text result', () => {
  const text = renderResult({}, { content: [{ type: 'text', text: 'Accepted' }], structuredContent: { action_id: 'a', approval_url: 'http://example.com/approve' } })[0].text;
  assert.match(text, /Accepted/);
  assert.match(text, /action_id/);
  assert.match(text, /approval_url/);
});

test('state writes merge independently and corrupted state is not overwritten', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-jumpserver-store-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const store = new StateStore(join(directory, 'state.json'));
  await Promise.all(Array.from({ length: 6 }, (_, i) => new StateStore(store.path).transaction(state => { state[`writer${i}`] = i; })));
  assert.equal(Object.keys(await store.read()).filter(key => key.startsWith('writer')).length, 6);
  await writeFile(store.path, '{broken');
  await assert.rejects(store.transaction(() => {}), { code: 'state_read_failed' });
});

test('address validation and diagnostic redaction enforce the provider contract', () => {
  assert.equal(mcpUrl('http://example.com'), 'http://example.com/koko/mcp');
  assert.equal(loopbackOrigin('http://127.0.0.1:3000'), 'http://127.0.0.1:3000');
  assert.throws(() => loopbackOrigin('http://localhost:3000'));
  assert.throws(() => mcpUrl('http://example.com/koko/mcp/'));
  assert.throws(() => mcpUrl('http://user:password@example.com/koko/mcp'));
  assert.equal(redact('Authorization: Bearer private access_token=token refresh_token=rotated password=secret').includes('private'), false);
  assert.equal(redact('password=secret').includes('secret'), false);
});

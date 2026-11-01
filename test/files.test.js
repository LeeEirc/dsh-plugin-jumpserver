import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, realpath, rm, stat, writeFile, open, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { JumpServerManager } from '../lib/manager.js';
import { StateStore } from '../lib/store.js';
import { FileTransfers, MAX_FILE_BYTES } from '../lib/files.js';
import { toolDefinition, renderResult } from '../lib/tools.js';
import { provider } from './fixtures/provider.js';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');

async function setup(t) {
  const remote = await provider({ files: true });
  const directory = await mkdtemp(join(tmpdir(), 'dsh-jumpserver-file-test-'));
  const workspace = join(directory, 'workspace'), storage = join(directory, 'attachments');
  await mkdir(workspace); await mkdir(storage);
  const manager = new JumpServerManager({ store: new StateStore(join(directory, 'state.json')) });
  t.after(async () => { await manager.dispose(); await remote.close(); await rm(directory, { recursive: true, force: true }); });
  const row = await manager.add({ url: `${remote.base}/koko/mcp` });
  const auth = await manager.authorize(row.id);
  const response = await fetch(auth.authorizeUrl, { redirect: 'manual' });
  await manager.oauth.complete(row.id, new URL(response.headers.get('location')));
  // Small implementations of the native DSH attachment/filesystem service seams.
  const attachments = {
    saved: 0,
    fileHostPath: ref => join(storage, ref.attachmentId.slice(7), ref.name),
    async saveFileStream({ data, name, signal }) {
      const chunks = [];
      for await (const chunk of data) { signal?.throwIfAborted(); chunks.push(chunk); }
      const bytes = Buffer.concat(chunks);
      const ref = { attachmentId: `sha256:${sha(bytes)}`, bytes: bytes.length, name };
      const path = this.fileHostPath(ref);
      await mkdir(resolve(path, '..'), { recursive: true }); await writeFile(path, bytes);
      this.saved++;
      return ref;
    },
    async *readFileStream(ref, signal) {
      signal?.throwIfAborted();
      const bytes = await readFile(this.fileHostPath(ref));
      assert.equal(sha(bytes), ref.attachmentId.slice(7));
      yield bytes;
    },
  };
  const fs = {
    processPathFromHostPath: path => path,
    async resolve(path, { cwd = workspace } = {}) { const canonical = await realpath(resolve(cwd, path)); return { targetKey: canonical }; },
    contains(root, target) { const path = relative(root.targetKey, target.targetKey); return path === '' || (!path.startsWith('..') && !path.startsWith('/')); },
    async stat(target) { const value = await stat(target.targetKey); return { type: value.isFile() ? 'file' : 'directory', size: value.size, version: `${value.size}:${value.mtimeMs}` }; },
    async readByteRange(target, { offset, length }) {
      assert.ok(length <= 65536);
      const handle = await open(target.targetKey);
      try { const bytes = Buffer.alloc(length); const result = await handle.read(bytes, 0, length, offset); return bytes.subarray(0, result.bytesRead); }
      finally { await handle.close(); }
    },
  };
  const messages = [];
  const agent = { session: { header: { cwd: workspace }, deriveMessages: () => messages.slice() }, ctx: { get: key => ({ attachments, fs })[key] } };
  let key = 0;
  const call = async (name, args, owner = agent) => {
    const entry = manager.connections.get(row.id), tool = toolDefinition(manager, entry, entry.tools.find(t => t.name === name));
    const value = await tool.execute(args, { agent: owner, signal: AbortSignal.timeout(10000) });
    if (owner === agent) messages.push({ role: 'tool', content: tool.output.render(args, value) });
    return value;
  };
  const upload = local_path => call('file_write', { operation: 'upload', session_id: 'existing-sftp', remote_path: '/file.bin', local_path, idempotency_key: `upload-${key++}` });
  const download = () => call('file_read', { operation: 'download', session_id: 'existing-sftp', remote_path: '/file.bin', idempotency_key: `download-${key++}` });
  const query = (action_id, owner) => call('query_actions', { operation: 'get', action_id }, owner);
  const attach = async (bytes, name = 'input.bin') => {
    const ref = await attachments.saveFileStream({ data: [bytes], name });
    messages.push({ role: 'user', content: [{ type: 'file', attachment: ref }] });
    return attachments.fileHostPath(ref);
  };
  return { remote, manager, row, workspace, directory, attachments, fs, messages, agent, call, upload, download, query, attach };
}

test('conversation files use the existing MCP action and native attachment storage', async t => {
  const { remote, manager, attach, upload, download, query, attachments } = await setup(t);
  const bytes = Buffer.from([0, 255, 128, 3, 10]);
  const sent = await upload(await attach(bytes));
  assert.equal(sent.structuredContent.status, 'succeeded');
  assert.equal(sent.structuredContent.local_transfer.state, 'uploaded');
  assert.deepEqual(remote.state.fileBytes, bytes);
  assert.equal(remote.state.fileHeaders['content-length'], String(bytes.length));
  assert.equal(remote.state.fileHeaders['x-content-sha256'], sha(bytes));
  assert.equal(remote.state.fileHeaders.authorization, `Bearer ${remote.state.access}`);
  assert.equal(remote.state.toolCalls.find(c => c.name === 'file_write').args.local_path, undefined);
  remote.state.downloadPending = true;
  const pending = await download();
  remote.state.fileActions.get(pending.structuredContent.action_id).status = 'succeeded';
  const got = await query(pending.structuredContent.action_id);
  assert.equal(got.structuredContent.local_transfer.state, 'stored');
  assert.equal(got.file.name, 'file.bin');
  assert.deepEqual(await readFile(attachments.fileHostPath(got.file)), bytes);
  assert.ok(renderResult({}, got).some(b => b.type === 'file' && b.attachment === got.file));
  const requests = remote.state.fileRequests;
  await query(got.structuredContent.action_id);
  assert.equal(remote.state.fileRequests, requests);
  assert.ok(!remote.state.toolCalls.some(c => ['connect_asset', 'disconnect_asset'].includes(c.name)));
  assert.equal(manager.files.active, 0);
  assert.equal((await manager.status()).toolCount, 10);
});

test('approval resumes the same upload after restoring native tool results', async t => {
  const { remote, manager, workspace, upload, query, agent } = await setup(t);
  remote.state.fileApproval = true;
  const path = join(workspace, 'approved.bin');
  await writeFile(path, 'approved bytes');
  const pending = await upload(path);
  const id = pending.structuredContent.action_id;
  assert.equal(pending.structuredContent.status, 'awaiting_approval');
  assert.equal(remote.state.fileRequests, 0);
  await writeFile(path, 'changed after approval');
  remote.state.fileActions.get(id).status = 'queued';
  const stranger = { ...agent, session: { ...agent.session, deriveMessages: () => [] } };
  assert.equal((await query(id, stranger)).structuredContent.local_transfer.state, 'source_required');
  assert.equal(remote.state.fileRequests, 0);
  await manager.files.dispose(); manager.files = new FileTransfers(manager);
  remote.state.uploadPending = true;
  const resumed = await query(id);
  assert.equal(resumed.structuredContent.action_id, id);
  assert.equal(resumed.structuredContent.status, 'running');
  assert.equal(resumed.structuredContent.local_transfer.state, 'uploaded');
  assert.equal(remote.state.fileBytes.toString(), 'approved bytes');
  await query(id);
  assert.equal(remote.state.fileRequests, 1);
  assert.equal(remote.state.toolCalls.filter(c => c.name === 'file_write').length, 1);
});

test('query metadata cannot resume an upload with a different request hash', async t => {
  const { remote, manager, attach, upload, query } = await setup(t);
  remote.state.fileApproval = true;
  const pending = await upload(await attach(Buffer.from('registered bytes')));
  const action = remote.state.fileActions.get(pending.structuredContent.action_id);
  action.status = 'queued'; action.request_hash = 'different';
  await manager.files.dispose(); manager.files = new FileTransfers(manager);
  const result = await query(action.action_id);
  assert.equal(result.structuredContent.local_transfer.state, 'failed');
  assert.equal(remote.state.fileRequests, 0);
});

test('streaming 401 remains uncertain across resume and never replays bytes', async t => {
  const { remote, manager, row, attach, upload, query } = await setup(t);
  remote.state.denyFile = true;
  const value = await upload(await attach(Buffer.from('private bytes')));
  assert.equal(value.structuredContent.local_transfer.state, 'unknown');
  assert.equal(remote.state.fileRequests, 1);
  assert.equal(remote.state.refreshes, 0);
  await manager.files.dispose(); manager.files = new FileTransfers(manager);
  await query(value.structuredContent.action_id);
  assert.equal(remote.state.fileRequests, 1);
  remote.state.fileActions.get(value.structuredContent.action_id).status = 'succeeded';
  assert.equal((await query(value.structuredContent.action_id)).structuredContent.local_transfer.state, 'uploaded');
  assert.equal(remote.state.fileRequests, 1);
  await assert.rejects(manager.oauth.fileFetch(row.id, '../token'), { code: 'invalid_target' });
});

test('nested tool calls retain native files for approval recovery', async t => {
  const { remote, manager, row, agent, messages, attach, query } = await setup(t);
  remote.state.fileApproval = true;
  const entry = manager.connections.get(row.id);
  const tool = toolDefinition(manager, entry, entry.tools.find(t => t.name === 'file_write'));
  const value = await tool.execute({ operation: 'upload', session_id: 'existing-sftp', remote_path: '/nested.bin',
    local_path: await attach(Buffer.from('nested bytes')), idempotency_key: 'nested-upload' },
  { agent, signal: AbortSignal.timeout(10000), parent: {}, deferContext: message => messages.push(message) });
  assert.equal(messages.at(-1).source.kind, 'jumpserver-file-transfer');
  await manager.files.dispose(); manager.files = new FileTransfers(manager);
  remote.state.fileActions.get(value.structuredContent.action_id).status = 'queued';
  const recovered = await query(value.structuredContent.action_id);
  assert.equal(recovered.structuredContent.local_transfer.state, 'uploaded');
  assert.equal(remote.state.fileRequests, 1);
});

test('workspace uploads are snapshotted; foreign files and mismatched metadata are rejected', async t => {
  const { remote, call, workspace, directory, upload, attach, agent, attachments } = await setup(t);
  const bytes = Buffer.alloc(65540, 42), path = join(workspace, 'report.bin');
  await writeFile(path, bytes);
  await upload(path);
  assert.deepEqual(remote.state.fileBytes, bytes);
  const foreign = join(directory, 'private.bin'); await writeFile(foreign, 'secret');
  await symlink(foreign, join(workspace, 'escape'));
  const before = remote.state.calls;
  await assert.rejects(upload(join(workspace, 'escape')), { code: 'file_outside_session' });
  await assert.rejects(call('file_write', { operation: 'upload', local_path: path, size: 1 }), { code: 'source_mismatch' });
  const attached = await attach(Buffer.from('session-owned'));
  const stranger = { ...agent, session: { ...agent.session, deriveMessages: () => [] } };
  await assert.rejects(call('file_write', { operation: 'upload', local_path: attached }, stranger), { code: 'file_outside_session' });
  assert.equal(remote.state.calls, before);
  assert.ok(attachments.saved > 0);
});

test('invalid descriptors and corrupt downloads cannot publish a native file', async t => {
  const { remote, attachments, download } = await setup(t);
  remote.state.badTransfer = true;
  const invalid = await download();
  assert.equal(invalid.structuredContent.local_transfer.state, 'failed');
  assert.equal(remote.state.fileRequests, 0);
  remote.state.badTransfer = false; remote.state.badDownload = true;
  const corrupt = await download();
  assert.equal(corrupt.file, undefined);
  assert.equal(corrupt.structuredContent.local_transfer.state, 'failed');
  assert.equal(attachments.saved, 0);
  assert.match(corrupt.structuredContent.local_transfer.error, /SHA256/);
});

test('missing sources, oversize files and removed panel actions fail before transfer', async t => {
  const { remote, manager, upload, workspace, fs } = await setup(t);
  const before = remote.state.calls;
  await assert.rejects(upload(), { code: 'local_file_required' });
  const path = join(workspace, 'large.bin'); await writeFile(path, 'small');
  const ordinary = fs.stat;
  fs.stat = async target => ({ ...await ordinary(target), size: MAX_FILE_BYTES + 1 });
  await assert.rejects(upload(path), { code: 'invalid_file' });
  for (const action of ['file_assets', 'file_start', 'file_status', 'file_cancel']) {
    assert.equal((await manager.dispatch({ action })).error.code, 'invalid_action');
  }
  assert.equal(remote.state.calls, before);
});

test('changing a workspace source during snapshot cannot register an upload', async t => {
  const { remote, workspace, attachments, fs, upload } = await setup(t);
  const path = join(workspace, 'changing.bin'); await writeFile(path, 'original');
  const ordinary = fs.stat;
  let reads = 0;
  fs.stat = async target => ({ ...await ordinary(target), version: String(reads++) });
  const before = remote.state.calls;
  await assert.rejects(upload(path), { code: 'source_changed' });
  assert.equal(remote.state.calls, before);
  assert.equal(attachments.saved, 0);
});

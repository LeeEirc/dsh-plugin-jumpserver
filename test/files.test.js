import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { JumpServerManager } from '../lib/manager.js';
import { StateStore } from '../lib/store.js';
import { provider } from './fixtures/provider.js';

async function setup(t) {
  const remote = await provider({ files: true });
  const directory = await mkdtemp(join(tmpdir(), 'dsh-jumpserver-file-test-'));
  const manager = new JumpServerManager({ store: new StateStore(join(directory, 'state.json')) });
  t.after(async () => { await manager.dispose(); await remote.close(); await rm(directory, { recursive: true, force: true }); });
  const row = await manager.add({ url: `${remote.base}/koko/mcp` });
  const auth = await manager.authorize(row.id);
  const response = await fetch(auth.authorizeUrl, { redirect: 'manual' });
  await manager.oauth.complete(row.id, new URL(response.headers.get('location')));
  const input = { connectionId: row.id, assetId: 'asset', account: 'account-id', remotePath: '/file.bin' };
  return { remote, manager, row, input };
}

function uploadRequest(id, bytes) {
  return new Request(`http://dsh/api/jumpserver/files/upload?transferId=${id}`, { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: bytes });
}

test('browser bytes travel through authenticated file routes and verified downloads', async t => {
  const { remote, manager, input } = await setup(t);
  const bytes = Buffer.from([0, 255, 128, 3, 10]);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const upload = await manager.files.start({ ...input, kind: 'upload', size: bytes.length, sha256 });
  assert.equal(upload.phase, 'upload_ready');
  const posted = await manager.files.handle(uploadRequest(upload.id, bytes), 'upload');
  assert.equal((await posted.json()).value.phase, 'succeeded');
  assert.deepEqual(remote.state.fileBytes, bytes);
  assert.equal(remote.state.fileHeaders['content-length'], String(bytes.length));
  assert.equal(remote.state.fileHeaders['x-content-sha256'], sha256);
  assert.equal(remote.state.fileHeaders.authorization, `Bearer ${remote.state.access}`);

  const download = await manager.files.start({ ...input, kind: 'download' });
  assert.equal(download.phase, 'download_ready');
  const response = await manager.files.handle(new Request(`http://dsh/api/jumpserver/files/download?transferId=${download.id}`), 'download');
  assert.equal(response.status, 200);
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes);
  assert.equal(manager.files.active, 0);
});

test('approval blocks byte transfer and streaming 401 is never replayed', async t => {
  const { remote, manager, row, input } = await setup(t);
  const bytes = Buffer.from('private bytes');
  remote.state.fileApproval = true;
  const upload = await manager.files.start({ ...input, kind: 'upload', size: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
  assert.equal(upload.phase, 'awaiting_approval');
  assert.equal((await manager.files.handle(uploadRequest(upload.id, bytes), 'upload')).status, 409);
  assert.equal(remote.state.fileRequests, 0);
  remote.state.fileActions.get(upload.actionId).status = 'queued';
  assert.equal((await manager.files.status(upload.id)).phase, 'upload_ready');
  remote.state.denyFile = true;
  assert.equal((await manager.files.handle(uploadRequest(upload.id, bytes), 'upload')).status, 401);
  assert.equal(remote.state.fileRequests, 1);
  assert.equal(remote.state.refreshes, 0);
  assert.equal((await manager.files.handle(uploadRequest(upload.id, bytes), 'upload')).status, 409);
  assert.equal(remote.state.fileRequests, 1);
  await assert.rejects(manager.oauth.fileFetch(row.id, '../token'), { code: 'invalid_target' });
});

test('corrupt downloads are rejected before any file is delivered', async t => {
  const { remote, manager, input } = await setup(t);
  const download = await manager.files.start({ ...input, kind: 'download' });
  remote.state.badDownload = true;
  const response = await manager.files.handle(new Request(`http://dsh/api/jumpserver/files/download?transferId=${download.id}`), 'download');
  assert.equal(response.status, 409);
  assert.equal((await response.json()).error.code, 'download_mismatch');
  assert.equal(manager.files.active, 0);
});

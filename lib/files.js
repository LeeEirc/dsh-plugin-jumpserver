import { createHash, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdtemp, open, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, posix } from 'node:path';
import { Readable } from 'node:stream';
import { AdapterError, redact } from './http.js';

export const MAX_FILE_BYTES = 100 * 1024 * 1024;
const FINAL = new Set(['succeeded', 'failed', 'cancelled', 'rejected', 'expired', 'unknown']);

export function toolValue(result) {
  if (result.isError) throw new AdapterError(result.content.filter(x => x.type === 'text').map(x => x.text).join('\n'), 'tool_rejected');
  if (result.structuredContent && typeof result.structuredContent === 'object') return result.structuredContent;
  try { return JSON.parse(result.content.find(x => x.type === 'text')?.text); }
  catch { throw new AdapterError('JumpServer 未返回有效的操作状态', 'invalid_tool_result'); }
}

// Bytes use authenticated Connection routes, never JSON Remote/model arguments.
// Each transfer owns one SFTP session; no user-supplied host filesystem paths.
export class FileTransfers {
  constructor(manager) { this.manager = manager; this.transfers = new Map(); this.active = 0; this.disposed = false; }

  async call(record, name, args, signal) {
    return toolValue(await this.manager.call(record.connectionId, name, args, { signal }));
  }

  async record(id) {
    const record = this.transfers.get(id);
    if (!record || this.disposed || Date.now() - record.created > 15 * 60 * 1000) throw new AdapterError('文件传输已过期，请核对审计记录后重新操作', 'transfer_expired', 404);
    const row = await this.manager.store.get(record.connectionId);
    if (!row.enabled || row.revision !== record.revision || row.needsReauth) throw new AdapterError('连接配置已变更或需要重新授权', 'stale_transfer', 409);
    return record;
  }

  view(record) {
    const action = record.action || record.connection || {};
    return { id: record.id, phase: record.phase, status: action.status || record.phase, actionId: action.action_id,
      sessionId: record.sessionId, approvalUrl: ['awaiting_approval', 'awaiting_input'].includes(record.phase) ? action.approval_url || record.connection?.approval_url : undefined,
      auditUrl: action.audit_url, error: record.error || '', path: record.path, kind: record.kind };
  }

  async start(input) {
    for (const [id, record] of this.transfers) if (Date.now() - record.created > 15 * 60 * 1000) await this.cancel(id);
    if (this.disposed || this.transfers.size >= 8) throw new AdapterError('文件传输数量已达上限，请先关闭已完成的传输', 'transfer_limit');
    if (!['upload', 'download'].includes(input.kind) || typeof input.remotePath !== 'string' || !input.remotePath.startsWith('/') || input.remotePath.length > 4096 || /[\x00-\x1f\\]/.test(input.remotePath)) throw new AdapterError('请选择传输方向并填写绝对 SFTP 虚拟路径', 'invalid_path');
    if (!input.assetId || !input.account) throw new AdapterError('请选择已授权的资产和账号', 'invalid_account');
    if (input.kind === 'upload' && (!Number.isSafeInteger(input.size) || input.size < 0 || input.size > MAX_FILE_BYTES || !/^[a-f0-9]{64}$/.test(input.sha256))) throw new AdapterError('上传大小或 SHA256 无效，最多支持 100 MiB', 'invalid_file');
    const row = await this.manager.store.get(input.connectionId);
    const record = { id: randomUUID(), connectionId: row.id, revision: row.revision, created: Date.now(), kind: input.kind,
      path: input.remotePath, size: input.size, sha256: input.sha256, overwrite: input.overwrite === true,
      phase: 'connecting', controller: new AbortController(), key: randomUUID() };
    this.transfers.set(record.id, record);
    try {
      record.connection = await this.call(record, 'connect_asset', { asset_id: input.assetId, account: input.account, protocol: 'sftp', idempotency_key: `file-connect-${record.key}` }, record.controller.signal);
      record.sessionId = record.connection.session_id;
      return await this.status(record.id);
    } catch (error) {
      // The request may have reached Core. Do not recreate it with a new key.
      record.phase = error.code === 'tool_rejected' ? 'failed' : 'unknown'; record.error = redact(error.message);
      if (record.phase === 'failed') await this.closeSession(record);
      return this.view(record);
    }
  }

  async status(id) {
    const record = await this.record(id);
    if (record.busy || FINAL.has(record.phase) || ['upload_ready', 'download_ready'].includes(record.phase)) return this.view(record);
    record.busy = true;
    try {
      if (!record.action) {
        const state = await this.call(record, 'get_action', { action_id: record.connection.action_id }, record.controller.signal);
        record.connection = { ...record.connection, ...state };
        if (state.status !== 'succeeded') {
          record.phase = FINAL.has(state.status) ? state.status : state.status === 'awaiting_approval' || state.status === 'awaiting_input' ? state.status : 'connecting';
          record.error = state.result?.error || '';
          if (FINAL.has(record.phase)) await this.closeSession(record);
          return this.view(record);
        }
        const args = { session_id: record.sessionId, remote_path: record.path, idempotency_key: `file-action-${record.key}` };
        if (record.kind === 'upload') Object.assign(args, { size: record.size, sha256: record.sha256, overwrite: record.overwrite });
        record.args = args;
        record.action = await this.call(record, `${record.kind}_file`, args, record.controller.signal);
      } else {
        record.action = await this.call(record, 'get_action', { action_id: record.action.action_id }, record.controller.signal);
      }
      let state = record.action.status;
      if (record.kind === 'upload' && state === 'queued' && !record.uploadStarted) record.phase = 'upload_ready';
      else if (record.kind === 'download' && state === 'succeeded') record.phase = 'download_ready';
      else record.phase = state;
      record.error = record.action.result?.error || '';
      if (FINAL.has(record.phase)) await this.closeSession(record);
      return this.view(record);
    } catch (error) {
      record.phase = error.code === 'tool_rejected' ? 'failed' : 'unknown'; record.error = redact(error.message);
      return this.view(record);
    } finally { record.busy = false; }
  }

  async closeSession(record) {
    if (!record.sessionId || record.closed) return;
    record.closed = true;
    await this.manager.call(record.connectionId, 'disconnect_asset', { session_id: record.sessionId }, { signal: AbortSignal.timeout(5000) }).catch(() => {});
  }

  async cancel(id) {
    const record = this.transfers.get(id);
    if (!record) return { released: true };
    record.controller.abort();
    if (record.action?.action_id && !FINAL.has(record.action.status)) await this.manager.call(record.connectionId, 'cancel_action', { action_id: record.action.action_id }, { signal: AbortSignal.timeout(5000) }).catch(() => {});
    await this.closeSession(record);
    this.transfers.delete(id);
    return { released: true };
  }

  async upload(record, request) {
    if (record.kind !== 'upload' || record.phase !== 'upload_ready' || record.uploadStarted || !request.body) throw new AdapterError('上传尚未就绪或已提交，请查询原操作，不要重传', 'upload_not_ready', 409);
    record.uploadStarted = true;
    record.phase = 'running';
    const signal = AbortSignal.any([request.signal, record.controller.signal, AbortSignal.timeout(300000)]);
    const size = record.size;
    let received = 0;
    const reader = request.body.getReader();
    const body = new ReadableStream({
      async pull(controller) {
        try {
          const part = await reader.read();
          if (part.done) {
            if (received !== size) throw new AdapterError('上传字节数与登记大小不符', 'size_mismatch');
            controller.close(); return;
          }
          received += part.value.byteLength;
          if (received > size) throw new AdapterError('上传超过登记大小', 'size_mismatch');
          controller.enqueue(part.value);
        } catch (error) { await reader.cancel().catch(() => {}); controller.error(error); }
      },
      cancel(reason) { return reader.cancel(reason); }
    });
    const response = await this.manager.oauth.fileFetch(record.connectionId, 'upload', {
      method: 'POST', body, duplex: 'half', signal,
      headers: { 'Content-Type': 'application/octet-stream', 'Content-Length': String(size), 'X-Content-SHA256': record.sha256, 'X-JumpServer-Action-ID': record.action.action_id }
    });
    if (!response.ok) { await response.body?.cancel(); throw new AdapterError(`文件流上传返回 HTTP ${response.status}；请查询原操作后处理`, 'upload_failed', response.status); }
    // Ignore the accepted HTTP response as execution evidence; query get_action.
    await response.body?.cancel();
    return Response.json({ ok: true, value: await this.status(record.id) }, { headers: { 'Cache-Control': 'no-store' } });
  }

  async download(record, request) {
    if (record.kind !== 'download' || record.phase !== 'download_ready') throw new AdapterError('下载尚未完成，请先查询原操作', 'download_not_ready', 409);
    const signal = AbortSignal.any([request.signal, record.controller.signal, AbortSignal.timeout(300000)]);
    const response = await this.manager.oauth.fileFetch(record.connectionId, 'download', { method: 'GET', signal, headers: { 'X-JumpServer-Action-ID': record.action.action_id } });
    if (!response.ok) { await response.body?.cancel(); throw new AdapterError(`文件流下载返回 HTTP ${response.status}`, 'download_failed', response.status); }
    const size = Number(response.headers.get('content-length'));
    const digest = response.headers.get('x-content-sha256');
    const evidence = record.action.result;
    if (!response.ok || !response.headers.has('content-length') || !Number.isSafeInteger(size) || size < 0 || size > MAX_FILE_BYTES || !/^[a-f0-9]{64}$/.test(digest || '') || evidence?.size !== size || evidence?.sha256 !== digest) {
      await response.body?.cancel(); throw new AdapterError('下载响应与审计记录的大小或摘要不符', 'download_mismatch', 409);
    }
    const directory = await mkdtemp(join(tmpdir(), 'dsh-jumpserver-download-'));
    const path = join(directory, 'verified');
    let file;
    try {
      file = await open(path, 'wx', 0o600);
      const hash = createHash('sha256');
      let received = 0;
      if (!response.body) throw new AdapterError('下载缺少响应体', 'download_mismatch');
      for await (const chunk of response.body) {
        received += chunk.byteLength;
        if (received > size) throw new AdapterError('下载超过登记大小', 'download_mismatch', 409);
        hash.update(chunk); await file.writeFile(chunk);
      }
      await file.close(); file = null;
      if (received !== size || hash.digest('hex') !== digest) throw new AdapterError('下载字节数或 SHA256 校验失败', 'download_mismatch', 409);
      await this.closeSession(record);
      signal.throwIfAborted();
      const stream = createReadStream(path, { signal });
      stream.once('close', () => { rm(directory, { recursive: true, force: true }).catch(() => {}); });
      record.phase = 'succeeded';
      return new Response(Readable.toWeb(stream), { headers: { 'Content-Type': 'application/octet-stream', 'Content-Length': String(size),
        'X-Content-SHA256': digest, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(posix.basename(record.path) || 'download')}` } });
    } catch (error) {
      await file?.close().catch(() => {}); await rm(directory, { recursive: true, force: true }); throw error;
    }
  }

  async handle(request, kind) {
    if (this.active >= 2) return new Response('Too many active file streams', { status: 429 });
    this.active++;
    let record, claimed = false, streamingResponse = false;
    try {
      record = await this.record(new URL(request.url).searchParams.get('transferId'));
      if (record.streaming) throw new AdapterError('此文件正在传输', 'transfer_busy', 409);
      record.streaming = true;
      claimed = true;
      if (kind === 'upload' && request.headers.get('content-type')?.split(';')[0] !== 'application/octet-stream') throw new AdapterError('文件流类型必须为 application/octet-stream', 'invalid_content_type', 415);
      const response = await (kind === 'upload' ? this.upload(record, request) : this.download(record, request));
      if (kind === 'upload') return response;
      const reader = response.body.getReader();
      streamingResponse = true;
      let released = false;
      const release = () => { if (!released) { released = true; this.active--; record.streaming = false; } };
      reader.closed.then(release, release);
      return new Response(new ReadableStream({
        async pull(controller) {
          try {
            const part = await reader.read();
            if (part.done) { release(); controller.close(); }
            else controller.enqueue(part.value);
          } catch (error) { release(); controller.error(error); }
        },
        async cancel(reason) { try { await reader.cancel(reason); } finally { release(); } }
      }), { headers: response.headers });
    } catch (error) {
      if (claimed && record.uploadStarted) { record.phase = 'unknown'; record.error = redact(error.message); }
      else if (claimed && kind === 'download') { record.phase = 'failed'; record.error = redact(error.message); await this.closeSession(record); }
      return Response.json({ ok: false, error: { code: error.code || 'file_transfer_failed', message: redact(error.message) } }, { status: error.status || 400, headers: { 'Cache-Control': 'no-store' } });
    } finally { if (!streamingResponse) { this.active--; if (claimed) record.streaming = false; } }
  }

  async dispose() { this.disposed = true; await Promise.all([...this.transfers.keys()].map(id => this.cancel(id))); }
}

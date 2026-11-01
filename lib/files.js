import { createHash, randomUUID } from 'node:crypto';
import { posix } from 'node:path';
import { Readable } from 'node:stream';
import { isDeepStrictEqual } from 'node:util';
import { AdapterError, redact } from './http.js';

export const MAX_FILE_BYTES = 100 * 1024 * 1024;

function toolValue(result) {
  if (result.structuredContent && typeof result.structuredContent === 'object') return result.structuredContent;
  try { return JSON.parse(result.content.find(x => x.type === 'text')?.text); }
  catch { throw new AdapterError('JumpServer 未返回有效的操作状态', 'invalid_tool_result'); }
}

function digest(ref) {
  const match = /^sha256:([a-f0-9]{64})$/.exec(ref?.attachmentId);
  if (!match || !Number.isSafeInteger(ref.bytes) || ref.bytes < 0 || ref.bytes > MAX_FILE_BYTES) {
    throw new AdapterError('文件摘要或大小无效，最多支持 100 MiB', 'invalid_file');
  }
  return match[1];
}

function runtime(exec) {
  const session = exec?.agent?.session, ctx = exec?.agent?.ctx;
  const attachments = ctx?.get('attachments'), fs = ctx?.get('fs');
  if (!session || !attachments || !fs) throw new AdapterError('文件传输需要 DSH 会话、附件存储和文件系统', 'file_context_required');
  return { session, attachments, fs };
}

function localFile(env, attachment) {
  const sha256 = digest(attachment);
  const hostPath = env.attachments.fileHostPath(attachment);
  const path = hostPath && env.fs.processPathFromHostPath(hostPath);
  if (!path) throw new AdapterError('当前 DSH 文件系统无法访问此附件', 'file_unavailable');
  return { path, size: attachment.bytes, sha256, attachment };
}

function withAction(result, original, action) {
  return { ...result, structuredContent: action, content: result.content.map(block => {
    if (block.type === 'text') {
      try { if (isDeepStrictEqual(JSON.parse(block.text), original)) return { ...block, text: JSON.stringify(action) }; }
      catch { /* Preserve non-JSON server explanations. */ }
    }
    return block;
  }) };
}

// Only client-side bytes are handled here. MCP owns sessions, actions and approvals.
export class FileTransfers {
  constructor(manager) {
    this.manager = manager;
    this.sessions = new WeakMap();
    this.active = 0;
    this.controller = new AbortController();
  }

  async source(env, path, signal) {
    if (typeof path !== 'string' || !path || path.length > 4096 || /[\x00-\x1f]/.test(path)) {
      throw new AdapterError('上传需要 local_path，指向本会话附件或当前工作区文件', 'local_file_required');
    }
    for (const message of env.session.deriveMessages()) {
      for (const block of message.content) {
        if (block.type === 'file') {
          const hostPath = env.attachments.fileHostPath(block.attachment);
          if (hostPath && env.fs.processPathFromHostPath(hostPath) === path) return localFile(env, block.attachment);
        }
      }
    }
    const cwd = env.session.header.cwd;
    if (!cwd) throw new AdapterError('此会话没有工作区，请先在对话中上传附件', 'local_file_required');
    const target = await env.fs.resolve(path, { cwd, signal });
    const root = await env.fs.resolve(cwd, { signal });
    if (!env.fs.contains(root, target)) throw new AdapterError('仅允许上传当前工作区文件或本会话附件', 'file_outside_session');
    const info = await env.fs.stat(target, signal);
    if (info?.type !== 'file' || !Number.isSafeInteger(info.size) || info.size < 0 || info.size > MAX_FILE_BYTES) {
      throw new AdapterError('请选择不超过 100 MiB 的普通文件', 'invalid_file');
    }
    const fs = env.fs;
    async function* chunks() {
      let offset = 0;
      while (offset < info.size) {
        signal.throwIfAborted();
        const bytes = await fs.readByteRange(target, { offset, length: Math.min(65536, info.size - offset) }, signal);
        if (!bytes.byteLength || bytes.byteLength > info.size - offset) throw new AdapterError('上传源文件已改变', 'source_changed');
        offset += bytes.byteLength;
        yield bytes;
      }
      if ((await fs.stat(target, signal))?.version !== info.version) throw new AdapterError('上传源文件已改变', 'source_changed');
    }
    const attachment = await env.attachments.saveFileStream({ data: chunks(), name: posix.basename(path.replaceAll('\\', '/')), signal });
    return localFile(env, attachment);
  }

  record(env, connectionId, actionId) {
    let records = this.sessions.get(env.session);
    if (!records) this.sessions.set(env.session, records = new Map());
    const key = `${connectionId}:${actionId}`;
    if (records.has(key)) return records.get(key);
    this.makeRoom(records);
    const record = {};
    let restored = false;
    // Native tool results retain the attachment and byte-attempt evidence across resume.
    for (const message of env.session.deriveMessages().reverse()) {
      if (message.role !== 'tool' && message.source?.kind !== 'jumpserver-file-transfer') continue;
      for (const block of message.content) {
        if (block.type !== 'text' || block.text.length > 65536) continue;
        let action;
        try { action = JSON.parse(block.text); } catch { continue; }
        if (action?.action_id !== actionId || action.local_transfer?.connection_id !== connectionId) continue;
        if (action.request) record.registration ??= { request: action.request, hash: action.request_hash };
        if (restored) continue;
        const fileBlock = message.content.find(b => b.type === 'file' && isDeepStrictEqual(b.attachment, action.local_file?.attachment));
        if (fileBlock) {
          const file = localFile(env, fileBlock.attachment);
          if (action.kind === 'file_upload') record.source = file;
          else if (action.kind === 'file_download') record.download = file;
        }
        record.started = ['uploaded', 'unknown'].includes(action.local_transfer.state);
        record.uploaded = action.local_transfer.state === 'uploaded';
        restored = true;
      }
    }
    records.set(key, record);
    return record;
  }

  makeRoom(records) {
    if (records.size < 32) return;
    const disposable = [...records].find(([, value]) => !value.started || value.uploaded || value.download || value.settled);
    if (!disposable) throw new AdapterError('本会话存在过多未确认的文件传输，请先查询原操作', 'transfer_limit');
    records.delete(disposable[0]);
  }

  async execute(connectionId, name, input, exec) {
    const { local_path: path, ...args } = input;
    const uploading = name === 'file_write' && args.operation === 'upload';
    const downloading = name === 'file_read' && args.operation === 'download';
    const signal = AbortSignal.any([exec?.signal ?? AbortSignal.timeout(60000), this.controller.signal]);
    let env, source;
    if (path !== undefined && !uploading) throw new AdapterError('local_path 仅用于 file_write(operation=upload)', 'invalid_local_file');
    if (uploading || downloading) {
      env = runtime(exec);
      const records = this.sessions.get(env.session);
      if (records) this.makeRoom(records);
    }
    if (uploading) {
      source = await this.source(env, path, signal);
      if ((args.size !== undefined && args.size !== source.size) || (args.sha256 !== undefined && args.sha256 !== source.sha256)) {
        throw new AdapterError('上传大小或摘要与本地文件不符', 'source_mismatch');
      }
      Object.assign(args, { size: source.size, sha256: source.sha256 });
    }
    let result = await this.manager.call(connectionId, name, args, { signal });
    if (result.isError) return { result };
    const original = toolValue(result);
    if (!['file_upload', 'file_download'].includes(original.kind)) return { result };
    if (typeof original.action_id !== 'string' || !original.action_id) throw new AdapterError('文件操作缺少 action_id', 'invalid_tool_result');
    env ??= runtime(exec);
    const action = { ...original };
    delete action.local_file;
    delete action.local_transfer;
    const record = this.record(env, connectionId, action.action_id);
    if (source) record.source = source;
    if (action.request) record.registration = { request: action.request, hash: action.request_hash };
    if (action.kind === 'file_upload' && action.status === 'succeeded') record.uploaded = true;
    const transfer = action.transfer;
    let state = record.download ? 'stored' : record.uploaded ? 'uploaded' : record.started ? 'unknown' : 'pending';
    const previousState = state;
    let error;
    const row = await this.manager.store.get(connectionId);
    const kind = action.kind === 'file_upload' ? 'upload' : 'download';
    if (!row.enabled || row.needsReauth) throw new AdapterError('连接已停用或需要重新授权', 'stale_connection');
    if (record.busy) return { result };
    record.busy = true;
    try {
      if (transfer?.ready && !record.started && !record.download) {
        if (transfer.url !== `${row.url}/files/${kind}` || transfer.method !== (kind === 'upload' ? 'POST' : 'GET') || transfer.headers?.['X-JumpServer-Action-ID'] !== action.action_id) {
          throw new AdapterError('文件传输描述与当前操作不符', 'invalid_transfer');
        }
        if (kind === 'upload' && record.source) {
          // Paged queries omit the request. Reuse registration metadata only
          // when Core confirms the same immutable request hash.
          const request = action.request ?? (action.request_hash && action.request_hash === record.registration?.hash ? record.registration.request : undefined);
          if (action.status !== 'queued' || request?.size !== record.source.size || request?.sha256 !== record.source.sha256 ||
              (transfer.size ?? request?.size) !== record.source.size || (transfer.sha256 ?? request?.sha256) !== record.source.sha256) {
            throw new AdapterError('上传操作与本地文件不符', 'source_mismatch');
          }
          await this.stream(async () => {
            record.started = true;
            const response = await this.manager.oauth.fileFetch(connectionId, 'upload', { method: 'POST',
              body: Readable.from(env.attachments.readFileStream(record.source.attachment, signal)), duplex: 'half', signal,
              headers: { 'Content-Type': 'application/octet-stream', 'Content-Length': String(record.source.size), 'X-Content-SHA256': record.source.sha256, 'X-JumpServer-Action-ID': action.action_id } });
            await response.body?.cancel();
            if (!response.ok) throw new AdapterError(`文件上传返回 HTTP ${response.status}，请查询原操作，不要重传`, 'upload_failed');
            record.uploaded = true;
          });
          state = 'uploaded';
          // HTTP acceptance is only byte staging; Core still owns execution evidence.
          const refreshed = await this.manager.call(connectionId, 'query_actions', { operation: 'get', action_id: action.action_id }, { signal });
          if (refreshed.isError) throw new AdapterError('字节已提交，请查询原操作确认最终结果', 'upload_status_unavailable');
          result = refreshed;
          Object.assign(action, toolValue(result));
        } else if (kind === 'download') {
          if (action.status !== 'succeeded') throw new AdapterError('下载操作尚未成功', 'download_not_ready');
          record.download = await this.stream(() => this.download(env, connectionId, action, signal));
          state = 'stored';
        } else state = 'source_required';
      }
    } catch (failure) {
      state = record.uploaded ? 'uploaded' : record.started ? 'unknown' : 'failed';
      error = redact(failure.message);
    } finally { record.busy = false; }
    record.settled = ['succeeded', 'failed', 'cancelled', 'rejected', 'expired'].includes(action.status);
    const file = record.download || record.source;
    action.local_transfer = { connection_id: connectionId, state, ...(error ? { error } : {}) };
    if (file) action.local_file = file;
    // PTC composites otherwise retain only JSON; defer the native file to their outer result.
    if (exec?.parent && file && (source || state !== previousState)) exec.deferContext({ id: randomUUID(), role: 'user',
      source: { kind: 'jumpserver-file-transfer', form: 'notice', summary: `JumpServer file: ${file.attachment.name}`.slice(0, 120) },
      content: [{ type: 'text', text: JSON.stringify(action) }, { type: 'file', attachment: file.attachment }] });
    return { result: withAction(result, toolValue(result), action), file: file?.attachment };
  }

  async stream(work) {
    if (this.active >= 2) throw new AdapterError('同时最多传输两个文件，请稍后查询原操作', 'transfer_busy');
    this.active++;
    try { return await work(); } finally { this.active--; }
  }

  async download(env, connectionId, action, signal) {
    const size = action.result?.size, sha256 = action.result?.sha256;
    digest({ attachmentId: `sha256:${sha256}`, bytes: size });
    if (action.transfer.size !== size || action.transfer.sha256 !== sha256) throw new AdapterError('下载描述与审计结果不符', 'download_mismatch');
    const response = await this.manager.oauth.fileFetch(connectionId, 'download', { method: 'GET', signal, headers: { 'X-JumpServer-Action-ID': action.action_id } });
    try {
      if (!response.ok || !response.body || response.headers.get('content-length') !== String(size) || response.headers.get('x-content-sha256') !== sha256) {
        throw new AdapterError(`下载响应与审计结果不符（HTTP ${response.status}）`, 'download_mismatch');
      }
      async function* chunks() {
        let received = 0;
        const hash = createHash('sha256');
        for await (const chunk of response.body) {
          signal.throwIfAborted();
          received += chunk.byteLength;
          if (received > size) throw new AdapterError('下载超过登记大小', 'download_mismatch');
          hash.update(chunk);
          yield chunk;
        }
        if (received !== size || hash.digest('hex') !== sha256) throw new AdapterError('下载长度或 SHA256 校验失败', 'download_mismatch');
      }
      const attachment = await env.attachments.saveFileStream({ data: chunks(), signal, name: posix.basename(action.result?.file?.path || action.request?.path || 'download') });
      return localFile(env, attachment);
    } finally { await response.body?.cancel().catch(() => {}); }
  }

  async dispose() { this.controller.abort(); this.sessions = new WeakMap(); }
}

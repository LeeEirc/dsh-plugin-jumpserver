#!/usr/bin/env node
import { realpath } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { AdapterError, mcpUrl, redact } from './http.js';
import { JumpServerManager } from './manager.js';
import { StateStore } from './store.js';

function waitForConnection(manager, id, signal, timeoutMs) {
  return new Promise((resolve, reject) => {
    const finish = (error) => {
      clearTimeout(timer);
      manager.off('changed', check);
      signal.removeEventListener('abort', aborted);
      error ? reject(error) : resolve();
    };
    const aborted = () => finish(signal.reason);
    const check = () => {
      const entry = manager.connections.get(id);
      if (entry?.status === 'connected') finish();
      else if (['error', 'needs-auth'].includes(entry?.status)) {
        finish(new AdapterError(entry.error || 'JumpServer 连接未完成', 'connection_failed'));
      }
    };
    // The OAuth callback listener is unref'ed for the host; this bounded timer
    // keeps a standalone CLI alive while its user completes browser consent.
    const timer = setTimeout(() => finish(new AdapterError('授权已超时，请重新运行配置命令', 'authorization_expired')), timeoutMs);
    manager.on('changed', check);
    signal.addEventListener('abort', aborted, { once: true });
    if (signal.aborted) aborted();
    else check();
  });
}

export async function setupConnection(url, { store = new StateStore(), onAuthorize, signal, timeoutMs = 300000 } = {}) {
  const target = mcpUrl(url);
  const controller = new AbortController();
  const active = AbortSignal.any([controller.signal, ...(signal ? [signal] : [])]);
  const manager = new JumpServerManager({ store });
  const abort = () => { void manager.dispose(); };
  active.addEventListener('abort', abort, { once: true });
  try {
    active.throwIfAborted();
    let row = (await store.read()).connection;
    if (!row) {
      try { await manager.add({ url: target }); }
      catch (error) { if (error.code !== 'already_configured') throw error; }
      row = (await store.read()).connection;
    }
    if (row.url !== target) throw new AdapterError('已有 JumpServer 连接指向其他地址，请在插件页面确认修改；当前配置未覆盖', 'configuration_conflict');
    if (!row.enabled) throw new AdapterError('已有 JumpServer 连接已停用，请在插件页面手动启用', 'disabled');
    if (row.tokens && !row.needsReauth) {
      try { await manager.connect(row.id); }
      catch (error) {
        if (!(await store.get(row.id)).needsReauth) throw error;
      }
    }
    active.throwIfAborted();
    if (manager.connections.get(row.id)?.status !== 'connected') {
      if (typeof onAuthorize !== 'function') throw new AdapterError('需要浏览器授权，请使用配置命令或插件页面继续', 'needs_auth');
      const flow = await manager.authorize(row.id);
      active.throwIfAborted();
      await Promise.all([
        waitForConnection(manager, row.id, active, timeoutMs),
        Promise.resolve().then(() => onAuthorize(flow.authorizeUrl)),
      ]);
    }
    active.throwIfAborted();
    return { status: 'connected', tool_count: manager.connections.get(row.id).tools.length, next_step: 'reload_client' };
  } finally {
    active.removeEventListener('abort', abort);
    controller.abort();
    await manager.dispose();
  }
}

const usage = 'Usage: jumpserver-mcp setup --url <MCP URL> [--state-path <existing plugin state file>]';

async function main() {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: {
    url: { type: 'string' }, 'state-path': { type: 'string' }, help: { type: 'boolean', short: 'h' },
  } });
  if (values.help) { console.log(usage); return; }
  if (positionals.length !== 1 || positionals[0] !== 'setup' || !values.url) throw new AdapterError(usage, 'invalid_arguments');
  const controller = new AbortController();
  const stop = () => controller.abort(new AdapterError('配置已取消；已保存的连接可在下次继续使用', 'cancelled'));
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  try {
    const result = await setupConnection(values.url, {
      store: new StateStore(values['state-path']), signal: controller.signal,
      onAuthorize: url => console.log('Browser authorization: ' + url),
    });
    console.log(JSON.stringify(result));
    console.log('连接和工具发现已验证。请重新加载对应 DSH profile，或在 JumpServer 页面重新连接。');
  } finally {
    process.removeListener('SIGINT', stop);
    process.removeListener('SIGTERM', stop);
  }
}

if (process.argv[1] && await realpath(process.argv[1]).catch(() => '') === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error(JSON.stringify({ error: { code: error.code || 'setup_failed', message: redact(error.message) } }));
    process.exitCode = 1;
  });
}

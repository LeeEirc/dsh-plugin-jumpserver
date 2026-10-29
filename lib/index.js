import { TypertRemoteService, Remote } from '@deepseek-ai/dsh-typert-protocol';
import { JumpServerManager } from './manager.js';
import { StateStore } from './store.js';
import { loopbackOrigin } from './http.js';
import { registerBridge } from './tools.js';
import { remoteContract } from './remote-contract.js';

export const name = 'jumpserver';
export const inject = ['tools'];

const initializers = [];
export class JumpServerService extends TypertRemoteService {
  constructor(ctx, manager) {
    super(ctx, 'jumpserver');
    for (const initialize of initializers) initialize.call(this);
    this.manager = manager;
  }
  request(input) { return this.manager.dispatch(input); }
}
Remote(JumpServerService.prototype.request, { kind: 'method', name: 'request', static: false, private: false,
  addInitializer: fn => initializers.push(fn) });

export function apply(ctx, config = {}) {
  const manager = new JumpServerManager({ store: new StateStore(config.statePath) });
  new JumpServerService(ctx, manager);
  const bridge = registerBridge(ctx, manager);
  ctx.effect(() => ctx.inject(['connection'], child => {
    for (const kind of ['upload', 'download']) child.effect(() => child.connection.fetch.register({
      path: `/api/jumpserver/files/${kind}`,
      methods: [kind === 'upload' ? 'POST' : 'GET'],
      requestBody: kind === 'upload' ? 'streaming' : 'buffered',
      fetch: request => manager.files.handle(request, kind),
    }));
  }).dispose);
  ctx.effect(() => ctx.inject(['typert'], child => {
    child.effect(() => child.typert.register({ package: remoteContract.package, face: 'host', schemas: [],
      model: { services: [], events: [], objects: [] }, invocations: remoteContract.descriptors }));
  }).dispose);
  ctx.effect(() => ctx.inject(['webServer'], child => {
    child.effect(() => child.webServer.register({ kind: 'prefix', path: '/jumpserver', async handler(req, res) {
      const url = new URL(req.url, 'http://127.0.0.1');
      const callback = /^\/jumpserver\/callback\/([\w-]+)$/.exec(url.pathname);
      if (req.method === 'GET' && callback) { await manager.oauth.respond(callback[1], url, res); return; }
      if (url.pathname === '/jumpserver/api/ping' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ name: 'dsh-plugin-jumpserver', version: '0.2.0' })); return;
      }
      if (url.pathname !== '/jumpserver/api/request' || req.method !== 'POST') { res.writeHead(404); res.end(); return; }
      // Use the same explicit JSON POST contract in Web. Electron uses Remote/IPC.
      if (!String(req.headers['content-type'] || '').startsWith('application/json')) { res.writeHead(415); res.end(); return; }
      const origin = req.headers.origin;
      const host = req.headers.host;
      if (origin) {
        try { if (new URL(origin).host !== host) throw new Error('origin'); }
        catch { res.writeHead(403); res.end(); return; }
      }
      let body = '';
      try {
        for await (const chunk of req) { body += chunk; if (Buffer.byteLength(body) > 65536) throw new Error('请求超过 64 KiB'); }
        const input = JSON.parse(body);
        if (input.action === 'authorize' && config.callbackOrigin) input.options = { callbackOrigin: loopbackOrigin(config.callbackOrigin) };
        const result = await manager.dispatch(input);
        res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(result));
      } catch { res.writeHead(400, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: false, error: { code: 'invalid_request', message: '请求格式无效或超过大小限制' } })); }
    } }));
  }).dispose);
  ctx.effect(() => async () => { bridge(); await manager.dispose(); });
  manager.start().catch(error => ctx.logger.error(`jumpserver: ${error.code || 'startup_failed'}`));
}

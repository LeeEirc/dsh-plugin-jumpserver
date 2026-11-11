import { TypertRemoteService, Remote } from '@deepseek-ai/dsh-typert-protocol';
import { JumpServerManager } from './manager.js';
import { StateStore } from './store.js';
import { loopbackOrigin, redact } from './http.js';
import { registerBridge } from './tools.js';
import { remoteContract } from './remote-contract.js';
import { claimSingleton } from './singleton.js';
import { dirname, join } from 'node:path';
import { PluginUpdater } from './updater.js';
import { openBrowser } from './browser.js';
import { PLUGIN_PACKAGE, PLUGIN_VERSION } from './identity.js';

export const name = 'jumpserver';
export const inject = ['tools'];

const initializers = [];
export class JumpServerService extends TypertRemoteService {
  constructor(ctx, manager, updater) {
    super(ctx, 'jumpserver');
    for (const initialize of initializers) initialize.call(this);
    this.manager = manager;
    this.updater = updater;
  }
  async request(input) {
    try {
      if (input?.action === 'update-status') return { ok: true, value: this.updater.status() };
      if (input?.action === 'check-update') return { ok: true, value: await this.updater.check() };
      if (input?.action === 'install-update') return { ok: true, value: await this.updater.install(input.version) };
      const result = await this.manager.dispatch(input);
      if (result.ok && input.action === 'authorize' && input.options?.openBrowser === true) {
        result.value.browserOpened = await openBrowser(result.value.authorizeUrl);
      }
      return result;
    } catch (error) { return { ok: false, error: { code: String(error.code || 'adapter_error'), message: redact(error.message) } }; }
  }
}
Remote(JumpServerService.prototype.request, { kind: 'method', name: 'request', static: false, private: false,
  addInitializer: fn => initializers.push(fn) });

export function apply(ctx, config = {}) {
  claimSingleton(ctx, 'host');
  const manager = new JumpServerManager({ store: new StateStore(config.statePath) });
  const updater = new PluginUpdater({ directory: join(dirname(manager.store.path), 'jumpserver-updates'),
    getInstaller: () => ctx.get('pluginManager') });
  new JumpServerService(ctx, manager, updater);
  const bridge = registerBridge(ctx, manager);
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
        res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ name: PLUGIN_PACKAGE, version: PLUGIN_VERSION })); return;
      }
      if (url.pathname !== '/jumpserver/api/request' || req.method !== 'POST') { res.writeHead(404); res.end(); return; }
      // Keep the connection HTTP API separate from authenticated host controls.
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

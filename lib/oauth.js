import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';
import { AdapterError, httpUrl, loopbackOrigin, oauthError, requestJson } from './http.js';
import { OAUTH_CLIENT_NAME } from './identity.js';

const SCOPE = 'agent:access';
const PERMANENT = new Set(['invalid_grant', 'invalid_client', 'unauthorized_client', 'invalid_target']);
const callbackPath = id => `/jumpserver/callback/${id}`;

function sameCallback(a, b) {
  const left = new URL(a), right = new URL(b);
  // JumpServer permits a changing loopback port, but fixes host, path and query.
  left.port = ''; right.port = '';
  return left.href === right.href;
}

function tokenPair(json, previous) {
  if (typeof json?.access_token !== 'string' || !json.access_token || String(json.token_type).toLowerCase() !== 'bearer') {
    throw new AdapterError('Token 响应缺少有效的 Bearer access_token', 'invalid_token_response');
  }
  const seconds = Number(json.expires_in ?? 3600);
  if (!Number.isFinite(seconds) || seconds <= 0) throw new AdapterError('Token 有效期无效', 'invalid_token_response');
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token || previous?.refreshToken || '',
    expiresAt: Date.now() + seconds * 1000,
    refreshAt: Date.now() + seconds * 1000 - Math.min(60000, seconds * 100),
  };
}

export class JumpServerOAuth {
  constructor(store, { fetchImpl = fetch, onAuthorized = async () => {}, onAuthError = () => {}, flowTimeoutMs = 300000 } = {}) {
    this.store = store;
    this.fetch = fetchImpl;
    this.onAuthorized = onAuthorized;
    this.onAuthError = onAuthError;
    this.flowTimeoutMs = flowTimeoutMs;
    this.pending = new Map();
    this.flowVersions = new Map();
    this.refreshes = new Map();
    this.unpersisted = new Set();
    this.disposed = false;
  }

  async discover(instance) {
    const endpoint = httpUrl(instance.url);
    const response = await this.fetch(endpoint, { headers: { Accept: 'application/json, text/event-stream' }, redirect: 'error', signal: AbortSignal.timeout(15000) });
    const challenge = response.headers.get('www-authenticate') || '';
    await response.body?.cancel();
    const advertised = /resource_metadata\s*=\s*"([^"]+)"/i.exec(challenge)?.[1];
    const candidates = [...new Set([advertised, `${endpoint.origin}/.well-known/oauth-protected-resource${endpoint.pathname}`, `${instance.url}/.well-known/oauth-protected-resource`].filter(Boolean))];
    let resource;
    for (const url of candidates) {
      const result = await requestJson(url, { fetchImpl: this.fetch });
      if (result.response.ok && result.json?.resource && result.json.authorization_servers?.length) { resource = result.json; break; }
    }
    if (!resource) throw new AdapterError('未发现 JumpServer OAuth 资源元数据', 'discovery_failed');
    if (resource.resource !== instance.url) throw new AdapterError('服务端 resource 与配置的 MCP 地址不一致，请使用对外公布的精确地址', 'resource_mismatch');
    const issuer = httpUrl(resource.authorization_servers[0]).href.replace(/\/$/, '');
    const issuerUrl = new URL(issuer);
    const metadataUrl = `${issuerUrl.origin}/.well-known/oauth-authorization-server${issuerUrl.pathname === '/' ? '' : issuerUrl.pathname}`;
    const { response: metadataResponse, json: md } = await requestJson(metadataUrl, { fetchImpl: this.fetch });
    if (!metadataResponse.ok || !md?.authorization_endpoint || !md.token_endpoint || md.issuer !== issuer) {
      throw new AdapterError('授权服务器元数据无效或 issuer 不匹配', 'discovery_failed');
    }
    if (!md.code_challenge_methods_supported?.includes('S256') || !md.scopes_supported?.includes(SCOPE)
        || !md.token_endpoint_auth_methods_supported?.includes('none')) {
      throw new AdapterError('授权服务器不支持 JumpServer public client / PKCE S256 / agent:access', 'unsupported_oauth');
    }
    const discovered = { issuer, resource: resource.resource, authorizationEndpoint: httpUrl(md.authorization_endpoint).href,
      tokenEndpoint: httpUrl(md.token_endpoint).href,
      registrationEndpoint: md.registration_endpoint ? httpUrl(md.registration_endpoint).href : '',
      revocationEndpoint: md.revocation_endpoint ? httpUrl(md.revocation_endpoint).href : '' };
    await this.store.transaction(state => {
      const row = state.connection;
      if (!row || row.revision !== instance.revision) throw new AdapterError('连接配置已变更，请重新授权', 'stale_connection');
      row.discovery = discovered;
    });
    return discovered;
  }

  cancel(id) {
    this.flowVersions.set(id, (this.flowVersions.get(id) || 0) + 1);
    const flow = this.pending.get(id);
    if (!flow) return;
    this.pending.delete(id);
    clearTimeout(flow.timer);
    flow.server?.close();
  }

  async begin(id, { callbackOrigin } = {}) {
    if (this.disposed) throw new AdapterError('插件已停止', 'disposed');
    this.cancel(id);
    const version = this.flowVersions.get(id);
    const assertCurrent = () => {
      if (this.disposed || this.flowVersions.get(id) !== version) throw new AdapterError('授权已取消或被新的授权替代', 'stale_authorization');
    };
    const instance = await this.store.get(id);
    const md = await this.discover(instance);
    assertCurrent();
    let server;
    let origin;
    try {
      if (callbackOrigin) origin = loopbackOrigin(callbackOrigin);
      else {
        server = createServer(async (req, res) => {
          const url = new URL(req.url, 'http://127.0.0.1');
          if (req.method !== 'GET' || url.pathname !== callbackPath(id)) { res.writeHead(404); res.end(); return; }
          await this.respond(id, url, res);
        });
        await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
        server.unref();
        origin = `http://127.0.0.1:${server.address().port}`;
      }
      const redirectUri = `${origin}${callbackPath(id)}`;
      // Serialize discovery's registration decision with other windows/processes.
      // Each caller still owns its own PKCE flow and changing loopback port.
      const client = await this.store.transaction(async state => {
        const row = state.connection;
        if (!row || row.revision !== instance.revision) throw new AdapterError('连接配置已变更，请重新授权', 'stale_connection');
        if (row.client?.id && row.client.resource === md.resource && row.client.issuer === md.issuer
            && sameCallback(row.client.redirectUri, redirectUri)) return row.client;
        if (!md.registrationEndpoint) throw new AdapterError('此站点未开启自动客户端注册，请在 JumpServer Agent / MCP 设置启用 DCR', 'registration_disabled');
        const { response, json } = await requestJson(md.registrationEndpoint, { method: 'POST', fetchImpl: this.fetch, body: {
          client_name: OAUTH_CLIENT_NAME, application_type: 'native',
          redirect_uris: [redirectUri], grant_types: ['authorization_code', 'refresh_token'],
          response_types: ['code'], token_endpoint_auth_method: 'none', scope: SCOPE,
        } });
        if (!response.ok || typeof json?.client_id !== 'string') throw oauthError(response, json, '客户端注册');
        row.client = { id: json.client_id, redirectUri, resource: md.resource, issuer: md.issuer };
        return row.client;
      });
      const state = randomBytes(32).toString('base64url');
      const verifier = randomBytes(48).toString('base64url');
      assertCurrent();
      const flow = { state, verifier, clientId: client.id, redirectUri, revision: instance.revision, md, server };
      flow.timer = setTimeout(() => {
        if (this.pending.get(id) === flow) { this.cancel(id); this.onAuthError(id, new AdapterError('授权已超时，请重新登录', 'authorization_expired')); }
      }, this.flowTimeoutMs);
      flow.timer.unref();
      this.pending.set(id, flow);
      const url = new URL(md.authorizationEndpoint);
      url.search = new URLSearchParams({ response_type: 'code', client_id: client.id, redirect_uri: redirectUri,
        scope: SCOPE, resource: md.resource, state, code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256' });
      return { authorizeUrl: url.href, expiresAt: Date.now() + this.flowTimeoutMs };
    } catch (error) { server?.close(); throw error; }
  }

  async complete(id, url) {
    const flow = this.pending.get(id);
    const state = url.searchParams.get('state') || '';
    if (!flow || Buffer.byteLength(state) !== Buffer.byteLength(flow.state) || !timingSafeEqual(Buffer.from(state), Buffer.from(flow.state))) {
      throw new AdapterError('授权状态无效或已过期，请重新发起登录', 'invalid_state');
    }
    this.cancel(id);
    const version = this.flowVersions.get(id);
    if (url.searchParams.has('error')) throw new AdapterError('用户取消授权或服务端拒绝授权', 'access_denied');
    const code = url.searchParams.get('code');
    if (!code) throw new AdapterError('授权回调缺少 code', 'invalid_callback');
    const { response, json } = await requestJson(flow.md.tokenEndpoint, { method: 'POST', fetchImpl: this.fetch, form: {
      grant_type: 'authorization_code', code, code_verifier: flow.verifier, client_id: flow.clientId,
      redirect_uri: flow.redirectUri, resource: flow.md.resource,
    } });
    if (!response.ok) throw oauthError(response, json, '换取 Token');
    if (this.disposed || this.flowVersions.get(id) !== version) throw new AdapterError('授权已取消', 'stale_authorization');
    const tokens = tokenPair(json);
    await this.store.transaction(state => {
      const row = state.connection;
      if (!row || row.revision !== flow.revision || row.client?.id !== flow.clientId) throw new AdapterError('连接配置已变更，请重新授权', 'stale_connection');
      row.tokens = tokens; row.needsReauth = false; row.lastRefreshError = '';
    });
    this.unpersisted.delete(id);
    await this.onAuthorized(id);
  }

  async respond(id, url, res) {
    const expectedFlow = this.pending.get(id);
    let message = '授权完成，可以关闭此页面并返回 DeepSeek Harness。';
    let status = 200;
    try { await this.complete(id, url); }
    catch (error) {
      status = 400; message = '授权未完成，请返回 DeepSeek Harness 查看状态并重试。';
      if (!['invalid_state', 'stale_authorization'].includes(error.code) && (!this.pending.get(id) || this.pending.get(id) === expectedFlow)) this.onAuthError(id, error);
    }
    res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'", 'Referrer-Policy': 'no-referrer' });
    res.end(`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>JumpServer 授权</title><body style="font:16px system-ui;padding:40px"><h1>JumpServer</h1><p>${message}</p></body></html>`);
  }

  async token(id, { force = false, failedAccessToken } = {}) {
    const current = await this.store.get(id);
    if (current.needsReauth || !current.tokens?.accessToken) throw new AdapterError('请先通过浏览器授权 JumpServer', 'needs_auth', 401);
    if (!force && Date.now() < current.tokens.refreshAt) return current.tokens.accessToken;
    if (this.unpersisted.has(id)) throw new AdapterError('刷新后的 Token 未能保存，请检查磁盘并重新授权', 'token_persistence_failed', 401);
    if (!this.refreshes.has(id)) {
      const refresh = this.store.transaction(async state => {
        const row = state.connection;
        if (!row?.tokens || row.revision !== current.revision || row.needsReauth) return { error: new AdapterError('请重新授权 JumpServer', 'needs_auth', 401) };
        if ((failedAccessToken && row.tokens.accessToken !== failedAccessToken && Date.now() < row.tokens.expiresAt)
            || (!force && Date.now() < row.tokens.refreshAt)) return { token: row.tokens.accessToken };
        if (!row.tokens.refreshToken) {
          row.needsReauth = true;
          return { error: new AdapterError('服务端未返回 refresh_token，请重新授权', 'needs_auth', 401) };
        }
        const { response, json } = await requestJson(row.discovery.tokenEndpoint, { method: 'POST', fetchImpl: this.fetch, form: {
          grant_type: 'refresh_token', refresh_token: row.tokens.refreshToken, client_id: row.client.id, resource: row.discovery.resource,
        } });
        if (!response.ok) {
          const error = oauthError(response, json, 'Token 刷新');
          row.lastRefreshError = error.code;
          if (PERMANENT.has(error.code)) row.needsReauth = true;
          return { error };
        }
        row.tokens = tokenPair(json, row.tokens); row.needsReauth = false;
        row.lastRefreshAt = Date.now(); row.lastRefreshError = '';
        // A failed disk write after this point must never replay the spent pair.
        this.unpersisted.add(id);
        return { token: row.tokens.accessToken };
      }).then(result => {
        if (result.error) throw result.error;
        this.unpersisted.delete(id);
        return result.token;
      }).finally(() => { this.refreshes.delete(id); });
      this.refreshes.set(id, refresh);
    }
    return this.refreshes.get(id);
  }

  async authorizedFetch(id, url, options = {}) {
    const instance = await this.store.get(id);
    if (new URL(url).href !== instance.url) throw new AdapterError('拒绝向 MCP 地址之外发送 Token', 'invalid_target');
    let token = await this.token(id);
    const request = async () => {
      if ((await this.store.get(id)).revision !== instance.revision) throw new AdapterError('连接配置已变更', 'stale_connection');
      const headers = new Headers(options.headers);
      headers.set('Authorization', `Bearer ${token}`);
      return this.fetch(url, { ...options, headers, redirect: 'error' });
    };
    let response = await request();
    if (response.status === 401) {
      await response.body?.cancel();
      token = await this.token(id, { force: true, failedAccessToken: token });
      response = await request();
    }
    return response;
  }

  async fileFetch(id, kind, options = {}) {
    if (!['upload', 'download'].includes(kind)) throw new AdapterError('无效的文件接口', 'invalid_target');
    const instance = await this.store.get(id);
    const headers = new Headers(options.headers);
    headers.set('Authorization', `Bearer ${await this.token(id)}`);
    if ((await this.store.get(id)).revision !== instance.revision) throw new AdapterError('连接配置已变更', 'stale_connection');
    // A streaming body is one-shot. Refresh beforehand, never replay on 401,
    // redirects, timeout or an uncertain response. URLs cannot come from a caller.
    return this.fetch(`${instance.url}/files/${kind}`, { ...options, headers, redirect: 'error' });
  }

  async revoke(id) {
    this.cancel(id);
    const row = await this.store.get(id);
    if (row.tokens && row.discovery?.revocationEndpoint && row.client?.id) {
      const { response, json } = await requestJson(row.discovery.revocationEndpoint, { method: 'POST', fetchImpl: this.fetch, form: {
        token: row.tokens.refreshToken || row.tokens.accessToken, token_type_hint: row.tokens.refreshToken ? 'refresh_token' : 'access_token', client_id: row.client.id,
      } });
      if (!response.ok) throw oauthError(response, json, '撤销授权');
    }
    await this.store.transaction(state => {
      const current = state.connection;
      if (current?.revision === row.revision) { delete current.tokens; current.needsReauth = true; }
    });
  }

  dispose() { this.disposed = true; for (const id of this.pending.keys()) this.cancel(id); }
}

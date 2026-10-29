export class AdapterError extends Error {
  constructor(message, code = 'adapter_error', status = 400) {
    super(message);
    this.name = 'AdapterError';
    this.code = code;
    this.status = status;
  }
}

export function httpUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw new AdapterError('请输入完整的 HTTP 或 HTTPS 地址', 'invalid_url'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.hash) {
    throw new AdapterError('地址必须使用 HTTP/HTTPS，且不能包含凭据或片段', 'invalid_url');
  }
  return url;
}

export function mcpUrl(value) {
  const url = httpUrl(String(value ?? '').trim());
  if (url.search) throw new AdapterError('MCP 地址不能包含查询参数', 'invalid_url');
  if (url.pathname === '/') url.pathname = '/koko/mcp';
  if (url.pathname.endsWith('/')) throw new AdapterError('MCP 地址末尾不能带斜线', 'invalid_url');
  return url.href;
}

export function loopbackOrigin(value) {
  const url = httpUrl(value);
  if (url.protocol !== 'http:' || !['127.0.0.1', '[::1]'].includes(url.hostname)
      || url.pathname !== '/' || url.search) {
    throw new AdapterError('OAuth 回调 origin 必须为 http://127.0.0.1:端口 或 http://[::1]:端口', 'invalid_callback');
  }
  return url.origin;
}

export function redact(value) {
  return String(value ?? '')
    .replace(/Bearer\s+[^\s"',;]+/gi, 'Bearer <redacted>')
    .replace(/([?&](?:code|state|token|access_token|refresh_token|client_secret)=)[^&\s"']*/gi, '$1<redacted>')
    .replace(/("?(?:access_token|refresh_token|client_secret|password|code_verifier)"?\s*[:=]\s*)"?[^"\s,}]+"?/gi, '$1<redacted>')
    .slice(0, 600);
}

export async function requestJson(url, { method = 'GET', body, form, timeoutMs = 20000, fetchImpl = fetch } = {}) {
  httpUrl(url);
  const headers = { Accept: 'application/json' };
  let data;
  if (form) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    data = new URLSearchParams(form);
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    data = JSON.stringify(body);
  }
  const response = await fetchImpl(url, { method, headers, body: data, redirect: 'error', signal: AbortSignal.timeout(timeoutMs) });
  const reader = response.body?.getReader();
  const chunks = [];
  let size = 0;
  try {
    if (reader) for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 2 * 1024 * 1024) throw new AdapterError('服务端响应超过 2 MiB', 'response_too_large');
      chunks.push(value);
    }
  } finally {
    if (reader) { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  }
  let json;
  try { json = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { /* HTTP status is still useful for discovery. */ }
  return { response, json };
}

export function oauthError(response, json, phase) {
  const code = typeof json?.error === 'string' && /^[\w-]{1,80}$/.test(json.error) ? json.error : `http_${response.status}`;
  return new AdapterError(`${phase}失败（${code}）`, code, response.status === 429 ? 429 : 400);
}

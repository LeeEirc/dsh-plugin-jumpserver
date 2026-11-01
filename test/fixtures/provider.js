import { createServer } from 'node:http';
import { createHash } from 'node:crypto';

export async function provider({ files = false } = {}) {
  const state = { registrations: 0, refreshes: 0, calls: 0, denyRefresh: false, access: 'access-0', refresh: 'refresh-0', grants: new Map(), dropCommand: false };
  let base;
  const tools = [
    { name: 'search_assets', description: 'Find permitted assets', inputSchema: { type: 'object', properties: { limit: { type: 'integer' } } } },
    { name: 'execute_command', description: 'Submit an operation', inputSchema: { type: 'object', properties: { command: { type: 'string' }, idempotency_key: { type: 'string' } }, required: ['command', 'idempotency_key'] } },
    { name: 'query_actions', description: 'Read an action', inputSchema: { type: 'object', properties: { operation: { type: 'string', enum: ['get'] }, action_id: { type: 'string' } }, required: ['operation', 'action_id'] } },
  ];
  if (files) {
    for (const name of ['connect_asset', 'disconnect_asset', 'query_sessions', 'file_write', 'file_read', 'cancel_action', 'open_terminal']) tools.push({ name, inputSchema: { type: 'object', additionalProperties: true } });
    state.fileActions = new Map(); state.fileRequests = 0;
    state.fileBytes = Buffer.from('verified file\0\xff\n中文');
    state.toolCalls = [];
  }
  const json = (res, code, value) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(value)); };
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, base);
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const bytes = Buffer.concat(chunks);
    const text = bytes.toString();
    if (files && url.pathname.startsWith('/koko/mcp/files/')) {
      state.fileRequests++;
      state.fileHeaders = req.headers;
      if (req.headers.authorization !== `Bearer ${state.access}` || state.denyFile) { res.writeHead(401); res.end(); return; }
      const action = state.fileActions.get(req.headers['x-jumpserver-action-id']);
      if (!action) { res.writeHead(404); res.end(); return; }
      if (url.pathname.endsWith('/upload')) {
        if (action.status !== 'queued' || bytes.length !== action.request.size || createHash('sha256').update(bytes).digest('hex') !== action.request.sha256) { res.writeHead(409); res.end(); return; }
        state.fileBytes = bytes; action.status = state.uploadPending ? 'running' : 'succeeded'; action.result = { size: bytes.length, sha256: action.request.sha256 };
        json(res, 200, action); return;
      }
      const payload = state.badDownload ? Buffer.alloc(state.fileBytes.length, 0) : state.fileBytes;
      res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Length': String(payload.length), 'X-Content-SHA256': action.result.sha256 });
      res.end(payload); return;
    }
    if (url.pathname.endsWith('oauth-protected-resource') || url.pathname === '/.well-known/oauth-protected-resource/koko/mcp') {
      json(res, 200, { resource: `${base}/koko/mcp`, authorization_servers: [base], scopes_supported: ['agent:access'] }); return;
    }
    if (url.pathname === '/.well-known/oauth-authorization-server') {
      json(res, 200, { issuer: base, authorization_endpoint: `${base}/authorize`, token_endpoint: `${base}/token`,
        registration_endpoint: `${base}/register`, revocation_endpoint: `${base}/revoke`, scopes_supported: ['agent:access'],
        code_challenge_methods_supported: ['S256'], token_endpoint_auth_methods_supported: ['none'] }); return;
    }
    if (url.pathname === '/register') {
      state.registrations++; state.registration = JSON.parse(text);
      if (state.registrationGate) { state.registering?.(); await state.registrationGate; }
      json(res, 201, { client_id: 'public-client' }); return;
    }
    if (url.pathname === '/authorize') {
      state.authorization = Object.fromEntries(url.searchParams);
      const code = `code-${state.grants.size}`;
      state.grants.set(code, state.authorization);
      const callback = new URL(url.searchParams.get('redirect_uri'));
      callback.searchParams.set('state', url.searchParams.get('state'));
      callback.searchParams.set('code', code);
      res.writeHead(302, { Location: callback.href }); res.end(); return;
    }
    if (url.pathname === '/token') {
      const form = new URLSearchParams(text);
      if (form.get('resource') !== `${base}/koko/mcp` || form.get('client_id') !== 'public-client' || form.has('client_secret')) {
        json(res, 400, { error: 'invalid_target' }); return;
      }
      if (form.get('grant_type') === 'authorization_code') {
        const grant = state.grants.get(form.get('code'));
        if (!grant || form.get('redirect_uri') !== grant.redirect_uri || createHash('sha256').update(form.get('code_verifier')).digest('base64url') !== grant.code_challenge) {
          json(res, 400, { error: 'invalid_grant' }); return;
        }
      } else {
        state.refreshes++;
        await new Promise(resolve => setTimeout(resolve, 30));
        if (state.denyRefresh || form.get('refresh_token') !== state.refresh) { json(res, 400, { error: 'invalid_grant' }); return; }
        state.access = `access-${state.refreshes}`; state.refresh = `refresh-${state.refreshes}`;
      }
      json(res, 200, { token_type: 'Bearer', access_token: state.access, refresh_token: state.refresh, expires_in: 3600 }); return;
    }
    if (url.pathname === '/revoke') { state.revoked = true; res.writeHead(200); res.end(); return; }
    if (url.pathname === '/koko/mcp') {
      if (req.headers.authorization !== `Bearer ${state.access}` || state.revoked) {
        res.writeHead(401, { 'WWW-Authenticate': `Bearer resource_metadata="${base}/koko/mcp/.well-known/oauth-protected-resource", scope="agent:access"` }); res.end(); return;
      }
      if (req.method !== 'POST') { res.writeHead(405); res.end(); return; }
      const rpc = JSON.parse(text);
      if (rpc.id === undefined) { res.writeHead(202); res.end(); return; }
      let result;
      if (rpc.method === 'initialize') {
        if (state.initializeGate) { state.initializing?.(); await state.initializeGate; }
        result = { protocolVersion: rpc.params.protocolVersion, serverInfo: { name: 'jumpserver-test', version: '1' }, capabilities: { tools: {} }, instructions: 'Keep action_id and query_actions.' };
      }
      else if (rpc.method === 'tools/list') result = { tools };
      else if (rpc.method === 'tools/call') {
        state.calls++;
        if (state.dropCommand && rpc.params.name === 'execute_command') { req.socket.destroy(); return; }
        let value = rpc.params.name === 'search_assets' ? { results: [] } : { action_id: 'action-1', status: 'awaiting_approval', approval_url: `${base}/approval`, audit_status: 'pending', next_offset: 3, evidence_pending: true };
        if (files) {
          const { name, arguments: args } = rpc.params;
          state.toolCalls.push({ name, args });
          if (name === 'search_assets') value = { results: [{ id: 'asset', name: 'asset', accounts: [{ id: 'account-id', name: 'root', username: 'root', protocols: ['ssh', 'sftp'] }] }] };
          if (name === 'connect_asset') {
            value = { session_id: 'file-session', action_id: `connect-${state.calls}`, status: 'ready' };
            state.fileActions.set(value.action_id, { ...value, status: 'succeeded' });
          }
          if ((name === 'file_write' && args.operation === 'upload') || (name === 'file_read' && args.operation === 'download')) {
            value = { action_id: `${args.operation}-${state.calls}`, kind: args.operation === 'upload' ? 'file_upload' : 'file_download', session_id: args.session_id,
              status: args.operation === 'upload' ? state.fileApproval ? 'awaiting_approval' : 'queued' : state.downloadPending ? 'accepted' : 'succeeded', request: { path: args.remote_path, size: args.size, sha256: args.sha256, overwrite: args.overwrite },
              request_hash: createHash('sha256').update(JSON.stringify(args)).digest('hex'),
              result: { file: { path: args.remote_path }, size: state.fileBytes.length, sha256: createHash('sha256').update(state.fileBytes).digest('hex') } };
            state.fileActions.set(value.action_id, value);
          }
          if (name === 'query_actions' && args.operation === 'get') value = state.fileActions.get(args.action_id) || value;
          if (name === 'disconnect_asset') value = { session_id: args.session_id, status: 'closed' };
          if (name === 'cancel_action') value = { action_id: args.action_id, status: 'cancelled' };
          if (['file_upload', 'file_download'].includes(value.kind)) {
            const upload = value.kind === 'file_upload', metadata = upload ? value.request : value.result;
            value = { ...value, transfer: { url: `${base}/koko/mcp/files/${upload ? 'upload' : 'download'}`, method: upload ? 'POST' : 'GET',
              ready: upload ? value.status === 'queued' : value.status === 'succeeded', headers: { 'X-JumpServer-Action-ID': value.action_id },
              size: metadata.size, sha256: metadata.sha256 } };
            if (state.badTransfer) value.transfer.url = `${base}/untrusted`;
            if (name === 'query_actions') {
              delete value.request;
              if (upload) { delete value.transfer.size; delete value.transfer.sha256; }
            }
          }
        }
        result = { content: [{ type: 'text', text: JSON.stringify(value) }], structuredContent: value };
      } else { json(res, 200, { jsonrpc: '2.0', id: rpc.id, error: { code: -32601, message: 'Method not found' } }); return; }
      json(res, 200, { jsonrpc: '2.0', id: rpc.id, result }); return;
    }
    res.writeHead(404); res.end();
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
  return { base, state, tools, close: () => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }) };
}

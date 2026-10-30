import React from 'react';
import { remoteContract } from '../lib/remote-contract.js';
import { FileTransfer } from './files.js';
import { DISPLAY_NAME, PLUGIN_ID } from '../lib/identity.js';
import { claimSingleton } from '../lib/singleton.js';

const h = React.createElement;
export const inject = ['remote'];
const zh = {
  title: 'JumpServer', intro: '连接 JumpServer，在浏览器中授权后使用获准访问的资产工具。',
  url: 'JumpServer / MCP 地址', timeout: '工具调用超时（毫秒）', save: '保存配置', cancel: '取消',
  authorize: '浏览器授权', open: '打开授权页面', connect: '重新连接', edit: '编辑', disable: '停用', enable: '启用', logout: '撤销授权', remove: '清除配置',
  connected: '已连接', 'needs-auth': '待授权', authorizing: '等待浏览器授权', connecting: '连接中', disabled: '已停用', disconnected: '未连接', error: '连接失败',
  tools: '工具', logs: '诊断日志', empty: '配置一个 JumpServer 地址后即可授权连接。', none: '暂无日志', expires: 'Token 到期', refreshed: '最近刷新',
  deleteQuestion: '清除 JumpServer 连接配置及本地 Token？服务端授权可先通过“撤销授权”撤销。', logoutQuestion: '撤销 JumpServer 的 OAuth 授权？',
  authHint: '在新页面登录并确认可访问组织的授权。授权完成后本页会自动更新。',
  fileTransfer: '文件上传与下载', fileRootHint: '路径从 SFTP 虚拟根目录 / 开始，与 SSH 中的系统路径可能不同。每次传输最多 100 MiB。',
  fileSearch: '搜索资产', fileAsset: '资产', fileAccount: 'SFTP 账号', fileChoose: '请选择', filePath: '远端文件路径', fileSelect: '选择本机文件',
  fileOverwrite: '允许覆盖已有文件', fileUpload: '上传文件', fileDownload: '下载文件', fileContinue: '继续查询', fileClose: '关闭记录',
  fileNoSftp: '此资产没有可用的 SFTP 账号，请先检查资产和账号授权。', fileSizeLimit: '请选择不超过 100 MiB 的文件。',
  fileSecureContext: '请通过 HTTPS 或本机地址访问 DSH，以校验上传文件的 SHA256。',
  fileConnecting: '正在建立 SFTP 会话', fileRunning: '操作处理中，可稍后继续查询', fileApproval: '需要在 JumpServer 完成人工确认后继续',
  fileReady: '已准备传输', fileSucceeded: '传输完成并已校验', fileFailed: '传输失败，请查看审计记录', fileCancelled: '已取消',
  fileUnknown: '暂时无法确认结果，请查看原操作审计，不要重新提交', fileOpenApproval: '打开审批或凭据页面', fileAudit: '查看操作审计',
};
const en = {
  title: 'JumpServer', intro: 'Connect JumpServer and authorize in your browser to use permitted asset tools.',
  url: 'JumpServer / MCP URL', timeout: 'Tool call timeout (ms)', save: 'Save configuration', cancel: 'Cancel',
  authorize: 'Authorize in browser', open: 'Open authorization page', connect: 'Reconnect', edit: 'Edit', disable: 'Disable', enable: 'Enable', logout: 'Revoke authorization', remove: 'Clear configuration',
  connected: 'Connected', 'needs-auth': 'Authorization required', authorizing: 'Waiting for browser', connecting: 'Connecting', disabled: 'Disabled', disconnected: 'Disconnected', error: 'Connection failed',
  tools: 'Tools', logs: 'Diagnostics', empty: 'Configure a JumpServer URL to authorize and connect.', none: 'No diagnostics yet', expires: 'Token expires', refreshed: 'Last refreshed',
  deleteQuestion: 'Clear the JumpServer configuration and local tokens? Revoke authorization first to revoke the server grant.', logoutQuestion: 'Revoke JumpServer OAuth authorization?',
  authHint: 'Sign in and authorize access to your available organizations in the new page. This page updates automatically.',
  fileTransfer: 'Upload and download files', fileRootHint: 'Paths start at the virtual SFTP root /, which may differ from SSH paths. Maximum 100 MiB per transfer.',
  fileSearch: 'Search assets', fileAsset: 'Asset', fileAccount: 'SFTP account', fileChoose: 'Select', filePath: 'Remote file path', fileSelect: 'Choose a local file',
  fileOverwrite: 'Allow overwriting an existing file', fileUpload: 'Upload file', fileDownload: 'Download file', fileContinue: 'Check progress', fileClose: 'Close record',
  fileNoSftp: 'No authorized SFTP account is available on this asset. Check asset and account permissions.', fileSizeLimit: 'Choose a file no larger than 100 MiB.',
  fileSecureContext: 'Open DSH over HTTPS or a loopback address to verify the upload SHA256.',
  fileConnecting: 'Connecting SFTP session', fileRunning: 'Operation pending; check progress again shortly', fileApproval: 'Complete the human step in JumpServer, then continue',
  fileReady: 'Ready to transfer', fileSucceeded: 'Transfer completed and verified', fileFailed: 'Transfer failed; inspect the audit record', fileCancelled: 'Cancelled',
  fileUnknown: 'Result is uncertain. Inspect the original audit record before submitting another operation.', fileOpenApproval: 'Open approval or credentials page', fileAudit: 'View operation audit',
};

const css = `.jsm{max-width:850px;color:var(--dsw-alias-label-primary);display:flex;flex-direction:column;gap:16px}.jsm p{margin:0;color:var(--dsw-alias-label-secondary);line-height:1.6}.jsm h3{margin:0;font-size:16px}.jsm-card,.jsm-form{border:1px solid var(--dsw-alias-border-l2);border-radius:10px;padding:16px;background:var(--dsw-alias-bg-layer-3);display:flex;flex-direction:column;gap:12px}.jsm-head,.jsm-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.jsm-head strong{flex:1}.jsm-status{font-size:12px;border-radius:6px;padding:3px 8px;background:var(--dsw-alias-bg-layer-1)}.jsm-status[data-state=connected]{color:var(--dsw-alias-state-success-primary)}.jsm-error{color:var(--dsw-alias-state-error-primary);font-size:13px;overflow-wrap:anywhere}.jsm-url{font-size:12px;overflow-wrap:anywhere;color:var(--dsw-alias-label-tertiary)}.jsm label{font-size:13px;display:flex;flex-direction:column;gap:6px}.jsm-file-transfer{display:flex;flex-direction:column;gap:10px;margin-top:12px}.jsm select{font:inherit;padding:8px;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-1)}.jsm input{font:inherit;padding:8px 10px;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-1)}.jsm button{font:inherit;font-size:12px;padding:6px 10px;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-1);cursor:pointer}.jsm button:disabled{opacity:.5;cursor:default}.jsm .jsm-primary{background:var(--dsw-alias-state-business-primary);color:white;border-color:transparent}.jsm small{font-size:11px;color:var(--dsw-alias-label-tertiary)}.jsm details{font-size:12px}.jsm summary{cursor:pointer}.jsm pre{max-height:220px;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;font-size:11px}.jsm li{margin:8px 0}.jsm a{color:var(--dsw-alias-state-business-primary)}`;

function Settings({ request, t }) {
  const [connection, setConnection] = React.useState(null);
  const [loaded, setLoaded] = React.useState(false);
  const [error, setError] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [editing, setEditing] = React.useState(false);
  const [values, setValues] = React.useState({ url: '', timeoutMs: '60000' });
  const [authorization, setAuthorization] = React.useState(null);
  const [logs, setLogs] = React.useState([]);
  const refresh = React.useCallback(async () => {
    const row = await request({ action: 'status' });
    setConnection(row); setLoaded(true);
    setAuthorization(previous => previous && row?.status === 'authorizing' ? previous : null);
  }, [request]);
  React.useEffect(() => {
    let active = true, running = false;
    const poll = async () => {
      if (running || !active) return;
      running = true;
      try {
        const row = await request({ action: 'status' });
        if (active) { setConnection(row); setLoaded(true); }
      } catch (e) { if (active) setError(e.message); }
      finally { running = false; }
    };
    poll();
    const timer = setInterval(poll, 2500);
    return () => { active = false; clearInterval(timer); };
  }, [request]);
  const run = async work => {
    setBusy(true); setError('');
    try { await work(); await refresh(); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };
  const authorize = () => {
    const popup = window.open('about:blank', '_blank');
    if (popup) popup.opener = null;
    run(async () => {
      try {
        const options = {};
        if (location.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(location.hostname)) {
          const callback = new URL(location.origin);
          if (callback.hostname === 'localhost') callback.hostname = '127.0.0.1';
          options.callbackOrigin = callback.origin;
        }
        const result = await request({ action: 'authorize', id: connection.id, options });
        setAuthorization(result);
        if (popup) popup.location.href = result.authorizeUrl;
      } catch (e) { popup?.close(); throw e; }
    });
  };
  const field = (key, type = 'text') => h('label', { key }, t(key === 'timeoutMs' ? 'timeout' : key),
    h('input', { type, required: true, value: values[key], 'aria-label': t(key === 'timeoutMs' ? 'timeout' : key),
      placeholder: key === 'url' ? 'https://jumpserver.example.com/koko/mcp' : undefined,
      min: type === 'number' ? 1000 : undefined, max: type === 'number' ? 600000 : undefined,
      onChange: event => setValues(old => ({ ...old, [key]: event.target.value })) }));
  const action = (label, handler, extra = {}) => h('button', { type: 'button', disabled: busy || !loaded, onClick: handler, ...extra }, t(label));
  return h('section', { className: 'jsm', 'data-jumpserver-settings': true },
    h('h3', null, t('title')), h('p', null, t('intro')),
    error && h('div', { className: 'jsm-error', role: 'alert' }, error),
    (!connection || editing) && h('form', { className: 'jsm-form', onSubmit: event => { event.preventDefault(); run(async () => {
      await request({ ...(connection ? { action: 'update', id: connection.id } : { action: 'add' }), values });
      setEditing(false); setValues({ url: '', timeoutMs: '60000' });
    }); } }, field('url'), field('timeoutMs', 'number'),
    h('div', { className: 'jsm-actions' }, h('button', { className: 'jsm-primary', type: 'submit', disabled: busy || !loaded }, t('save')),
      connection && action('cancel', () => setEditing(false)))),
    loaded && !connection && h('p', null, t('empty')),
    connection && h('article', { className: 'jsm-card', 'data-connection': PLUGIN_ID },
      h('div', { className: 'jsm-head' }, h('strong', null, DISPLAY_NAME), h('span', { className: 'jsm-status', 'data-state': connection.status }, `${t(connection.status)}${connection.status === 'connected' ? ` · ${connection.toolCount} ${t('tools')}` : ''}`)),
      h('div', { className: 'jsm-url' }, connection.url),
      connection.error && h('div', { className: 'jsm-error' }, connection.error),
      h('div', { className: 'jsm-actions' },
        connection.enabled && action('authorize', authorize, { className: 'jsm-primary' }),
        connection.enabled && action('connect', () => run(() => request({ action: 'connect', id: connection.id }))),
        action('edit', () => { setEditing(true); setValues({ url: connection.url, timeoutMs: String(connection.timeoutMs) }); }),
        action(connection.enabled ? 'disable' : 'enable', () => run(() => request({ action: 'update', id: connection.id, values: { enabled: !connection.enabled } }))),
        action('logout', () => { if (window.confirm(t('logoutQuestion'))) run(() => request({ action: 'logout', id: connection.id })); }),
        action('remove', () => { if (window.confirm(t('deleteQuestion'))) run(async () => {
          await request({ action: 'remove', id: connection.id });
          setEditing(false); setAuthorization(null); setLogs([]); setValues({ url: '', timeoutMs: '60000' });
        }); })),
      authorization && connection.status === 'authorizing' && h('p', null, t('authHint'), ' ', h('a', { href: authorization.authorizeUrl, target: '_blank', rel: 'noopener noreferrer' }, t('open'))),
      connection.expiresAt && h('small', null, `${t('expires')}: ${new Date(connection.expiresAt).toLocaleString()}${connection.lastRefreshAt ? ` · ${t('refreshed')}: ${new Date(connection.lastRefreshAt).toLocaleString()}` : ''}`),
      connection.status === 'connected' && h(FileTransfer, { request, t, connectionId: connection.id }),
      h('details', null, h('summary', null, `${t('tools')} (${connection.toolCount})`), h('ul', null, ...connection.tools.map(tool => h('li', { key: tool.name }, h('code', null, tool.name), h('p', null, tool.description))))),
      h('details', { onToggle: event => { if (event.currentTarget.open) request({ action: 'logs', id: connection.id }).then(setLogs).catch(e => setError(e.message)); } },
        h('summary', null, t('logs')), h('pre', null, logs.map(log => `${new Date(log.at).toLocaleTimeString()} [${log.phase}] ${log.message}`).join('\n') || t('none'))),
    ),
  );
}

function registerSettings(ctx) {
  ctx.effect(() => ctx.locale.register('jumpserver', { zh, en }));
  const request = async input => {
    const remote = await ctx.remote.jumpserver.request(input);
    if (!remote.ok) throw new Error(remote.error.message || remote.error.code);
    const result = remote.value;
    if (!result.ok) throw new Error(result.error.message);
    return result.value;
  };
  const t = ctx.locale.bind('jumpserver');
  if (!document.querySelector('style[data-jumpserver]')) {
    const style = document.createElement('style'); style.dataset.jumpserver = 'true'; style.textContent = css; document.head.appendChild(style);
    ctx.effect(() => () => style.remove());
  }
  ctx.slots.inject('settings.section', () => ctx.slots.register({ name: 'settings.section', id: 'jumpserver', order: 51, label: () => t('title'), locale: 'jumpserver' }, () => h(Settings, { request, t })));
}

export async function apply(ctx) {
  claimSingleton(ctx, 'client');
  const unmount = await ctx.remote.$mount(remoteContract);
  const ui = ctx.inject(['remote.jumpserver', 'slots', 'locale'], registerSettings);
  try { await ui; }
  catch (error) { await ui.dispose(); await unmount(); throw error; }
  return async () => { await ui.dispose(); await unmount(); };
}

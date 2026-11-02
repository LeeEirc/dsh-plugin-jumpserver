import React from 'react';
import { remoteContract } from '../lib/remote-contract.js';
import { DISPLAY_NAME, PLUGIN_ID, TOOL_PREFIX } from '../lib/identity.js';
import { claimSingleton } from '../lib/singleton.js';

const h = React.createElement;
export const inject = ['remote'];
const zh = {
  title: 'JumpServer', intro: '连接 JumpServer，在浏览器中授权后使用获准访问的资产工具。',
  connection: '连接概览', configuration: '连接设置', loading: '正在读取连接…',
  url: 'JumpServer / MCP 地址', timeout: '工具调用超时（毫秒）', save: '保存配置', cancel: '取消',
  authorize: '浏览器授权', open: '打开授权页面', connect: '重新连接', edit: '编辑', disable: '停用', enable: '启用', logout: '撤销授权', remove: '清除配置',
  connected: '已连接', 'needs-auth': '待授权', authorizing: '等待浏览器授权', connecting: '连接中', disabled: '已停用', disconnected: '未连接', error: '连接失败',
  tools: '工具', toolsHint: '在 DSH 会话中使用以下工具，展开可查看说明。', noTools: '连接成功后，这里会显示可用的工具。',
  logs: '诊断日志', refresh: '刷新', empty: '配置一个 JumpServer 地址后即可授权连接。', none: '暂无日志', expires: 'Token 到期', refreshed: '最近刷新',
  deleteQuestion: '清除 JumpServer 连接配置及本地 Token？服务端授权可先通过“撤销授权”撤销。', logoutQuestion: '撤销 JumpServer 的 OAuth 授权？',
  authHint: '在新页面登录并确认可访问组织的授权。授权完成后本页会自动更新。',
};
const en = {
  title: 'JumpServer', intro: 'Connect JumpServer and authorize in your browser to use permitted asset tools.',
  connection: 'Connection overview', configuration: 'Connection settings', loading: 'Loading connection…',
  url: 'JumpServer / MCP URL', timeout: 'Tool call timeout (ms)', save: 'Save configuration', cancel: 'Cancel',
  authorize: 'Authorize in browser', open: 'Open authorization page', connect: 'Reconnect', edit: 'Edit', disable: 'Disable', enable: 'Enable', logout: 'Revoke authorization', remove: 'Clear configuration',
  connected: 'Connected', 'needs-auth': 'Authorization required', authorizing: 'Waiting for browser', connecting: 'Connecting', disabled: 'Disabled', disconnected: 'Disconnected', error: 'Connection failed',
  tools: 'Tools', toolsHint: 'Use these tools in DSH conversations. Expand a tool to read its description.', noTools: 'Available tools will appear after connecting.',
  logs: 'Diagnostics', refresh: 'Refresh', empty: 'Configure a JumpServer URL to authorize and connect.', none: 'No diagnostics yet', expires: 'Token expires', refreshed: 'Last refreshed',
  deleteQuestion: 'Clear the JumpServer configuration and local tokens? Revoke authorization first to revoke the server grant.', logoutQuestion: 'Revoke JumpServer OAuth authorization?',
  authHint: 'Sign in and authorize access to your available organizations in the new page. This page updates automatically.',
};

const css = `
.jsm-page{flex:1;min-height:0;overflow:auto;color:var(--dsw-alias-label-primary)}
.jsm{box-sizing:border-box;max-width:1040px;margin:0 auto;padding:32px;display:flex;flex-direction:column;gap:20px}
.jsm-title{padding-top:var(--dsh-frame-top-clearance,0px)}
.jsm h1{margin:0 0 8px;font-size:24px;line-height:1.4}.jsm h2{margin:0;font-size:16px;line-height:1.5}
.jsm p{margin:0;color:var(--dsw-alias-label-secondary);line-height:1.6}
.jsm-card{border:1px solid var(--dsw-alias-border-l2);border-radius:12px;padding:20px;background:var(--dsw-alias-bg-layer-3);display:flex;flex-direction:column;gap:16px;min-width:0}
.jsm-head,.jsm-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.jsm-head h2{flex:1}
.jsm-status{font-size:12px;border-radius:6px;padding:4px 8px;background:var(--dsw-alias-bg-layer-1)}.jsm-status[data-state=connected]{color:var(--dsw-alias-state-success-primary)}
.jsm-error{color:var(--dsw-alias-state-error-primary);font-size:13px;overflow-wrap:anywhere}.jsm-url{font-size:13px;overflow-wrap:anywhere;color:var(--dsw-alias-label-secondary)}
.jsm-form{display:flex;flex-direction:column;gap:16px}.jsm-fields{display:grid;grid-template-columns:minmax(0,1fr) minmax(160px,220px);gap:16px}
.jsm label{font-size:13px;display:flex;flex-direction:column;gap:8px}.jsm input{box-sizing:border-box;width:100%;font:inherit;padding:9px 12px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-1)}
.jsm button{font:inherit;font-size:13px;padding:7px 12px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-1);cursor:pointer}.jsm button:disabled{opacity:.5;cursor:default}.jsm button:focus-visible,.jsm input:focus-visible,.jsm summary:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:3px}
.jsm .jsm-primary{background:var(--dsw-alias-state-business-primary);color:white;border-color:transparent}.jsm .jsm-danger{color:var(--dsw-alias-state-error-primary)}
.jsm-management{padding-top:16px;border-top:1px solid var(--dsw-alias-border-l2)}.jsm small{font-size:12px;color:var(--dsw-alias-label-tertiary)}
.jsm-tool{border-top:1px solid var(--dsw-alias-border-l2);padding-top:12px}.jsm-tool summary{cursor:pointer;font-size:13px;overflow-wrap:anywhere}.jsm-tool p{font-size:13px;margin-top:10px;white-space:pre-wrap;overflow-wrap:anywhere}
.jsm pre{margin:0;max-height:300px;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px;line-height:1.7}.jsm a{color:var(--dsw-alias-state-business-primary)}
@media(max-width:640px){.jsm{padding:20px 16px;gap:16px}.jsm-card{padding:16px}.jsm-fields{grid-template-columns:minmax(0,1fr)}}
`;

function PanelIcon({ size = 20 }) {
  return h('svg', { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true },
    h('rect', { x: 3, y: 4, width: 18, height: 14, rx: 3 }),
    h('path', { d: 'm7 8 3 3-3 3m6 0h4M9 21h6m-3-3v3' }));
}

function JumpServerPage({ request, t }) {
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
    const entries = row ? await request({ action: 'logs', id: row.id }) : [];
    return { row, entries };
  }, [request]);
  const update = ({ row, entries }) => {
    setConnection(row); setLogs(entries); setLoaded(true);
    setAuthorization(previous => previous && row?.status === 'authorizing' ? previous : null);
  };
  React.useEffect(() => {
    let active = true, running = false;
    const poll = async () => {
      if (running || !active) return;
      running = true;
      try {
        const snapshot = await refresh();
        if (active) update(snapshot);
      } catch (e) { if (active) setError(e.message); }
      finally { running = false; }
    };
    poll();
    const timer = setInterval(poll, 2500);
    return () => { active = false; clearInterval(timer); };
  }, [refresh]);
  const run = async work => {
    setBusy(true); setError('');
    try { await work(); update(await refresh()); }
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
    h('input', { type, required: true, disabled: busy, value: values[key], 'aria-label': t(key === 'timeoutMs' ? 'timeout' : key),
      placeholder: key === 'url' ? 'https://jumpserver.example.com/koko/mcp' : undefined,
      min: type === 'number' ? 1000 : undefined, max: type === 'number' ? 600000 : undefined,
      onChange: event => setValues(old => ({ ...old, [key]: event.target.value })) }));
  const action = (label, handler, extra = {}) => h('button', { type: 'button', disabled: busy || !loaded, onClick: handler, ...extra }, t(label));
  const configuration = h('section', { className: 'jsm-card', id: 'jumpserver-configuration', 'aria-labelledby': 'jumpserver-configuration-title' },
    h('h2', { id: 'jumpserver-configuration-title' }, t('configuration')),
    !connection && h('p', null, t('empty')),
    h('form', { className: 'jsm-form', onSubmit: event => { event.preventDefault(); run(async () => {
      await request({ ...(connection ? { action: 'update', id: connection.id } : { action: 'add' }), values });
      setEditing(false); setValues({ url: '', timeoutMs: '60000' });
    }); } }, h('div', { className: 'jsm-fields' }, field('url'), field('timeoutMs', 'number')),
    h('div', { className: 'jsm-actions' }, h('button', { className: 'jsm-primary', type: 'submit', disabled: busy || !loaded }, t('save')),
      connection && action('cancel', () => setEditing(false)))),
    connection && h('div', { className: 'jsm-actions jsm-management' },
      action('logout', () => { if (window.confirm(t('logoutQuestion'))) run(() => request({ action: 'logout', id: connection.id })); }),
      action('remove', () => { if (window.confirm(t('deleteQuestion'))) run(async () => {
        await request({ action: 'remove', id: connection.id });
        setEditing(false); setAuthorization(null); setLogs([]); setValues({ url: '', timeoutMs: '60000' });
      }); }, { className: 'jsm-danger' })),
  );
  return h('div', { className: 'jsm-page', 'data-jumpserver-page': true }, h('main', { className: 'jsm', 'aria-label': DISPLAY_NAME },
    h('header', { className: 'jsm-title' }, h('h1', null, DISPLAY_NAME), h('p', null, t('intro'))),
    error && h('div', { className: 'jsm-error', role: 'alert' }, error),
    !loaded && h('p', { role: 'status' }, t('loading')),
    connection && h('section', { className: 'jsm-card', 'data-connection': PLUGIN_ID, 'aria-labelledby': 'jumpserver-connection-title' },
      h('div', { className: 'jsm-head' }, h('h2', { id: 'jumpserver-connection-title' }, t('connection')), h('span', { className: 'jsm-status', 'data-state': connection.status, role: 'status' }, t(connection.status))),
      h('div', { className: 'jsm-url' }, connection.url),
      connection.error && h('div', { className: 'jsm-error' }, connection.error),
      h('div', { className: 'jsm-actions' },
        connection.enabled && action('authorize', authorize, { className: 'jsm-primary' }),
        connection.enabled && action('connect', () => run(() => request({ action: 'connect', id: connection.id }))),
        action(connection.enabled ? 'disable' : 'enable', () => run(() => request({ action: 'update', id: connection.id, values: { enabled: !connection.enabled } }))),
        action('configuration', () => {
          if (!editing) setValues({ url: connection.url, timeoutMs: String(connection.timeoutMs) });
          setEditing(previous => !previous);
        }, { 'aria-expanded': editing, 'aria-controls': 'jumpserver-configuration' })),
      authorization && connection.status === 'authorizing' && h('p', null, t('authHint'), ' ', h('a', { href: authorization.authorizeUrl, target: '_blank', rel: 'noopener noreferrer' }, t('open'))),
      connection.expiresAt && h('small', null, `${t('expires')}: ${new Date(connection.expiresAt).toLocaleString()}${connection.lastRefreshAt ? ` · ${t('refreshed')}: ${new Date(connection.lastRefreshAt).toLocaleString()}` : ''}`)),
    loaded && (!connection || editing) && configuration,
    loaded && h('section', { className: 'jsm-card', 'aria-labelledby': 'jumpserver-tools-title' },
      h('h2', { id: 'jumpserver-tools-title' }, `${t('tools')} (${connection?.toolCount || 0})`),
      h('p', null, t(connection?.tools.length ? 'toolsHint' : 'noTools')),
      ...(connection?.tools || []).map(tool => h('details', { className: 'jsm-tool', key: tool.name },
        h('summary', null, h('code', null, `${TOOL_PREFIX}${tool.name}`)), h('p', null, tool.description)))),
    loaded && h('section', { className: 'jsm-card', 'aria-labelledby': 'jumpserver-logs-title' },
      h('div', { className: 'jsm-head' }, h('h2', { id: 'jumpserver-logs-title' }, t('logs')),
        action('refresh', () => run(async () => {}))),
      h('pre', null, logs.map(log => `${new Date(log.at).toLocaleTimeString()} [${log.phase}] ${log.message}`).join('\n') || t('none'))),
  ));
}

function registerPage(ctx) {
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
  ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: PLUGIN_ID, locale: 'jumpserver' }, () => h(JumpServerPage, { request, t })));
  ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({ name: 'sidebar.panellist', id: PLUGIN_ID, order: 51, label: () => t('title'), locale: 'jumpserver' }, PanelIcon));
}

export async function apply(ctx) {
  claimSingleton(ctx, 'client');
  const unmount = await ctx.remote.$mount(remoteContract);
  const ui = ctx.inject(['remote.jumpserver', 'slots', 'locale'], registerPage);
  try { await ui; }
  catch (error) { await ui.dispose(); await unmount(); throw error; }
  return async () => { await ui.dispose(); await unmount(); };
}

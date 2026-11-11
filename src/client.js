import React from 'react';
import { remoteContract } from '../lib/remote-contract.js';
import { DISPLAY_NAME, GITHUB_URL, PLUGIN_ID, PLUGIN_VERSION, TOOL_PREFIX } from '../lib/identity.js';
import { claimSingleton } from '../lib/singleton.js';
import { authorizeInBrowser } from '../lib/client-authorization.js';

const h = React.createElement;
export const inject = ['remote'];
const zh = {
  title: 'JumpServer', intro: '在 DeepSeek Harness 中连接 JumpServer，通过浏览器授权，让 Agent 使用你有权限的资产，执行命令、传输文件，并在需要时由你接管终端。',
  connection: '连接概览', configuration: '连接设置', loading: '正在读取连接…',
  url: 'JumpServer / MCP 地址', timeout: '工具调用超时（毫秒）', save: '保存配置', cancel: '取消',
  authorize: '浏览器授权', open: '打开授权页面', connect: '重新连接', edit: '编辑', disable: '停用', enable: '启用', logout: '撤销授权', remove: '清除配置',
  connected: '已连接', 'needs-auth': '待授权', authorizing: '等待浏览器授权', connecting: '连接中', disabled: '已停用', disconnected: '未连接', error: '连接失败',
  tools: '工具', toolsHint: '已接入对话，按需查看工具说明。', noTools: '连接后自动发现可用工具。', viewTools: '查看', collapseTools: '收起',
  tool_search_assets: '资产搜索', tool_connect_asset: '连接资产', tool_disconnect_asset: '断开连接', tool_execute_command: '执行命令',
  tool_query_actions: '操作查询', tool_query_sessions: '会话查询', tool_file_read: '文件读取', tool_file_write: '文件写入', tool_cancel_action: '取消操作', tool_open_terminal: '人工终端',
  logs: '诊断日志', refresh: '刷新', empty: '配置一个 JumpServer 地址后即可授权连接。', none: '暂无日志', expires: 'Token 到期', refreshed: '最近刷新',
  deleteQuestion: '撤销 JumpServer 授权并清除本地连接配置？', logoutQuestion: '撤销 JumpServer 的 OAuth 授权？',
  authHint: '在新页面登录并确认可访问组织的授权。授权完成后本页会自动更新。',
  authOpenFailed: '未能自动打开浏览器，请点击下方授权链接继续。',
  version: '插件版本', checkUpdate: '检查更新', checkingUpdate: '检查中…', installUpdate: '更新', installingUpdate: '更新中…',
  development: '开发版',
  upToDate: '暂无更新', updateUnavailable: '请在 DSH 插件管理中更新。',
  updated: '已更新', reload: '重新加载', restartRequired: '重启 DSH 后生效。',
};
const en = {
  title: 'JumpServer', intro: 'Connect JumpServer to DeepSeek Harness. Authorize in your browser so your agent can use permitted assets, run commands, transfer files, and hand the terminal over to you when needed.',
  connection: 'Connection overview', configuration: 'Connection settings', loading: 'Loading connection…',
  url: 'JumpServer / MCP URL', timeout: 'Tool call timeout (ms)', save: 'Save configuration', cancel: 'Cancel',
  authorize: 'Authorize in browser', open: 'Open authorization page', connect: 'Reconnect', edit: 'Edit', disable: 'Disable', enable: 'Enable', logout: 'Revoke authorization', remove: 'Clear configuration',
  connected: 'Connected', 'needs-auth': 'Authorization required', authorizing: 'Waiting for browser', connecting: 'Connecting', disabled: 'Disabled', disconnected: 'Disconnected', error: 'Connection failed',
  tools: 'Tools', toolsHint: 'Available in conversations. Browse details when needed.', noTools: 'Tools are discovered after connecting.', viewTools: 'View', collapseTools: 'Collapse',
  tool_search_assets: 'Search assets', tool_connect_asset: 'Connect asset', tool_disconnect_asset: 'Disconnect', tool_execute_command: 'Run command',
  tool_query_actions: 'Query operations', tool_query_sessions: 'Query sessions', tool_file_read: 'Read files', tool_file_write: 'Write files', tool_cancel_action: 'Cancel operation', tool_open_terminal: 'Human terminal',
  logs: 'Diagnostics', refresh: 'Refresh', empty: 'Configure a JumpServer URL to authorize and connect.', none: 'No diagnostics yet', expires: 'Token expires', refreshed: 'Last refreshed',
  deleteQuestion: 'Revoke JumpServer authorization and clear this connection?', logoutQuestion: 'Revoke JumpServer OAuth authorization?',
  authHint: 'Sign in and authorize access to your available organizations in the new page. This page updates automatically.',
  authOpenFailed: 'The browser could not open automatically. Use the authorization link below to continue.',
  version: 'Plugin version', checkUpdate: 'Check for updates', checkingUpdate: 'Checking…', installUpdate: 'Update', installingUpdate: 'Updating…',
  development: 'Development',
  upToDate: 'No updates available', updateUnavailable: 'Update through DSH plugin management.',
  updated: 'Updated', reload: 'Reload', restartRequired: 'Restart DSH to apply.',
};

const css = `
.jsm-page{flex:1;min-height:0;overflow:auto;color:var(--dsw-alias-label-primary)}
.jsm{box-sizing:border-box;max-width:1040px;margin:0 auto;padding:32px;display:flex;flex-direction:column;gap:20px}
.jsm-title{padding-top:var(--dsh-frame-top-clearance,0px)}
.jsm-title .jsm-head{justify-content:space-between}.jsm-title .jsm-head h1{margin:0}.jsm .jsm-title p{margin-top:8px}
.jsm-heading{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap}.jsm-version{font-size:12px;font-weight:400;white-space:nowrap;color:var(--dsw-alias-label-tertiary)}.jsm .jsm-version a{color:inherit}.jsm .jsm-version a:hover{color:var(--dsw-alias-state-business-primary)}
.jsm-header-actions{display:flex;align-items:center;gap:12px;flex-wrap:wrap}.jsm-header-actions>a{font-size:12px}.jsm-title .jsm-update-message{font-size:12px;overflow-wrap:anywhere}.jsm-title .jsm-update-message[data-error=true]{color:var(--dsw-alias-state-error-primary)}
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
.jsm-tools-card{padding:0;gap:0}.jsm-catalog{min-width:0}.jsm-catalog-summary{display:flex;align-items:center;gap:12px;padding:18px 20px;cursor:pointer;border-radius:12px;list-style:none}.jsm-catalog-summary:hover{background:var(--dsw-alias-bg-layer-1)}
.jsm-catalog summary::-webkit-details-marker{display:none}.jsm-catalog summary::marker{content:''}
.jsm-catalog-icon{display:flex;align-items:center;justify-content:center;flex:none;width:34px;height:34px;border-radius:9px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary)}
.jsm-catalog-title{display:flex;align-items:center;gap:8px}.jsm-count{padding:2px 7px;border-radius:5px;font-size:12px;line-height:1.4;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums}
.jsm-catalog-hint{flex:1;font-size:12px;color:var(--dsw-alias-label-tertiary);line-height:1.5}.jsm-catalog-toggle{display:flex;align-items:center;gap:6px;flex:none;font-size:12px;color:var(--dsw-alias-label-secondary)}
.jsm-chevron{flex:none;transition:transform .15s}.jsm-catalog[open]>.jsm-catalog-summary .jsm-chevron,.jsm-tool[open]>summary .jsm-chevron{transform:rotate(90deg)}
.jsm-catalog .jsm-when-open{display:none}.jsm-catalog[open]>.jsm-catalog-summary .jsm-when-open{display:inline}.jsm-catalog[open]>.jsm-catalog-summary .jsm-when-closed{display:none}
.jsm-catalog[open]>.jsm-catalog-summary{border-bottom:1px solid var(--dsw-alias-border-l2);border-radius:12px 12px 0 0}.jsm-tool-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));align-items:start;gap:8px;padding:16px}
.jsm-tool{min-width:0;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;overflow:hidden}.jsm-tool>summary{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:11px 12px;cursor:pointer;font-size:13px;line-height:1.5;list-style:none}.jsm-tool>summary:hover{background:var(--dsw-alias-bg-layer-1)}.jsm-tool>summary span{overflow-wrap:anywhere}.jsm-tool[open]{border-color:var(--dsw-alias-state-business-primary)}
.jsm-tool-body{max-height:180px;overflow:auto;padding:0 12px 12px}.jsm-tool-body code{display:block;overflow-wrap:anywhere;font-size:11px;color:var(--dsw-alias-label-tertiary);line-height:1.6}.jsm-tool-body p{font-size:12px;margin-top:8px;white-space:pre-wrap;overflow-wrap:anywhere}.jsm-catalog-empty{padding:16px 20px}
.jsm pre{margin:0;max-height:300px;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px;line-height:1.7}.jsm a{color:var(--dsw-alias-state-business-primary)}
@media(min-width:1100px){.jsm-tool-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media(max-width:800px){.jsm-catalog-summary{flex-wrap:wrap;gap:10px}.jsm-catalog-hint{order:1;flex-basis:100%;padding-left:44px}.jsm-catalog-toggle{margin-left:auto}}
@media(max-width:640px){.jsm{padding:20px 16px;gap:16px}.jsm-card{padding:16px}.jsm-fields{grid-template-columns:minmax(0,1fr)}.jsm-tools-card{padding:0}.jsm-catalog-summary{padding:16px}.jsm-tool-grid{grid-template-columns:minmax(0,1fr);padding:12px}}
@media(prefers-reduced-motion:reduce){.jsm-chevron{transition:none}}
`;

function PanelIcon({ size = 20 }) {
  return h('svg', { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true },
    h('rect', { x: 3, y: 4, width: 18, height: 14, rx: 3 }),
    h('path', { d: 'm7 8 3 3-3 3m6 0h4M9 21h6m-3-3v3' }));
}

function Chevron() {
  return h('svg', { className: 'jsm-chevron', width: 14, height: 14, viewBox: '0 0 20 20', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true },
    h('path', { d: 'm7.5 5 5 5-5 5' }));
}

const knownTools = new Set(['search_assets', 'connect_asset', 'disconnect_asset', 'execute_command', 'query_actions', 'query_sessions', 'file_read', 'file_write', 'cancel_action', 'open_terminal']);

function ToolsCatalog({ tools, t }) {
  return h('section', { className: 'jsm-card jsm-tools-card', 'aria-labelledby': 'jumpserver-tools-title' },
    h('details', { className: 'jsm-catalog' },
      h('summary', { className: 'jsm-catalog-summary' },
        h('span', { className: 'jsm-catalog-icon', 'aria-hidden': true }, h(PanelIcon, { size: 18 })),
        h('h2', { className: 'jsm-catalog-title', id: 'jumpserver-tools-title' }, t('tools'), h('span', { className: 'jsm-count' }, tools.length)),
        h('span', { className: 'jsm-catalog-hint' }, t(tools.length ? 'toolsHint' : 'noTools')),
        h('span', { className: 'jsm-catalog-toggle' }, h('span', { className: 'jsm-when-closed' }, t('viewTools')), h('span', { className: 'jsm-when-open' }, t('collapseTools')), h(Chevron))),
      tools.length ? h('div', { className: 'jsm-tool-grid' }, ...tools.map(tool => h('details', { className: 'jsm-tool', key: tool.name, name: 'jumpserver-tool-details' },
        h('summary', { title: tool.name }, h('span', null, knownTools.has(tool.name) ? t(`tool_${tool.name}`) : tool.name), h(Chevron)),
        h('div', { className: 'jsm-tool-body' }, h('code', null, `${TOOL_PREFIX}${tool.name}`), h('p', null, tool.description))))) : h('p', { className: 'jsm-catalog-empty' }, t('noTools'))));
}

function PluginHeader({ request, t, installBlocked, onInstallingChange }) {
  const [pluginUpdate, setPluginUpdate] = React.useState({ currentVersion: PLUGIN_VERSION });
  const [operation, setOperation] = React.useState('check-update');
  const [message, setMessage] = React.useState(null);
  React.useEffect(() => {
    let active = true;
    (async () => {
      try {
        const current = await request({ action: 'update-status' });
        if (!active) return;
        setPluginUpdate(current);
        if (current.needsRestart || current.installedVersion) return;
        const result = await request({ action: 'check-update' });
        if (active) setPluginUpdate(result);
      } catch (e) { if (active) setMessage({ text: e.message, error: true }); }
      finally { if (active) setOperation(null); }
    })();
    return () => { active = false; };
  }, [request]);
  const needsReload = pluginUpdate.installedVersion && pluginUpdate.installedVersion !== pluginUpdate.currentVersion && !pluginUpdate.needsRestart;
  const changeVersion = async () => {
    if (needsReload) { window.location.reload(); return; }
    const action = pluginUpdate.available ? 'install-update' : 'check-update';
    setOperation(action); setMessage(null);
    if (action === 'install-update') onInstallingChange(true);
    try {
      const result = await request({ action, ...(action === 'install-update' ? { version: pluginUpdate.latestVersion } : {}) });
      setPluginUpdate(result);
      if (action === 'check-update' && !result.available) setMessage({ text: t('upToDate') });
    } catch (e) { setMessage({ text: e.message, error: true }); }
    finally { setOperation(null); if (action === 'install-update') onInstallingChange(false); }
  };
  const label = t(operation === 'check-update' ? 'checkingUpdate' : operation === 'install-update' ? 'installingUpdate'
    : pluginUpdate.needsRestart ? 'updated' : needsReload ? 'reload' : pluginUpdate.available ? 'installUpdate' : 'checkUpdate');
  const hint = pluginUpdate.needsRestart ? t('restartRequired') : needsReload ? t('reload')
    : pluginUpdate.available ? pluginUpdate.canInstall ? `${t('installUpdate')} v${pluginUpdate.latestVersion}` : t('updateUnavailable') : t('checkUpdate');
  const notice = message?.text || (pluginUpdate.installedVersion
    ? `${t('updated')} v${pluginUpdate.installedVersion}${pluginUpdate.needsRestart ? ` · ${t('restartRequired')}` : ''}`
    : pluginUpdate.available && !pluginUpdate.canInstall ? t('updateUnavailable') : '');
  return h('header', { className: 'jsm-title' },
    h('div', { className: 'jsm-head' },
      h('div', { className: 'jsm-heading' }, h('h1', null, DISPLAY_NAME),
        h('span', { className: 'jsm-version', 'aria-label': t('version'), title: pluginUpdate.development ? t('development') : undefined }, `v${pluginUpdate.currentVersion}`,
          pluginUpdate.commit && h(React.Fragment, null, ' · ', h('a', { href: `${GITHUB_URL}/commit/${pluginUpdate.commit}`, title: pluginUpdate.commit,
            target: '_blank', rel: 'noopener noreferrer' }, pluginUpdate.commit.slice(0, 7))))),
      h('div', { className: 'jsm-header-actions' },
        h('a', { href: GITHUB_URL, title: GITHUB_URL, target: '_blank', rel: 'noopener noreferrer' }, 'GitHub ↗'),
        h('button', { type: 'button', className: pluginUpdate.available && !operation ? 'jsm-primary' : undefined,
          disabled: !!operation || pluginUpdate.needsRestart || (pluginUpdate.available && (!pluginUpdate.canInstall || installBlocked)) || (needsReload && installBlocked),
          title: hint, 'aria-label': pluginUpdate.available && !operation ? hint : label, onClick: changeVersion }, label))),
    h('p', null, t('intro')),
    notice && h('p', { className: 'jsm-update-message', role: message?.error ? 'alert' : 'status', 'data-error': !!message?.error }, notice));
}

function JumpServerPage({ request, t }) {
  const [connection, setConnection] = React.useState(null);
  const [loaded, setLoaded] = React.useState(false);
  const [error, setError] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [installingPlugin, setInstallingPlugin] = React.useState(false);
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
  const authorize = () => run(async () => setAuthorization(await authorizeInBrowser(request, connection.id)));
  const logout = () => { if (window.confirm(t('logoutQuestion'))) run(() => request({ action: 'logout', id: connection.id })); };
  const field = (key, type = 'text') => h('label', { key }, t(key === 'timeoutMs' ? 'timeout' : key),
    h('input', { type, required: true, disabled: busy || installingPlugin, value: values[key], 'aria-label': t(key === 'timeoutMs' ? 'timeout' : key),
      placeholder: key === 'url' ? 'https://jumpserver.example.com/koko/mcp' : undefined,
      min: type === 'number' ? 1000 : undefined, max: type === 'number' ? 600000 : undefined,
      onChange: event => setValues(old => ({ ...old, [key]: event.target.value })) }));
  const action = (label, handler, extra = {}) => h('button', { type: 'button', disabled: busy || installingPlugin || !loaded, onClick: handler, ...extra }, t(label));
  const configuration = h('section', { className: 'jsm-card', id: 'jumpserver-configuration', 'aria-labelledby': 'jumpserver-configuration-title' },
    h('h2', { id: 'jumpserver-configuration-title' }, t('configuration')),
    !connection && h('p', null, t('empty')),
    h('form', { className: 'jsm-form', onSubmit: event => { event.preventDefault(); run(async () => {
      await request({ ...(connection ? { action: 'update', id: connection.id } : { action: 'add' }), values });
      setEditing(false); setValues({ url: '', timeoutMs: '60000' });
    }); } }, h('div', { className: 'jsm-fields' }, field('url'), field('timeoutMs', 'number')),
    h('div', { className: 'jsm-actions' }, h('button', { className: 'jsm-primary', type: 'submit', disabled: busy || installingPlugin || !loaded }, t('save')),
      connection && action('cancel', () => setEditing(false)))),
    connection && h('div', { className: 'jsm-actions jsm-management' },
      action('remove', () => { if (window.confirm(t('deleteQuestion'))) run(async () => {
        await request({ action: 'remove', id: connection.id });
        setEditing(false); setAuthorization(null); setLogs([]); setValues({ url: '', timeoutMs: '60000' });
      }); }, { className: 'jsm-danger' })),
  );
  return h('div', { className: 'jsm-page', 'data-jumpserver-page': true }, h('main', { className: 'jsm', 'aria-label': DISPLAY_NAME },
    h(PluginHeader, { request, t, installBlocked: busy || connection?.status === 'authorizing', onInstallingChange: setInstallingPlugin }),
    error && h('div', { className: 'jsm-error', role: 'alert' }, error),
    !loaded && h('p', { role: 'status' }, t('loading')),
    connection && h('section', { className: 'jsm-card', 'data-connection': PLUGIN_ID, 'aria-labelledby': 'jumpserver-connection-title' },
      h('div', { className: 'jsm-head' }, h('h2', { id: 'jumpserver-connection-title' }, t('connection')), h('span', { className: 'jsm-status', 'data-state': connection.status, role: 'status' }, t(connection.status))),
      h('div', { className: 'jsm-url' }, connection.url),
      connection.error && h('div', { className: 'jsm-error' }, connection.error),
      h('div', { className: 'jsm-actions' },
        connection.authorized ? action('logout', logout, { className: 'jsm-danger' })
          : connection.enabled && action('authorize', authorize, { className: 'jsm-primary' }),
        connection.enabled && connection.authorized && action('connect', () => run(() => request({ action: 'connect', id: connection.id }))),
        action(connection.enabled ? 'disable' : 'enable', () => run(() => request({ action: 'update', id: connection.id, values: { enabled: !connection.enabled } }))),
        action('configuration', () => {
          if (!editing) setValues({ url: connection.url, timeoutMs: String(connection.timeoutMs) });
          setEditing(previous => !previous);
        }, { 'aria-expanded': editing, 'aria-controls': 'jumpserver-configuration' })),
      authorization && connection.status === 'authorizing' && h('p', null,
        t(authorization.browserOpened === false ? 'authOpenFailed' : 'authHint'), ' ', h('a', { href: authorization.authorizeUrl, target: '_blank', rel: 'noopener noreferrer' }, t('open'))),
      connection.expiresAt && h('small', null, `${t('expires')}: ${new Date(connection.expiresAt).toLocaleString()}${connection.lastRefreshAt ? ` · ${t('refreshed')}: ${new Date(connection.lastRefreshAt).toLocaleString()}` : ''}`)),
    loaded && (!connection || editing) && configuration,
    loaded && h(ToolsCatalog, { tools: connection?.tools || [], t }),
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

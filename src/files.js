import React from 'react';

const h = React.createElement;
const FINAL = new Set(['succeeded', 'failed', 'cancelled', 'rejected', 'expired', 'unknown']);

async function fileFetch(kind, transferId, init) {
  const path = `api/jumpserver/files/${kind}?transferId=${encodeURIComponent(transferId)}`;
  const response = globalThis.__DSH_FILE_UPLOAD__?.fetch
    ? await globalThis.__DSH_FILE_UPLOAD__.fetch(path, init)
    : await fetch(new URL(path, document.baseURI), { credentials: 'same-origin', ...init });
  if (!response.ok) {
    const result = await response.json().catch(() => null);
    throw new Error(result?.error?.message || `HTTP ${response.status}`);
  }
  return response;
}

export function FileTransfer({ request, t, instanceId }) {
  const [query, setQuery] = React.useState('');
  const [assets, setAssets] = React.useState([]);
  const [assetId, setAssetId] = React.useState('');
  const [account, setAccount] = React.useState('');
  const [path, setPath] = React.useState('/');
  const [file, setFile] = React.useState(null);
  const [overwrite, setOverwrite] = React.useState(false);
  const [transfer, setTransfer] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const active = React.useRef(null);
  const current = React.useRef(null);
  const opened = React.useRef(false);
  const asset = assets.find(row => row.id === assetId);
  const accounts = (asset?.accounts || []).filter(row => row.protocols?.includes('sftp'));
  const disabled = busy || Boolean(transfer);

  React.useEffect(() => () => {
    active.current?.abort();
    if (current.current) request({ action: 'file_cancel', transferId: current.current.id }).catch(() => {});
  }, [request]);

  const run = async work => {
    if (active.current) return;
    const controller = new AbortController();
    active.current = controller; setBusy(true); setError('');
    try { await work(controller.signal); }
    catch (e) { if (!controller.signal.aborted) setError(e.message); }
    finally { if (active.current === controller) { active.current = null; setBusy(false); } }
  };

  const search = () => run(async signal => {
    const result = await request({ action: 'file_assets', id: instanceId, query });
    if (signal.aborted) return;
    const rows = result.results || [];
    setAssets(rows); setAssetId(rows[0]?.id || '');
    setAccount(rows[0]?.accounts?.find(row => row.protocols?.includes('sftp'))?.id || '');
  });

  const show = value => { current.current = value; setTransfer(value); };
  const drive = async (initial, signal) => {
    let value = initial;
    for (let attempt = 0; attempt < 20 && !signal.aborted; attempt++) {
      show(value);
      if (FINAL.has(value.phase) || ['awaiting_approval', 'awaiting_input'].includes(value.phase)) return;
      if (value.phase === 'upload_ready') {
        const response = await fileFetch('upload', value.id, { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: file, signal });
        const result = await response.json();
        if (!result.ok) throw new Error(result.error.message);
        value = result.value;
      } else if (value.phase === 'download_ready') {
        const response = await fileFetch('download', value.id, { method: 'GET', signal });
        const blob = await response.blob();
        if (signal.aborted) return;
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url; link.download = value.path.split('/').pop() || 'download';
        document.body.appendChild(link); link.click(); link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        show({ ...value, phase: 'succeeded', status: 'succeeded' }); return;
      } else {
        await new Promise(resolve => {
          const done = () => { clearTimeout(timer); signal.removeEventListener('abort', done); resolve(); };
          const timer = setTimeout(done, 700); signal.addEventListener('abort', done, { once: true });
        });
        if (signal.aborted) return;
        value = await request({ action: 'file_status', transferId: value.id });
      }
    }
    if (!signal.aborted) show(value);
  };

  const start = kind => run(async signal => {
    const input = { action: 'file_start', instanceId, assetId, account, kind, remotePath: path, overwrite };
    if (kind === 'upload') {
      if (!file || file.size > 100 * 1024 * 1024) throw new Error(t('fileSizeLimit'));
      if (!globalThis.crypto?.subtle) throw new Error(t('fileSecureContext'));
      input.size = file.size;
      const hash = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
      input.sha256 = [...new Uint8Array(hash)].map(byte => byte.toString(16).padStart(2, '0')).join('');
    }
    if (signal.aborted) return;
    const value = await request(input);
    // A completed Remote request can outlive a removed panel. Release its session.
    if (signal.aborted) { await request({ action: 'file_cancel', transferId: value.id }); return; }
    await drive(value, signal);
  });

  const reset = () => {
    active.current?.abort();
    const value = current.current;
    if (value) request({ action: 'file_cancel', transferId: value.id }).then(() => {
      current.current = null; setTransfer(null);
    }).catch(e => setError(e.message));
  };

  const phase = transfer?.phase;
  const phaseKey = { connecting: 'fileConnecting', queued: 'fileRunning', running: 'fileRunning', accepted: 'fileRunning', dispatching: 'fileRunning',
    awaiting_approval: 'fileApproval', awaiting_input: 'fileApproval', upload_ready: 'fileReady', download_ready: 'fileReady',
    succeeded: 'fileSucceeded', failed: 'fileFailed', cancelled: 'fileCancelled', rejected: 'fileFailed', expired: 'fileFailed', unknown: 'fileUnknown' }[phase];

  return h('details', { onToggle: event => { if (event.currentTarget.open && !opened.current) { opened.current = true; search(); } } },
    h('summary', null, t('fileTransfer')),
    h('div', { className: 'jsm-file-transfer' }, h('p', null, t('fileRootHint')),
      error && h('div', { role: 'alert', className: 'jsm-error' }, error),
      h('div', { className: 'jsm-actions' },
        h('input', { value: query, disabled, placeholder: t('fileSearch'), 'aria-label': t('fileSearch'), onChange: event => setQuery(event.target.value) }),
        h('button', { disabled, onClick: search }, t('fileSearch'))),
      h('label', null, t('fileAsset'), h('select', { value: assetId, disabled, onChange: event => {
        setAssetId(event.target.value); setAccount(assets.find(row => row.id === event.target.value)?.accounts?.find(row => row.protocols?.includes('sftp'))?.id || '');
      } }, h('option', { value: '' }, t('fileChoose')), ...assets.map(row => h('option', { key: row.id, value: row.id }, row.name)))),
      h('label', null, t('fileAccount'), h('select', { value: account, disabled, onChange: event => setAccount(event.target.value) },
        h('option', { value: '' }, t('fileChoose')), ...accounts.map(row => h('option', { key: row.id, value: row.id }, `${row.name} (${row.username})`)))),
      asset && !accounts.length && h('p', null, t('fileNoSftp')),
      h('label', null, t('filePath'), h('input', { value: path, disabled, onChange: event => setPath(event.target.value) })),
      h('label', null, t('fileSelect'), h('input', { type: 'file', disabled, onChange: event => {
        const selected = event.target.files?.[0]; setFile(selected || null);
        if (selected && path.endsWith('/')) setPath(path + selected.name);
      } })),
      h('label', { className: 'jsm-actions' }, h('input', { type: 'checkbox', checked: overwrite, disabled, onChange: event => setOverwrite(event.target.checked) }), t('fileOverwrite')),
      h('div', { className: 'jsm-actions' },
        h('button', { disabled: disabled || !account || !file, onClick: () => start('upload') }, t('fileUpload')),
        h('button', { disabled: disabled || !account, onClick: () => start('download') }, t('fileDownload')),
        transfer && !FINAL.has(phase) && h('button', { disabled: busy, onClick: () => run(async signal => drive(await request({ action: 'file_status', transferId: transfer.id }), signal)) }, t('fileContinue')),
        transfer && h('button', { onClick: reset }, t(FINAL.has(phase) ? 'fileClose' : 'cancel'))),
      transfer && h('p', { role: 'status' }, t(phaseKey || 'fileRunning'), transfer.error && ` · ${transfer.error}`),
      transfer?.approvalUrl && h('a', { href: transfer.approvalUrl, target: '_blank', rel: 'noopener noreferrer' }, t('fileOpenApproval')),
      transfer?.auditUrl && h('a', { href: transfer.auditUrl, target: '_blank', rel: 'noopener noreferrer' }, t('fileAudit')),
    ));
}

import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { authorizeInBrowser } from '../lib/client-authorization.js';
import { openBrowser } from '../lib/browser.js';
import { readFileSync } from 'node:fs';
import { PLUGIN_PACKAGE, PLUGIN_VERSION, DISPLAY_NAME, GITHUB_URL } from '../lib/identity.js';

const authorizeUrl = 'https://jumpserver.example/authorize?state=fixture&code_challenge=fixture';

test('Web reserves its popup synchronously and reuses the loopback callback', async () => {
  const events = [];
  const popup = { opener: {}, location: {}, close() {} };
  let complete;
  const pending = new Promise(resolve => { complete = resolve; });
  const flow = authorizeInBrowser(input => {
    events.push('request');
    assert.deepEqual(input.options, { openBrowser: false, callbackOrigin: 'http://127.0.0.1:8080' });
    return pending;
  }, 'connection', { location: new URL('http://localhost:8080'), open() { events.push('open'); return popup; } });
  assert.deepEqual(events, ['open', 'request']);
  assert.equal(popup.opener, null);
  complete({ authorizeUrl });
  assert.equal((await flow).browserOpened, true);
  assert.equal(popup.location.href, authorizeUrl);
});

test('desktop authorization delegates to the system browser without creating an embedded window', async () => {
  const result = await authorizeInBrowser(async input => {
    assert.deepEqual(input.options, { openBrowser: true });
    return { authorizeUrl, browserOpened: true };
  }, 'connection', { location: new URL('file:///client/index.html'), open() { assert.fail('Embedded popup'); } });
  assert.equal(result.browserOpened, true);
});

test('blocked Web popups retain the same authorization link and failed authorization closes the blank page', async () => {
  let calls = 0;
  const result = await authorizeInBrowser(async () => { calls++; return { authorizeUrl }; }, 'connection',
    { location: new URL('https://dsh.example'), open() { return null; } });
  assert.equal(result.authorizeUrl, authorizeUrl);
  assert.equal(result.browserOpened, false);
  assert.equal(calls, 1);
  let closed = false;
  await assert.rejects(authorizeInBrowser(async () => { throw new Error('registration_failed'); }, 'connection',
    { location: new URL('https://dsh.example'), open: () => ({ close() { closed = true; } }) }), /registration_failed/);
  assert.equal(closed, true);
});

test('native browser launchers keep URL arguments literal and exclude Harness credentials', async () => {
  for (const [platform, command] of [['linux', 'xdg-open'], ['darwin', 'open'], ['win32', 'rundll32.exe']]) {
    const opened = await openBrowser(authorizeUrl, { platform, env: { DISPLAY: ':0', PATH: '/bin', DEEPSEEK_API_KEY: 'fixture', DSH_HOME: '/private' },
      spawnImpl(program, args, options) {
        assert.equal(program, command);
        assert.equal(args.at(-1), authorizeUrl);
        assert.equal(options.shell, false);
        assert.deepEqual(options.env, { DISPLAY: ':0', PATH: '/bin' });
        const child = new EventEmitter();
        process.nextTick(() => child.emit('exit', 0));
        return child;
      } });
    assert.equal(opened, true);
  }
});

test('headless and SSH sessions keep manual consent; invalid URLs never launch a command', async () => {
  for (const env of [{}, { DISPLAY: ':0', SSH_CONNECTION: 'fixture' }]) {
    assert.equal(await openBrowser(authorizeUrl, { platform: 'linux', env, spawnImpl() { assert.fail('Remote browser opened'); } }), false);
  }
  await assert.rejects(openBrowser('javascript:alert(1)'), { code: 'invalid_url' });
  assert.equal(await openBrowser(authorizeUrl, { platform: 'darwin', spawnImpl() {
    const child = new EventEmitter();
    process.nextTick(() => child.emit('error', new Error('unavailable')));
    return child;
  } }), false);
});

// Exercise the actual header lifecycle without loading a browser or the host UI.
const clientSource = readFileSync(new URL('../src/client.js', import.meta.url), 'utf8');
const headerSource = clientSource.slice(clientSource.indexOf('function PluginHeader('), clientSource.indexOf('\nfunction JumpServerPage('));
const flush = () => new Promise(resolve => setImmediate(resolve));
const updateState = extra => ({ currentVersion: PLUGIN_VERSION, latestVersion: '99.0.0', available: true, canInstall: true,
  installing: false, installedVersion: null, needsRestart: false, updateError: null, ...extra });

function header(request, onManagePlugin) {
  const states = [], timers = new Map(), actions = [], installing = [];
  let cursor = 0, effect, mounted = false, nextTimer = 0;
  const state = initial => {
    const index = cursor++;
    if (!(index in states)) states[index] = initial;
    return [states[index], value => { states[index] = typeof value === 'function' ? value(states[index]) : value; }];
  };
  const React = { useState: state, useRef: initial => state({ current: initial })[0],
    useEffect: callback => { if (!mounted) effect = callback; }, Fragment: 'fragment' };
  const create = new Function('React', 'h', 'PLUGIN_VERSION', 'DISPLAY_NAME', 'GITHUB_URL', 'setTimeout', 'clearTimeout',
    `${headerSource}; return PluginHeader;`);
  const Header = create(React, (type, props, ...children) => ({ type, props, children }), PLUGIN_VERSION, DISPLAY_NAME, GITHUB_URL,
    (callback, delay) => { assert.equal(delay, 1000); const id = ++nextTimer; timers.set(id, callback); return id; }, id => timers.delete(id));
  const props = { request: async input => { actions.push(input.action); return request(input); }, t: key => key,
    onInstallingChange: value => installing.push(value), onManagePlugin };
  const render = () => { cursor = 0; return Header(props); };
  const button = node => node?.type === 'button' ? node : node?.children?.map(button).find(Boolean);
  render(); mounted = true;
  const unmount = effect();
  return { states, actions, installing, timers, render, unmount, button: () => button(render()), async tick() {
    const [id, callback] = timers.entries().next().value;
    timers.delete(id); await callback(); await flush();
  } };
}

test('header resumes HMR updates from host status and displays terminal success or recovery errors', async () => {
  for (const terminal of [updateState({ available: false, installedVersion: '99.0.0' }), updateState({ needsRestart: true,
    updateError: { code: 'update_install_failed', message: 'Previous version restored', recoveryPath: '/updates/previous.tgz' } })]) {
    const snapshots = [updateState({ installing: true }), terminal];
    const view = header(async input => { assert.equal(input.action, 'update-status'); return snapshots.shift(); });
    await flush();
    assert.equal(view.states[1], 'install-update');
    assert.deepEqual(view.installing, [true]);
    await view.tick();
    assert.equal(view.timers.size, 0);
    assert.deepEqual(view.actions, ['update-status', 'update-status']);
    assert.deepEqual(view.installing, [true, false]);
    if (terminal.updateError) {
      assert.equal(view.states[2].error, true);
      assert.match(view.states[2].text, /Previous version restored.*previous\.tgz.*restartRequired/);
      assert.equal(view.button().children[0], 'restartRequired');
    } else assert.equal(view.states[0].installedVersion, '99.0.0');
    view.unmount();
  }
});

test('header observes installation independently of its RPC and unmount only clears local polling', async () => {
  let failInstall, started = false, polls = 0;
  const view = header(async input => {
    if (input.action === 'install-update') {
      started = true;
      return new Promise((_resolve, reject) => { failInstall = reject; });
    }
    if (!started) return updateState();
    return ++polls === 1 ? updateState({ installing: true }) : updateState({ available: false, installedVersion: '99.0.0' });
  });
  await flush();
  assert.deepEqual(view.actions, ['update-status', 'check-update']);
  const original = view.button().props.onClick();
  await view.tick();
  assert.equal(view.states[1], 'install-update');
  await view.tick();
  assert.equal(view.states[0].installedVersion, '99.0.0');
  failInstall(new Error('Original Remote disconnected'));
  await original;
  assert.equal(view.states[2], null);
  assert.equal(view.actions.filter(action => action === 'install-update').length, 1);
  view.unmount();
  const pending = header(async () => updateState({ installing: true }));
  await flush();
  assert.equal(pending.timers.size, 1);
  pending.unmount();
  assert.equal(pending.timers.size, 0);
  assert.deepEqual(pending.installing, [true]);
  assert.deepEqual(pending.actions, ['update-status']);
});

test('plugin management recovery links prefer native bundle details and retain their Release fallback', async () => {
  const navigationSource = clientSource.slice(clientSource.indexOf('function openPluginManager('), clientSource.indexOf('function PluginHeader('));
  const open = new Function('PLUGIN_PACKAGE', `${navigationSource}; return openPluginManager;`)(PLUGIN_PACKAGE);
  const link = node => node?.type === 'a' && node.props.href === `${GITHUB_URL}/releases/latest`
    ? node : node?.children?.map(link).find(Boolean);
  for (const mode of ['native', 'missing', 'failed']) {
    let called = 0, prevented = false;
    const ctx = { get(key) {
      assert.equal(key, 'pluginNavigation');
      return mode === 'missing' ? undefined : { openBundle(name) {
        assert.equal(name, PLUGIN_PACKAGE); called++;
        if (mode === 'failed') throw new Error('Navigation unavailable');
      } };
    } };
    const view = header(async () => updateState({ canInstall: false }), event => open(ctx, event));
    await flush();
    const recovery = link(view.render());
    assert.equal(recovery.children[0], 'managePlugin');
    recovery.props.onClick({ preventDefault() { prevented = true; } });
    assert.equal(prevented, mode === 'native');
    assert.equal(called, mode === 'missing' ? 0 : 1);
    view.unmount();
  }
  const healthy = header(async () => updateState());
  await flush();
  assert.equal(link(healthy.render()), undefined);
  healthy.unmount();
});

test('header does not overlap status requests when the original install RPC disconnects', async () => {
  let started = false, failInstall, completeStatus;
  const view = header(async input => {
    if (input.action === 'install-update') {
      started = true;
      return new Promise((_resolve, reject) => { failInstall = reject; });
    }
    if (!started) return updateState();
    return new Promise(resolve => { completeStatus = resolve; });
  });
  await flush();
  const original = view.button().props.onClick();
  const polling = view.tick();
  failInstall(Object.assign(new Error('Remote reloading'), { code: 'gateway/unavailable' }));
  await original;
  await view.tick();
  assert.equal(view.actions.filter(action => action === 'update-status').length, 2);
  completeStatus(updateState({ available: false, installedVersion: '99.0.0' }));
  await polling;
  assert.equal(view.states[2], null);
  assert.equal(view.timers.size, 0);
  view.unmount();
});

test('a loaded or superseded update does not prevent automatic checks for the next release', async () => {
  for (const installedVersion of [PLUGIN_VERSION, '0.0.0']) {
    const view = header(async () => updateState({ installedVersion }));
    await flush();
    assert.deepEqual(view.actions, ['update-status', 'check-update']);
    assert.equal(view.button().children[0], 'installUpdate');
    assert.equal(view.timers.size, 0);
    view.unmount();
  }
});

test('definitive host update outcomes survive a missing service or a stale pending status', async () => {
  const register = clientSource.slice(clientSource.indexOf('function registerPage('));
  const requestSource = register.slice(register.indexOf('  const request ='), register.indexOf("  const t ="));
  for (const mode of ['restore-failed', 'service-missing', 'stale-status']) {
    let started = false, completeInstall, completeStatus, failStatus;
    const request = new Function('ctx', `${requestSource}; return request;`)({ remote: { jumpserver: { request: async input => {
      if (input.action === 'install-update') {
        started = true;
        return new Promise(resolve => { completeInstall = resolve; });
      }
      if (started) return new Promise((resolve, reject) => { completeStatus = resolve; failStatus = reject; });
      return { ok: true, value: { ok: true, value: updateState() } };
    } } } });
    const view = header(request);
    await flush();
    const original = view.button().props.onClick();
    const polling = view.tick();
    const message = 'Restore failed; install file:/updates/previous/package';
    completeInstall({ ok: true, value: mode === 'restore-failed'
      ? { ok: false, error: { code: 'update_restore_failed', message } }
      : { ok: true, value: updateState({ available: false, installedVersion: '99.0.0', needsRestart: true }) } });
    await original;
    assert.equal(view.states[0].installing, false);
    assert.equal(view.installing.at(-1), false);
    if (mode === 'stale-status') completeStatus({ ok: true, value: { ok: true, value: updateState({ installing: true }) } });
    else failStatus(Object.assign(new Error('Replacement service is missing'), { code: 'gateway/unavailable' }));
    await polling;
    assert.equal(view.states[0].installing, false);
    assert.equal(view.timers.size, 0);
    if (mode === 'restore-failed') {
      assert.equal(view.states[0].updateError.code, 'update_restore_failed');
      assert.equal(view.states[2].text, message);
      assert.match(JSON.stringify(view.render()), /releases\/latest/);
    } else {
      assert.equal(view.states[0].installedVersion, '99.0.0');
      assert.equal(view.states[2], null);
    }
    view.unmount();
  }
});

test('a manual update check recovers after a terminal error and ignores earlier pending responses', async () => {
  let started = false, failInstall, completeStatus, polls = 0;
  const view = header(async input => {
    if (input.action === 'install-update') {
      started = true;
      return new Promise((_resolve, reject) => { failInstall = reject; });
    }
    if (input.action === 'check-update' || !started) return updateState();
    if (++polls === 1) return updateState({ available: false, installing: true });
    return new Promise(resolve => { completeStatus = resolve; });
  });
  await flush();
  const original = view.button().props.onClick();
  await view.tick();
  const oldStatus = view.tick();
  failInstall(Object.assign(new Error('Restore failed; install file:/updates/previous/package'),
    { code: 'update_restore_failed', fromHost: true }));
  await original;
  assert.equal(view.button().children[0], 'checkUpdate');
  await view.button().props.onClick();
  assert.equal(view.actions.filter(action => action === 'check-update').length, 2);
  completeStatus(updateState({ available: false, installing: true }));
  await oldStatus;
  assert.equal(view.states[1], null);
  assert.equal(view.states[0].available, true);
  assert.equal(view.states[0].updateError, null);
  assert.equal(view.states[2], null);
  assert.equal(view.timers.size, 0);
  view.unmount();
});

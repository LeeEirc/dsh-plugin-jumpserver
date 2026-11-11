import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { authorizeInBrowser } from '../lib/client-authorization.js';
import { openBrowser } from '../lib/browser.js';

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

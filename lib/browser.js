import { spawn } from 'node:child_process';
import { httpUrl } from './http.js';

export async function openBrowser(value, { platform = process.platform, env = process.env, spawnImpl = spawn } = {}) {
  const url = httpUrl(value).href;
  if (platform === 'linux' && (!env.DISPLAY && !env.WAYLAND_DISPLAY || env.SSH_CONNECTION || env.SSH_TTY)) return false;
  const launcher = platform === 'darwin' ? ['open', url]
    : platform === 'win32' ? ['rundll32.exe', 'url.dll,FileProtocolHandler', url]
      : platform === 'linux' ? ['xdg-open', url] : null;
  if (!launcher) return false;
  const browserEnv = Object.fromEntries(Object.entries(env).filter(([key]) =>
    !/api.?key|token|secret|password|authorization/i.test(key) && !/^(DSH_|DEEPSEEK_|OPENAI_|ANTHROPIC_)/.test(key)));
  return new Promise(resolve => {
    let child;
    let timer;
    const finish = opened => { clearTimeout(timer); resolve(opened); };
    try {
      child = spawnImpl(launcher[0], launcher.slice(1), { shell: false, stdio: 'ignore', windowsHide: true, env: browserEnv });
      child.once('error', () => finish(false));
      child.once('exit', code => finish(code === 0));
      // Some desktop launchers keep running with the browser. Leave it running.
      timer = setTimeout(() => { child.unref(); finish(true); }, 1500);
    } catch { finish(false); }
  });
}

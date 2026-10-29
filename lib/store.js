import { mkdir, open, readFile, rename, unlink, rmdir, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { AdapterError } from './http.js';

export class StateStore {
  constructor(path = join(process.env.DSH_HOME || join(homedir(), '.dsh'), 'jumpserver.json')) {
    this.path = path;
  }

  async read() {
    try {
      const state = JSON.parse(await readFile(this.path, 'utf8'));
      if (state.version !== 1 || !Array.isArray(state.instances)) throw new Error('unsupported state');
      return state;
    } catch (error) {
      if (error.code === 'ENOENT') return { version: 1, instances: [] };
      throw new AdapterError('无法读取 JumpServer 状态文件，请检查文件格式和权限', 'state_read_failed', 500);
    }
  }

  async get(id) {
    const instance = (await this.read()).instances.find(row => row.id === id);
    if (!instance) throw new AdapterError('JumpServer 实例不存在', 'not_found', 404);
    return instance;
  }

  async lock() {
    await mkdir(dirname(this.path), { recursive: true, mode: 0o700 });
    const directory = `${this.path}.lock`;
    const guard = `${directory}.reclaim`;
    const started = Date.now();
    while (Date.now() - started < 30000) {
      try {
        await mkdir(directory, { mode: 0o700 });
        try {
          const owner = await open(join(directory, 'owner.json'), 'wx', 0o600);
          try { await owner.writeFile(JSON.stringify({ pid: process.pid })); } finally { await owner.close(); }
        } catch (error) { await rmdir(directory).catch(() => {}); throw error; }
        return async () => { await unlink(join(directory, 'owner.json')); await rmdir(directory); };
      } catch (error) { if (error.code !== 'EEXIST') throw error; }
      let ownedGuard = false;
      try {
        await mkdir(guard, { mode: 0o700 });
        ownedGuard = true;
        let owner;
        try { owner = JSON.parse(await readFile(join(directory, 'owner.json'), 'utf8')); } catch { /* Incomplete owner needs an age check. */ }
        let dead = false;
        if (Number.isInteger(owner?.pid) && owner.pid > 0) {
          try { process.kill(owner.pid, 0); } catch (error) { dead = error.code === 'ESRCH'; }
        } else {
          try { dead = Date.now() - (await stat(directory)).mtimeMs > 30000; } catch { /* Lock just released. */ }
        }
        if (dead) {
          await unlink(join(directory, 'owner.json')).catch(error => { if (error.code !== 'ENOENT') throw error; });
          await rmdir(directory).catch(error => { if (error.code !== 'ENOENT') throw error; });
        }
      } catch (error) { if (error.code !== 'EEXIST' && error.code !== 'ENOENT') throw error; }
      finally { if (ownedGuard) await rmdir(guard); }
      await delay(40);
    }
    throw new AdapterError('状态文件正被其他进程使用，请稍后重试', 'state_locked', 503);
  }

  async transaction(update) {
    const release = await this.lock();
    let temporary;
    try {
      const state = await this.read();
      const value = await update(state);
      temporary = `${this.path}.${randomUUID()}.tmp`;
      const file = await open(temporary, 'wx', 0o600);
      try { await file.writeFile(JSON.stringify(state, null, 2)); await file.sync(); } finally { await file.close(); }
      await rename(temporary, this.path);
      return value;
    } finally {
      if (temporary) await unlink(temporary).catch(() => {});
      await release();
    }
  }
}

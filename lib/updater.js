import { createHash, randomUUID } from 'node:crypto';
import { cp, mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import semver from 'semver';
import { AdapterError, requestJson } from './http.js';
import { PLUGIN_PACKAGE, PLUGIN_VERSION } from './identity.js';
import { BUILD_INFO } from './build-info.js';

const REPOSITORY = 'LeeEirc/dsh-plugin-jumpserver';
const DOWNLOAD_HOSTS = new Set(['github.com', 'release-assets.githubusercontent.com', 'objects.githubusercontent.com']);

async function download(url, limit, fetchImpl) {
  const signal = AbortSignal.timeout(60000);
  for (let redirects = 0; redirects <= 4; redirects++) {
    const target = new URL(url);
    if (target.protocol !== 'https:' || !DOWNLOAD_HOSTS.has(target.hostname) || target.username || target.password
        || (target.port && target.port !== '443')) throw new AdapterError('更新下载地址无效', 'invalid_release');
    const response = await fetchImpl(target.href, { redirect: 'manual', signal });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      await response.body?.cancel();
      const location = response.headers.get('location');
      if (!location) break;
      url = new URL(location, target).href;
      continue;
    }
    if (!response.ok) { await response.body?.cancel(); throw new AdapterError('更新包下载失败，请稍后重试', 'download_failed'); }
    const reader = response.body?.getReader();
    const chunks = [];
    let size = 0;
    try {
      if (Number(response.headers.get('content-length')) > limit) throw new AdapterError('更新文件超过大小限制', 'update_too_large');
      if (reader) for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > limit) throw new AdapterError('更新文件超过大小限制', 'update_too_large');
        chunks.push(value);
      }
    } finally { if (reader) { await reader.cancel().catch(() => {}); reader.releaseLock(); } }
    return Buffer.concat(chunks);
  }
  throw new AdapterError('更新下载跳转过多', 'download_failed');
}

function updateJob(scope, directory) {
  const create = () => ({ installing: null, installedVersion: null, needsRestart: false, updateError: null });
  if (!scope) return create();
  const key = Symbol.for('dsh-plugin-jumpserver.update-jobs');
  const roots = globalThis[key] ??= new WeakMap();
  let jobs = roots.get(scope);
  if (!jobs) roots.set(scope, jobs = new Map());
  if (!jobs.has(directory)) jobs.set(directory, create());
  return jobs.get(directory);
}

function succeeded(result, version) {
  return ['applied', 'restart-required'].includes(result?.application)
    && (!result.bundle || result.bundle === PLUGIN_PACKAGE)
    && (!version || !result.version || result.version === version);
}

function failure(result) {
  return new AdapterError(`DSH 插件安装未完成（${result?.error?.code || result?.application || 'install_failed'}）`, 'update_install_failed');
}

export class PluginUpdater {
  constructor({ directory, getInstaller = () => null, isHmr = () => false, scope,
    packageDirectory = fileURLToPath(new URL('../', import.meta.url)), fetchImpl = fetch, version = PLUGIN_VERSION }) {
    this.directory = directory;
    this.getInstaller = getInstaller;
    this.isHmr = isHmr;
    this.packageDirectory = packageDirectory;
    this.job = updateJob(scope, directory);
    this.fetch = fetchImpl;
    this.version = version;
    this.release = null;
    this.checking = null;
  }

  status(installer = this.getInstaller(), hmr = this.isHmr()) {
    const installed = this.job.installedVersion;
    const current = installed && semver.gt(installed, this.version) ? installed : this.version;
    return { currentVersion: this.version, ...BUILD_INFO, latestVersion: this.release?.version || null,
      available: !!this.release && semver.gt(this.release.version, current),
      canInstall: typeof installer?.installBundle === 'function' && (!hmr ||
        ['listBundles', 'removeBundle', 'setBundleEnabled'].every(name => typeof installer[name] === 'function')),
      installing: !!this.job.installing, installedVersion: installed, needsRestart: this.job.needsRestart,
      updateError: this.job.updateError };
  }

  async snapshot() {
    const manifest = JSON.parse(await readFile(join(this.packageDirectory, 'package.json'), 'utf8'));
    if (manifest.name !== PLUGIN_PACKAGE || manifest.version !== this.version) {
      throw new AdapterError('当前插件文件与运行版本不一致，未开始更新，请在 DSH 插件管理中更新', 'update_backup_failed');
    }
    const directory = await mkdtemp(join(this.directory, `rollback-${this.version}-`));
    try {
      for (const name of ['lib', 'locale', 'cordis.patch.yml', 'README.md', 'LICENSE', 'THIRD_PARTY_NOTICES']) {
        await cp(join(this.packageDirectory, name), join(directory, name), { recursive: true });
      }
      delete manifest.scripts;
      delete manifest.devDependencies;
      await writeFile(join(directory, 'package.json'), JSON.stringify(manifest, null, 2) + '\n', { mode: 0o600 });
      return directory;
    } catch (error) {
      await rm(directory, { recursive: true, force: true });
      throw error;
    }
  }

  async replace(installer, file, version) {
    const bundle = (await installer.listBundles()).find(item => item.name === PLUGIN_PACKAGE);
    if (!bundle?.installed || !bundle.removable || bundle.version !== this.version) {
      throw new AdapterError('当前 profile 的插件状态已改变或不允许替换，请在 DSH 插件管理中更新', 'stale_update');
    }
    const enabled = bundle.enabled;
    const backup = await this.snapshot();
    const recoverySource = `file:${backup}`;
    const options = target => ({ enabled, saveExact: true, expected: { name: PLUGIN_PACKAGE, version: target } });
    try {
      const removed = await installer.removeBundle(PLUGIN_PACKAGE);
      if (!succeeded(removed)) throw failure(removed);
      const result = await installer.installBundle(file, options(version));
      if (!succeeded(result, version)) throw failure(result);
      return result;
    } catch (error) {
      try {
        const current = (await installer.listBundles()).find(item => item.name === PLUGIN_PACKAGE && item.installed);
        if (current?.version === this.version) {
          if (current.enabled !== enabled) {
            const restored = await installer.setBundleEnabled(PLUGIN_PACKAGE, enabled);
            if (!succeeded(restored)) throw failure(restored);
            this.job.needsRestart = restored.application === 'restart-required';
          }
        } else {
          if (current) {
            if (current.version !== version) throw new Error('Plugin changed during update');
            const removed = await installer.removeBundle(PLUGIN_PACKAGE);
            if (!succeeded(removed)) throw failure(removed);
          }
          const restored = await installer.installBundle(recoverySource, options(this.version));
          if (!succeeded(restored, this.version)) throw failure(restored);
          this.job.needsRestart = restored.application === 'restart-required';
        }
      } catch {
        throw Object.assign(new AdapterError('更新未完成，旧版本恢复失败，请在 DSH 插件管理中从恢复目录重新安装',
          'update_restore_failed'), { recoveryPath: recoverySource });
      }
      throw Object.assign(new AdapterError(`${error.message}；已保留或恢复旧版本，可重试更新`, 'update_install_failed'), { recoveryPath: recoverySource });
    }
  }

  check() {
    if (this.checking) return this.checking;
    this.checking = (async () => {
      const { response, json } = await requestJson(`https://api.github.com/repos/${REPOSITORY}/releases/latest`, { fetchImpl: this.fetch });
      if (response.status === 404) { this.release = null; return this.status(); }
      if (!response.ok) throw new AdapterError('无法检查 GitHub 发布版本，请稍后重试', 'update_check_failed');
      const version = /^v\d+\.\d+\.\d+$/.test(json?.tag_name || '') ? semver.valid(json.tag_name.slice(1)) : null;
      if (!version || json.draft || json.prerelease || !Array.isArray(json.assets)) throw new AdapterError('发布版本信息无效', 'invalid_release');
      const asset = name => {
        const entries = json.assets.filter(item => item.name === name);
        const url = `https://github.com/${REPOSITORY}/releases/download/${json.tag_name}/${name}`;
        if (entries.length !== 1 || entries[0].browser_download_url !== url) throw new AdapterError('发布包或校验文件缺失', 'invalid_release');
        return url;
      };
      const filename = `${PLUGIN_PACKAGE}-${version}.tgz`;
      this.release = { version, filename, packageUrl: asset(filename), checksumUrl: asset('SHA256SUMS') };
      return this.status();
    })().finally(() => { this.checking = null; });
    return this.checking;
  }

  install(version) {
    if (this.job.installing) return this.job.installing;
    this.job.installing = (async () => {
      const installer = this.getInstaller();
      const hmr = this.isHmr();
      if (!this.status(installer, hmr).canInstall) throw new AdapterError('当前 DSH 不支持此更新流程，请在插件管理中更新', 'update_unavailable');
      const release = this.release;
      if (!release || version !== release.version || (!semver.gt(version, this.version) || (this.job.installedVersion && !semver.gt(version, this.job.installedVersion)))) {
        throw new AdapterError('请先检查并选择新的发布版本', 'stale_update');
      }
      this.job.updateError = null;
      this.job.installedVersion = null;
      this.job.needsRestart = false;
      const checksums = (await download(release.checksumUrl, 64 * 1024, this.fetch)).toString('utf8');
      const matches = checksums.split(/\r?\n/).map(line => /^([a-fA-F0-9]{64})\s+\*?(.+)$/.exec(line))
        .filter(match => match?.[2] === release.filename);
      if (matches.length !== 1) throw new AdapterError('发布包 SHA256 校验信息无效', 'invalid_checksum');
      const bytes = await download(release.packageUrl, 16 * 1024 * 1024, this.fetch);
      const digest = createHash('sha256').update(bytes).digest('hex');
      if (digest !== matches[0][1].toLowerCase()) throw new AdapterError('更新包 SHA256 校验失败，未执行安装', 'checksum_mismatch');
      await mkdir(this.directory, { recursive: true, mode: 0o700 });
      // The profile keeps a file: dependency on this verified archive.
      const file = join(this.directory, `${PLUGIN_PACKAGE}-${version}-${digest.slice(0, 12)}.tgz`);
      const temporary = file + '.' + randomUUID() + '.part';
      try { await writeFile(temporary, bytes, { mode: 0o600, flag: 'wx' }); await rename(temporary, file); }
      finally { await rm(temporary, { force: true }); }
      const result = hmr ? await this.replace(installer, file, version) :
        await installer.installBundle(file, { enabled: true, saveExact: true, expected: { name: PLUGIN_PACKAGE, version } });
      if (!succeeded(result, version)) throw failure(result);
      this.job.installedVersion = version;
      this.job.needsRestart = result.application === 'restart-required';
      await rm(join(this.directory, 'last-update-error.json'), { force: true }).catch(() => {});
      return { ...this.status(installer, hmr), installing: false };
    })().catch(async error => {
      this.job.updateError = { code: String(error.code || 'update_install_failed'), message: String(error.message),
        ...(error.recoveryPath ? { recoveryPath: error.recoveryPath } : {}) };
      if (error.recoveryPath) {
        await writeFile(join(this.directory, 'last-update-error.json'), JSON.stringify(this.job.updateError, null, 2) + '\n',
          { mode: 0o600 }).catch(() => {});
        console.error(`jumpserver: ${this.job.updateError.code}; recovery source: ${error.recoveryPath}`);
      }
      throw error;
    }).finally(() => { this.job.installing = null; });
    return this.job.installing;
  }
}

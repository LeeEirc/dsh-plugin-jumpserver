import { createHash, randomUUID } from 'node:crypto';
import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
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

export class PluginUpdater {
  constructor({ directory, getInstaller = () => null, fetchImpl = fetch, version = PLUGIN_VERSION }) {
    this.directory = directory;
    this.getInstaller = getInstaller;
    this.fetch = fetchImpl;
    this.version = version;
    this.release = null;
    this.checking = null;
    this.installing = null;
    this.installedVersion = null;
    this.needsRestart = false;
  }

  status() {
    return { currentVersion: this.version, ...BUILD_INFO, latestVersion: this.release?.version || null,
      available: !!this.release && semver.gt(this.release.version, this.installedVersion || this.version),
      canInstall: typeof this.getInstaller()?.installBundle === 'function', installing: !!this.installing,
      installedVersion: this.installedVersion, needsRestart: this.needsRestart };
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
    if (this.installing) return this.installing;
    this.installing = (async () => {
      const installer = this.getInstaller();
      if (typeof installer?.installBundle !== 'function') throw new AdapterError('当前 DSH 未启用原生插件管理，请在插件管理中更新', 'update_unavailable');
      const release = this.release;
      if (!release || version !== release.version || !semver.gt(version, this.installedVersion || this.version)) {
        throw new AdapterError('请先检查并选择新的发布版本', 'stale_update');
      }
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
      const result = await installer.installBundle(file, { enabled: true, saveExact: true });
      if (!['applied', 'restart-required'].includes(result?.application) || (result.bundle && result.bundle !== PLUGIN_PACKAGE)) {
        throw new AdapterError(`DSH 插件安装未完成（${result?.error?.code || result?.application || 'install_failed'}），请在插件管理查看诊断`, 'update_install_failed');
      }
      this.installedVersion = version;
      this.needsRestart = result.application === 'restart-required';
      return { ...this.status(), installing: false };
    })().finally(() => { this.installing = null; });
    return this.installing;
  }
}

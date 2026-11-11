import { readFileSync } from 'node:fs';

let info = {};
try {
  const value = JSON.parse(readFileSync(new URL('./build-info.json', import.meta.url), 'utf8'));
  if (value && typeof value === 'object') info = value;
}
catch { /* A source checkout may not have been built yet. */ }

export const BUILD_INFO = Object.freeze({
  commit: typeof info.commit === 'string' && /^[a-f0-9]{40}$/i.test(info.commit) ? info.commit : null,
  development: info.development === true,
});

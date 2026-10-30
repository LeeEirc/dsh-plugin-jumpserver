// Share ownership across package copies and HMR, keeping DSH roots independent.
export function claimSingleton(ctx, side) {
  const key = Symbol.for(`dsh-plugin-jumpserver.${side}.owners`);
  const owners = globalThis[key] ??= new WeakMap();
  const root = ctx.root;
  if (owners.has(root)) {
    throw Object.assign(new Error('JumpServer 插件已启用，请修改现有配置'), { code: 'already_loaded' });
  }
  const owner = {};
  owners.set(root, owner);
  ctx.effect(() => () => { if (owners.get(root) === owner) owners.delete(root); });
}

import { OPERATING_RULES } from './manager.js';
import { isDeepStrictEqual } from 'node:util';
import { DISPLAY_NAME, TOOL_PREFIX } from './identity.js';

// DSH's raw tool registry accepts a subset of JSON Schema. Keep the original
// schema on the MCP client, and project only the model-facing registry schema.
export function parameters(schema) {
  if (!schema || typeof schema !== 'object') return {};
  const result = {};
  if (typeof schema.description === 'string') result.description = schema.description;
  if (schema.oneOf) return { ...result, oneOf: schema.oneOf.map(parameters) };
  if (Array.isArray(schema.type)) return { ...result, oneOf: schema.type.map(type => parameters({ ...schema, type })) };
  if (['string', 'number', 'integer', 'boolean', 'null'].includes(schema.type)) {
    result.type = schema.type;
    if (Array.isArray(schema.enum)) result.enum = schema.enum;
    if (Object.hasOwn(schema, 'const')) result.const = schema.const;
  } else if (schema.type === 'object') {
    result.type = 'object';
    result.properties = Object.fromEntries(Object.entries(schema.properties || {}).map(([key, value]) => [key, parameters(value)]));
    if (Array.isArray(schema.required)) result.required = schema.required.filter(key => Object.hasOwn(result.properties, key));
    if (typeof schema.additionalProperties === 'boolean') result.additionalProperties = schema.additionalProperties;
  } else if (schema.type === 'array') { result.type = 'array'; result.items = parameters(schema.items); }
  return result;
}

export function renderResult(_args, value) {
  const text = value.content.filter(block => block.type === 'text').map(block => block.text).join('\n');
  const structured = value.structuredContent === undefined ? '' : JSON.stringify(value.structuredContent);
  let duplicate = text.trim() === structured;
  if (text && structured && !duplicate) {
    try { duplicate = isDeepStrictEqual(JSON.parse(text), value.structuredContent); } catch { /* Preserve non-JSON text. */ }
  }
  return [{ type: 'text', text: (text && structured && !duplicate ? `${text}\n\n${structured}` : structured || text) || '工具未返回文本内容' }];
}

export function toolDefinition(manager, entry, tool) {
  const schema = parameters(tool.inputSchema);
  const files = ['list_files', 'stat_file', 'read_file', 'write_file', 'rename_file', 'remove_file', 'make_directory', 'upload_file', 'download_file'].includes(tool.name);
  if (tool.name === 'connect_asset') {
    if (schema.properties?.account) schema.properties.account.description = 'Exact search_assets accounts[].id, including virtual aliases; never the display name or username.';
    if (schema.properties?.protocol) schema.properties.protocol.description = 'Choose an authorized account protocol: sftp for file tools; ssh for commands.';
  }
  if (files) {
    if (schema.properties?.session_id) schema.properties.session_id.description = 'A connected protocol=sftp session. SSH sessions cannot run file tools.';
    const path = schema.properties?.path || schema.properties?.remote_path;
    if (path) path.description = 'Absolute virtual SFTP path rooted at /. Start by inspecting /; SSH filesystem paths may differ.';
  }
  const guidance = tool.name === 'upload_file'
    ? 'Registers authorization only. Use the JumpServer settings file transfer panel to send browser file bytes; polling cannot upload a file.'
    : files ? 'Requires a separate SFTP session and virtual SFTP paths.' : '';
  return {
    name: `${TOOL_PREFIX}${tool.name}`,
    description: `${tool.description || tool.name}\n[${DISPLAY_NAME}] ${guidance}`.trim().slice(0, 4000),
    parameters: schema,
    output: { schema: { type: 'object', properties: {
      content: { type: 'array', items: {} }, structuredContent: {}, isError: { type: 'boolean' },
    }, required: ['content'], additionalProperties: false }, render: renderResult },
    isConcurrencySafe: () => ['search_assets', 'get_action'].includes(tool.name),
    timeoutMs: entry.row.timeoutMs,
    async execute(args, exec) {
      const result = await manager.call(entry.row.id, tool.name, args ?? {}, { signal: exec?.signal });
      if (result.isError) throw new Error(result.content.filter(block => block.type === 'text').map(block => block.text).join('\n') || 'JumpServer 工具返回错误');
      return { content: result.content, ...(result.structuredContent !== undefined ? { structuredContent: result.structuredContent } : {}), isError: false };
    },
  };
}

export function registerBridge(ctx, manager) {
  const registrations = new Map();
  const sync = () => {
    const desired = new Map();
    for (const entry of manager.connections.values()) {
      if (entry.status !== 'connected') continue;
      for (const tool of entry.tools) {
        const definition = toolDefinition(manager, entry, tool);
        desired.set(definition.name, { definition, signature: JSON.stringify([entry.row.revision, tool]) });
      }
    }
    for (const [name, old] of registrations) {
      if (desired.get(name)?.signature === old.signature) continue;
      old.dispose(); registrations.delete(name);
    }
    for (const [name, next] of desired) {
      if (registrations.has(name)) continue;
      try { registrations.set(name, { signature: next.signature, dispose: ctx.tools.register(next.definition) }); }
      catch (error) { manager.log('plugin', 'register', error.message); ctx.logger.error(`jumpserver: tool registration failed for ${name}`); }
    }
  };
  manager.on('changed', sync);
  sync();
  const prompt = () => {
    const connected = [...manager.connections.values()].filter(entry => entry.status === 'connected');
    return connected.length ? `${OPERATING_RULES}\n${connected.map(entry => `[${DISPLAY_NAME}]\n${entry.instructions || ''}`).join('\n')}` : '';
  };
  const promptInjection = ctx.inject(['systemPrompt'], child => {
    child.effect(() => child.systemPrompt.section({ name: 'jumpserver:operations', order: 3110, text: prompt, interpolate: false }));
  });
  return () => {
    manager.off('changed', sync);
    for (const row of registrations.values()) row.dispose();
    registrations.clear();
    promptInjection.dispose();
  };
}

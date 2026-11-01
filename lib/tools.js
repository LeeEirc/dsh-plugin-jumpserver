import { OPERATING_RULES } from './manager.js';
import { isDeepStrictEqual } from 'node:util';
import { DISPLAY_NAME, TOOL_PREFIX } from './identity.js';

function objectParameters(schema) {
  if (!schema.oneOf) return schema;
  const branches = schema.oneOf.map(objectParameters);
  if (branches.some(branch => branch.type !== 'object')) throw new Error('MCP tool parameters must describe objects');
  const properties = {};
  for (const branch of branches) {
    for (const [name, property] of Object.entries(branch.properties || {})) {
      const choices = properties[name] ||= [];
      const { description: _description, ...constraints } = property;
      if (!choices.some(choice => {
        const { description: _previousDescription, ...previous } = choice;
        return isDeepStrictEqual(previous, constraints);
      })) choices.push(property);
    }
  }
  return {
    type: 'object',
    properties: Object.fromEntries(Object.entries(properties).map(([name, choices]) => {
      if (choices.length === 1) return [name, choices[0]];
      if (choices.every(choice => choice.type === choices[0].type && (Object.hasOwn(choice, 'const') || choice.enum))) {
        return [name, { type: choices[0].type,
          ...(choices[0].description ? { description: choices[0].description } : {}),
          enum: [...new Set(choices.flatMap(choice => Object.hasOwn(choice, 'const') ? [choice.const] : choice.enum))] }];
      }
      return [name, { oneOf: choices }];
    })),
    required: (branches[0].required || []).filter(name => branches.every(branch => branch.required?.includes(name))),
    additionalProperties: branches.some(branch => branch.additionalProperties !== false),
  };
}

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
  return [{ type: 'text', text: (text && structured && !duplicate ? `${text}\n\n${structured}` : structured || text) || '工具未返回文本内容' },
    ...(value.file ? [{ type: 'file', attachment: value.file }] : [])];
}

export function toolDefinition(manager, entry, tool) {
  // Model gateways require object roots. Keep selectors and the union of fields
  // here; MCP still validates the original per-operation schema on every call.
  const schema = objectParameters(parameters(tool.inputSchema));
  if (tool.name === 'file_write') schema.properties.local_path = { type: 'string',
    description: 'DSH only: required for operation=upload. Use the saved path of this conversation attachment or a file in this session workspace. Size and SHA256 are computed by the plugin; this path is never sent to JumpServer.' };
  return {
    name: `${TOOL_PREFIX}${tool.name}`,
    description: `${tool.description || tool.name}\n[${DISPLAY_NAME}]`.trim().slice(0, 4000),
    parameters: schema,
    output: { schema: { type: 'object', properties: {
      content: { type: 'array', items: {} }, structuredContent: {}, isError: { type: 'boolean' },
      file: { type: 'object', properties: { attachmentId: { type: 'string' }, name: { type: 'string' }, bytes: { type: 'integer' } }, required: ['attachmentId', 'name', 'bytes'], additionalProperties: false },
    }, required: ['content'], additionalProperties: false }, render: renderResult },
    isConcurrencySafe: args => tool.name === 'search_assets' || (tool.name === 'query_actions' && args?.operation === 'list'),
    timeoutMs: entry.row.timeoutMs,
    async execute(args, exec) {
      args ??= {};
      const transfer = (tool.name === 'file_write' && args.operation === 'upload') || (tool.name === 'file_read' && args.operation === 'download') ||
        (tool.name === 'query_actions' && args.operation === 'get') || Object.hasOwn(args, 'local_path');
      const { result, file } = transfer ? await manager.files.execute(entry.row.id, tool.name, args, exec) :
        { result: await manager.call(entry.row.id, tool.name, args, { signal: exec?.signal }) };
      if (result.isError) throw new Error(result.content.filter(block => block.type === 'text').map(block => block.text).join('\n') || 'JumpServer 工具返回错误');
      return { content: result.content, ...(result.structuredContent !== undefined ? { structuredContent: result.structuredContent } : {}),
        ...(file ? { file } : {}), isError: false };
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

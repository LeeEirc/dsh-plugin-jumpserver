// Built from src/client.js by npm run build.
window.__ModuleLoader__.load({
  id: 'dsh-plugin-jumpserver',
  factory: (require) => {
    const module = { exports: {} };
    const exports = module.exports;
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client.js
var client_exports = {};
__export(client_exports, {
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(client_exports);
var import_react = __toESM(require("react"), 1);

// lib/remote-contract.js
var import_zod = require("zod");
var jsonCodec = { mode: "strict", typeSymbol: "dsh-plugin-jumpserver#Json", create: () => import_zod.z.json() };
var remoteContract = {
  package: "dsh-plugin-jumpserver",
  descriptors: [{
    id: "dsh-plugin-jumpserver#jumpserver/request",
    service: "jumpserver",
    namespace: "jumpserver",
    method: "request",
    invocation: { kind: "direct" },
    parameters: [{ name: "input", wire: "input", source: "json", codec: jsonCodec }],
    result: jsonCodec
  }]
};

// lib/identity.js
var PLUGIN_ID = "jumpserver";
var DISPLAY_NAME = "JumpServer";
var TOOL_PREFIX = "mcp__jumpserver__";

// lib/singleton.js
function claimSingleton(ctx, side) {
  const key = /* @__PURE__ */ Symbol.for(`dsh-plugin-jumpserver.${side}.owners`);
  const owners = globalThis[key] ??= /* @__PURE__ */ new WeakMap();
  const root = ctx.root;
  if (owners.has(root)) {
    throw Object.assign(new Error("JumpServer \u63D2\u4EF6\u5DF2\u542F\u7528\uFF0C\u8BF7\u4FEE\u6539\u73B0\u6709\u914D\u7F6E"), { code: "already_loaded" });
  }
  const owner = {};
  owners.set(root, owner);
  ctx.effect(() => () => {
    if (owners.get(root) === owner) owners.delete(root);
  });
}

// src/client.js
var h = import_react.default.createElement;
var inject = ["remote"];
var zh = {
  title: "JumpServer",
  intro: "\u8FDE\u63A5 JumpServer\uFF0C\u5728\u6D4F\u89C8\u5668\u4E2D\u6388\u6743\u540E\u4F7F\u7528\u83B7\u51C6\u8BBF\u95EE\u7684\u8D44\u4EA7\u5DE5\u5177\u3002",
  connection: "\u8FDE\u63A5\u6982\u89C8",
  configuration: "\u8FDE\u63A5\u8BBE\u7F6E",
  loading: "\u6B63\u5728\u8BFB\u53D6\u8FDE\u63A5\u2026",
  url: "JumpServer / MCP \u5730\u5740",
  timeout: "\u5DE5\u5177\u8C03\u7528\u8D85\u65F6\uFF08\u6BEB\u79D2\uFF09",
  save: "\u4FDD\u5B58\u914D\u7F6E",
  cancel: "\u53D6\u6D88",
  authorize: "\u6D4F\u89C8\u5668\u6388\u6743",
  open: "\u6253\u5F00\u6388\u6743\u9875\u9762",
  connect: "\u91CD\u65B0\u8FDE\u63A5",
  edit: "\u7F16\u8F91",
  disable: "\u505C\u7528",
  enable: "\u542F\u7528",
  logout: "\u64A4\u9500\u6388\u6743",
  remove: "\u6E05\u9664\u914D\u7F6E",
  connected: "\u5DF2\u8FDE\u63A5",
  "needs-auth": "\u5F85\u6388\u6743",
  authorizing: "\u7B49\u5F85\u6D4F\u89C8\u5668\u6388\u6743",
  connecting: "\u8FDE\u63A5\u4E2D",
  disabled: "\u5DF2\u505C\u7528",
  disconnected: "\u672A\u8FDE\u63A5",
  error: "\u8FDE\u63A5\u5931\u8D25",
  tools: "\u5DE5\u5177",
  toolsHint: "\u5DF2\u63A5\u5165\u5BF9\u8BDD\uFF0C\u6309\u9700\u67E5\u770B\u5DE5\u5177\u8BF4\u660E\u3002",
  noTools: "\u8FDE\u63A5\u540E\u81EA\u52A8\u53D1\u73B0\u53EF\u7528\u5DE5\u5177\u3002",
  viewTools: "\u67E5\u770B",
  collapseTools: "\u6536\u8D77",
  tool_search_assets: "\u8D44\u4EA7\u641C\u7D22",
  tool_connect_asset: "\u8FDE\u63A5\u8D44\u4EA7",
  tool_disconnect_asset: "\u65AD\u5F00\u8FDE\u63A5",
  tool_execute_command: "\u6267\u884C\u547D\u4EE4",
  tool_query_actions: "\u64CD\u4F5C\u67E5\u8BE2",
  tool_query_sessions: "\u4F1A\u8BDD\u67E5\u8BE2",
  tool_file_read: "\u6587\u4EF6\u8BFB\u53D6",
  tool_file_write: "\u6587\u4EF6\u5199\u5165",
  tool_cancel_action: "\u53D6\u6D88\u64CD\u4F5C",
  tool_open_terminal: "\u4EBA\u5DE5\u7EC8\u7AEF",
  logs: "\u8BCA\u65AD\u65E5\u5FD7",
  refresh: "\u5237\u65B0",
  empty: "\u914D\u7F6E\u4E00\u4E2A JumpServer \u5730\u5740\u540E\u5373\u53EF\u6388\u6743\u8FDE\u63A5\u3002",
  none: "\u6682\u65E0\u65E5\u5FD7",
  expires: "Token \u5230\u671F",
  refreshed: "\u6700\u8FD1\u5237\u65B0",
  deleteQuestion: "\u6E05\u9664 JumpServer \u8FDE\u63A5\u914D\u7F6E\u53CA\u672C\u5730 Token\uFF1F\u670D\u52A1\u7AEF\u6388\u6743\u53EF\u5148\u901A\u8FC7\u201C\u64A4\u9500\u6388\u6743\u201D\u64A4\u9500\u3002",
  logoutQuestion: "\u64A4\u9500 JumpServer \u7684 OAuth \u6388\u6743\uFF1F",
  authHint: "\u5728\u65B0\u9875\u9762\u767B\u5F55\u5E76\u786E\u8BA4\u53EF\u8BBF\u95EE\u7EC4\u7EC7\u7684\u6388\u6743\u3002\u6388\u6743\u5B8C\u6210\u540E\u672C\u9875\u4F1A\u81EA\u52A8\u66F4\u65B0\u3002"
};
var en = {
  title: "JumpServer",
  intro: "Connect JumpServer and authorize in your browser to use permitted asset tools.",
  connection: "Connection overview",
  configuration: "Connection settings",
  loading: "Loading connection\u2026",
  url: "JumpServer / MCP URL",
  timeout: "Tool call timeout (ms)",
  save: "Save configuration",
  cancel: "Cancel",
  authorize: "Authorize in browser",
  open: "Open authorization page",
  connect: "Reconnect",
  edit: "Edit",
  disable: "Disable",
  enable: "Enable",
  logout: "Revoke authorization",
  remove: "Clear configuration",
  connected: "Connected",
  "needs-auth": "Authorization required",
  authorizing: "Waiting for browser",
  connecting: "Connecting",
  disabled: "Disabled",
  disconnected: "Disconnected",
  error: "Connection failed",
  tools: "Tools",
  toolsHint: "Available in conversations. Browse details when needed.",
  noTools: "Tools are discovered after connecting.",
  viewTools: "View",
  collapseTools: "Collapse",
  tool_search_assets: "Search assets",
  tool_connect_asset: "Connect asset",
  tool_disconnect_asset: "Disconnect",
  tool_execute_command: "Run command",
  tool_query_actions: "Query operations",
  tool_query_sessions: "Query sessions",
  tool_file_read: "Read files",
  tool_file_write: "Write files",
  tool_cancel_action: "Cancel operation",
  tool_open_terminal: "Human terminal",
  logs: "Diagnostics",
  refresh: "Refresh",
  empty: "Configure a JumpServer URL to authorize and connect.",
  none: "No diagnostics yet",
  expires: "Token expires",
  refreshed: "Last refreshed",
  deleteQuestion: "Clear the JumpServer configuration and local tokens? Revoke authorization first to revoke the server grant.",
  logoutQuestion: "Revoke JumpServer OAuth authorization?",
  authHint: "Sign in and authorize access to your available organizations in the new page. This page updates automatically."
};
var css = `
.jsm-page{flex:1;min-height:0;overflow:auto;color:var(--dsw-alias-label-primary)}
.jsm{box-sizing:border-box;max-width:1040px;margin:0 auto;padding:32px;display:flex;flex-direction:column;gap:20px}
.jsm-title{padding-top:var(--dsh-frame-top-clearance,0px)}
.jsm h1{margin:0 0 8px;font-size:24px;line-height:1.4}.jsm h2{margin:0;font-size:16px;line-height:1.5}
.jsm p{margin:0;color:var(--dsw-alias-label-secondary);line-height:1.6}
.jsm-card{border:1px solid var(--dsw-alias-border-l2);border-radius:12px;padding:20px;background:var(--dsw-alias-bg-layer-3);display:flex;flex-direction:column;gap:16px;min-width:0}
.jsm-head,.jsm-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.jsm-head h2{flex:1}
.jsm-status{font-size:12px;border-radius:6px;padding:4px 8px;background:var(--dsw-alias-bg-layer-1)}.jsm-status[data-state=connected]{color:var(--dsw-alias-state-success-primary)}
.jsm-error{color:var(--dsw-alias-state-error-primary);font-size:13px;overflow-wrap:anywhere}.jsm-url{font-size:13px;overflow-wrap:anywhere;color:var(--dsw-alias-label-secondary)}
.jsm-form{display:flex;flex-direction:column;gap:16px}.jsm-fields{display:grid;grid-template-columns:minmax(0,1fr) minmax(160px,220px);gap:16px}
.jsm label{font-size:13px;display:flex;flex-direction:column;gap:8px}.jsm input{box-sizing:border-box;width:100%;font:inherit;padding:9px 12px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-1)}
.jsm button{font:inherit;font-size:13px;padding:7px 12px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-1);cursor:pointer}.jsm button:disabled{opacity:.5;cursor:default}.jsm button:focus-visible,.jsm input:focus-visible,.jsm summary:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:3px}
.jsm .jsm-primary{background:var(--dsw-alias-state-business-primary);color:white;border-color:transparent}.jsm .jsm-danger{color:var(--dsw-alias-state-error-primary)}
.jsm-management{padding-top:16px;border-top:1px solid var(--dsw-alias-border-l2)}.jsm small{font-size:12px;color:var(--dsw-alias-label-tertiary)}
.jsm-tools-card{padding:0;gap:0}.jsm-catalog{min-width:0}.jsm-catalog-summary{display:flex;align-items:center;gap:12px;padding:18px 20px;cursor:pointer;border-radius:12px;list-style:none}.jsm-catalog-summary:hover{background:var(--dsw-alias-bg-layer-1)}
.jsm-catalog summary::-webkit-details-marker{display:none}.jsm-catalog summary::marker{content:''}
.jsm-catalog-icon{display:flex;align-items:center;justify-content:center;flex:none;width:34px;height:34px;border-radius:9px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary)}
.jsm-catalog-title{display:flex;align-items:center;gap:8px}.jsm-count{padding:2px 7px;border-radius:5px;font-size:12px;line-height:1.4;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums}
.jsm-catalog-hint{flex:1;font-size:12px;color:var(--dsw-alias-label-tertiary);line-height:1.5}.jsm-catalog-toggle{display:flex;align-items:center;gap:6px;flex:none;font-size:12px;color:var(--dsw-alias-label-secondary)}
.jsm-chevron{flex:none;transition:transform .15s}.jsm-catalog[open]>.jsm-catalog-summary .jsm-chevron,.jsm-tool[open]>summary .jsm-chevron{transform:rotate(90deg)}
.jsm-catalog .jsm-when-open{display:none}.jsm-catalog[open]>.jsm-catalog-summary .jsm-when-open{display:inline}.jsm-catalog[open]>.jsm-catalog-summary .jsm-when-closed{display:none}
.jsm-catalog[open]>.jsm-catalog-summary{border-bottom:1px solid var(--dsw-alias-border-l2);border-radius:12px 12px 0 0}.jsm-tool-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));align-items:start;gap:8px;padding:16px}
.jsm-tool{min-width:0;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;overflow:hidden}.jsm-tool>summary{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:11px 12px;cursor:pointer;font-size:13px;line-height:1.5;list-style:none}.jsm-tool>summary:hover{background:var(--dsw-alias-bg-layer-1)}.jsm-tool>summary span{overflow-wrap:anywhere}.jsm-tool[open]{border-color:var(--dsw-alias-state-business-primary)}
.jsm-tool-body{max-height:180px;overflow:auto;padding:0 12px 12px}.jsm-tool-body code{display:block;overflow-wrap:anywhere;font-size:11px;color:var(--dsw-alias-label-tertiary);line-height:1.6}.jsm-tool-body p{font-size:12px;margin-top:8px;white-space:pre-wrap;overflow-wrap:anywhere}.jsm-catalog-empty{padding:16px 20px}
.jsm pre{margin:0;max-height:300px;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px;line-height:1.7}.jsm a{color:var(--dsw-alias-state-business-primary)}
@media(min-width:1100px){.jsm-tool-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media(max-width:800px){.jsm-catalog-summary{flex-wrap:wrap;gap:10px}.jsm-catalog-hint{order:1;flex-basis:100%;padding-left:44px}.jsm-catalog-toggle{margin-left:auto}}
@media(max-width:640px){.jsm{padding:20px 16px;gap:16px}.jsm-card{padding:16px}.jsm-fields{grid-template-columns:minmax(0,1fr)}.jsm-tools-card{padding:0}.jsm-catalog-summary{padding:16px}.jsm-tool-grid{grid-template-columns:minmax(0,1fr);padding:12px}}
@media(prefers-reduced-motion:reduce){.jsm-chevron{transition:none}}
`;
function PanelIcon({ size = 20 }) {
  return h(
    "svg",
    { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true },
    h("rect", { x: 3, y: 4, width: 18, height: 14, rx: 3 }),
    h("path", { d: "m7 8 3 3-3 3m6 0h4M9 21h6m-3-3v3" })
  );
}
function Chevron() {
  return h(
    "svg",
    { className: "jsm-chevron", width: 14, height: 14, viewBox: "0 0 20 20", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true },
    h("path", { d: "m7.5 5 5 5-5 5" })
  );
}
var knownTools = /* @__PURE__ */ new Set(["search_assets", "connect_asset", "disconnect_asset", "execute_command", "query_actions", "query_sessions", "file_read", "file_write", "cancel_action", "open_terminal"]);
function ToolsCatalog({ tools, t }) {
  return h(
    "section",
    { className: "jsm-card jsm-tools-card", "aria-labelledby": "jumpserver-tools-title" },
    h(
      "details",
      { className: "jsm-catalog" },
      h(
        "summary",
        { className: "jsm-catalog-summary" },
        h("span", { className: "jsm-catalog-icon", "aria-hidden": true }, h(PanelIcon, { size: 18 })),
        h("h2", { className: "jsm-catalog-title", id: "jumpserver-tools-title" }, t("tools"), h("span", { className: "jsm-count" }, tools.length)),
        h("span", { className: "jsm-catalog-hint" }, t(tools.length ? "toolsHint" : "noTools")),
        h("span", { className: "jsm-catalog-toggle" }, h("span", { className: "jsm-when-closed" }, t("viewTools")), h("span", { className: "jsm-when-open" }, t("collapseTools")), h(Chevron))
      ),
      tools.length ? h("div", { className: "jsm-tool-grid" }, ...tools.map((tool) => h(
        "details",
        { className: "jsm-tool", key: tool.name, name: "jumpserver-tool-details" },
        h("summary", { title: tool.name }, h("span", null, knownTools.has(tool.name) ? t(`tool_${tool.name}`) : tool.name), h(Chevron)),
        h("div", { className: "jsm-tool-body" }, h("code", null, `${TOOL_PREFIX}${tool.name}`), h("p", null, tool.description))
      ))) : h("p", { className: "jsm-catalog-empty" }, t("noTools"))
    )
  );
}
function JumpServerPage({ request, t }) {
  const [connection, setConnection] = import_react.default.useState(null);
  const [loaded, setLoaded] = import_react.default.useState(false);
  const [error, setError] = import_react.default.useState("");
  const [busy, setBusy] = import_react.default.useState(false);
  const [editing, setEditing] = import_react.default.useState(false);
  const [values, setValues] = import_react.default.useState({ url: "", timeoutMs: "60000" });
  const [authorization, setAuthorization] = import_react.default.useState(null);
  const [logs, setLogs] = import_react.default.useState([]);
  const refresh = import_react.default.useCallback(async () => {
    const row = await request({ action: "status" });
    const entries = row ? await request({ action: "logs", id: row.id }) : [];
    return { row, entries };
  }, [request]);
  const update = ({ row, entries }) => {
    setConnection(row);
    setLogs(entries);
    setLoaded(true);
    setAuthorization((previous) => previous && row?.status === "authorizing" ? previous : null);
  };
  import_react.default.useEffect(() => {
    let active = true, running = false;
    const poll = async () => {
      if (running || !active) return;
      running = true;
      try {
        const snapshot = await refresh();
        if (active) update(snapshot);
      } catch (e) {
        if (active) setError(e.message);
      } finally {
        running = false;
      }
    };
    poll();
    const timer = setInterval(poll, 2500);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [refresh]);
  const run = async (work) => {
    setBusy(true);
    setError("");
    try {
      await work();
      update(await refresh());
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const authorize = () => {
    const popup = window.open("about:blank", "_blank");
    if (popup) popup.opener = null;
    run(async () => {
      try {
        const options = {};
        if (location.protocol === "http:" && ["127.0.0.1", "localhost", "[::1]"].includes(location.hostname)) {
          const callback = new URL(location.origin);
          if (callback.hostname === "localhost") callback.hostname = "127.0.0.1";
          options.callbackOrigin = callback.origin;
        }
        const result = await request({ action: "authorize", id: connection.id, options });
        setAuthorization(result);
        if (popup) popup.location.href = result.authorizeUrl;
      } catch (e) {
        popup?.close();
        throw e;
      }
    });
  };
  const field = (key, type = "text") => h(
    "label",
    { key },
    t(key === "timeoutMs" ? "timeout" : key),
    h("input", {
      type,
      required: true,
      disabled: busy,
      value: values[key],
      "aria-label": t(key === "timeoutMs" ? "timeout" : key),
      placeholder: key === "url" ? "https://jumpserver.example.com/koko/mcp" : void 0,
      min: type === "number" ? 1e3 : void 0,
      max: type === "number" ? 6e5 : void 0,
      onChange: (event) => setValues((old) => ({ ...old, [key]: event.target.value }))
    })
  );
  const action = (label, handler, extra = {}) => h("button", { type: "button", disabled: busy || !loaded, onClick: handler, ...extra }, t(label));
  const configuration = h(
    "section",
    { className: "jsm-card", id: "jumpserver-configuration", "aria-labelledby": "jumpserver-configuration-title" },
    h("h2", { id: "jumpserver-configuration-title" }, t("configuration")),
    !connection && h("p", null, t("empty")),
    h(
      "form",
      { className: "jsm-form", onSubmit: (event) => {
        event.preventDefault();
        run(async () => {
          await request({ ...connection ? { action: "update", id: connection.id } : { action: "add" }, values });
          setEditing(false);
          setValues({ url: "", timeoutMs: "60000" });
        });
      } },
      h("div", { className: "jsm-fields" }, field("url"), field("timeoutMs", "number")),
      h(
        "div",
        { className: "jsm-actions" },
        h("button", { className: "jsm-primary", type: "submit", disabled: busy || !loaded }, t("save")),
        connection && action("cancel", () => setEditing(false))
      )
    ),
    connection && h(
      "div",
      { className: "jsm-actions jsm-management" },
      action("logout", () => {
        if (window.confirm(t("logoutQuestion"))) run(() => request({ action: "logout", id: connection.id }));
      }),
      action("remove", () => {
        if (window.confirm(t("deleteQuestion"))) run(async () => {
          await request({ action: "remove", id: connection.id });
          setEditing(false);
          setAuthorization(null);
          setLogs([]);
          setValues({ url: "", timeoutMs: "60000" });
        });
      }, { className: "jsm-danger" })
    )
  );
  return h("div", { className: "jsm-page", "data-jumpserver-page": true }, h(
    "main",
    { className: "jsm", "aria-label": DISPLAY_NAME },
    h("header", { className: "jsm-title" }, h("h1", null, DISPLAY_NAME), h("p", null, t("intro"))),
    error && h("div", { className: "jsm-error", role: "alert" }, error),
    !loaded && h("p", { role: "status" }, t("loading")),
    connection && h(
      "section",
      { className: "jsm-card", "data-connection": PLUGIN_ID, "aria-labelledby": "jumpserver-connection-title" },
      h("div", { className: "jsm-head" }, h("h2", { id: "jumpserver-connection-title" }, t("connection")), h("span", { className: "jsm-status", "data-state": connection.status, role: "status" }, t(connection.status))),
      h("div", { className: "jsm-url" }, connection.url),
      connection.error && h("div", { className: "jsm-error" }, connection.error),
      h(
        "div",
        { className: "jsm-actions" },
        connection.enabled && action("authorize", authorize, { className: "jsm-primary" }),
        connection.enabled && action("connect", () => run(() => request({ action: "connect", id: connection.id }))),
        action(connection.enabled ? "disable" : "enable", () => run(() => request({ action: "update", id: connection.id, values: { enabled: !connection.enabled } }))),
        action("configuration", () => {
          if (!editing) setValues({ url: connection.url, timeoutMs: String(connection.timeoutMs) });
          setEditing((previous) => !previous);
        }, { "aria-expanded": editing, "aria-controls": "jumpserver-configuration" })
      ),
      authorization && connection.status === "authorizing" && h("p", null, t("authHint"), " ", h("a", { href: authorization.authorizeUrl, target: "_blank", rel: "noopener noreferrer" }, t("open"))),
      connection.expiresAt && h("small", null, `${t("expires")}: ${new Date(connection.expiresAt).toLocaleString()}${connection.lastRefreshAt ? ` \xB7 ${t("refreshed")}: ${new Date(connection.lastRefreshAt).toLocaleString()}` : ""}`)
    ),
    loaded && (!connection || editing) && configuration,
    loaded && h(ToolsCatalog, { tools: connection?.tools || [], t }),
    loaded && h(
      "section",
      { className: "jsm-card", "aria-labelledby": "jumpserver-logs-title" },
      h(
        "div",
        { className: "jsm-head" },
        h("h2", { id: "jumpserver-logs-title" }, t("logs")),
        action("refresh", () => run(async () => {
        }))
      ),
      h("pre", null, logs.map((log) => `${new Date(log.at).toLocaleTimeString()} [${log.phase}] ${log.message}`).join("\n") || t("none"))
    )
  ));
}
function registerPage(ctx) {
  ctx.effect(() => ctx.locale.register("jumpserver", { zh, en }));
  const request = async (input) => {
    const remote = await ctx.remote.jumpserver.request(input);
    if (!remote.ok) throw new Error(remote.error.message || remote.error.code);
    const result = remote.value;
    if (!result.ok) throw new Error(result.error.message);
    return result.value;
  };
  const t = ctx.locale.bind("jumpserver");
  if (!document.querySelector("style[data-jumpserver]")) {
    const style = document.createElement("style");
    style.dataset.jumpserver = "true";
    style.textContent = css;
    document.head.appendChild(style);
    ctx.effect(() => () => style.remove());
  }
  ctx.slots.inject("main", () => ctx.slots.register({ name: "main", key: PLUGIN_ID, locale: "jumpserver" }, () => h(JumpServerPage, { request, t })));
  ctx.slots.inject("sidebar.panellist", () => ctx.slots.register({ name: "sidebar.panellist", id: PLUGIN_ID, order: 51, label: () => t("title"), locale: "jumpserver" }, PanelIcon));
}
async function apply(ctx) {
  claimSingleton(ctx, "client");
  const unmount = await ctx.remote.$mount(remoteContract);
  const ui = ctx.inject(["remote.jumpserver", "slots", "locale"], registerPage);
  try {
    await ui;
  } catch (error) {
    await ui.dispose();
    await unmount();
    throw error;
  }
  return async () => {
    await ui.dispose();
    await unmount();
  };
}

    return module.exports;
  }
});

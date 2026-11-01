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
  logs: "\u8BCA\u65AD\u65E5\u5FD7",
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
  logs: "Diagnostics",
  empty: "Configure a JumpServer URL to authorize and connect.",
  none: "No diagnostics yet",
  expires: "Token expires",
  refreshed: "Last refreshed",
  deleteQuestion: "Clear the JumpServer configuration and local tokens? Revoke authorization first to revoke the server grant.",
  logoutQuestion: "Revoke JumpServer OAuth authorization?",
  authHint: "Sign in and authorize access to your available organizations in the new page. This page updates automatically."
};
var css = `.jsm{max-width:850px;color:var(--dsw-alias-label-primary);display:flex;flex-direction:column;gap:16px}.jsm p{margin:0;color:var(--dsw-alias-label-secondary);line-height:1.6}.jsm h3{margin:0;font-size:16px}.jsm-card,.jsm-form{border:1px solid var(--dsw-alias-border-l2);border-radius:10px;padding:16px;background:var(--dsw-alias-bg-layer-3);display:flex;flex-direction:column;gap:12px}.jsm-head,.jsm-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.jsm-head strong{flex:1}.jsm-status{font-size:12px;border-radius:6px;padding:3px 8px;background:var(--dsw-alias-bg-layer-1)}.jsm-status[data-state=connected]{color:var(--dsw-alias-state-success-primary)}.jsm-error{color:var(--dsw-alias-state-error-primary);font-size:13px;overflow-wrap:anywhere}.jsm-url{font-size:12px;overflow-wrap:anywhere;color:var(--dsw-alias-label-tertiary)}.jsm label{font-size:13px;display:flex;flex-direction:column;gap:6px}.jsm input{font:inherit;padding:8px 10px;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-1)}.jsm button{font:inherit;font-size:12px;padding:6px 10px;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-1);cursor:pointer}.jsm button:disabled{opacity:.5;cursor:default}.jsm .jsm-primary{background:var(--dsw-alias-state-business-primary);color:white;border-color:transparent}.jsm small{font-size:11px;color:var(--dsw-alias-label-tertiary)}.jsm details{font-size:12px}.jsm summary{cursor:pointer}.jsm pre{max-height:220px;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;font-size:11px}.jsm li{margin:8px 0}.jsm a{color:var(--dsw-alias-state-business-primary)}`;
function Settings({ request, t }) {
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
    setConnection(row);
    setLoaded(true);
    setAuthorization((previous) => previous && row?.status === "authorizing" ? previous : null);
  }, [request]);
  import_react.default.useEffect(() => {
    let active = true, running = false;
    const poll = async () => {
      if (running || !active) return;
      running = true;
      try {
        const row = await request({ action: "status" });
        if (active) {
          setConnection(row);
          setLoaded(true);
        }
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
  }, [request]);
  const run = async (work) => {
    setBusy(true);
    setError("");
    try {
      await work();
      await refresh();
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
      value: values[key],
      "aria-label": t(key === "timeoutMs" ? "timeout" : key),
      placeholder: key === "url" ? "https://jumpserver.example.com/koko/mcp" : void 0,
      min: type === "number" ? 1e3 : void 0,
      max: type === "number" ? 6e5 : void 0,
      onChange: (event) => setValues((old) => ({ ...old, [key]: event.target.value }))
    })
  );
  const action = (label, handler, extra = {}) => h("button", { type: "button", disabled: busy || !loaded, onClick: handler, ...extra }, t(label));
  return h(
    "section",
    { className: "jsm", "data-jumpserver-settings": true },
    h("h3", null, t("title")),
    h("p", null, t("intro")),
    error && h("div", { className: "jsm-error", role: "alert" }, error),
    (!connection || editing) && h(
      "form",
      { className: "jsm-form", onSubmit: (event) => {
        event.preventDefault();
        run(async () => {
          await request({ ...connection ? { action: "update", id: connection.id } : { action: "add" }, values });
          setEditing(false);
          setValues({ url: "", timeoutMs: "60000" });
        });
      } },
      field("url"),
      field("timeoutMs", "number"),
      h(
        "div",
        { className: "jsm-actions" },
        h("button", { className: "jsm-primary", type: "submit", disabled: busy || !loaded }, t("save")),
        connection && action("cancel", () => setEditing(false))
      )
    ),
    loaded && !connection && h("p", null, t("empty")),
    connection && h(
      "article",
      { className: "jsm-card", "data-connection": PLUGIN_ID },
      h("div", { className: "jsm-head" }, h("strong", null, DISPLAY_NAME), h("span", { className: "jsm-status", "data-state": connection.status }, `${t(connection.status)}${connection.status === "connected" ? ` \xB7 ${connection.toolCount} ${t("tools")}` : ""}`)),
      h("div", { className: "jsm-url" }, connection.url),
      connection.error && h("div", { className: "jsm-error" }, connection.error),
      h(
        "div",
        { className: "jsm-actions" },
        connection.enabled && action("authorize", authorize, { className: "jsm-primary" }),
        connection.enabled && action("connect", () => run(() => request({ action: "connect", id: connection.id }))),
        action("edit", () => {
          setEditing(true);
          setValues({ url: connection.url, timeoutMs: String(connection.timeoutMs) });
        }),
        action(connection.enabled ? "disable" : "enable", () => run(() => request({ action: "update", id: connection.id, values: { enabled: !connection.enabled } }))),
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
        })
      ),
      authorization && connection.status === "authorizing" && h("p", null, t("authHint"), " ", h("a", { href: authorization.authorizeUrl, target: "_blank", rel: "noopener noreferrer" }, t("open"))),
      connection.expiresAt && h("small", null, `${t("expires")}: ${new Date(connection.expiresAt).toLocaleString()}${connection.lastRefreshAt ? ` \xB7 ${t("refreshed")}: ${new Date(connection.lastRefreshAt).toLocaleString()}` : ""}`),
      h("details", null, h("summary", null, `${t("tools")} (${connection.toolCount})`), h("ul", null, ...connection.tools.map((tool) => h("li", { key: tool.name }, h("code", null, tool.name), h("p", null, tool.description))))),
      h(
        "details",
        { onToggle: (event) => {
          if (event.currentTarget.open) request({ action: "logs", id: connection.id }).then(setLogs).catch((e) => setError(e.message));
        } },
        h("summary", null, t("logs")),
        h("pre", null, logs.map((log) => `${new Date(log.at).toLocaleTimeString()} [${log.phase}] ${log.message}`).join("\n") || t("none"))
      )
    )
  );
}
function registerSettings(ctx) {
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
  ctx.slots.inject("settings.section", () => ctx.slots.register({ name: "settings.section", id: "jumpserver", order: 51, label: () => t("title"), locale: "jumpserver" }, () => h(Settings, { request, t })));
}
async function apply(ctx) {
  claimSingleton(ctx, "client");
  const unmount = await ctx.remote.$mount(remoteContract);
  const ui = ctx.inject(["remote.jumpserver", "slots", "locale"], registerSettings);
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

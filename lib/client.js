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

// src/client.js
var h = import_react.default.createElement;
var inject = ["remote"];
var zh = {
  title: "JumpServer",
  intro: "\u8FDE\u63A5 JumpServer\uFF0C\u5728\u6D4F\u89C8\u5668\u4E2D\u6388\u6743\u540E\u4F7F\u7528\u83B7\u51C6\u8BBF\u95EE\u7684\u8D44\u4EA7\u5DE5\u5177\u3002",
  name: "\u5B9E\u4F8B\u6807\u8BC6",
  url: "JumpServer / MCP \u5730\u5740",
  timeout: "\u5DE5\u5177\u8C03\u7528\u8D85\u65F6\uFF08\u6BEB\u79D2\uFF09",
  add: "\u6DFB\u52A0\u5B9E\u4F8B",
  save: "\u4FDD\u5B58\u4FEE\u6539",
  cancel: "\u53D6\u6D88",
  authorize: "\u6D4F\u89C8\u5668\u6388\u6743",
  open: "\u6253\u5F00\u6388\u6743\u9875\u9762",
  connect: "\u91CD\u65B0\u8FDE\u63A5",
  edit: "\u7F16\u8F91",
  disable: "\u505C\u7528",
  enable: "\u542F\u7528",
  logout: "\u64A4\u9500\u6388\u6743",
  remove: "\u5220\u9664",
  connected: "\u5DF2\u8FDE\u63A5",
  "needs-auth": "\u5F85\u6388\u6743",
  authorizing: "\u7B49\u5F85\u6D4F\u89C8\u5668\u6388\u6743",
  connecting: "\u8FDE\u63A5\u4E2D",
  disabled: "\u5DF2\u505C\u7528",
  disconnected: "\u672A\u8FDE\u63A5",
  error: "\u8FDE\u63A5\u5931\u8D25",
  tools: "\u5DE5\u5177",
  logs: "\u8BCA\u65AD\u65E5\u5FD7",
  empty: "\u5C1A\u672A\u6DFB\u52A0 JumpServer \u5B9E\u4F8B\u3002",
  none: "\u6682\u65E0\u65E5\u5FD7",
  expires: "Token \u5230\u671F",
  refreshed: "\u6700\u8FD1\u5237\u65B0",
  deleteQuestion: "\u5220\u9664\u6B64\u5B9E\u4F8B\u53CA\u672C\u5730 Token\uFF1F\u670D\u52A1\u7AEF\u6388\u6743\u53EF\u5148\u901A\u8FC7\u201C\u64A4\u9500\u6388\u6743\u201D\u64A4\u9500\u3002",
  logoutQuestion: "\u64A4\u9500\u6B64\u5B9E\u4F8B\u7684 OAuth \u6388\u6743\uFF1F",
  authHint: "\u5728\u65B0\u9875\u9762\u767B\u5F55\u3001\u9009\u62E9\u7EC4\u7EC7\u5E76\u786E\u8BA4\u6388\u6743\u3002\u6388\u6743\u5B8C\u6210\u540E\u672C\u9875\u4F1A\u81EA\u52A8\u66F4\u65B0\u3002",
  nameHint: "\u5C0F\u5199\u5B57\u6BCD\u5F00\u5934\uFF0C\u4EC5\u542B\u5C0F\u5199\u5B57\u6BCD\u3001\u6570\u5B57\u3001\u4E0B\u5212\u7EBF\uFF1B\u7528\u4E8E\u5DE5\u5177\u540D\u79F0\u3002"
};
var en = {
  title: "JumpServer",
  intro: "Connect JumpServer and authorize in your browser to use permitted asset tools.",
  name: "Instance identifier",
  url: "JumpServer / MCP URL",
  timeout: "Tool call timeout (ms)",
  add: "Add instance",
  save: "Save changes",
  cancel: "Cancel",
  authorize: "Authorize in browser",
  open: "Open authorization page",
  connect: "Reconnect",
  edit: "Edit",
  disable: "Disable",
  enable: "Enable",
  logout: "Revoke authorization",
  remove: "Delete",
  connected: "Connected",
  "needs-auth": "Authorization required",
  authorizing: "Waiting for browser",
  connecting: "Connecting",
  disabled: "Disabled",
  disconnected: "Disconnected",
  error: "Connection failed",
  tools: "Tools",
  logs: "Diagnostics",
  empty: "No JumpServer instances yet.",
  none: "No diagnostics yet",
  expires: "Token expires",
  refreshed: "Last refreshed",
  deleteQuestion: "Delete this instance and its local tokens? Revoke authorization first to revoke the server grant.",
  logoutQuestion: "Revoke OAuth authorization for this instance?",
  authHint: "Sign in, select an organization and consent in the new page. This page updates automatically.",
  nameHint: "Start with a lowercase letter; use lowercase letters, digits and underscores. Used in tool names."
};
var css = `.jsm{max-width:850px;color:var(--dsw-alias-label-primary);display:flex;flex-direction:column;gap:16px}.jsm p{margin:0;color:var(--dsw-alias-label-secondary);line-height:1.6}.jsm h3{margin:0;font-size:16px}.jsm-card,.jsm-form{border:1px solid var(--dsw-alias-border-l2);border-radius:10px;padding:16px;background:var(--dsw-alias-bg-layer-3);display:flex;flex-direction:column;gap:12px}.jsm-head,.jsm-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.jsm-head strong{flex:1}.jsm-status{font-size:12px;border-radius:6px;padding:3px 8px;background:var(--dsw-alias-bg-layer-1)}.jsm-status[data-state=connected]{color:var(--dsw-alias-state-success-primary)}.jsm-error{color:var(--dsw-alias-state-error-primary);font-size:13px;overflow-wrap:anywhere}.jsm-url{font-size:12px;overflow-wrap:anywhere;color:var(--dsw-alias-label-tertiary)}.jsm label{font-size:13px;display:flex;flex-direction:column;gap:6px}.jsm input{font:inherit;padding:8px 10px;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-1)}.jsm button{font:inherit;font-size:12px;padding:6px 10px;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-1);cursor:pointer}.jsm button:disabled{opacity:.5;cursor:default}.jsm .jsm-primary{background:var(--dsw-alias-state-business-primary);color:white;border-color:transparent}.jsm small{font-size:11px;color:var(--dsw-alias-label-tertiary)}.jsm details{font-size:12px}.jsm summary{cursor:pointer}.jsm pre{max-height:220px;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;font-size:11px}.jsm li{margin:8px 0}.jsm a{color:var(--dsw-alias-state-business-primary)}`;
function Settings({ request, t }) {
  const [instances, setInstances] = import_react.default.useState([]);
  const [error, setError] = import_react.default.useState("");
  const [busy, setBusy] = import_react.default.useState(false);
  const [editing, setEditing] = import_react.default.useState(null);
  const [values, setValues] = import_react.default.useState({ name: "", url: "", timeoutMs: "60000" });
  const [authorization, setAuthorization] = import_react.default.useState(null);
  const [logs, setLogs] = import_react.default.useState({});
  const refresh = import_react.default.useCallback(async () => {
    const rows = await request({ action: "list" });
    setInstances(rows);
    setAuthorization((previous) => previous && rows.find((row) => row.id === previous.id)?.status === "authorizing" ? previous : null);
  }, [request]);
  import_react.default.useEffect(() => {
    let active = true, running = false;
    const poll = async () => {
      if (running || !active) return;
      running = true;
      try {
        const rows = await request({ action: "list" });
        if (active) setInstances(rows);
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
  const authorize = (id) => {
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
        const result = await request({ action: "authorize", id, options });
        setAuthorization({ ...result, id });
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
      placeholder: key === "url" ? "https://jumpserver.example.com/koko/mcp" : key === "name" ? "main" : void 0,
      min: type === "number" ? 1e3 : void 0,
      max: type === "number" ? 6e5 : void 0,
      onChange: (event) => setValues((old) => ({ ...old, [key]: event.target.value }))
    })
  );
  const action = (label, handler, extra = {}) => h("button", { type: "button", disabled: busy, onClick: handler, ...extra }, t(label));
  return h(
    "section",
    { className: "jsm", "data-jumpserver-settings": true },
    h("h3", null, t("title")),
    h("p", null, t("intro")),
    error && h("div", { className: "jsm-error", role: "alert" }, error),
    h(
      "form",
      { className: "jsm-form", onSubmit: (event) => {
        event.preventDefault();
        run(async () => {
          await request({ action: editing ? "update" : "add", id: editing, values });
          setEditing(null);
          setValues({ name: "", url: "", timeoutMs: "60000" });
        });
      } },
      field("name"),
      h("small", null, t("nameHint")),
      field("url"),
      field("timeoutMs", "number"),
      h(
        "div",
        { className: "jsm-actions" },
        h("button", { className: "jsm-primary", type: "submit", disabled: busy }, t(editing ? "save" : "add")),
        editing && action("cancel", () => {
          setEditing(null);
          setValues({ name: "", url: "", timeoutMs: "60000" });
        })
      )
    ),
    !instances.length && h("p", null, t("empty")),
    ...instances.map((row) => h(
      "article",
      { className: "jsm-card", key: row.id, "data-instance": row.name },
      h("div", { className: "jsm-head" }, h("strong", null, row.name), h("span", { className: "jsm-status", "data-state": row.status }, `${t(row.status)}${row.status === "connected" ? ` \xB7 ${row.toolCount} ${t("tools")}` : ""}`)),
      h("div", { className: "jsm-url" }, row.url),
      row.error && h("div", { className: "jsm-error" }, row.error),
      h(
        "div",
        { className: "jsm-actions" },
        row.enabled && action("authorize", () => authorize(row.id), { className: "jsm-primary" }),
        row.enabled && action("connect", () => run(() => request({ action: "connect", id: row.id }))),
        action("edit", () => {
          setEditing(row.id);
          setValues({ name: row.name, url: row.url, timeoutMs: String(row.timeoutMs) });
        }),
        action(row.enabled ? "disable" : "enable", () => run(() => request({ action: "update", id: row.id, values: { enabled: !row.enabled } }))),
        action("logout", () => {
          if (window.confirm(t("logoutQuestion"))) run(() => request({ action: "logout", id: row.id }));
        }),
        action("remove", () => {
          if (window.confirm(t("deleteQuestion"))) run(() => request({ action: "remove", id: row.id }));
        })
      ),
      authorization?.id === row.id && row.status === "authorizing" && h("p", null, t("authHint"), " ", h("a", { href: authorization.authorizeUrl, target: "_blank", rel: "noopener noreferrer" }, t("open"))),
      row.expiresAt && h("small", null, `${t("expires")}: ${new Date(row.expiresAt).toLocaleString()}${row.lastRefreshAt ? ` \xB7 ${t("refreshed")}: ${new Date(row.lastRefreshAt).toLocaleString()}` : ""}`),
      h("details", null, h("summary", null, `${t("tools")} (${row.toolCount})`), h("ul", null, ...row.tools.map((tool) => h("li", { key: tool.name }, h("code", null, tool.name), h("p", null, tool.description))))),
      h(
        "details",
        { onToggle: (event) => {
          if (event.currentTarget.open) request({ action: "logs", id: row.id }).then((value) => setLogs((old) => ({ ...old, [row.id]: value }))).catch((e) => setError(e.message));
        } },
        h("summary", null, t("logs")),
        h("pre", null, (logs[row.id] || []).map((log) => `${new Date(log.at).toLocaleTimeString()} [${log.phase}] ${log.message}`).join("\n") || t("none"))
      )
    ))
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

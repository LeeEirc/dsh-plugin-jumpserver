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
var import_react2 = __toESM(require("react"), 1);

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

// src/files.js
var import_react = __toESM(require("react"), 1);
var h = import_react.default.createElement;
var FINAL = /* @__PURE__ */ new Set(["succeeded", "failed", "cancelled", "rejected", "expired", "unknown"]);
async function fileFetch(kind, transferId, init) {
  const path = `api/jumpserver/files/${kind}?transferId=${encodeURIComponent(transferId)}`;
  const response = globalThis.__DSH_FILE_UPLOAD__?.fetch ? await globalThis.__DSH_FILE_UPLOAD__.fetch(path, init) : await fetch(new URL(path, document.baseURI), { credentials: "same-origin", ...init });
  if (!response.ok) {
    const result = await response.json().catch(() => null);
    throw new Error(result?.error?.message || `HTTP ${response.status}`);
  }
  return response;
}
function FileTransfer({ request, t, instanceId }) {
  const [query, setQuery] = import_react.default.useState("");
  const [assets, setAssets] = import_react.default.useState([]);
  const [assetId, setAssetId] = import_react.default.useState("");
  const [account, setAccount] = import_react.default.useState("");
  const [path, setPath] = import_react.default.useState("/");
  const [file, setFile] = import_react.default.useState(null);
  const [overwrite, setOverwrite] = import_react.default.useState(false);
  const [transfer, setTransfer] = import_react.default.useState(null);
  const [busy, setBusy] = import_react.default.useState(false);
  const [error, setError] = import_react.default.useState("");
  const active = import_react.default.useRef(null);
  const current = import_react.default.useRef(null);
  const opened = import_react.default.useRef(false);
  const asset = assets.find((row) => row.id === assetId);
  const accounts = (asset?.accounts || []).filter((row) => row.protocols?.includes("sftp"));
  const disabled = busy || Boolean(transfer);
  import_react.default.useEffect(() => () => {
    active.current?.abort();
    if (current.current) request({ action: "file_cancel", transferId: current.current.id }).catch(() => {
    });
  }, [request]);
  const run = async (work) => {
    if (active.current) return;
    const controller = new AbortController();
    active.current = controller;
    setBusy(true);
    setError("");
    try {
      await work(controller.signal);
    } catch (e) {
      if (!controller.signal.aborted) setError(e.message);
    } finally {
      if (active.current === controller) {
        active.current = null;
        setBusy(false);
      }
    }
  };
  const search = () => run(async (signal) => {
    const result = await request({ action: "file_assets", id: instanceId, query });
    if (signal.aborted) return;
    const rows = result.results || [];
    setAssets(rows);
    setAssetId(rows[0]?.id || "");
    setAccount(rows[0]?.accounts?.find((row) => row.protocols?.includes("sftp"))?.id || "");
  });
  const show = (value) => {
    current.current = value;
    setTransfer(value);
  };
  const drive = async (initial, signal) => {
    let value = initial;
    for (let attempt = 0; attempt < 20 && !signal.aborted; attempt++) {
      show(value);
      if (FINAL.has(value.phase) || ["awaiting_approval", "awaiting_input"].includes(value.phase)) return;
      if (value.phase === "upload_ready") {
        const response = await fileFetch("upload", value.id, { method: "POST", headers: { "Content-Type": "application/octet-stream" }, body: file, signal });
        const result = await response.json();
        if (!result.ok) throw new Error(result.error.message);
        value = result.value;
      } else if (value.phase === "download_ready") {
        const response = await fileFetch("download", value.id, { method: "GET", signal });
        const blob = await response.blob();
        if (signal.aborted) return;
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = value.path.split("/").pop() || "download";
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1e3);
        show({ ...value, phase: "succeeded", status: "succeeded" });
        return;
      } else {
        await new Promise((resolve) => {
          const done = () => {
            clearTimeout(timer);
            signal.removeEventListener("abort", done);
            resolve();
          };
          const timer = setTimeout(done, 700);
          signal.addEventListener("abort", done, { once: true });
        });
        if (signal.aborted) return;
        value = await request({ action: "file_status", transferId: value.id });
      }
    }
    if (!signal.aborted) show(value);
  };
  const start = (kind) => run(async (signal) => {
    const input = { action: "file_start", instanceId, assetId, account, kind, remotePath: path, overwrite };
    if (kind === "upload") {
      if (!file || file.size > 100 * 1024 * 1024) throw new Error(t("fileSizeLimit"));
      if (!globalThis.crypto?.subtle) throw new Error(t("fileSecureContext"));
      input.size = file.size;
      const hash = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
      input.sha256 = [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
    }
    if (signal.aborted) return;
    const value = await request(input);
    if (signal.aborted) {
      await request({ action: "file_cancel", transferId: value.id });
      return;
    }
    await drive(value, signal);
  });
  const reset = () => {
    active.current?.abort();
    const value = current.current;
    if (value) request({ action: "file_cancel", transferId: value.id }).then(() => {
      current.current = null;
      setTransfer(null);
    }).catch((e) => setError(e.message));
  };
  const phase = transfer?.phase;
  const phaseKey = {
    connecting: "fileConnecting",
    queued: "fileRunning",
    running: "fileRunning",
    accepted: "fileRunning",
    dispatching: "fileRunning",
    awaiting_approval: "fileApproval",
    awaiting_input: "fileApproval",
    upload_ready: "fileReady",
    download_ready: "fileReady",
    succeeded: "fileSucceeded",
    failed: "fileFailed",
    cancelled: "fileCancelled",
    rejected: "fileFailed",
    expired: "fileFailed",
    unknown: "fileUnknown"
  }[phase];
  return h(
    "details",
    { onToggle: (event) => {
      if (event.currentTarget.open && !opened.current) {
        opened.current = true;
        search();
      }
    } },
    h("summary", null, t("fileTransfer")),
    h(
      "div",
      { className: "jsm-file-transfer" },
      h("p", null, t("fileRootHint")),
      error && h("div", { role: "alert", className: "jsm-error" }, error),
      h(
        "div",
        { className: "jsm-actions" },
        h("input", { value: query, disabled, placeholder: t("fileSearch"), "aria-label": t("fileSearch"), onChange: (event) => setQuery(event.target.value) }),
        h("button", { disabled, onClick: search }, t("fileSearch"))
      ),
      h("label", null, t("fileAsset"), h("select", { value: assetId, disabled, onChange: (event) => {
        setAssetId(event.target.value);
        setAccount(assets.find((row) => row.id === event.target.value)?.accounts?.find((row) => row.protocols?.includes("sftp"))?.id || "");
      } }, h("option", { value: "" }, t("fileChoose")), ...assets.map((row) => h("option", { key: row.id, value: row.id }, row.name)))),
      h("label", null, t("fileAccount"), h(
        "select",
        { value: account, disabled, onChange: (event) => setAccount(event.target.value) },
        h("option", { value: "" }, t("fileChoose")),
        ...accounts.map((row) => h("option", { key: row.id, value: row.id }, `${row.name} (${row.username})`))
      )),
      asset && !accounts.length && h("p", null, t("fileNoSftp")),
      h("label", null, t("filePath"), h("input", { value: path, disabled, onChange: (event) => setPath(event.target.value) })),
      h("label", null, t("fileSelect"), h("input", { type: "file", disabled, onChange: (event) => {
        const selected = event.target.files?.[0];
        setFile(selected || null);
        if (selected && path.endsWith("/")) setPath(path + selected.name);
      } })),
      h("label", { className: "jsm-actions" }, h("input", { type: "checkbox", checked: overwrite, disabled, onChange: (event) => setOverwrite(event.target.checked) }), t("fileOverwrite")),
      h(
        "div",
        { className: "jsm-actions" },
        h("button", { disabled: disabled || !account || !file, onClick: () => start("upload") }, t("fileUpload")),
        h("button", { disabled: disabled || !account, onClick: () => start("download") }, t("fileDownload")),
        transfer && !FINAL.has(phase) && h("button", { disabled: busy, onClick: () => run(async (signal) => drive(await request({ action: "file_status", transferId: transfer.id }), signal)) }, t("fileContinue")),
        transfer && h("button", { onClick: reset }, t(FINAL.has(phase) ? "fileClose" : "cancel"))
      ),
      transfer && h("p", { role: "status" }, t(phaseKey || "fileRunning"), transfer.error && ` \xB7 ${transfer.error}`),
      transfer?.approvalUrl && h("a", { href: transfer.approvalUrl, target: "_blank", rel: "noopener noreferrer" }, t("fileOpenApproval")),
      transfer?.auditUrl && h("a", { href: transfer.auditUrl, target: "_blank", rel: "noopener noreferrer" }, t("fileAudit"))
    )
  );
}

// src/client.js
var h2 = import_react2.default.createElement;
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
  nameHint: "\u5C0F\u5199\u5B57\u6BCD\u5F00\u5934\uFF0C\u4EC5\u542B\u5C0F\u5199\u5B57\u6BCD\u3001\u6570\u5B57\u3001\u4E0B\u5212\u7EBF\uFF1B\u7528\u4E8E\u5DE5\u5177\u540D\u79F0\u3002",
  fileTransfer: "\u6587\u4EF6\u4E0A\u4F20\u4E0E\u4E0B\u8F7D",
  fileRootHint: "\u8DEF\u5F84\u4ECE SFTP \u865A\u62DF\u6839\u76EE\u5F55 / \u5F00\u59CB\uFF0C\u4E0E SSH \u4E2D\u7684\u7CFB\u7EDF\u8DEF\u5F84\u53EF\u80FD\u4E0D\u540C\u3002\u6BCF\u6B21\u4F20\u8F93\u6700\u591A 100 MiB\u3002",
  fileSearch: "\u641C\u7D22\u8D44\u4EA7",
  fileAsset: "\u8D44\u4EA7",
  fileAccount: "SFTP \u8D26\u53F7",
  fileChoose: "\u8BF7\u9009\u62E9",
  filePath: "\u8FDC\u7AEF\u6587\u4EF6\u8DEF\u5F84",
  fileSelect: "\u9009\u62E9\u672C\u673A\u6587\u4EF6",
  fileOverwrite: "\u5141\u8BB8\u8986\u76D6\u5DF2\u6709\u6587\u4EF6",
  fileUpload: "\u4E0A\u4F20\u6587\u4EF6",
  fileDownload: "\u4E0B\u8F7D\u6587\u4EF6",
  fileContinue: "\u7EE7\u7EED\u67E5\u8BE2",
  fileClose: "\u5173\u95ED\u8BB0\u5F55",
  fileNoSftp: "\u6B64\u8D44\u4EA7\u6CA1\u6709\u53EF\u7528\u7684 SFTP \u8D26\u53F7\uFF0C\u8BF7\u5148\u68C0\u67E5\u8D44\u4EA7\u548C\u8D26\u53F7\u6388\u6743\u3002",
  fileSizeLimit: "\u8BF7\u9009\u62E9\u4E0D\u8D85\u8FC7 100 MiB \u7684\u6587\u4EF6\u3002",
  fileSecureContext: "\u8BF7\u901A\u8FC7 HTTPS \u6216\u672C\u673A\u5730\u5740\u8BBF\u95EE DSH\uFF0C\u4EE5\u6821\u9A8C\u4E0A\u4F20\u6587\u4EF6\u7684 SHA256\u3002",
  fileConnecting: "\u6B63\u5728\u5EFA\u7ACB SFTP \u4F1A\u8BDD",
  fileRunning: "\u64CD\u4F5C\u5904\u7406\u4E2D\uFF0C\u53EF\u7A0D\u540E\u7EE7\u7EED\u67E5\u8BE2",
  fileApproval: "\u9700\u8981\u5728 JumpServer \u5B8C\u6210\u4EBA\u5DE5\u786E\u8BA4\u540E\u7EE7\u7EED",
  fileReady: "\u5DF2\u51C6\u5907\u4F20\u8F93",
  fileSucceeded: "\u4F20\u8F93\u5B8C\u6210\u5E76\u5DF2\u6821\u9A8C",
  fileFailed: "\u4F20\u8F93\u5931\u8D25\uFF0C\u8BF7\u67E5\u770B\u5BA1\u8BA1\u8BB0\u5F55",
  fileCancelled: "\u5DF2\u53D6\u6D88",
  fileUnknown: "\u6682\u65F6\u65E0\u6CD5\u786E\u8BA4\u7ED3\u679C\uFF0C\u8BF7\u67E5\u770B\u539F\u64CD\u4F5C\u5BA1\u8BA1\uFF0C\u4E0D\u8981\u91CD\u65B0\u63D0\u4EA4",
  fileOpenApproval: "\u6253\u5F00\u5BA1\u6279\u6216\u51ED\u636E\u9875\u9762",
  fileAudit: "\u67E5\u770B\u64CD\u4F5C\u5BA1\u8BA1"
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
  authHint: "Sign in and authorize access to your available organizations in the new page. This page updates automatically.",
  nameHint: "Start with a lowercase letter; use lowercase letters, digits and underscores. Used in tool names.",
  fileTransfer: "Upload and download files",
  fileRootHint: "Paths start at the virtual SFTP root /, which may differ from SSH paths. Maximum 100 MiB per transfer.",
  fileSearch: "Search assets",
  fileAsset: "Asset",
  fileAccount: "SFTP account",
  fileChoose: "Select",
  filePath: "Remote file path",
  fileSelect: "Choose a local file",
  fileOverwrite: "Allow overwriting an existing file",
  fileUpload: "Upload file",
  fileDownload: "Download file",
  fileContinue: "Check progress",
  fileClose: "Close record",
  fileNoSftp: "No authorized SFTP account is available on this asset. Check asset and account permissions.",
  fileSizeLimit: "Choose a file no larger than 100 MiB.",
  fileSecureContext: "Open DSH over HTTPS or a loopback address to verify the upload SHA256.",
  fileConnecting: "Connecting SFTP session",
  fileRunning: "Operation pending; check progress again shortly",
  fileApproval: "Complete the human step in JumpServer, then continue",
  fileReady: "Ready to transfer",
  fileSucceeded: "Transfer completed and verified",
  fileFailed: "Transfer failed; inspect the audit record",
  fileCancelled: "Cancelled",
  fileUnknown: "Result is uncertain. Inspect the original audit record before submitting another operation.",
  fileOpenApproval: "Open approval or credentials page",
  fileAudit: "View operation audit"
};
var css = `.jsm{max-width:850px;color:var(--dsw-alias-label-primary);display:flex;flex-direction:column;gap:16px}.jsm p{margin:0;color:var(--dsw-alias-label-secondary);line-height:1.6}.jsm h3{margin:0;font-size:16px}.jsm-card,.jsm-form{border:1px solid var(--dsw-alias-border-l2);border-radius:10px;padding:16px;background:var(--dsw-alias-bg-layer-3);display:flex;flex-direction:column;gap:12px}.jsm-head,.jsm-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.jsm-head strong{flex:1}.jsm-status{font-size:12px;border-radius:6px;padding:3px 8px;background:var(--dsw-alias-bg-layer-1)}.jsm-status[data-state=connected]{color:var(--dsw-alias-state-success-primary)}.jsm-error{color:var(--dsw-alias-state-error-primary);font-size:13px;overflow-wrap:anywhere}.jsm-url{font-size:12px;overflow-wrap:anywhere;color:var(--dsw-alias-label-tertiary)}.jsm label{font-size:13px;display:flex;flex-direction:column;gap:6px}.jsm-file-transfer{display:flex;flex-direction:column;gap:10px;margin-top:12px}.jsm select{font:inherit;padding:8px;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-1)}.jsm input{font:inherit;padding:8px 10px;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-1)}.jsm button{font:inherit;font-size:12px;padding:6px 10px;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-1);cursor:pointer}.jsm button:disabled{opacity:.5;cursor:default}.jsm .jsm-primary{background:var(--dsw-alias-state-business-primary);color:white;border-color:transparent}.jsm small{font-size:11px;color:var(--dsw-alias-label-tertiary)}.jsm details{font-size:12px}.jsm summary{cursor:pointer}.jsm pre{max-height:220px;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;font-size:11px}.jsm li{margin:8px 0}.jsm a{color:var(--dsw-alias-state-business-primary)}`;
function Settings({ request, t }) {
  const [instances, setInstances] = import_react2.default.useState([]);
  const [error, setError] = import_react2.default.useState("");
  const [busy, setBusy] = import_react2.default.useState(false);
  const [editing, setEditing] = import_react2.default.useState(null);
  const [values, setValues] = import_react2.default.useState({ name: "", url: "", timeoutMs: "60000" });
  const [authorization, setAuthorization] = import_react2.default.useState(null);
  const [logs, setLogs] = import_react2.default.useState({});
  const refresh = import_react2.default.useCallback(async () => {
    const rows = await request({ action: "list" });
    setInstances(rows);
    setAuthorization((previous) => previous && rows.find((row) => row.id === previous.id)?.status === "authorizing" ? previous : null);
  }, [request]);
  import_react2.default.useEffect(() => {
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
  const field = (key, type = "text") => h2(
    "label",
    { key },
    t(key === "timeoutMs" ? "timeout" : key),
    h2("input", {
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
  const action = (label, handler, extra = {}) => h2("button", { type: "button", disabled: busy, onClick: handler, ...extra }, t(label));
  return h2(
    "section",
    { className: "jsm", "data-jumpserver-settings": true },
    h2("h3", null, t("title")),
    h2("p", null, t("intro")),
    error && h2("div", { className: "jsm-error", role: "alert" }, error),
    h2(
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
      h2("small", null, t("nameHint")),
      field("url"),
      field("timeoutMs", "number"),
      h2(
        "div",
        { className: "jsm-actions" },
        h2("button", { className: "jsm-primary", type: "submit", disabled: busy }, t(editing ? "save" : "add")),
        editing && action("cancel", () => {
          setEditing(null);
          setValues({ name: "", url: "", timeoutMs: "60000" });
        })
      )
    ),
    !instances.length && h2("p", null, t("empty")),
    ...instances.map((row) => h2(
      "article",
      { className: "jsm-card", key: row.id, "data-instance": row.name },
      h2("div", { className: "jsm-head" }, h2("strong", null, row.name), h2("span", { className: "jsm-status", "data-state": row.status }, `${t(row.status)}${row.status === "connected" ? ` \xB7 ${row.toolCount} ${t("tools")}` : ""}`)),
      h2("div", { className: "jsm-url" }, row.url),
      row.error && h2("div", { className: "jsm-error" }, row.error),
      h2(
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
      authorization?.id === row.id && row.status === "authorizing" && h2("p", null, t("authHint"), " ", h2("a", { href: authorization.authorizeUrl, target: "_blank", rel: "noopener noreferrer" }, t("open"))),
      row.expiresAt && h2("small", null, `${t("expires")}: ${new Date(row.expiresAt).toLocaleString()}${row.lastRefreshAt ? ` \xB7 ${t("refreshed")}: ${new Date(row.lastRefreshAt).toLocaleString()}` : ""}`),
      row.status === "connected" && h2(FileTransfer, { request, t, instanceId: row.id }),
      h2("details", null, h2("summary", null, `${t("tools")} (${row.toolCount})`), h2("ul", null, ...row.tools.map((tool) => h2("li", { key: tool.name }, h2("code", null, tool.name), h2("p", null, tool.description))))),
      h2(
        "details",
        { onToggle: (event) => {
          if (event.currentTarget.open) request({ action: "logs", id: row.id }).then((value) => setLogs((old) => ({ ...old, [row.id]: value }))).catch((e) => setError(e.message));
        } },
        h2("summary", null, t("logs")),
        h2("pre", null, (logs[row.id] || []).map((log) => `${new Date(log.at).toLocaleTimeString()} [${log.phase}] ${log.message}`).join("\n") || t("none"))
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
  ctx.slots.inject("settings.section", () => ctx.slots.register({ name: "settings.section", id: "jumpserver", order: 51, label: () => t("title"), locale: "jumpserver" }, () => h2(Settings, { request, t })));
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

# DSH JumpServer 插件

为 DeepSeek Harness 桌面版及本机 `dsh web` 提供 JumpServer 实例管理、浏览器 OAuth 授权、Token 自动刷新、MCP 工具发现及调用。

适配 JumpServer / KoKo 的 `pr@dev@agent-mcp` 服务端契约。参考 [dsh-mcp-manager](https://github.com/hyqhyq3/dsh-mcp-manager) 的插件结构和 OAuth 集成方式，MCP 传输使用官方 TypeScript SDK。

## 安装

要求 Node.js `^22.19` 或 `>=24`，DSH `>=0.2.1-rc.2 <0.3.0`。

在仓库目录执行：

```bash
npm install
npm run build
npm pack
```

在 DSH 桌面版的插件安装入口选择本地包 `dsh-plugin-jumpserver-0.1.0.tgz`，或将其完整路径作为安装源。Web 版可使用：

```bash
dsh plugin --profile web add /完整路径/dsh-plugin-jumpserver-0.1.0.tgz
```

安装后重启对应 DSH profile，打开 **设置 → JumpServer**。包中的 `cordis.patch.yml` 自动启用插件。

## 使用

1. 添加实例：标识如 `main`、地址如 `https://jumpserver.example.com/koko/mcp`。只填写站点 origin 时自动补上 `/koko/mcp`；完整 MCP 地址末尾不能带 `/`。
2. 点击“浏览器授权”，在 JumpServer 登录、选择组织并确认授权。部分部署还会要求确认跳转到本机回调。
3. 授权完成后自动连接并发现工具，设置页显示状态、工具列表、Token 有效期和诊断日志。浏览器未自动打开时点击“打开授权页面”。
4. 在 DSH 会话中使用工具，名称为 `mcp__jumpserver_<实例标识>__<原始工具名>`，例如 `mcp__jumpserver_main__search_assets`。
5. 修改地址会清除该实例的本地 OAuth 凭据，需要重新授权。停用保留凭据并卸载工具；“撤销授权”调用服务端撤销端点并删除本地 Token；“删除”仅删除本地实例。

实例标识以小写字母开头，仅包含小写字母、数字和下划线，最多 32 字符。可以配置同一站点的多个实例，分别授权不同组织。组织由 JumpServer 授权页决定，切换组织需要重新授权。

## 桌面与 Web

- 设置页使用 DSH 原生 Remote 服务，支持桌面 IPC 和 Web 通道，不要求 Electron 的 `file://` 页面使用相对 HTTP 请求。
- 桌面授权自动在 `127.0.0.1` 临时监听回调，完成或超时后释放。首次动态注册使用 public client、PKCE S256、`agent:access` 和精确 MCP resource，无需客户端密钥。
- 本机 HTTP Web 优先使用 DSH Web 服务的回调路由。浏览器通过 `localhost` 访问时回调改用 `127.0.0.1`，符合当前 JumpServer 的 IP 回环要求。
- 动态注册允许本机端口变化，插件持久化并复用 client ID。
- 远程 Web 须通过本地端口转发以 `http://127.0.0.1:端口` 访问 DSH，让授权回调通过相同转发到达 DSH。直接注册远程域名回调不符合当前服务端规则。
- HTTP、HTTPS MCP 地址均支持，适用于 HTTP 开发环境和 HTTPS 部署。

## Token 与状态

默认状态文件为 `$DSH_HOME/jumpserver.json`，未设置 `DSH_HOME` 时为 `~/.dsh/jumpserver.json`。OAuth Token 保存在宿主侧文件中，文件权限 `0600`；不返回设置页，不进入代码、日志或 URL。插件配置可通过 `statePath` 指定其他状态文件。

刷新在请求前根据 `expires_in` 提前触发。401 可触发一次刷新并重试被拒绝的请求；网络故障不会自动重放命令。进程内合并刷新请求，进程间通过文件锁串行刷新和状态写入，原子替换保存轮换后的 Token。`invalid_grant` 等永久错误停止刷新并提示重新授权。轮换成功但写盘失败时停止后续刷新，修复状态目录后重新授权。

锁目录为状态文件旁的 `.lock`。仅回收已退出进程或长时间未完成的持有者；不会按存活进程的锁年龄抢占。异常遗留的 `.lock.reclaim` 需要检查后人工清理，避免并发抢占。

实例配置默认属于本机 DSH 用户，工具在该 profile 的会话中全局可用。多个 DSH 进程使用相同 `DSH_HOME` 时共享凭据。第一版不提供项目级工具隔离。

## 操作结果

服务端当前提供资产搜索、连接/断开、命令执行、操作查询/取消、SFTP 文件操作、文件上传下载登记和人工终端交接。工具目录以实际 `tools/list` 为准，支持分页及工具变更通知。

`execute_command` 等工具返回 `action_id` 后，仍须使用 `get_action` 查询。HTTP 成功、MCP 调用成功、操作已接受均不代表资产执行成功。插件保留 `structuredContent`、审批/交接/审计链接、事件游标和审计状态，并向模型提供服务端操作说明。

- 每个新操作使用新的 `idempotency_key`，重试同一操作保持原参数和原键。
- `unknown` 结果禁止自动重发，须先核对资产状态。
- 审批、MFA、个人凭据和敏感输入通过返回的 JumpServer 页面完成。
- SSH 命令之间不共享 Shell 状态，工作目录和环境变量使用 `cwd` / `env` 显式传入。
- `upload_file` / `download_file` 可以发现和调用，但 PC 大文件字节传输还需独立实现文件流接口；本插件第一版不提供本地文件上传/下载 UI。小文本可使用 `read_file` / `write_file`。

## 开发

```bash
npm test
npm run build
```

修改设置页源码 `src/client.js` 后执行 `npm run build`，生成 DSH 加载的 `lib/client.js`。单元测试使用本机隔离的 OAuth/MCP 服务，不需要外部环境或真实凭据。

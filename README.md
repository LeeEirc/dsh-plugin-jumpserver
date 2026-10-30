# JumpServer for DeepSeek Harness

为 DeepSeek Harness 桌面版及本机 `dsh web` 提供 JumpServer 连接配置、浏览器 OAuth 授权、Token 自动刷新、MCP 工具发现及调用。

适配 JumpServer / KoKo 的 `pr@dev@agent-mcp` 服务端契约。参考 [dsh-mcp-manager](https://github.com/hyqhyq3/dsh-mcp-manager) 的插件结构和 OAuth 集成方式，MCP 传输使用官方 TypeScript SDK。

## 安装

要求 Node.js `^22.19` 或 `>=24`，DSH `>=0.2.1-rc.2 <0.3.0`。

在仓库目录执行：

```bash
npm install
npm run build
npm pack
```

在 DSH 桌面版的插件安装入口选择本地包 `dsh-plugin-jumpserver-0.2.0.tgz`，或将其完整路径作为安装源。Web 版可使用：

```bash
dsh plugin --profile web add /完整路径/dsh-plugin-jumpserver-0.2.0.tgz
```

安装后重启对应 DSH profile，打开 **设置 → JumpServer**。包中的 `cordis.patch.yml` 自动启用插件。

## 使用

1. 配置 JumpServer：地址如 `https://jumpserver.example.com/koko/mcp`，填写后点击“保存配置”。只填写站点 origin 时自动补上 `/koko/mcp`；完整 MCP 地址末尾不能带 `/`。
2. 点击“浏览器授权”，在 JumpServer 登录并确认授权。部分部署还会要求确认跳转到本机回调。
3. 授权完成后自动连接并发现工具，设置页显示状态、工具列表、Token 有效期和诊断日志。浏览器未自动打开时点击“打开授权页面”。
4. 在 DSH 会话中使用工具，名称为 `mcp__jumpserver__<原始工具名>`，例如 `mcp__jumpserver__search_assets`。
5. 修改地址会清除本地 OAuth 凭据，需要重新授权。停用保留凭据并卸载工具；“撤销授权”调用服务端撤销端点并删除本地 Token，保留客户端注册信息；“清除配置”删除本地连接及其凭据。

插件列表及设置页固定显示 **JumpServer**，包名为 `dsh-plugin-jumpserver`，内部插件 ID 为 `jumpserver`。JumpServer OAuth 授权页中的客户端名称固定为 **DeepSeek Harness**，同一连接重复授权会复用已保存的 `client_id`。

每份状态配置只保存一个 JumpServer 连接，界面不提供自定义实例名和多实例列表；宿主侧拒绝创建第二条配置，并在同一 DSH 运行上下文中限制插件重复加载。切换站点须修改地址并重新授权，授权范围以 JumpServer 权限为准。不同电脑或用户保持各自独立的授权。

使用模型网关时，DSH 配置中的模型标识须与网关实际可用的模型目录一致。模型路由的 404 应通过 DSH 模型设置修正，避免把它当作 JumpServer 权限错误重试。

## 桌面与 Web

- 设置页使用 DSH 原生 Remote 服务，支持桌面 IPC 和 Web 通道，不要求 Electron 的 `file://` 页面使用相对 HTTP 请求。
- 桌面授权自动在 `127.0.0.1` 临时监听回调，完成或超时后释放。首次动态注册使用 public client、PKCE S256、`agent:access` 和精确 MCP resource，无需客户端密钥。
- 本机 HTTP Web 优先使用 DSH Web 服务的回调路由。浏览器通过 `localhost` 访问时回调改用 `127.0.0.1`，符合当前 JumpServer 的 IP 回环要求。
- 动态注册允许本机端口变化，插件持久化并复用 client ID。
- 远程 Web 须通过本地端口转发以 `http://127.0.0.1:端口` 访问 DSH，让授权回调通过相同转发到达 DSH。直接注册远程域名回调不符合当前服务端规则。
- HTTP、HTTPS MCP 地址均支持，适用于 HTTP 开发环境和 HTTPS 部署。

## Token 与状态

状态格式为 `version: 2`，使用单个 `connection` 对象；未配置时为 `null`。默认状态文件为 `$DSH_HOME/jumpserver.json`，未设置 `DSH_HOME` 时为 `~/.dsh/jumpserver.json`。OAuth Token 保存在宿主侧文件中，文件权限 `0600`；不返回设置页，不进入代码、日志或 URL。插件配置可通过 `statePath` 指定其他状态文件。

刷新在请求前根据 `expires_in` 提前触发。401 可触发一次刷新并重试被拒绝的请求；网络故障不会自动重放命令。进程内合并刷新请求，进程间通过文件锁串行刷新和状态写入，原子替换保存轮换后的 Token。`invalid_grant` 等永久错误停止刷新并提示重新授权。轮换成功但写盘失败时停止后续刷新，修复状态目录后重新授权。

锁目录为状态文件旁的 `.lock`。仅回收已退出进程或长时间未完成的持有者；不会按存活进程的锁年龄抢占。异常遗留的 `.lock.reclaim` 需要检查后人工清理，避免并发抢占。

连接配置默认属于本机 DSH 用户，工具在该 profile 的会话中全局可用。多个 DSH 进程使用相同 `DSH_HOME` 时共享凭据。第一版不提供项目级工具隔离。

## 操作结果

服务端当前提供资产搜索、连接/断开、命令执行、操作查询/取消、SFTP 文件操作、文件上传下载登记和人工终端交接。工具目录以实际 `tools/list` 为准，支持分页及工具变更通知。

`execute_command` 等工具返回 `action_id` 后，仍须使用 `get_action` 查询。HTTP 成功、MCP 调用成功、操作已接受均不代表资产执行成功。插件保留 `structuredContent`、审批/交接/审计链接、事件游标和审计状态，并向模型提供服务端操作说明。

- 每个新操作使用新的 `idempotency_key`，重试同一操作保持原参数和原键。
- `unknown` 结果禁止自动重发，须先核对资产状态。
- 审批、MFA、个人凭据和敏感输入通过返回的 JumpServer 页面完成。
- SSH 命令之间不共享 Shell 状态，工作目录和环境变量使用 `cwd` / `env` 显式传入。
- 在 DSH 的“设置 → JumpServer → 文件上传与下载”中搜索资产、选择 SFTP 账号和虚拟远端路径，可上传本机文件或下载资产文件。插件建立专用 SFTP 会话并负责文件流；操作仍经过 Core 授权、审批及审计。每次最多 100 MiB，同时最多传输两个文件。
- SFTP 的 `/` 是平台配置的虚拟根目录，可能与 SSH 的系统 `/` 不同。先确认该目录的可见路径；没有 SFTP 授权时须先调整授权，不能靠 SSH/base64 绕过文件策略。
- `upload_file` / `download_file` 本身登记操作；仅轮询不会上传字节。浏览器文件流经 DSH 已认证的 Connection 路由转发，OAuth Token 始终留在宿主侧。上传按登记大小和 SHA256 校验；下载先核对审计结果、响应头、实际长度和 SHA256，再交付给浏览器。小文本仍可使用 `read_file` / `write_file`。
- 人工审批或凭据输入通过面板中的 JumpServer 链接完成，再点击“继续查询”。未确认结果的上传不会自动重传；关闭记录会请求取消未完成操作并释放会话。刷新页面会丢失本机文件选择，须先查看原操作审计；不支持断点续传。

## 开发

```bash
npm test
npm run build
```

修改设置页源码 `src/client.js` 后执行 `npm run build`，生成 DSH 加载的 `lib/client.js`。单元测试使用本机隔离的 OAuth/MCP 服务，不需要外部环境或真实凭据。

## 自动构建与 Release

GitHub Actions 的 **Build and Release** 工作流在推送 `master` 或提交 Pull Request 时执行单元测试、构建和打包，安装包与 `SHA256SUMS` 保留在该次运行的 Artifacts 中。

发布新版本时，先修改 `package.json` 的版本，并同步更新 lock 文件、提交代码，再推送同名版本标签：

```bash
npm version patch
git push origin master --follow-tags
```

也可以在 GitHub **Actions → Build and Release → Run workflow** 手动发布：

- `tag` 留空：使用所选分支的 `package.json` 版本创建 Release 和标签。
- `tag` 填写已有标签（例如 `v0.2.0`）：检出该标签，重新测试、构建并更新对应 Release 的安装包和校验文件。
- 已有运行可以使用 **Re-run all jobs** 重跑。只重跑发布 job 时复用尚未过期的构建产物。

标签必须与 `package.json` 的版本一致。同一标签重跑会覆盖同名附件，并保留既有 Release 说明；不会移动已有标签。所选分支包含新代码时，应提升版本，或明确选择原标签重建。包含预发布版本号的标签（如 `v0.2.0-beta.1`）自动标记为 Pre-release。

工作流只使用 GitHub 自动提供的 `GITHUB_TOKEN`，无需配置额外发布密钥。安装包通过 GitHub Release 分发，不会上传 npm registry。

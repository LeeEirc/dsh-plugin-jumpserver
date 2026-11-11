# JumpServer for DeepSeek Harness

在 DeepSeek Harness 中连接 JumpServer，通过浏览器授权，让 Agent 使用你有权限的资产，执行命令、传输文件，并在需要时由你接管终端。

## 开始使用

1. 从 [GitHub Releases](https://github.com/LeeEirc/dsh-plugin-jumpserver/releases) 下载安装包，通过 DSH 的插件安装入口安装，然后启动对应的 DSH。
2. 打开左侧 **JumpServer**，填写 JumpServer 地址并点击“保存配置”。
3. 点击“浏览器授权”，在浏览器登录 JumpServer 并确认授权。未自动打开时，点击“打开授权页面”。
4. 连接成功后，直接在对话中让 Agent 查找资产、执行命令或传输文件。需要人工操作时，打开返回的终端链接接管。

上传文件可从对话附件选择；下载结果会保存为对话附件。所有资产、账号和操作权限均以 JumpServer 授权为准。

## 更新与连接管理

标题旁显示版本和短提交号。打开页面会自动检查更新，发现新版本后点击“更新”即可安装，也可手动点击“检查更新”。安装后按提示重新加载页面或重启 DSH，已有连接和授权会保留。

已授权时点击“撤销授权”可退出授权并保留连接配置，再次使用时通过浏览器重新授权。停用保留授权；“连接设置”中的“清除配置”会先撤销服务端授权，再清除本地配置。撤销失败时配置会保留，可稍后重试。

[GitHub](https://github.com/LeeEirc/dsh-plugin-jumpserver) · [反馈问题](https://github.com/LeeEirc/dsh-plugin-jumpserver/issues)

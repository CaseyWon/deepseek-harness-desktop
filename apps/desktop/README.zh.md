# DeepSeek Harness 桌面端

[English](README.md) | 中文

桌面应用会在私有回环端口启动已发布的 DeepSeek Harness Web 工作台，并在受管理的 Electron 窗口中呈现。它负责后端启停、窗口状态、原生窗口控制、外部链接交接、启动诊断和桌面加载体验；会话、工具、设置、终端会话与插件界面仍由现有 Harness 包负责。

## 从源码运行

在仓库根目录执行：

```sh
pnpm install
pnpm run dev:desktop
```

`dev:desktop` 会先构建 Harness 库与 Web 客户端，再启动桌面应用。可将 `DSH_DESKTOP_SERVER_URL` 设为回环 HTTP URL，使窗口连接到已经运行的开发服务器，而不启动子进程。

## 构建安装程序

```sh
pnpm run dist:desktop
```

Windows NSIS 安装程序会写入 `.artifacts/desktop-release/`。其中包含 Harness 后端的便携式生产部署，因此安装后的应用不要求用户另行安装 Node.js 或 pnpm。应用数据、Harness profile、会话与后端日志保留在操作系统的当前用户应用目录中；安装程序不会嵌入凭据。

## 安全与生命周期

桌面宿主只接受 `localhost`、`127.0.0.1` 或 `::1` 后端 URL。窗口会拒绝应用外部导航并将链接交给系统浏览器，渲染进程不能使用 Node.js，preload 只暴露窗口、重启、日志和项目链接操作。关闭应用会终止 Harness 子进程树。

当前桌面载体复用回环 Web 宿主，因此所有已发布 Web 插件无需第二套插件交付实现即可工作。原生 Electron IPC 载体仍属于独立架构改动，因为它必须一并替换 API 请求、事件流、插件 bundle 与特权桌面能力。

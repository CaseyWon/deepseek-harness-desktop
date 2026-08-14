# Agent Note: Electron 桌面端外壳

Status: implemented

[English](2026-08-14-electron-desktop-shell.md) | 中文

## Problem

DeepSeek Harness 提供浏览器工作台，但没有可安装的桌面生命周期。用户必须启动 CLI 进程、保留其终端、找到回环 URL、管理浏览器窗口，并在产品之外诊断启动失败。另建一套渲染器还会拆分 Web 插件目录，使桌面行为落后于已发布的工作台。

## Decision

`apps/desktop` 是 Electron 产品应用，它会在临时回环端口启动现有 Web profile，并将其载入一个受管理窗口。主进程负责子进程、启动探测、持久化窗口边界、外部链接交接、单实例行为和后端日志。隔离的 preload 只暴露有限的窗口管理 API，并在不向 Harness 渲染器授予 Node.js 访问权限的前提下添加桌面窗口栏。

加载文档是桌面端自有界面，明确呈现准备、服务启动、连接、就绪和失败状态。启动失败会留在产品内，并提供重试和日志位置操作。就绪后，应用会呈现与 `dsh web` 相同的插件组合工作台，包括会话、工具、终端、设置和模型配置。

安装程序会将 CLI 及其运行时 peer 提供者按生产依赖、hoisted 方式部署，并作为非 asar 后端资源随包携带。这样既能让原生 Node-API 二进制正常工作，也能避免工作区专属 junction，同时允许 Electron 内嵌的 Node 运行时在系统未安装 Node.js 时启动 Harness。

特权窗口只载入 `localhost`、`127.0.0.1` 或 `::1` 上的 HTTP URL。其他导航会被拒绝并交给系统浏览器。关闭应用会终止子进程树；`DSH_DESKTOP_SERVER_URL` 则可指定一个明确配置的回环开发服务器，且不会改变生产行为。

## Alternatives considered

**只保留浏览器图形应用。** 这样会维持单一交付目标，但无法提供应用生命周期、原生窗口行为、安装程序或产品内启动诊断。

**另建一套桌面渲染器。** 新渲染器可以逐个为 Electron 优化视图，但会重复插件组合界面，并要求每项 Web 功能实现和测试两次。

**在首个桌面版本中实现原生 IPC 载体。** 现有的 [GUI 分层决策](../architecture/2026-07-19-gui-layering-and-rpc-protocol.md) 将 IPC 确定为 Electron 的最终传输方式。交付它需要协同替换一元请求、下行流、动态客户端插件交付与特权原生交互。回环载体能够在不拆散这些协议改动的情况下交付桌面产品；IPC 仍是后续覆盖所有层级的架构改动，而不是局部适配器。

## Consequences

桌面用户获得单窗口启动、关闭、恢复和打包能力，同时保留完整 Web 功能集。回环服务器始终位于本进程并选择临时端口，但应用暂时保留了原生 IPC 实现可以移除的 HTTP 与 WebSocket 载体成本。桌面验证覆盖 URL 信任、TypeScript、Electron bundle、现有 Web 构建、便携后端启动、Windows 打包产物启动、插件激活和子进程关闭。

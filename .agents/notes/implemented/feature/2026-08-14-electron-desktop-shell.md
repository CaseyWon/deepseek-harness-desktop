# Agent Note: Electron desktop shell

Status: implemented

English | [中文](2026-08-14-electron-desktop-shell.zh.md)

## Problem

DeepSeek Harness ships a browser workspace but has no installable desktop lifecycle. A user must start a CLI process, retain its terminal, find the loopback URL, manage the browser window, and diagnose startup failures outside the product. Building a separate renderer would also split the Web plugin catalog and make desktop behavior lag behind the shipped workspace.

## Decision

`apps/desktop` is an Electron product application that starts the existing Web profile on an ephemeral loopback port and loads it into one managed window. The main process owns the child process, startup probes, persisted window bounds, external-link handoff, single-instance behavior, and the backend log. The isolated preload exposes a narrow window-management API and adds desktop chrome without granting the Harness renderer Node.js access.

The loading document is a desktop-owned screen with explicit preparing, service-start, connection, ready, and failure states. A failed launch remains inside the product and offers retry and log-location actions. Once ready, the application presents the same plugin-composed workspace as `dsh web`, including its sessions, tools, terminal, settings, and model setup.

The installer stages a hoisted, production-only pnpm deployment of the CLI and its runtime peer providers as an unpacked backend resource. This keeps native Node-API binaries usable, avoids workspace-specific junctions, and lets Electron's embedded Node runtime start Harness without a system Node.js installation.

The privileged window loads only HTTP URLs on `localhost`, `127.0.0.1`, or `::1`. Other navigations are denied and handed to the system browser. Closing the application terminates the child process tree, while `DSH_DESKTOP_SERVER_URL` permits an explicitly configured loopback development server without changing production behavior.

## Alternatives considered

**Keep the browser as the only graphical application.** This preserves one delivery target but does not provide an application lifecycle, native window behavior, installer, or in-product startup diagnostics.

**Build a separate desktop renderer.** A new renderer could optimize every view for Electron, but it would duplicate the plugin-composed UI and require every Web feature to be implemented and tested twice.

**Implement the native IPC carrier in the first desktop release.** The existing [GUI layering decision](../architecture/2026-07-19-gui-layering-and-rpc-protocol.md) identifies IPC as the final Electron transport. Shipping it requires coordinated replacements for unary requests, downlink streams, dynamic client plugin delivery, and privileged native interactions. The loopback carrier delivers the desktop product without fragmenting those protocol changes; IPC remains a later all-layer architecture change rather than a partial adapter.

## Consequences

Desktop users receive one-window startup, shutdown, recovery, and packaging while retaining the complete Web feature set. The loopback server remains process-local and chooses an ephemeral port, but the application temporarily retains the HTTP and WebSocket carrier costs that a native IPC implementation can remove. Desktop verification covers URL trust, TypeScript, Electron bundles, the existing Web build, portable-backend startup, packaged Windows launch, plugin activation, and child-process shutdown.

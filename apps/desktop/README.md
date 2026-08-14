# DeepSeek Harness Desktop

English | [中文](README.zh.md)

The desktop application launches the shipped DeepSeek Harness Web workspace on a private loopback port and presents it in a managed Electron window. It owns backend startup and shutdown, window state, native window controls, external-link handoff, startup diagnostics, and the desktop loading experience; conversations, tools, settings, terminal sessions, and plugin UI remain owned by the existing Harness packages.

## Run from source

From the repository root:

```sh
pnpm install
pnpm run dev:desktop
```

`dev:desktop` builds the Harness libraries and Web client before launching the desktop application. Set `DSH_DESKTOP_SERVER_URL` to a loopback HTTP URL to connect the window to an already running development server instead of starting a child process.

## Build an installer

```sh
pnpm run dist:desktop
```

The Windows NSIS installer is written under `.artifacts/desktop-release/`. It contains a portable production deployment of the Harness backend, so the installed application does not require a separate Node.js or pnpm installation. Application data, Harness profiles, sessions, and backend logs remain in the operating system's per-user application directories; the installer never embeds credentials.

## Security and lifecycle

The desktop host accepts only `localhost`, `127.0.0.1`, or `::1` backend URLs. Navigation outside the local application is denied in the window and handed to the system browser, renderer processes have no Node.js integration, and the preload exposes only window, restart, log, and project-link operations. Closing the application terminates the child Harness process tree.

The current desktop carrier reuses the loopback Web host so every shipped Web plugin works without a second plugin-delivery implementation. A native Electron IPC carrier remains a separate architecture change because it must replace API requests, event streams, plugin bundles, and privileged desktop capabilities together.

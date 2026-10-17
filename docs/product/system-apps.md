# MaiaOS system application catalog

System programs should be `.wasm` wherever practical; native firmware is reserved for boot/recovery, device drivers and privileged host services. Each application should have a desktop acceptance test and a Tab5 acceptance test.

| ID | Program | Role | Priority | Planned language |
|---|---|---|---|---|
| `init` | System Init | Load policy and start essential services | P0 | C89/WASM |
| `shell` | Maia Shell | Desktop launcher, status bar, app switching | P0 | MaiaJS or MaiaC |
| `terminal` | Maia Terminal | Text commands, logs, developer tools | P0 | MaiaC |
| `files` | Maia Files | Browse VFS, copy, move and delete | P1 | MaiaJS |
| `settings` | Maia Settings | Display, storage, device and app settings | P1 | MaiaJS |
| `monitor` | Maia Monitor | CPU, memory, instances, filesystem and uptime | P1 | MaiaC |
| `installer` | Maia Package Manager | Install and verify app packages | P1 | MaiaC |
| `editor` | Maia Text Editor | Edit text/config files | P2 | MaiaJS |
| `console` | Maia Developer Console | Inspect WASM modules and ABI traces | P2 | MaiaJS |
| `clock` | Maia Clock | Monotonic uptime and app lifecycle reference | P0 | C++98 |
| `calculator` | Maia Calculator | Runnable LVGL/WASM reference app | P0 | C++98 |
| `viewer` | Maia Media Viewer | Image viewing within memory limits | P3 | MaiaCpp |
| `network` | Maia Network | Connection diagnostics via available device transport | P2 | MaiaC |
| `update` | Maia Update | Verified firmware/system app update workflow | P2 | MaiaC |

## Native services

- Boot coordinator and recovery UI
- MaiaWASM runtime
- Host ABI dispatcher and capability manager
- MaiaGFX UI task, input router, resource manager
- MaiaVFS filesystem adapters
- MaiaEvents event queues and timers
- MaiaProcess instance manager and scheduler
- MaiaIPC bounded message queues
- MaiaDevices HAL and device diagnostics
- Logging, crash reports and update verification

## MVP user experience

Power on -> MaiaOS splash -> launcher -> Calculator + Terminal + Monitor. Opening a WASM application creates a window, responds to touch and can be terminated without rebooting the device.

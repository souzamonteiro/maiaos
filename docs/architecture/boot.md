# Boot and recovery

```mermaid
sequenceDiagram
 participant ROM as ESP32-P4 ROM
 participant BL as Espressif bootloader
 participant FW as MaiaOS native firmware
 participant SD as microSD
 participant VM as MaiaWASM
 participant APP as /system/kernel.wasm
 ROM->>BL: load second-stage bootloader
 BL->>FW: verify/load application image
 FW->>FW: initialize clocks, PSRAM, logging, watchdog, display
 FW->>SD: mount storage
 alt SD and kernel module available
  FW->>VM: create runtime and host ABI
  VM->>SD: read /system/kernel.wasm
  VM->>VM: validate / instantiate with quotas
    VM->>APP: invoke maiaos_start
  APP->>FW: request platform services through maia.* callbacks
    loop Platform scheduler tick
     FW->>VM: invoke maiaos_step
     VM->>APP: poll queued events and advance kernel state
    end
 else missing or invalid kernel module
  FW->>FW: enter native recovery UI
 end
```

## Bootloader, platform host, and MaiaOS guest

The Espressif ROM and second-stage bootloader load the native platform firmware. That firmware provides MaiaWASMVM, LVGL/display drivers, recovery, and the device callback table; the C++98 MaiaOS kernel itself is `/system/kernel.wasm`, compiled to WASM and loaded by the platform boot coordinator. The guest sees only the `maia.*` ABI. The browser wrapper follows the same contract but temporarily uses the browser's native WebAssembly engine. Do not put a second hardware-independent copy of display/services into the guest.

## Storage policy

- Flash: signed/verified firmware (when secure boot is configured), recovery UI, configuration and optional minimal rescue app.
- microSD: `/system/kernel.wasm`, app packages, user data, logs and non-critical assets.
- SD may be removed or corrupted: boot must enter recovery without a working filesystem.
- Atomic updates: write temp files, verify checksum/signature if enabled, rename; preserve previous bootable init.
- Secure boot and flash encryption are separate deployment features, not assumed enabled.

## Boot stages

0. ROM and second-stage bootloader (Espressif maintained).
1. Native MaiaOS platform startup, drivers, SD, display and diagnostics.
2. Instantiate MaiaWASM and register `maia.*` host functions.
3. Load and validate `/system/kernel.wasm`; invoke the manifest-selected `maiaos_start` export.
4. Schedule `maiaos_step` and bind every `maia.*` import to device callbacks; failure falls back to native recovery.

The boot module's manifest is a capability request, not authorization. Define explicit privileged capabilities and host policy.

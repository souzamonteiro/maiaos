#include <stdint.h>

#if !defined(__wasm__)
#error "The Maia Clock guest must be compiled to WebAssembly."
#endif

#define MAIA_IMPORT(module_name, field_name) \
    __attribute__((import_module(module_name), import_name(field_name)))

extern "C" {
MAIA_IMPORT("maia.gfx", "window_create")
int32_t maia_window_create(int32_t text_ptr, int32_t text_len);

MAIA_IMPORT("maia.gfx", "label_create")
int32_t maia_label_create(int32_t parent, int32_t text_ptr, int32_t text_len);

MAIA_IMPORT("maia.gfx", "label_set_text")
int32_t maia_label_set_text(int32_t label, int32_t text_ptr, int32_t text_len);

MAIA_IMPORT("maia.gfx", "button_create")
int32_t maia_button_create(int32_t parent, int32_t text_ptr, int32_t text_len);

MAIA_IMPORT("maia.events", "poll")
int32_t maia_events_poll(int32_t output_ptr, int32_t capacity);

MAIA_IMPORT("maia.process", "exit")
void maia_process_exit(int32_t status);

MAIA_IMPORT("maia.time", "monotonic_ms")
int64_t maia_monotonic_ms(void);
}

static char kUptimeText[] = "Browser uptime: 000000000 seconds";
static const char kTitle[] = "Maia Clock";
static const char kCloseButton[] = "Close clock";
static const int32_t kWouldBlock = -6;
static const uint32_t kEventVersion = 1;
static const uint32_t kGfxClicked = 1;
static uint8_t gEventPacket[24];
static int32_t gCloseButton = -1;
static int32_t gUptimeLabel = -1;
static uint64_t gLastSeconds = static_cast<uint64_t>(-1);

static uint32_t read_u32_le(const uint8_t *bytes)
{
    return static_cast<uint32_t>(bytes[0])
        | (static_cast<uint32_t>(bytes[1]) << 8)
        | (static_cast<uint32_t>(bytes[2]) << 16)
        | (static_cast<uint32_t>(bytes[3]) << 24);
}

extern "C" __attribute__((visibility("default"))) void maia_app_start(void)
{
    int32_t window = maia_window_create(
        static_cast<int32_t>(reinterpret_cast<uintptr_t>(kTitle)),
        static_cast<int32_t>(sizeof(kTitle) - 1));
    if (window < 0) return;

    gUptimeLabel = maia_label_create(
        window,
        static_cast<int32_t>(reinterpret_cast<uintptr_t>(kUptimeText)),
        static_cast<int32_t>(sizeof(kUptimeText) - 1));
    gCloseButton = maia_button_create(
        window,
        static_cast<int32_t>(reinterpret_cast<uintptr_t>(kCloseButton)),
        static_cast<int32_t>(sizeof(kCloseButton) - 1));
}

extern "C" __attribute__((visibility("default"))) void maiaos_step(void)
{
    int32_t bytes = maia_events_poll(
        static_cast<int32_t>(reinterpret_cast<uintptr_t>(gEventPacket)),
        static_cast<int32_t>(sizeof(gEventPacket)));
    if (bytes != kWouldBlock
        && bytes == static_cast<int32_t>(sizeof(gEventPacket))
        && read_u32_le(gEventPacket) == kEventVersion
        && read_u32_le(gEventPacket + 4) == kGfxClicked
        && static_cast<int32_t>(read_u32_le(gEventPacket + 8)) == gCloseButton) {
        maia_process_exit(0);
        return;
    }

    int64_t milliseconds = maia_monotonic_ms();
    if (milliseconds < 0) return;
    uint64_t seconds = static_cast<uint64_t>(milliseconds) / 1000;
    if (seconds == gLastSeconds) return;
    gLastSeconds = seconds;

    uint64_t remaining = seconds;
    for (int32_t digit = 8; digit >= 0; digit--) {
        kUptimeText[16 + digit] = static_cast<char>('0' + (remaining % 10));
        remaining /= 10;
    }
    maia_label_set_text(
        gUptimeLabel,
        static_cast<int32_t>(reinterpret_cast<uintptr_t>(kUptimeText)),
        static_cast<int32_t>(sizeof(kUptimeText) - 1));
}
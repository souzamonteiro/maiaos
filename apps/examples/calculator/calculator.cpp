#include <stdint.h>

#if !defined(__wasm__)
#error "The MaiaOS calculator guest must be compiled to WebAssembly."
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
}

static const char kTitle[] = "Maia Calculator";
static const char kPrompt[] = "Choose an operation";
static const char kAddButton[] = "Add 7 + 5";
static const char kSubtractButton[] = "Subtract 7 - 5";
static const char kCloseButton[] = "Close calculator";
static const char kAddition[] = "7 + 5 = 12";
static const char kSubtraction[] = "7 - 5 = 2";
static const int32_t kWouldBlock = -6;
static const uint32_t kEventVersion = 1;
static const uint32_t kGfxClicked = 1;
static uint8_t gEventPacket[24];
static int32_t gResultLabel = -1;
static int32_t gAddButton = -1;
static int32_t gSubtractButton = -1;
static int32_t gCloseButton = -1;

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

    gResultLabel = maia_label_create(
        window,
        static_cast<int32_t>(reinterpret_cast<uintptr_t>(kPrompt)),
        static_cast<int32_t>(sizeof(kPrompt) - 1));
    gAddButton = maia_button_create(
        window,
        static_cast<int32_t>(reinterpret_cast<uintptr_t>(kAddButton)),
        static_cast<int32_t>(sizeof(kAddButton) - 1));
    gSubtractButton = maia_button_create(
        window,
        static_cast<int32_t>(reinterpret_cast<uintptr_t>(kSubtractButton)),
        static_cast<int32_t>(sizeof(kSubtractButton) - 1));
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
    if (bytes == kWouldBlock) return;
    if (bytes != static_cast<int32_t>(sizeof(gEventPacket))) return;
    if (read_u32_le(gEventPacket) != kEventVersion
        || read_u32_le(gEventPacket + 4) != kGfxClicked) return;

    int32_t handle = static_cast<int32_t>(read_u32_le(gEventPacket + 8));
    if (handle == gAddButton) {
        maia_label_set_text(
            gResultLabel,
            static_cast<int32_t>(reinterpret_cast<uintptr_t>(kAddition)),
            static_cast<int32_t>(sizeof(kAddition) - 1));
    } else if (handle == gSubtractButton) {
        maia_label_set_text(
            gResultLabel,
            static_cast<int32_t>(reinterpret_cast<uintptr_t>(kSubtraction)),
            static_cast<int32_t>(sizeof(kSubtraction) - 1));
    } else if (handle == gCloseButton) {
        maia_process_exit(0);
    }
}
#include <stdint.h>

#if !defined(__wasm__)
#error "The MaiaOS kernel guest must be compiled to WebAssembly."
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

MAIA_IMPORT("maia.vfs", "open")
int32_t maia_vfs_open(int32_t path_ptr, int32_t path_len, int32_t flags);

MAIA_IMPORT("maia.vfs", "read")
int32_t maia_vfs_read(int32_t handle, int32_t output_ptr, int32_t count);

MAIA_IMPORT("maia.vfs", "write")
int32_t maia_vfs_write(int32_t handle, int32_t input_ptr, int32_t count);

MAIA_IMPORT("maia.vfs", "close")
int32_t maia_vfs_close(int32_t handle);

MAIA_IMPORT("maia.log", "write")
int32_t maia_log_write(int32_t level, int32_t text_ptr, int32_t text_len);
}

static const char kWindowTitle[] = "MaiaOS C++ kernel guest";
static const char kWelcome[] = "The same kernel.wasm runs through replaceable maia.* host callbacks.";
static const char kStartup[] = "Reading /system/welcome.txt through maia.vfs...";
static const char kVfsError[] = "Could not read /system/welcome.txt.";
static const char kReadWelcomeButton[] = "Reload system welcome file";
static const char kWriteNoteButton[] = "Write a note to /home";
static const char kReadNoteButton[] = "Read the saved note";
static const char kNotePath[] = "/home/org.maiaos.kernel/maia-note.txt";
static const char kNoteText[] = "Saved by the C++98 kernel through maia.vfs.write.\n";
static const char kNoteSaved[] = "Note saved to /home/org.maiaos.kernel/maia-note.txt.";
static const char kNoteError[] = "VFS could not save or read the app note.";
static const char kEventLog[] = "Kernel consumed a button event from the host queue.";
static const char kPollError[] = "Kernel event queue returned an error.";
static const char kPacketError[] = "Kernel received a malformed event packet.";
static const char kUnsupportedEvent[] = "Kernel received an unsupported event version or type.";
static const int32_t kEventPacketBytes = 24;
static const int32_t kWouldBlock = -6;
static const int32_t kVfsReadOnly = 1;
static const uint32_t kEventVersion = 1;
static const uint32_t kGfxClicked = 1;
static uint8_t gEventPacket[24];
static uint8_t gFileBuffer[256];
static const char kWelcomePath[] = "/system/welcome.txt";

static int32_t gWindowHandle = -1;
static int32_t gStatusLabelHandle = -1;
static int32_t gReadWelcomeButtonHandle = -1;
static int32_t gWriteNoteButtonHandle = -1;
static int32_t gReadNoteButtonHandle = -1;

static const int32_t kVfsWriteCreateTruncate = 2 | 4 | 8;

static uint32_t read_u32_le(const uint8_t *bytes)
{
    return static_cast<uint32_t>(bytes[0])
        | (static_cast<uint32_t>(bytes[1]) << 8)
        | (static_cast<uint32_t>(bytes[2]) << 16)
        | (static_cast<uint32_t>(bytes[3]) << 24);
}

extern "C" __attribute__((visibility("default"))) void maiaos_start(void)
{
    gWindowHandle = maia_window_create(
        static_cast<int32_t>(reinterpret_cast<uintptr_t>(kWindowTitle)),
        static_cast<int32_t>(sizeof(kWindowTitle) - 1));
    if (gWindowHandle < 0) return;

    maia_label_create(
        gWindowHandle,
        static_cast<int32_t>(reinterpret_cast<uintptr_t>(kWelcome)),
        static_cast<int32_t>(sizeof(kWelcome) - 1));
    gStatusLabelHandle = maia_label_create(
        gWindowHandle,
        static_cast<int32_t>(reinterpret_cast<uintptr_t>(kStartup)),
        static_cast<int32_t>(sizeof(kStartup) - 1));
    gReadWelcomeButtonHandle = maia_button_create(
        gWindowHandle,
        static_cast<int32_t>(reinterpret_cast<uintptr_t>(kReadWelcomeButton)),
        static_cast<int32_t>(sizeof(kReadWelcomeButton) - 1));
    gWriteNoteButtonHandle = maia_button_create(
        gWindowHandle,
        static_cast<int32_t>(reinterpret_cast<uintptr_t>(kWriteNoteButton)),
        static_cast<int32_t>(sizeof(kWriteNoteButton) - 1));
    gReadNoteButtonHandle = maia_button_create(
        gWindowHandle,
        static_cast<int32_t>(reinterpret_cast<uintptr_t>(kReadNoteButton)),
        static_cast<int32_t>(sizeof(kReadNoteButton) - 1));

    int32_t file = maia_vfs_open(
        static_cast<int32_t>(reinterpret_cast<uintptr_t>(kWelcomePath)),
        static_cast<int32_t>(sizeof(kWelcomePath) - 1),
        kVfsReadOnly);
    if (file < 0) {
        maia_label_set_text(
            gStatusLabelHandle,
            static_cast<int32_t>(reinterpret_cast<uintptr_t>(kVfsError)),
            static_cast<int32_t>(sizeof(kVfsError) - 1));
        maia_log_write(3, static_cast<int32_t>(reinterpret_cast<uintptr_t>(kVfsError)), sizeof(kVfsError) - 1);
        return;
    }

    int32_t bytes = maia_vfs_read(file,
        static_cast<int32_t>(reinterpret_cast<uintptr_t>(gFileBuffer)),
        static_cast<int32_t>(sizeof(gFileBuffer)));
    maia_vfs_close(file);
    if (bytes < 0) {
        maia_label_set_text(
            gStatusLabelHandle,
            static_cast<int32_t>(reinterpret_cast<uintptr_t>(kVfsError)),
            static_cast<int32_t>(sizeof(kVfsError) - 1));
        maia_log_write(3, static_cast<int32_t>(reinterpret_cast<uintptr_t>(kVfsError)), sizeof(kVfsError) - 1);
        return;
    }
    maia_label_set_text(
        gStatusLabelHandle,
        static_cast<int32_t>(reinterpret_cast<uintptr_t>(gFileBuffer)),
        bytes);
}

static void set_status(const char *text, int32_t length)
{
    maia_label_set_text(
        gStatusLabelHandle,
        static_cast<int32_t>(reinterpret_cast<uintptr_t>(text)),
        length);
}

static void read_vfs_file(const char *path, int32_t path_length, const char *error_text, int32_t error_length)
{
    int32_t file = maia_vfs_open(
        static_cast<int32_t>(reinterpret_cast<uintptr_t>(path)),
        path_length,
        kVfsReadOnly);
    if (file < 0) {
        set_status(error_text, error_length);
        maia_log_write(3, static_cast<int32_t>(reinterpret_cast<uintptr_t>(error_text)), error_length);
        return;
    }

    int32_t bytes = maia_vfs_read(file,
        static_cast<int32_t>(reinterpret_cast<uintptr_t>(gFileBuffer)),
        static_cast<int32_t>(sizeof(gFileBuffer)));
    int32_t close_status = maia_vfs_close(file);
    if (bytes < 0 || close_status < 0) {
        set_status(error_text, error_length);
        maia_log_write(3, static_cast<int32_t>(reinterpret_cast<uintptr_t>(error_text)), error_length);
        return;
    }
    set_status(reinterpret_cast<const char *>(gFileBuffer), bytes);
}

static void save_home_note(void)
{
    int32_t file = maia_vfs_open(
        static_cast<int32_t>(reinterpret_cast<uintptr_t>(kNotePath)),
        static_cast<int32_t>(sizeof(kNotePath) - 1),
        kVfsWriteCreateTruncate);
    if (file < 0) {
        set_status(kNoteError, static_cast<int32_t>(sizeof(kNoteError) - 1));
        maia_log_write(3, static_cast<int32_t>(reinterpret_cast<uintptr_t>(kNoteError)), sizeof(kNoteError) - 1);
        return;
    }

    int32_t bytes = maia_vfs_write(
        file,
        static_cast<int32_t>(reinterpret_cast<uintptr_t>(kNoteText)),
        static_cast<int32_t>(sizeof(kNoteText) - 1));
    int32_t close_status = maia_vfs_close(file);
    if (bytes != static_cast<int32_t>(sizeof(kNoteText) - 1) || close_status < 0) {
        set_status(kNoteError, static_cast<int32_t>(sizeof(kNoteError) - 1));
        maia_log_write(3, static_cast<int32_t>(reinterpret_cast<uintptr_t>(kNoteError)), sizeof(kNoteError) - 1);
        return;
    }
    set_status(kNoteSaved, static_cast<int32_t>(sizeof(kNoteSaved) - 1));
}

extern "C" __attribute__((visibility("default"))) void maiaos_step(void)
{
    int32_t bytes = maia_events_poll(
        static_cast<int32_t>(reinterpret_cast<uintptr_t>(gEventPacket)),
        kEventPacketBytes);
    if (bytes == kWouldBlock) return;
    if (bytes < 0) {
        maia_log_write(3, static_cast<int32_t>(reinterpret_cast<uintptr_t>(kPollError)), sizeof(kPollError) - 1);
        return;
    }
    if (bytes != kEventPacketBytes) {
        maia_log_write(3, static_cast<int32_t>(reinterpret_cast<uintptr_t>(kPacketError)), sizeof(kPacketError) - 1);
        return;
    }
    if (read_u32_le(gEventPacket) != kEventVersion || read_u32_le(gEventPacket + 4) != kGfxClicked) {
        maia_log_write(2, static_cast<int32_t>(reinterpret_cast<uintptr_t>(kUnsupportedEvent)), sizeof(kUnsupportedEvent) - 1);
        return;
    }
    int32_t object_handle = static_cast<int32_t>(read_u32_le(gEventPacket + 8));
    if (object_handle == gReadWelcomeButtonHandle) {
        read_vfs_file(kWelcomePath, sizeof(kWelcomePath) - 1, kVfsError, sizeof(kVfsError) - 1);
    } else if (object_handle == gWriteNoteButtonHandle) {
        save_home_note();
    } else if (object_handle == gReadNoteButtonHandle) {
        read_vfs_file(kNotePath, sizeof(kNotePath) - 1, kNoteError, sizeof(kNoteError) - 1);
    } else {
        return;
    }
    maia_log_write(1,
        static_cast<int32_t>(reinterpret_cast<uintptr_t>(kEventLog)),
        static_cast<int32_t>(sizeof(kEventLog) - 1));
}

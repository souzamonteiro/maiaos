#include <stdint.h>
#define MAIA_IMPORT(module_name, field_name) __attribute__((import_module(module_name), import_name(field_name)))
extern "C" {
MAIA_IMPORT("maia.gfx", "window_create") int32_t maia_window_create(int32_t pointer, int32_t length);
MAIA_IMPORT("maia.gfx", "label_create") int32_t maia_label_create(int32_t parent, int32_t pointer, int32_t length);
MAIA_IMPORT("maia.gfx", "label_set_text") int32_t maia_label_set_text(int32_t handle, int32_t pointer, int32_t length);
MAIA_IMPORT("maia.events", "poll") int32_t maia_events_poll(int32_t pointer, int32_t capacity);
MAIA_IMPORT("maia.stream", "read") int32_t maia_stream_read(int32_t handle, int32_t pointer, int32_t count);
MAIA_IMPORT("maia.stream", "write") int32_t maia_stream_write(int32_t handle, int32_t pointer, int32_t count);
MAIA_IMPORT("maia.stream", "close") int32_t maia_stream_close(int32_t handle);
MAIA_IMPORT("maia.process", "exit") void maia_process_exit(int32_t status);
}
static const unsigned int kMaxLineBytes = 256;
static const unsigned int kEventVersion = 1;
static const unsigned int kEventKey = 2;
static const unsigned int kKeyText = 0;
static const unsigned int kKeyEnter = 1;
static const unsigned int kKeyBackspace = 2;
static const unsigned int kKeyLeft = 3;
static const unsigned int kKeyRight = 4;
static const unsigned int kKeyHome = 5;
static const unsigned int kKeyEnd = 6;
static const unsigned int kKeyDelete = 7;
static const unsigned int kKeyUp = 8;
static const unsigned int kKeyDown = 9;
static char gLine[256];
static char gPreviousLine[256];
static char gPendingInput[256];
static unsigned int gPendingLength = 0;
static unsigned int gPendingOffset = 0;
static char gTerminalText[4096];
static char gHistoryDisplay[4096];
static char gInputDisplay[4096];
static uint8_t gReadBuffer[128];
static uint8_t gEventPacket[24];
static unsigned int gTerminalLength = 0;
static unsigned int gLineLength = 0;
static unsigned int gCursor = 0;
static int gHasPreviousLine = 0;
static int gExited = 0;
static int gDirty = 1;
static int gWindowHandle = -1;
static int gOutputLabelHandle = -1;
static int gInputLabelHandle = -1;
static int gStdoutEOF = 0;
static int gStderrEOF = 0;
static unsigned int gEscape = 0;
static uint8_t gUtf8Bytes[4];
static unsigned int gUtf8Length = 0;
static unsigned int gUtf8Expected = 0;
static unsigned int gUtf8Codepoint = 0;
static unsigned int gUtf8Minimum = 0;
static char charAt(const char* text, unsigned int index)
{
    return *(text + index);
}

static void putChar(char* text, unsigned int index, char value)
{
    *(text + index) = value;
}

static unsigned int textLength(const char* text)
{
    unsigned int length = 0;
    while (text && charAt(text, length)) ++length;
    return length;
}

static int textEquals(const char* left, const char* right)
{
    unsigned int index = 0;
    if (!left || !right) return 0;
    while (charAt(left, index) && charAt(right, index)) {
        if (charAt(left, index) != charAt(right, index)) return 0;
        ++index;
    }
    return charAt(left, index) == charAt(right, index);
}


static void finish(int status)
{
    if (gExited) return;
    gExited = 1;
    maia_stream_close(3); maia_stream_close(4); maia_stream_close(5);
    maia_process_exit(status);
}
static void appendVisible(const uint8_t* bytes, unsigned int length)
{
    if (gTerminalLength + length >= 4096) gTerminalLength = 0;
    for (unsigned int i = 0; i < length; ++i) gTerminalText[gTerminalLength++] = static_cast<char>(bytes[i]);
    gTerminalText[gTerminalLength] = 0; gDirty = 1;
}
static void appendReplacement(void)
{
    const uint8_t replacement[3] = {239, 191, 189}; appendVisible(replacement, 3);
}
static void consumeByte(uint8_t value)
{
    // Incremental terminal UTF-8/control decoding, never shell tokenization.
    if (gUtf8Expected) {
        if (value >= 128 && value <= 191) {
            gUtf8Bytes[gUtf8Length++] = value;
            gUtf8Codepoint = (gUtf8Codepoint << 6) | (value & 63);
            if (gUtf8Length == gUtf8Expected) {
                if (gUtf8Codepoint < gUtf8Minimum || gUtf8Codepoint > 1114111
                    || (gUtf8Codepoint >= 55296 && gUtf8Codepoint <= 57343)) appendReplacement();
                else appendVisible(gUtf8Bytes, gUtf8Length);
                gUtf8Expected = 0; gUtf8Length = 0;
            }
            return;
        }
        appendReplacement(); gUtf8Expected = 0; gUtf8Length = 0;
    }
    if (value >= 128) {
        if (value >= 194 && value <= 223) { gUtf8Expected = 2; gUtf8Codepoint = value & 31; gUtf8Minimum = 128; }
        else if (value >= 224 && value <= 239) { gUtf8Expected = 3; gUtf8Codepoint = value & 15; gUtf8Minimum = 2048; }
        else if (value >= 240 && value <= 244) { gUtf8Expected = 4; gUtf8Codepoint = value & 7; gUtf8Minimum = 65536; }
        else { appendReplacement(); return; }
        gUtf8Bytes[0] = value; gUtf8Length = 1; return;
    }
    if (gEscape == 1) { gEscape = value == '[' ? 2 : 0; return; }
    if (gEscape == 2) { gEscape = value == '2' ? 3 : 0; return; }
    if (gEscape == 3) {
        if (value == 'J') { gTerminalLength = 0; gTerminalText[0] = 0; gDirty = 1; }
        gEscape = 0; return;
    }
    if (value == 27) { gEscape = 1; return; }
    if (value == 0 || value == 13) return;
    appendVisible(&value, 1);
}
static void renderInputLine(void)
{
    // Completed output and the live terminal line use separate LVGL labels.
    // The live output prefix (including a shell prompt) and caret stay together.
    unsigned int split = 0;
    for (unsigned int i = 0; i < gTerminalLength; ++i) if (gTerminalText[i] == '\n') split = i + 1;
    for (unsigned int i = 0; i < split; ++i) gHistoryDisplay[i] = gTerminalText[i];
    gHistoryDisplay[split] = 0;
    unsigned int start = split;
    const unsigned int maximumPrefix = 4094 - gLineLength;
    if (gTerminalLength - start > maximumPrefix) {
        start = gTerminalLength - maximumPrefix;
        while (start < gTerminalLength && (static_cast<unsigned char>(gTerminalText[start]) & 192) == 128) ++start;
    }
    unsigned int length = 0;
    for (unsigned int i = start; i < gTerminalLength; ++i) gInputDisplay[length++] = gTerminalText[i];
    for (unsigned int i = 0; i <= gLineLength; ++i) {
        if (i == gCursor) gInputDisplay[length++] = '|';
        else if (i < gCursor) gInputDisplay[length++] = gLine[i];
        else gInputDisplay[length++] = gLine[i - 1];
    }
    gInputDisplay[length] = 0;
    if (gOutputLabelHandle >= 0) maia_label_set_text(gOutputLabelHandle,
        static_cast<int32_t>(reinterpret_cast<uintptr_t>(gHistoryDisplay)), static_cast<int32_t>(split));
    if (gInputLabelHandle >= 0) maia_label_set_text(gInputLabelHandle,
        static_cast<int32_t>(reinterpret_cast<uintptr_t>(gInputDisplay)), static_cast<int32_t>(length));
    gDirty = 0;
}
static void flushInput(void)
{
    if (gPendingOffset == gPendingLength) return;
    const int32_t count = maia_stream_write(3,
        static_cast<int32_t>(reinterpret_cast<uintptr_t>(gPendingInput + gPendingOffset)),
        static_cast<int32_t>(gPendingLength - gPendingOffset));
    if (count == -6) return;
    if (count <= 0) { finish(1); return; }
    gPendingOffset += static_cast<unsigned int>(count);
    if (gPendingOffset == gPendingLength) { gPendingOffset = 0; gPendingLength = 0; }
}
static void submitLine(void)
{
    if (gPendingLength) return;
    for (unsigned int i = 0; i < gLineLength; ++i) {
        gPendingInput[i] = gLine[i];
        const uint8_t value = static_cast<uint8_t>(gLine[i]); appendVisible(&value, 1);
    }
    gPendingInput[gLineLength] = '\n'; gPendingLength = gLineLength + 1;
    const uint8_t newline = 10; appendVisible(&newline, 1);
    if (gLineLength) {
        for (unsigned int i = 0; i <= gLineLength; ++i) gPreviousLine[i] = gLine[i];
        gHasPreviousLine = 1;
    }
    gLineLength = 0; gCursor = 0; gLine[0] = 0; gDirty = 1;
}
static uint32_t readUint32(const uint8_t* bytes)
{
    return static_cast<uint32_t>(bytes[0]) | (static_cast<uint32_t>(bytes[1]) << 8)
        | (static_cast<uint32_t>(bytes[2]) << 16) | (static_cast<uint32_t>(bytes[3]) << 24);
}
static void setInputLine(const char* text)
{
    unsigned int length = textLength(text);
    if (length >= kMaxLineBytes) length = kMaxLineBytes - 1;
    for (unsigned int index = 0; index < length; ++index) {
        putChar(gLine, index, charAt(text, index));
    }
    putChar(gLine, length, 0);
    gLineLength = length;
    gCursor = length;
    gDirty = 1;
}

static void handleKeyEvent(uint32_t codepoint, uint32_t key)
{
    if (key == kKeyEnter) {
        submitLine();
    } else if (key == kKeyText) {
        if (codepoint < 32 || codepoint > 126 || gLineLength + 1 >= kMaxLineBytes) return;
        for (unsigned int index = gLineLength; index > gCursor; --index) {
            putChar(gLine, index, charAt(gLine, index - 1));
        }
        putChar(gLine, gCursor, static_cast<char>(codepoint));
        ++gLineLength;
        ++gCursor;
        putChar(gLine, gLineLength, 0);
        gDirty = 1;
    } else if (key == kKeyBackspace && gCursor > 0) {
        for (unsigned int index = gCursor - 1; index < gLineLength; ++index) {
            putChar(gLine, index, charAt(gLine, index + 1));
        }
        --gCursor;
        --gLineLength;
        gDirty = 1;
    } else if (key == kKeyDelete && gCursor < gLineLength) {
        for (unsigned int index = gCursor; index < gLineLength; ++index) {
            putChar(gLine, index, charAt(gLine, index + 1));
        }
        --gLineLength;
        gDirty = 1;
    } else if (key == kKeyLeft && gCursor > 0) {
        --gCursor;
        gDirty = 1;
    } else if (key == kKeyRight && gCursor < gLineLength) {
        ++gCursor;
        gDirty = 1;
    } else if (key == kKeyHome) {
        gCursor = 0;
        gDirty = 1;
    } else if (key == kKeyEnd) {
        gCursor = gLineLength;
        gDirty = 1;
    } else if (key == kKeyUp && gHasPreviousLine) {
        setInputLine(gPreviousLine);
    } else if (key == kKeyDown) {
        setInputLine("");
    }
}


static void drainOutput(int handle)
{
    for (unsigned int i = 0; i < 16; ++i) {
        const int32_t count = maia_stream_read(handle,
            static_cast<int32_t>(reinterpret_cast<uintptr_t>(gReadBuffer)), 128);
        if (count == -6) return;
        if (count < 0) { finish(1); return; }
        if (count == 0) {
            if (handle == 4) gStdoutEOF = 1; else gStderrEOF = 1;
            return;
        }
        for (unsigned int j = 0; j < static_cast<unsigned int>(count); ++j) consumeByte(gReadBuffer[j]);
    }
}
extern "C" __attribute__((visibility("default"))) void maia_io_start(void)
{
    const char* title = "Maia Terminal";
    const char* empty = "";
    gWindowHandle = maia_window_create(static_cast<int32_t>(reinterpret_cast<uintptr_t>(title)), 13);
    if (gWindowHandle < 0) { finish(1); return; }
    gOutputLabelHandle = maia_label_create(gWindowHandle, static_cast<int32_t>(reinterpret_cast<uintptr_t>(empty)), 0);
    gInputLabelHandle = maia_label_create(gWindowHandle, static_cast<int32_t>(reinterpret_cast<uintptr_t>(empty)), 0);
    if (gOutputLabelHandle < 0 || gInputLabelHandle < 0) { finish(1); return; }
    renderInputLine();
}
extern "C" __attribute__((visibility("default"))) void maiaos_step(void)
{
    if (gExited) return;
    drainOutput(4); if (gExited) return;
    drainOutput(5); if (gExited) return;
    if (gStdoutEOF && gStderrEOF) {
        if (gUtf8Expected) { appendReplacement(); gUtf8Expected = 0; }
        if (gDirty) renderInputLine();
        finish(0); return;
    }
    flushInput(); if (gExited) return;
    if (!gPendingLength) {
        for (unsigned int i = 0; i < 16; ++i) {
            const int32_t count = maia_events_poll(static_cast<int32_t>(reinterpret_cast<uintptr_t>(gEventPacket)), 24);
            if (count == -6) break;
            if (count != 24) { finish(1); return; }
            if (readUint32(gEventPacket) == kEventVersion && readUint32(gEventPacket + 4) == kEventKey)
                handleKeyEvent(readUint32(gEventPacket + 12), readUint32(gEventPacket + 16));
            if (gPendingLength) break;
        }
        flushInput();
    }
    if (!gExited && gDirty) renderInputLine();
}

#define MAIACPP_USE_C_ALLOCATOR
#include <stdint.h>
#include "generated/maia-shell-parser.hpp"
#include "maia-shell-parse-tree-collector.hpp"

#define MAIA_IMPORT(module_name, field_name) \
    __attribute__((import_module(module_name), import_name(field_name)))

extern "C" {
MAIA_IMPORT("maia.gfx", "window_create")
int32_t maia_window_create(int32_t text_ptr, int32_t text_len);

MAIA_IMPORT("maia.gfx", "label_create")
int32_t maia_label_create(int32_t parent, int32_t text_ptr, int32_t text_len);

MAIA_IMPORT("maia.gfx", "label_set_text")
int32_t maia_label_set_text(int32_t label, int32_t text_ptr, int32_t text_len);

MAIA_IMPORT("maia.events", "poll")
int32_t maia_events_poll(int32_t output_ptr, int32_t capacity);

MAIA_IMPORT("maia.vfs", "open")
int32_t maia_vfs_open(int32_t path_ptr, int32_t path_len, int32_t flags);

MAIA_IMPORT("maia.vfs", "read")
int32_t maia_vfs_read(int32_t handle, int32_t output_ptr, int32_t count);

MAIA_IMPORT("maia.vfs", "close")
int32_t maia_vfs_close(int32_t handle);

MAIA_IMPORT("maia.process", "exit")
void maia_process_exit(int32_t status);
}

static const int32_t kWouldBlock = -6;
static const int32_t kVfsRead = 1;
static const unsigned int kMaxLineBytes = 256;
static const unsigned int kTerminalBytes = 4096;
static const unsigned int kMaxTokens = 32;
static const unsigned int kMaxWordBytes = 96;
static const unsigned int kMaxArgs = 12;
static const unsigned int kReadBufferBytes = 128;
static const unsigned int kOutputBufferBytes = 263;
static const unsigned int kEventPacketBytes = 24;
static const unsigned int kEventVersion = 1;
static const unsigned int kEventGfxClicked = 1;
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

/* Compiler-owned storage cannot overlap generated lexer tables or the stack. */
static char gLine[256];
static MaiaCCParserToken gTokens[32];
static MaiaShellParseTreeNode gParseNodes[1024];
static char gCommandWords[1152];
static uint8_t gReadBuffer[128];
static char gOutputBuffer[263];
static char gTerminalText[4096];
static uint8_t gEventPacket[24];
static unsigned int gTokenCount = 0;
static unsigned int gTerminalLength = 0;
static unsigned int gLineLength = 0;
static unsigned int gCursor = 0;
static int gWindowHandle = -1;
static int gOutputLabelHandle = -1;
static int gInputLabelHandle = -1;
static int gHasPreviousLine = 0;
static int gExited = 0;
static char gPreviousLine[256];
static const char kWindowTitle[] = "Maia Shell";
static const char kStartupText[] = "MaiaOS Shell MVP. Type help to begin.\n";
static const char kPromptText[] = "maia> ";
static const char kEmptyText[] = "";

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

static int writeBytes(int32_t stream, const char* bytes, unsigned int length)
{
    if (stream != 1 && stream != 2) return -1;
    if (length >= kTerminalBytes) return -1;
    if (gTerminalLength + length >= kTerminalBytes) gTerminalLength = 0;
    for (unsigned int index = 0; index < length; ++index) {
        putChar(gTerminalText, gTerminalLength, bytes[index]);
        ++gTerminalLength;
    }
    putChar(gTerminalText, gTerminalLength, 0);
    if (gOutputLabelHandle < 0) return 0;
    const int32_t textPointer = static_cast<int32_t>(reinterpret_cast<uintptr_t>(gTerminalText));
    return maia_label_set_text(
        gOutputLabelHandle,
        textPointer,
        static_cast<int32_t>(gTerminalLength));
}

static int writeText(int32_t stream, const char* text)
{
    return writeBytes(stream, text, textLength(text));
}

static void clearTerminal(void)
{
    gTerminalLength = 0;
    putChar(gTerminalText, 0, 0);
    if (gOutputLabelHandle >= 0) {
        maia_label_set_text(gOutputLabelHandle,
            static_cast<int32_t>(reinterpret_cast<uintptr_t>(gTerminalText)), 0);
    }
}

static void renderInputLine(void)
{
    unsigned int displayLength;
    unsigned int index;
    char value;
    char* lineBuffer;
    char* outputBuffer;
    displayLength = 0;
    lineBuffer = gLine;
    outputBuffer = gOutputBuffer;
    for (index = 0; index < sizeof(kPromptText) - 1; ++index) {
        putChar(outputBuffer, displayLength, charAt(kPromptText, index));
        ++displayLength;
    }
    for (index = 0; index <= gLineLength; ++index) {
        if (index == gCursor) value = '|';
        else if (index < gCursor) value = charAt(lineBuffer, index);
        else value = charAt(lineBuffer, index - 1);
        putChar(outputBuffer, displayLength, value);
        ++displayLength;
    }
    putChar(outputBuffer, displayLength, 0);
    if (gInputLabelHandle >= 0) {
        maia_label_set_text(
            gInputLabelHandle,
            static_cast<int32_t>(reinterpret_cast<uintptr_t>(outputBuffer)),
            static_cast<int32_t>(displayLength));
    }
}

static uint32_t readUint32(const uint8_t* bytes)
{
    return static_cast<uint32_t>(bytes[0])
        | (static_cast<uint32_t>(bytes[1]) << 8)
        | (static_cast<uint32_t>(bytes[2]) << 16)
        | (static_cast<uint32_t>(bytes[3]) << 24);
}

static int tokenizeLine(void)
{
    MaiaCCLexerState lexer;
    gTokenCount = 0;
    maiaCCLexerStateInit(&lexer, gLine, gLineLength);
    if (!maiaCCLexerTokenize(&lexer, gTokens, kMaxTokens)) {
        return lexer.failed == 1 ? 0 : 3;
    }
    gTokenCount = lexer.tokenCount;
    return 1;
}

static int parseShellLine(MaiaShellParseTreeCollector* tree)
{
    MaiaCCParserState parser;
    MaiaCCParseEvents events;
    maiaShellParseTreeInit(
        tree,
        gParseNodes,
        kShellParseTreeCapacity);
    maiaShellParseTreeSetEvents(tree, &events);
    maiaCCParserStateInit(&parser, gTokens, gTokenCount, &events);
    const int accepted = maiaCC_parse(&parser);
    if (tree->overflow) return 3;
    return accepted && !parser.failed && parser.position == gTokenCount
        && tree->activeNode < 0;
}

static int buildCommandWords(const MaiaShellParseTreeCollector* tree, unsigned int* wordCount)
{
    *wordCount = 0;
    unsigned int simpleCommands = 0;
    for (unsigned int index = 0; index < tree->nodeCount; ++index) {
        const MaiaShellParseTreeNode* node = tree->nodes + index;
        if (node->kind != kShellParseTreeNonterminal) continue;
        if (textEquals(node->name, "SimpleCommand")) ++simpleCommands;
        if (textEquals(node->name, "Assignment") || textEquals(node->name, "Redirection")) return 2;
    }
    if (simpleCommands > 1) return 2;
    for (unsigned int index = 0; index < tree->nodeCount; ++index) {
        const MaiaShellParseTreeNode* node = tree->nodes + index;
        if (node->kind != kShellParseTreeTerminal) continue;
        if (node->token == MAIACC_TOKEN_EOF || node->token == MAIACC_TOKEN_NEWLINE) continue;
        if (node->token != MAIACC_TOKEN_WORD
            && node->token != MAIACC_TOKEN_ASSIGNMENT_WORD
            && node->token != MAIACC_TOKEN_IO_NUMBER) return 2;
        if (*wordCount >= kMaxArgs) return 3;

        char* word = gCommandWords + (*wordCount * kMaxWordBytes);
        unsigned int outputLength = 0;
        char quote = 0;
        for (unsigned int offset = 0; offset < node->length; ++offset) {
            char current = node->value[offset];
            if ((current == 39 || current == 34) && (!quote || quote == current)) {
                quote = quote ? 0 : current;
                continue;
            }
            if (current == 92 && quote != 39 && offset + 1 < node->length) {
                ++offset;
                current = node->value[offset];
            }
            if (outputLength + 1 >= kMaxWordBytes) return 3;
            putChar(word, outputLength, current);
            ++outputLength;
        }
        if (quote) return 2;
        putChar(word, outputLength, 0);
        ++*wordCount;
    }
    return 1;
}

static int parseSimpleCommand(unsigned int* wordCount)
{
    MaiaShellParseTreeCollector tree;
    const int lexical = tokenizeLine();
    if (lexical != 1) return lexical;
    const int parsed = parseShellLine(&tree);
    if (parsed != 1) return parsed;
    return buildCommandWords(&tree, wordCount);
}

static void printHelp(void)
{
    writeText(1, "Commands: help, echo, pwd, cat /system/welcome.txt, clear, exit\n");
}

static void runCat(const char* path)
{
    const int32_t handle = maia_vfs_open(
        static_cast<int32_t>(reinterpret_cast<uintptr_t>(path)),
        static_cast<int32_t>(textLength(path)),
        kVfsRead);
    if (handle <= 0) {
        writeText(2, "cat: cannot open file\n");
        return;
    }

    for (;;) {
        const int32_t count = maia_vfs_read(
            handle,
            static_cast<int32_t>(reinterpret_cast<uintptr_t>(gReadBuffer)),
            kReadBufferBytes);
        if (count < 0) {
            writeText(2, "cat: read failed\n");
            break;
        }
        if (count == 0) break;
        writeBytes(1, reinterpret_cast<const char*>(gReadBuffer), static_cast<unsigned int>(count));
    }
    maia_vfs_close(handle);
}

static void executeCommand(unsigned int wordCount)
{
    const char* command = gCommandWords;
    char* outputBuffer = gOutputBuffer;
    if (textEquals(command, "help")) {
        printHelp();
    } else if (textEquals(command, "echo")) {
        for (unsigned int index = 1; index < wordCount; ++index) {
            if (index > 1) writeText(1, " ");
            writeText(1, gCommandWords + (index * kMaxWordBytes));
        }
        writeText(1, "\n");
    } else if (textEquals(command, "pwd") && wordCount == 1) {
        writeText(1, "/\n");
    } else if (textEquals(command, "cat") && wordCount == 2
        && textEquals(gCommandWords + kMaxWordBytes, "/system/welcome.txt")) {
        runCat(gCommandWords + kMaxWordBytes);
    } else if (textEquals(command, "clear") && wordCount == 1) {
        clearTerminal();
    } else if (textEquals(command, "exit") && wordCount == 1) {
        gExited = 1;
        maia_process_exit(0);
    } else {
        putChar(outputBuffer, 0, 0);
        const char* prefix = "command not found: ";
        unsigned int offset = 0;
        while (charAt(prefix, offset) && offset + 1 < kOutputBufferBytes) {
            putChar(outputBuffer, offset, charAt(prefix, offset));
            ++offset;
        }
        unsigned int character = 0;
        while (charAt(command, character) && offset + 2 < kOutputBufferBytes) {
            putChar(outputBuffer, offset, charAt(command, character));
            ++offset;
            ++character;
        }
        putChar(outputBuffer, offset, 10);
        ++offset;
        putChar(outputBuffer, offset, 0);
        writeText(2, outputBuffer);
    }
}

static void processLine(void)
{
    unsigned int wordCount = 0;
    const int parsed = parseSimpleCommand(&wordCount);
    if (parsed != 1) {
        if (parsed == 0) writeText(2, "syntax error\n");
        else if (parsed == 3) writeText(2, "shell input limit exceeded\n");
        else writeText(2, "unsupported syntax: simple commands only\n");
        return;
    }
    if (wordCount > 0) executeCommand(wordCount);
}

static void submitLine(void)
{
    putChar(gLine, gLineLength, 0);
    writeText(1, kPromptText);
    writeBytes(1, gLine, gLineLength);
    writeText(1, "\n");
    if (gLineLength > 0) {
        for (unsigned int index = 0; index <= gLineLength; ++index) {
            putChar(gPreviousLine, index, charAt(gLine, index));
        }
        gHasPreviousLine = 1;
    }
    processLine();
    if (gExited) return;
    gLineLength = 0;
    gCursor = 0;
    putChar(gLine, 0, 0);
    renderInputLine();
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
    renderInputLine();
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
        renderInputLine();
    } else if (key == kKeyBackspace && gCursor > 0) {
        for (unsigned int index = gCursor - 1; index < gLineLength; ++index) {
            putChar(gLine, index, charAt(gLine, index + 1));
        }
        --gCursor;
        --gLineLength;
        renderInputLine();
    } else if (key == kKeyDelete && gCursor < gLineLength) {
        for (unsigned int index = gCursor; index < gLineLength; ++index) {
            putChar(gLine, index, charAt(gLine, index + 1));
        }
        --gLineLength;
        renderInputLine();
    } else if (key == kKeyLeft && gCursor > 0) {
        --gCursor;
        renderInputLine();
    } else if (key == kKeyRight && gCursor < gLineLength) {
        ++gCursor;
        renderInputLine();
    } else if (key == kKeyHome) {
        gCursor = 0;
        renderInputLine();
    } else if (key == kKeyEnd) {
        gCursor = gLineLength;
        renderInputLine();
    } else if (key == kKeyUp && gHasPreviousLine) {
        setInputLine(gPreviousLine);
    } else if (key == kKeyDown) {
        setInputLine("");
    }
}

extern "C" __attribute__((visibility("default"))) void maia_app_start(void)
{
    gWindowHandle = maia_window_create(
        static_cast<int32_t>(reinterpret_cast<uintptr_t>(kWindowTitle)),
        static_cast<int32_t>(sizeof(kWindowTitle) - 1));
    if (gWindowHandle < 0) return;
    gOutputLabelHandle = maia_label_create(
        gWindowHandle,
        static_cast<int32_t>(reinterpret_cast<uintptr_t>(kEmptyText)),
        0);
    gInputLabelHandle = maia_label_create(
        gWindowHandle,
        static_cast<int32_t>(reinterpret_cast<uintptr_t>(kEmptyText)),
        0);
    if (gOutputLabelHandle < 0 || gInputLabelHandle < 0) return;
    writeText(1, kStartupText);
    renderInputLine();
}

extern "C" __attribute__((visibility("default"))) void maiaos_step(void)
{
    for (unsigned int eventIndex = 0; eventIndex < 16; ++eventIndex) {
        const int32_t bytes = maia_events_poll(
            static_cast<int32_t>(reinterpret_cast<uintptr_t>(gEventPacket)),
            kEventPacketBytes);
        if (bytes == kWouldBlock) return;
        if (bytes != kEventPacketBytes || readUint32(gEventPacket) != kEventVersion) return;
        const uint32_t eventType = readUint32(gEventPacket + 4);
        if (eventType == kEventKey) {
            handleKeyEvent(readUint32(gEventPacket + 12), readUint32(gEventPacket + 16));
            if (gExited) return;
        }
    }
}

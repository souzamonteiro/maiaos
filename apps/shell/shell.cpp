#define MAIACPP_USE_C_ALLOCATOR
#include <stdint.h>
#include "generated/maia-shell-parser.hpp"
#include "maia-shell-parse-tree-collector.hpp"
#define MAIA_IMPORT(module_name, field_name) __attribute__((import_module(module_name), import_name(field_name)))
extern "C" {
MAIA_IMPORT("maia.stream", "read") int32_t maia_stream_read(int32_t handle, int32_t pointer, int32_t count);
MAIA_IMPORT("maia.stream", "write") int32_t maia_stream_write(int32_t handle, int32_t pointer, int32_t count);
MAIA_IMPORT("maia.stream", "close") int32_t maia_stream_close(int32_t handle);
MAIA_IMPORT("maia.vfs", "open") int32_t maia_vfs_open(int32_t pointer, int32_t length, int32_t flags);
MAIA_IMPORT("maia.vfs", "read") int32_t maia_vfs_read(int32_t handle, int32_t pointer, int32_t count);
MAIA_IMPORT("maia.vfs", "close") int32_t maia_vfs_close(int32_t handle);
MAIA_IMPORT("maia.process", "exit") void maia_process_exit(int32_t status);
}
static const int32_t kVfsRead = 1;
static const unsigned int kMaxTokens = 32;
static const unsigned int kMaxWordBytes = 96;
static const unsigned int kMaxArgs = 12;
static const unsigned int kReadBufferBytes = 128;
static const unsigned int kOutputBufferBytes = 263;
static const char kPromptText[] = "maia> ";
static char gLine[256];
static MaiaCCParserToken gTokens[32];
static MaiaShellParseTreeNode gParseNodes[1024];
static char gCommandWords[1152];
static uint8_t gReadBuffer[128];
static char gOutputBuffer[263];
static uint8_t gInputBuffer[256];
static unsigned int gInputOffset = 0;
static unsigned int gInputCount = 0;
static unsigned int gLineLength = 0;
static unsigned int gTokenCount = 0;
static int gInputOverflow = 0;
static int gInputEOF = 0;
static int gCatHandle = -1;
static int gExitRequested = 0;
static int gExited = 0;
static int gFatal = 0;
static char gPendingOutput[4096];
static uint8_t gPendingStream[4096];
static unsigned int gPendingOffset = 0;
static unsigned int gPendingLength = 0;
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
    if ((stream != 1 && stream != 2) || length > 4096 - gPendingLength) {
        gFatal = 1; return -4;
    }
    for (unsigned int i = 0; i < length; ++i) {
        gPendingOutput[gPendingLength] = bytes[i];
        gPendingStream[gPendingLength] = static_cast<uint8_t>(stream);
        ++gPendingLength;
    }
    return static_cast<int>(length);
}
static int writeText(int32_t stream, const char* text) { return writeBytes(stream, text, textLength(text)); }
static void flushOutput(void)
{
    for (unsigned int attempt = 0; attempt < 16 && gPendingOffset < gPendingLength; ++attempt) {
        unsigned int end = gPendingOffset + 1;
        const unsigned int stream = gPendingStream[gPendingOffset];
        while (end < gPendingLength && gPendingStream[end] == stream) ++end;
        const int32_t result = maia_stream_write(static_cast<int32_t>(stream),
            static_cast<int32_t>(reinterpret_cast<uintptr_t>(gPendingOutput + gPendingOffset)),
            static_cast<int32_t>(end - gPendingOffset));
        if (result == -6) return;
        if (result <= 0) { gFatal = 1; return; }
        gPendingOffset += static_cast<unsigned int>(result);
    }
    if (gPendingOffset == gPendingLength) { gPendingOffset = 0; gPendingLength = 0; }
}
static void runCat(const char* path)
{
    gCatHandle = maia_vfs_open(static_cast<int32_t>(reinterpret_cast<uintptr_t>(path)),
        static_cast<int32_t>(textLength(path)), kVfsRead);
    if (gCatHandle <= 0) { gCatHandle = -1; writeText(2, "cat: cannot open file\n"); }
}
static void resumeCat(void)
{
    const int32_t count = maia_vfs_read(gCatHandle,
        static_cast<int32_t>(reinterpret_cast<uintptr_t>(gReadBuffer)), kReadBufferBytes);
    if (count > 0) { writeBytes(1, reinterpret_cast<const char*>(gReadBuffer), static_cast<unsigned int>(count)); return; }
    maia_vfs_close(gCatHandle); gCatHandle = -1;
    if (count < 0) writeText(2, "cat: read failed\n");
    if (!gInputEOF) writeText(1, kPromptText);
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
        writeText(1, "\033[2J\033[H");
    } else if (textEquals(command, "exit") && wordCount == 1) {
        gExitRequested = 1;
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
        if (!gInputEOF) writeText(1, kPromptText);
        return;
    }
    if (wordCount > 0) executeCommand(wordCount);
    if (!gExitRequested && !gInputEOF && gCatHandle < 0) writeText(1, kPromptText);
}


static void finish(void)
{
    if (gCatHandle >= 0) { maia_vfs_close(gCatHandle); gCatHandle = -1; }
    for (int32_t handle = 0; handle < 3; ++handle) maia_stream_close(handle);
    gExited = 1; maia_process_exit(gFatal ? 1 : 0);
}
static void completeLine(void)
{
    gLine[gLineLength] = 0;
    if (gInputOverflow) {
        writeText(2, "shell input limit exceeded\n");
        if (!gInputEOF) writeText(1, kPromptText);
    } else processLine();
    gLineLength = 0; gInputOverflow = 0;
}
extern "C" __attribute__((visibility("default"))) void maia_app_start(void)
{
    writeText(1, "MaiaOS Shell MVP. Type help to begin.\n");
    writeText(1, kPromptText); flushOutput();
}
extern "C" __attribute__((visibility("default"))) void maiaos_step(void)
{
    if (gExited) return;
    for (unsigned int budget = 0; budget < 16; ++budget) {
        flushOutput();
        if (gFatal) { finish(); return; }
        if (gPendingLength) return;
        if (gExitRequested) { finish(); return; }
        if (gCatHandle >= 0) { resumeCat(); continue; }
        if (gInputEOF) { gExitRequested = 1; continue; }
        if (gInputOffset == gInputCount) {
            const int32_t count = maia_stream_read(0,
                static_cast<int32_t>(reinterpret_cast<uintptr_t>(gInputBuffer)), 256);
            if (count == -6) return;
            if (count < 0) { gFatal = 1; continue; }
            if (count == 0) {
                gInputEOF = 1;
                if (gLineLength || gInputOverflow) completeLine();
                continue;
            }
            gInputOffset = 0; gInputCount = static_cast<unsigned int>(count);
        }
        for (unsigned int i = 0; i < 256 && gInputOffset < gInputCount; ++i) {
            const char value = static_cast<char>(gInputBuffer[gInputOffset++]);
            if (value == '\n') { completeLine(); break; }
            if (gLineLength < 255) gLine[gLineLength++] = value;
            else gInputOverflow = 1;
        }
    }
}

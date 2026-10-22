#define MAIACPP_USE_C_ALLOCATOR
#include <stdint.h>
#include "../../maiaglob/maia_glob.h"
#include "generated/maia-shell-parser.hpp"
#include "maia-shell-parse-tree-collector.hpp"
#define MAIA_IMPORT(module_name, field_name) __attribute__((import_module(module_name), import_name(field_name)))
extern "C" {
MAIA_IMPORT("maia.stream", "read") int32_t maia_stream_read(int32_t handle, int32_t pointer, int32_t count);
MAIA_IMPORT("maia.stream", "write") int32_t maia_stream_write(int32_t handle, int32_t pointer, int32_t count);
MAIA_IMPORT("maia.stream", "close") int32_t maia_stream_close(int32_t handle);
MAIA_IMPORT("maia.vfs", "open") int32_t maia_vfs_open(int32_t pointer, int32_t length, int32_t flags);
MAIA_IMPORT("maia.vfs", "read") int32_t maia_vfs_read(int32_t handle, int32_t pointer, int32_t count);
MAIA_IMPORT("maia.vfs", "opendir") int32_t maia_vfs_opendir(int32_t pointer, int32_t length);
MAIA_IMPORT("maia.vfs", "readdir") int32_t maia_vfs_readdir(int32_t handle, int32_t pointer, int32_t capacity);
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
static int gDirectoryHandle = -1;
static unsigned int gLsActive = 0;
static unsigned int gLsCount = 0;
static unsigned int gLsIndex = 0;
static unsigned int gLsLookup = 0;
static const char* gLsOperand = 0;
static char gLsBase[256];
static char gCwd[1024] = "/";
// Scratch also holds a maximal cwd plus one bounded operand before normalization.
static char gResolvedPath[1152];
static uint8_t gDirectoryPacket[271];
static char gDirectoryOutput[1024];
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
static void resumeCat(void)
{
    const int32_t count = maia_vfs_read(gCatHandle,
        static_cast<int32_t>(reinterpret_cast<uintptr_t>(gReadBuffer)), kReadBufferBytes);
    if (count > 0) { writeBytes(1, reinterpret_cast<const char*>(gReadBuffer), static_cast<unsigned int>(count)); return; }
    maia_vfs_close(gCatHandle); gCatHandle = -1;
    if (count < 0) writeText(2, "cat: read failed\n");
    if (!gInputEOF) writeText(1, kPromptText);
}
static int resolvePath(const char* path)
{
    if (!path || !path[0]) return 0;
    unsigned int length = 1;
    gResolvedPath[0] = '/';
    if (path[0] != '/') {
        length = textLength(gCwd);
        for (unsigned int i = 0; i < length; ++i) gResolvedPath[i] = gCwd[i];
    }
    unsigned int offset = 0;
    while (path[offset]) {
        while (path[offset] == '/') ++offset;
        const unsigned int start = offset;
        while (path[offset] && path[offset] != '/') ++offset;
        const unsigned int count = offset - start;
        if (count == 0 || (count == 1 && path[start] == '.')) continue;
        if (count == 2 && path[start] == '.' && path[start + 1] == '.') {
            while (length > 1 && gResolvedPath[length - 1] != '/') --length;
            if (length > 1) --length;
            continue;
        }
        const unsigned int separator = length > 1 ? 1 : 0;
        if (length + separator + count >= 1152) return 0;
        if (separator) gResolvedPath[length++] = '/';
        for (unsigned int i = 0; i < count; ++i) gResolvedPath[length++] = path[start + i];
    }
    if (length >= 1024) return 0;
    gResolvedPath[length] = 0;
    return 1;
}
static void runCat(const char* path)
{
    if (!resolvePath(path)) { writeText(2, "cat: invalid path\n"); return; }
    gCatHandle = maia_vfs_open(static_cast<int32_t>(reinterpret_cast<uintptr_t>(gResolvedPath)),
        static_cast<int32_t>(textLength(gResolvedPath)), kVfsRead);
    if (gCatHandle <= 0) {
        if (gCatHandle == -3) writeText(2, "cat: permission denied\n");
        else if (gCatHandle == -4) writeText(2, "cat: open-file limit exceeded\n");
        else if (gCatHandle == -1) writeText(2, "cat: invalid path\n");
        else writeText(2, "cat: cannot open file\n");
        gCatHandle = -1;
    }
}
static void directoryError(const char* command, int status)
{
    writeText(2, command); writeText(2, ": ");
    if (status == -1) writeText(2, "invalid path or directory entry\n");
    else if (status == -2) writeText(2, "no such directory\n");
    else if (status == -3) writeText(2, "permission denied\n");
    else if (status == -4) writeText(2, "directory limit exceeded\n");
    else if (status == -9) writeText(2, "not a directory\n");
    else writeText(2, "directory operation failed\n");
}
static void runDirectoryCommand(const char* command, unsigned int wordCount)
{
    const int change = textEquals(command, "cd");
    const char* path = wordCount == 1 ? (change ? "/home/org.maiaplatform.shell" : gCwd) : gCommandWords + kMaxWordBytes;
    if (wordCount > 2 || path[0] == '-') {
        writeText(2, change ? "usage: cd [path]\n" : "usage: ls [path]\n"); return;
    }
    if (!resolvePath(path)) { directoryError(command, -1); return; }
    const int32_t handle = maia_vfs_opendir(static_cast<int32_t>(reinterpret_cast<uintptr_t>(gResolvedPath)),
        static_cast<int32_t>(textLength(gResolvedPath)));
    if (handle < 0) { directoryError(command, handle); return; }
    if (change) {
        const int32_t status = maia_vfs_close(handle);
        if (status < 0) { directoryError(command, status); return; }
        const unsigned int length = textLength(gResolvedPath);
        for (unsigned int i = 0; i <= length; ++i) gCwd[i] = gResolvedPath[i];
    } else gDirectoryHandle = handle;
}
static uint32_t directoryUint32(const uint8_t* bytes)
{
    return static_cast<uint32_t>(bytes[0]) | (static_cast<uint32_t>(bytes[1]) << 8)
        | (static_cast<uint32_t>(bytes[2]) << 16) | (static_cast<uint32_t>(bytes[3]) << 24);
}
static void writeEscaped(const char* text, unsigned int length, int newline)
{
    unsigned int output = 0; const char* digits = "0123456789ABCDEF";
    for (unsigned int i = 0; i < length; ++i) {
        const unsigned int value = static_cast<unsigned char>(text[i]);
        if (value == 92) { gDirectoryOutput[output++] = 92; gDirectoryOutput[output++] = 92; }
        else if (value < 32 || value == 127) {
            gDirectoryOutput[output++] = 92; gDirectoryOutput[output++] = 'x';
            gDirectoryOutput[output++] = digits[value >> 4]; gDirectoryOutput[output++] = digits[value & 15];
        } else gDirectoryOutput[output++] = static_cast<char>(value);
    }
    if (newline) gDirectoryOutput[output++] = '\n';
    writeBytes(1, gDirectoryOutput, output);
}
static void resumeLs(void)
{
    if (gLsIndex >= gLsCount) {
        gLsActive = 0; if (!gInputEOF) writeText(1, kPromptText); return;
    }
    const unsigned int index = gLsIndex++;
    const char* operand = index == 0 ? gCwd : gCommandWords + index * kMaxWordBytes;
    gLsOperand = operand; gLsLookup = 0;
    if (!resolvePath(operand)) { directoryError("ls", -1); return; }
    int handle = maia_vfs_opendir(static_cast<int32_t>(reinterpret_cast<uintptr_t>(gResolvedPath)),
        static_cast<int32_t>(textLength(gResolvedPath)));
    if (handle == -9 && operand[textLength(operand) - 1] != '/') {
        unsigned int slash = textLength(gResolvedPath);
        while (slash && gResolvedPath[slash - 1] != '/') --slash;
        const unsigned int length = textLength(gResolvedPath + slash);
        if (length > 255) { directoryError("ls", -1); return; }
        for (unsigned int i = 0; i <= length; ++i) gLsBase[i] = gResolvedPath[slash + i];
        gResolvedPath[slash > 1 ? slash - 1 : 1] = 0;
        handle = maia_vfs_opendir(static_cast<int32_t>(reinterpret_cast<uintptr_t>(gResolvedPath)),
            static_cast<int32_t>(textLength(gResolvedPath)));
        if (handle > 0) gLsLookup = 1;
    }
    if (handle <= 0) { directoryError("ls", handle); return; }
    if (!gLsLookup && gLsCount > 2) {
        writeEscaped(operand, textLength(operand), 0); writeText(1, ":\n");
    }
    gDirectoryHandle = handle;
}
static void runLs(unsigned int wordCount)
{
    for (unsigned int i = 1; i < wordCount; ++i) {
        const char* operand = gCommandWords + i * kMaxWordBytes;
        if (operand[0] == '-') { writeText(2, "usage: ls [path ...]\n"); return; }
        if (!operand[0]) { directoryError("ls", -1); return; }
    }
    gLsCount = wordCount; gLsIndex = wordCount == 1 ? 0 : 1; gLsActive = 1;
}
#include "shell-glob.hpp"

static void endListing(int status)
{
    maia_vfs_close(gDirectoryHandle); gDirectoryHandle = -1;
    if (status < 0) directoryError("ls", status);
}
static void resumeListing(void)
{
    const int32_t count = maia_vfs_readdir(gDirectoryHandle,
        static_cast<int32_t>(reinterpret_cast<uintptr_t>(gDirectoryPacket)), 271);
    if (count <= 0) { endListing(count == 0 && gLsLookup ? -2 : count); return; }
    if (count < 17 || count > 271 || directoryUint32(gDirectoryPacket) != 1
        || directoryUint32(gDirectoryPacket + 12) != 0) { endListing(-1); return; }
    const unsigned int type = directoryUint32(gDirectoryPacket + 4);
    const unsigned int length = directoryUint32(gDirectoryPacket + 8);
    if ((type != 1 && type != 2) || length == 0 || length > 255
        || length + 16 != static_cast<unsigned int>(count)) { endListing(-1); return; }
    if (gLsLookup) {
        unsigned int same = length == textLength(gLsBase) ? 1 : 0;
        for (unsigned int i = 0; same && i < length; ++i)
            if (gDirectoryPacket[16 + i] != static_cast<unsigned char>(gLsBase[i])) same = 0;
        if (!same) return;
        if (type != 1) { endListing(-9); return; }
        writeEscaped(gLsOperand, textLength(gLsOperand), 1);
        endListing(0); return;
    }
    unsigned int output = 0;
    const char* digits = "0123456789ABCDEF";
    for (unsigned int i = 0; i < length; ++i) {
        const unsigned int value = gDirectoryPacket[16 + i];
        if (value == 0 || value == '/') { endListing(-1); return; }
        if (value == 92) { gDirectoryOutput[output++] = 92; gDirectoryOutput[output++] = 92; }
        else if (value < 32 || value == 127) {
            gDirectoryOutput[output++] = 92; gDirectoryOutput[output++] = 'x';
            gDirectoryOutput[output++] = digits[value >> 4]; gDirectoryOutput[output++] = digits[value & 15];
        } else gDirectoryOutput[output++] = static_cast<char>(value);
    }
    if (type == 2) gDirectoryOutput[output++] = '/';
    gDirectoryOutput[output++] = '\n';
    writeBytes(1, gDirectoryOutput, output);
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
        unsigned char* protectedBytes = gWordProtected + (*wordCount * kMaxWordBytes);
        unsigned int outputLength = 0;
        char quote = 0;
        for (unsigned int offset = 0; offset < node->length; ++offset) {
            char current = node->value[offset];
            if ((current == 39 || current == 34) && (!quote || quote == current)) {
                quote = quote ? 0 : current;
                continue;
            }
            unsigned int protectedByte = quote ? 1 : 0;
            if (current == 92 && quote != 39 && offset + 1 < node->length) {
                const char next = node->value[offset + 1];
                if (quote != 34 || next == 36 || next == 96 || next == 34 || next == 92 || next == 10) {
                    ++offset; current = next; protectedByte = 1;
                }
            }
            if (outputLength + 1 >= kMaxWordBytes) return 3;
            putChar(word, outputLength, current); protectedBytes[outputLength] = static_cast<unsigned char>(protectedByte);
            ++outputLength;
            if (protectedByte && static_cast<unsigned char>(current) >= 128) {
                while (offset + 1 < node->length && (static_cast<unsigned char>(node->value[offset + 1]) & 192) == 128) {
                    if (outputLength + 1 >= kMaxWordBytes) return 3;
                    word[outputLength] = node->value[++offset]; protectedBytes[outputLength++] = 1;
                }
            }
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
    writeText(1, "Commands: help, echo, pwd, ls [path ...], cd [path], cat <file>, clear, exit\n");
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
        writeText(1, gCwd); writeText(1, "\n");
    } else if (textEquals(command, "ls")) {
        runLs(wordCount);
    } else if (textEquals(command, "cd")) {
        runDirectoryCommand(command, wordCount);
    } else if (textEquals(command, "cat")) {
        const char* path = gCommandWords + kMaxWordBytes;
        if (wordCount != 2 || path[0] == '-') writeText(2, "usage: cat <file>\n");
        else runCat(path);
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
    gExpansionActive = 1; gExpansionWalking = 0;
    gExpansionInputCount = wordCount; gExpansionIndex = 0; gExpansionCount = 0;
}


static void finish(void)
{
    if (gGlob) {
        maia_glob_walk_cancel(&gGlob->walker);
        free(gGlob->storage.compiler_workspace); free(gGlob); gGlob = 0;
    }
    if (gCatHandle >= 0) { maia_vfs_close(gCatHandle); gCatHandle = -1; }
    if (gDirectoryHandle >= 0) { maia_vfs_close(gDirectoryHandle); gDirectoryHandle = -1; }
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
    initGlob();
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
        if (gExpansionActive) { resumeExpansion(); continue; }
        if (gCatHandle >= 0) { resumeCat(); continue; }
        if (gDirectoryHandle >= 0) { resumeListing(); continue; }
        if (gLsActive) { resumeLs(); continue; }
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

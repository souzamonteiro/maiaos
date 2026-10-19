#include <stdint.h>
#include "generated/maia-shell-parser.hpp"

#define MAIA_IMPORT(module_name, field_name) \
    __attribute__((import_module(module_name), import_name(field_name)))

extern "C" {
MAIA_IMPORT("maia.tty", "poll_line")
int32_t maia_tty_poll_line(int32_t output_ptr, int32_t capacity);

MAIA_IMPORT("maia.tty", "write")
int32_t maia_tty_write(int32_t stream, int32_t input_ptr, int32_t length);

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
static const unsigned int kMaxTokens = 32;
static const unsigned int kMaxWordBytes = 96;
static const unsigned int kMaxArgs = 12;
static const unsigned int kTokensOffset = 260;
static const unsigned int kCommandWordsOffset = 900;
static const unsigned int kReadBufferOffset = 2052;
static const unsigned int kOutputBufferOffset = 2180;
static const unsigned int kReadBufferBytes = 128;
static const unsigned int kOutputBufferBytes = 256;
static const unsigned int kShellStorageBytes = 2436;
static const unsigned int kShellStorageAddress = 8192;

#define gShellStorage ((uint8_t*)kShellStorageAddress)
#define gLine ((char*)gShellStorage)
#define gTokens ((MaiaCCParserToken*)(gShellStorage + kTokensOffset))
#define gCommandWords ((char*)(gShellStorage + kCommandWordsOffset))
#define gReadBuffer (gShellStorage + kReadBufferOffset)
#define gOutputBuffer ((char*)(gShellStorage + kOutputBufferOffset))
static unsigned int gTokenCount = 0;

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
    return maia_tty_write(
        stream,
        static_cast<int32_t>(reinterpret_cast<uintptr_t>(bytes)),
        static_cast<int32_t>(length));
}

static int writeText(int32_t stream, const char* text)
{
    return writeBytes(stream, text, textLength(text));
}

static int appendToken(unsigned int type, unsigned int start, unsigned int end)
{
    MaiaCCParserToken* tokens = (MaiaCCParserToken*)(gShellStorage + kTokensOffset);
    const unsigned int count = gTokenCount;
    MaiaCCParserToken* token = tokens + count;
    const unsigned int length = end - start;
    const char* value = gLine + start;
    if (count >= kMaxTokens) {
        return 0;
    }
    if (length >= kMaxWordBytes) {
        return 0;
    }
    token->type = type;
    token->value = value;
    token->length = length;
    token->start = start;
    token->end = end;
    gTokenCount = count + 1;
    return 1;
}

static int isSpace(char value)
{
    return value == 32 || value == 9 || value == 13;
}

static int isNameStart(char value)
{
    return (value >= 'a' && value <= 'z')
        || (value >= 'A' && value <= 'Z')
        || value == '_';
}

static int isNamePart(char value)
{
    return isNameStart(value) || (value >= '0' && value <= '9');
}

static int spanEquals(unsigned int start, unsigned int end, const char* value)
{
    if (end - start != textLength(value)) return 0;
    for (unsigned int index = 0; index < end - start; ++index) {
        if (charAt(gLine, start + index) != charAt(value, index)) return 0;
    }
    return 1;
}

static unsigned int reservedWordToken(unsigned int start, unsigned int end)
{
    if (spanEquals(start, end, "if")) return MAIACC_TOKEN_TOKEN_if;
    if (spanEquals(start, end, "then")) return MAIACC_TOKEN_TOKEN_then;
    if (spanEquals(start, end, "elif")) return MAIACC_TOKEN_TOKEN_elif;
    if (spanEquals(start, end, "else")) return MAIACC_TOKEN_TOKEN_else;
    if (spanEquals(start, end, "fi")) return MAIACC_TOKEN_TOKEN_fi;
    if (spanEquals(start, end, "while")) return MAIACC_TOKEN_TOKEN_while;
    if (spanEquals(start, end, "until")) return MAIACC_TOKEN_TOKEN_until;
    if (spanEquals(start, end, "for")) return MAIACC_TOKEN_TOKEN_for;
    if (spanEquals(start, end, "in")) return MAIACC_TOKEN_TOKEN_in;
    if (spanEquals(start, end, "do")) return MAIACC_TOKEN_TOKEN_do;
    if (spanEquals(start, end, "done")) return MAIACC_TOKEN_TOKEN_done;
    return 0;
}

static unsigned int classifyWord(unsigned int start, unsigned int end, int wasQuoted)
{
    if (wasQuoted) return MAIACC_TOKEN_WORD;
    const unsigned int reserved = reservedWordToken(start, end);
    if (reserved) return reserved;

    unsigned int equalIndex = start;
    while (equalIndex < end && charAt(gLine, equalIndex) != '=') ++equalIndex;
    if (equalIndex < end && equalIndex > start && isNameStart(charAt(gLine, start))) {
        unsigned int nameIndex = start + 1;
        while (nameIndex < equalIndex && isNamePart(charAt(gLine, nameIndex))) ++nameIndex;
        if (nameIndex == equalIndex) return MAIACC_TOKEN_ASSIGNMENT_WORD;
    }

    if (start < end && charAt(gLine, start) >= '0' && charAt(gLine, start) <= '9') {
        unsigned int digit = start;
        while (digit < end && charAt(gLine, digit) >= '0' && charAt(gLine, digit) <= '9') ++digit;
        if (digit == end) return MAIACC_TOKEN_IO_NUMBER;
    }
    return MAIACC_TOKEN_WORD;
}

static int appendOperator(const char* line, unsigned int* position)
{
    const unsigned int start = *position;
    const char current = charAt(line, start);
    unsigned int type = 0;
    unsigned int length = 1;

    if (current == ';') type = MAIACC_TOKEN_TOKEN__3B_;
    else if (current == '&' && charAt(line, start + 1) == '&') {
        type = MAIACC_TOKEN_TOKEN__26__26_;
        length = 2;
    } else if (current == '|' && charAt(line, start + 1) == '|') {
        type = MAIACC_TOKEN_TOKEN__7C__7C_;
        length = 2;
    } else if (current == '!') type = MAIACC_TOKEN_TOKEN__21_;
    else if (current == '|') type = MAIACC_TOKEN_TOKEN__7C_;
    else if (current == '&') type = MAIACC_TOKEN_TOKEN__26_;
    else if (current == '(') type = MAIACC_TOKEN_TOKEN__28_;
    else if (current == ')') type = MAIACC_TOKEN_TOKEN__29_;
    else if (current == '{') type = MAIACC_TOKEN_TOKEN__7B_;
    else if (current == '}') type = MAIACC_TOKEN_TOKEN__7D_;
    else if (current == '>') {
        if (charAt(line, start + 1) == '>') {
            type = MAIACC_TOKEN_TOKEN__3E__3E_;
            length = 2;
        } else if (charAt(line, start + 1) == '&') {
            type = MAIACC_TOKEN_TOKEN__3E__26_;
            length = 2;
        } else if (charAt(line, start + 1) == '|') {
            type = MAIACC_TOKEN_TOKEN__3E__7C_;
            length = 2;
        } else type = MAIACC_TOKEN_TOKEN__3E_;
    } else if (current == '<') {
        if (charAt(line, start + 1) == '>') {
            type = MAIACC_TOKEN_TOKEN__3C__3E_;
            length = 2;
        } else if (charAt(line, start + 1) == '&') {
            type = MAIACC_TOKEN_TOKEN__3C__26_;
            length = 2;
        } else type = MAIACC_TOKEN_TOKEN__3C_;
    }

    if (!type) return 0;
    if (!appendToken(type, start, start + length)) return 0;
    *position += length;
    return 1;
}

static int tokenizeLine(const char* line)
{
    gTokenCount = 0;
    unsigned int position = 0;
    while (charAt(line, position)) {
        const char leadingSpace = charAt(line, position);
        if (leadingSpace == 32 || leadingSpace == 9 || leadingSpace == 13) {
            ++position;
            continue;
        }
        if (charAt(line, position) == '#') break;
        if (charAt(line, position) == ';' || charAt(line, position) == '&'
            || charAt(line, position) == '|' || charAt(line, position) == '!'
            || charAt(line, position) == '(' || charAt(line, position) == ')'
            || charAt(line, position) == '{' || charAt(line, position) == '}'
            || charAt(line, position) == '>' || charAt(line, position) == '<') {
            if (!appendOperator(line, &position)) {
                return 0;
            }
            continue;
        }

        const unsigned int start = position;
        char quote = 0;
        int wasQuoted = 0;
        int hasContent = 0;
        while (charAt(line, position)) {
            const char current = charAt(line, position);
            if (!quote && (isSpace(current) || current == ';' || current == '&'
                || current == '|' || current == '!' || current == '('
                || current == ')' || current == '{' || current == '}'
                || current == '>' || current == '<')) break;
            if (current == 92 && quote != 39) {
                ++position;
                if (!charAt(line, position)) {
                    return 0;
                }
                if (!charAt(line, position)) return 0;
                if (position - start + 1 >= kMaxWordBytes) return 0;
                ++position;
                hasContent = 1;
                continue;
            }
            if ((current == 39 || current == '"') && (!quote || quote == current)) {
                wasQuoted = 1;
                quote = quote ? 0 : current;
                ++position;
                hasContent = 1;
                continue;
            }
            if (position - start + 1 >= kMaxWordBytes) {
                return 0;
            }
            if (position - start + 1 >= kMaxWordBytes) return 0;
            ++position;
            hasContent = 1;
        }
        if (quote || !hasContent) return 0;
        const unsigned int tokenType = classifyWord(start, position, wasQuoted);
        if (!appendToken(tokenType, start, position)) {
            return 0;
        }
    }

    if (!appendToken(MAIACC_TOKEN_NEWLINE, position, position + 1)) return 0;
    if (!appendToken(MAIACC_TOKEN_EOF, position + 1, position + 1)) return 0;
    return 1;
}

static int parseShellLine(void)
{
    MaiaCCParserState parser;
    MaiaCCParserToken* tokens = (MaiaCCParserToken*)(gShellStorage + kTokensOffset);
    MaiaCCParseEvents events;
    events.context = 0;
    events.checkpoint = 0;
    events.restore = 0;
    events.startNonterminal = 0;
    events.terminal = 0;
    events.endNonterminal = 0;
    events.abortNonterminal = 0;
    events.matchesContextual = 0;
    maiaCCParserStateInit(&parser, tokens, gTokenCount, &events);
    return maiaCC_parse(&parser);
}

static int buildCommandAst(unsigned int* wordCount)
{
    MaiaCCParserToken* tokens = (MaiaCCParserToken*)(gShellStorage + kTokensOffset);
    *wordCount = 0;
    for (unsigned int index = 0; index < gTokenCount; ++index) {
        const MaiaCCParserToken* token = tokens + index;
        if (token->type == MAIACC_TOKEN_EOF || token->type == MAIACC_TOKEN_NEWLINE) break;
        if (token->type != MAIACC_TOKEN_WORD && token->type != MAIACC_TOKEN_IO_NUMBER) return 0;
        if (*wordCount >= kMaxArgs || token->end < token->start
            || token->end > textLength(gLine)) return 0;

        char* word = gCommandWords + (*wordCount * kMaxWordBytes);
        unsigned int outputLength = 0;
        char quote = 0;
        for (unsigned int position = token->start; position < token->end; ++position) {
            const char current = charAt(gLine, position);
            if ((current == 39 || current == '"') && (!quote || quote == current)) {
                quote = quote ? 0 : current;
                continue;
            }
            if (current == 92 && quote != 39 && position + 1 < token->end) {
                ++position;
                if (outputLength + 1 >= kMaxWordBytes) return 0;
                putChar(word, outputLength, charAt(gLine, position));
                ++outputLength;
                continue;
            }
            if (outputLength + 1 >= kMaxWordBytes) return 0;
            putChar(word, outputLength, current);
            ++outputLength;
        }
        if (quote) return 0;
        putChar(word, outputLength, 0);
        ++*wordCount;
    }
    return *wordCount > 0;
}

static void writePrompt(void)
{
    writeText(1, "maia> ");
}

static void printHelp(void)
{
    writeText(1, "Commands: help, echo, pwd, cat /system/welcome.txt, exit\n");
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
        maia_tty_write(
            1,
            static_cast<int32_t>(reinterpret_cast<uintptr_t>(gReadBuffer)),
            count);
    }
    maia_vfs_close(handle);
}

static void executeAst(unsigned int wordCount)
{
    const char* command = gCommandWords;
    char* outputBuffer = (char*)(gShellStorage + kOutputBufferOffset);
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
    } else if (textEquals(command, "exit") && wordCount == 1) {
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
    MaiaCCParserToken* tokens = (MaiaCCParserToken*)(gShellStorage + kTokensOffset);
    MaiaCCParserToken* firstToken = tokens;
    if (!tokenizeLine(gLine)) {
        writeText(2, "lexer failure\n");
        writePrompt();
        return;
    }
    if (!parseShellLine()) {
        writeText(2, "syntax error\n");
        writePrompt();
        return;
    }

    unsigned int wordCount = 0;
    if (buildCommandAst(&wordCount)) executeAst(wordCount);
    else if (firstToken->type != MAIACC_TOKEN_NEWLINE) {
        writeText(2, "unsupported syntax: MVP accepts simple commands only\n");
    }
    if (wordCount > 0 && textEquals(firstToken->value, "exit") && wordCount == 1) return;
    writePrompt();
}

extern "C" __attribute__((visibility("default"))) void maia_app_start(void)
{
    writeText(1, "MaiaOS Shell MVP. Type help for commands.\n");
    writePrompt();
}

extern "C" __attribute__((visibility("default"))) void maiaos_step(void)
{
    char* line = (char*)gShellStorage;
    const int32_t count = maia_tty_poll_line(
        static_cast<int32_t>(reinterpret_cast<uintptr_t>(line)),
        kMaxLineBytes);
    if (count == kWouldBlock) return;
    if (count < 0 || static_cast<unsigned int>(count) > kMaxLineBytes) {
        writeText(2, "tty input error\n");
        return;
    }
    putChar(line, count, 0);
    processLine();
}
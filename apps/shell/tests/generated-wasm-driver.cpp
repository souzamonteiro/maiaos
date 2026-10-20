/* Test-only raw-byte adapter. All matching/parsing executes in generated code. */
#define MAIACPP_USE_C_ALLOCATOR
#include "maia-shell-parser.hpp"
#include "../maia-shell-parse-tree-collector.hpp"

static char input[4096];
static MaiaCCParserToken tokens[2048];
static MaiaShellParseTreeNode nodes[8192];
static unsigned int tokenCount;
static unsigned int nodeCount;
static unsigned int errorPosition;

extern "C" {
char* probe_input() { return input; }
unsigned int probe_token_count() { return tokenCount; }
unsigned int probe_node_count() { return nodeCount; }
unsigned int probe_error_position() { return errorPosition; }
const char* probe_token_name(unsigned int i) { return maiaCCParserTokenName(tokens[i].type); }
const char* probe_token_value(unsigned int i) { return tokens[i].value; }
unsigned int probe_token_length(unsigned int i) { return tokens[i].length; }
unsigned int probe_token_start(unsigned int i) { return tokens[i].start; }
unsigned int probe_token_end(unsigned int i) { return tokens[i].end; }
unsigned int probe_node_kind(unsigned int i) { return nodes[i].kind; }
int probe_node_parent(unsigned int i) { return nodes[i].parent; }
const char* probe_node_name(unsigned int i) {
    return nodes[i].kind == kShellParseTreeTerminal
        ? maiaCCParserTokenName(nodes[i].token) : nodes[i].name;
}
const char* probe_node_value(unsigned int i) { return nodes[i].value; }
unsigned int probe_node_length(unsigned int i) { return nodes[i].length; }
int probe_lex(unsigned int length) {
    tokenCount = 0; nodeCount = 0; errorPosition = 0;
    if (length >= 4096) return 2;
    MaiaCCLexerState lexer;
    maiaCCLexerStateInit(&lexer, input, length);
    if (!maiaCCLexerTokenize(&lexer, tokens, 2048)) {
        tokenCount = lexer.tokenCount;
        errorPosition = lexer.position;
        return lexer.failed == 1 ? 1 : 2;
    }
    tokenCount = lexer.tokenCount;
    return 4;
}
int probe_parse(int collect) {
    MaiaShellParseTreeCollector tree;
    MaiaCCParseEvents events;
    MaiaCCParserState parser;
    maiaShellParseTreeInit(&tree, nodes, 8192);
    maiaShellParseTreeSetEvents(&tree, &events);
    maiaCCParserStateInit(&parser, tokens, tokenCount, collect ? &events : 0);
    const int accepted = maiaCC_parse(&parser) && !parser.failed
        && parser.position == tokenCount && !tree.overflow && tree.activeNode < 0;
    nodeCount = tree.nodeCount;
    if (tree.overflow) return 2;
    return accepted ? 4 : 3;
}
int probe_run(unsigned int length) {
    const int result = probe_lex(length);
    return result == 4 ? probe_parse(1) : result;
}
unsigned int probe_bench(unsigned int mode, unsigned int count, unsigned int length) {
    unsigned int checksum = 0;
    for (unsigned int i = 0; i < count; ++i) {
        int result = 0;
        if (mode == 0) result = probe_lex(length);
        else if (mode == 1) result = probe_parse(0);
        else if (mode == 2) result = probe_parse(1);
        else result = probe_run(length);
        checksum += static_cast<unsigned int>(result);
    }
    return checksum;
}
}

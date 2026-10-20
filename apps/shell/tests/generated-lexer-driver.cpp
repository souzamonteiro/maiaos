/* Native oracle adapter: raw input goes exclusively through generated rules. */
#include <iostream>
#include <iterator>
#include <string>
#include <vector>
#include "maia-shell-parser.hpp"
#include "../maia-shell-parse-tree-collector.hpp"

static void printHex(const char* value, unsigned int length)
{
    const char* digits = "0123456789abcdef";
    if (!length) { std::cout << '-'; return; }
    for (unsigned int i = 0; i < length; ++i) {
        const unsigned char byte = static_cast<unsigned char>(value[i]);
        std::cout << digits[byte >> 4] << digits[byte & 15];
    }
}

static void printTokens(const MaiaCCParserToken* tokens, unsigned int count)
{
    std::cout << "TOKENS\t" << count << '\n';
    for (unsigned int i = 0; i < count; ++i) {
        const MaiaCCParserToken& token = tokens[i];
        std::cout << maiaCCParserTokenName(token.type) << '\t' << token.start << '\t' << token.end << '\t';
        printHex(token.value, token.length); std::cout << '\n';
    }
}

static int parseInput(const std::string& input, bool detailedErrors = false)
{
    MaiaShellParseTreeNode limitedNodes[1];
    MaiaShellParseTreeCollector limited;
    maiaShellParseTreeInit(&limited, limitedNodes, 1);
    maiaShellParseTreeStart(&limited, "root", 0);
    maiaShellParseTreeStart(&limited, "child", 0);
    maiaShellParseTreeRestore(&limited, 0);
    maiaShellParseTreeAbort(&limited, "root", 0);
    if (!limited.overflow || limited.nodeCount || limited.activeNode != -1) return 4;
    std::vector<MaiaCCParserToken> tokens(input.size() + 2);
    MaiaCCLexerState lexer;
    maiaCCLexerStateInit(&lexer, input.c_str(), static_cast<unsigned int>(input.size()));
    if (!maiaCCLexerTokenize(&lexer, &tokens[0], static_cast<unsigned int>(tokens.size()))) {
        if (detailedErrors) {
            std::cout << "LEXERROR\t" << lexer.position << '\n';
            printTokens(&tokens[0], lexer.tokenCount);
            return lexer.failed == 1 ? 0 : 2;
        }
        std::cout << "LEXERROR\n"; return lexer.failed == 1 ? 0 : 2;
    }
    printTokens(&tokens[0], lexer.tokenCount);
    std::vector<MaiaShellParseTreeNode> nodes(8192);
    MaiaShellParseTreeCollector tree;
    MaiaCCParseEvents events;
    MaiaCCParserState parser;
    maiaShellParseTreeInit(&tree, &nodes[0], static_cast<unsigned int>(nodes.size()));
    maiaShellParseTreeSetEvents(&tree, &events);
    maiaCCParserStateInit(&parser, &tokens[0], lexer.tokenCount, &events);
    const bool accepted = maiaCC_parse(&parser) && !parser.failed
        && parser.position == lexer.tokenCount && !tree.overflow && tree.activeNode < 0;
    if (!accepted) { std::cout << "REJECT\n"; return 0; }
    std::cout << "ACCEPT\n";
    for (unsigned int i = 0; i < tree.nodeCount; ++i) {
        const MaiaShellParseTreeNode& node = nodes[i];
        unsigned int depth = 0;
        for (int parent = node.parent; parent >= 0; parent = nodes[parent].parent) {
            if (static_cast<unsigned int>(parent) >= i) return 3;
            ++depth;
        }
        const bool terminal = node.kind == kShellParseTreeTerminal;
        std::cout << depth << '\t' << (terminal ? "T" : "N") << '\t'
            << (terminal ? maiaCCParserTokenName(node.token) : node.name) << '\t';
        if (terminal) printHex(node.value, node.length); else std::cout << '-';
        std::cout << '\n';
    }
    return 0;
}

int main(int argc, char** argv)
{
    if (argc == 2 && std::string(argv[1]) == "--batch") {
        std::string line;
        while (std::getline(std::cin, line)) {
            std::string input;
            if (line.size() % 2) return 5;
            for (unsigned int i = 0; i < line.size(); i += 2) {
                const std::string digits = "0123456789abcdef";
                const std::string::size_type hi = digits.find(line[i]);
                const std::string::size_type lo = digits.find(line[i + 1]);
                if (hi == std::string::npos || lo == std::string::npos) return 5;
                input += static_cast<char>((hi << 4) | lo);
            }
            const int result = parseInput(input, true);
            if (result) return result;
            std::cout << "END\n";
        }
        return 0;
    }
    const std::string input((std::istreambuf_iterator<char>(std::cin)), std::istreambuf_iterator<char>());
    return parseInput(input);
}

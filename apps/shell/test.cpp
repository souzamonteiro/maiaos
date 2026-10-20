#include <iostream>
#include <string>
#include <vector>
#include "maia-shell.cpp"
#include "maia-shell-parse-tree-collector.hpp"

static int hexDigit(char value)
{
    if (value >= '0' && value <= '9') return value - '0';
    if (value >= 'a' && value <= 'f') return value - 'a' + 10;
    return -1;
}

static bool decodeHex(const std::string& encoded, std::string& value)
{
    if (encoded == "-") return true;
    if (encoded.size() % 2 != 0) return false;
    for (std::string::size_type offset = 0; offset < encoded.size(); offset += 2) {
        const int high = hexDigit(encoded[offset]);
        const int low = hexDigit(encoded[offset + 1]);
        if (high < 0 || low < 0) return false;
        value += static_cast<char>(high * 16 + low);
    }
    return true;
}

static void printHex(const char* value, unsigned int length)
{
    if (length == 0) { std::cout << '-'; return; }
    const char* digits = "0123456789abcdef";
    for (unsigned int offset = 0; offset < length; ++offset) {
        const unsigned char byte = static_cast<unsigned char>(value[offset]);
        std::cout << digits[byte >> 4] << digits[byte & 15];
    }
}

int main(void)
{
    unsigned int count;
    if (!(std::cin >> count) || count == 0 || count > 4096) return 2;
    std::vector<MaiaCCParserToken> tokens(count);
    std::vector<std::string> values(count);
    for (unsigned int index = 0; index < count; ++index) {
        std::string encoded;
        MaiaCCParserToken& token = tokens[index];
        if (!(std::cin >> token.type >> token.start >> token.end >> encoded)) return 2;
        if (!decodeHex(encoded, values[index])) return 2;
        token.value = values[index].c_str();
        token.length = static_cast<unsigned int>(values[index].size());
    }
    std::vector<MaiaShellParseTreeNode> nodes(kShellParseTreeCapacity);
    MaiaShellParseTreeCollector collector;
    MaiaCCParseEvents events;
    MaiaCCParserState parser;
    maiaShellParseTreeInit(&collector, &nodes[0], kShellParseTreeCapacity);
    maiaShellParseTreeSetEvents(&collector, &events);
    maiaCCParserStateInit(&parser, &tokens[0], count, &events);
    const bool accepted = maiaCC_parse(&parser) && !parser.failed
        && parser.position == count && !collector.overflow;
    if (!accepted) { std::cout << "REJECT\n"; return 0; }
    if (collector.activeNode != -1 || collector.nodeCount == 0) return 3;
    std::cout << "ACCEPT\n";
    for (unsigned int index = 0; index < collector.nodeCount; ++index) {
        const MaiaShellParseTreeNode& node = nodes[index];
        unsigned int depth = 0;
        int parent = node.parent;
        while (parent >= 0) {
            if (static_cast<unsigned int>(parent) >= index) return 3;
            ++depth;
            parent = nodes[parent].parent;
        }
        const bool terminal = node.kind == kShellParseTreeTerminal;
        std::cout << depth << '\t' << (terminal ? "T" : "N") << '\t'
            << (terminal ? maiaCCParserTokenName(node.token) : node.name) << '\t';
        if (terminal) printHex(node.value, node.length);
        else std::cout << '-';
        std::cout << '\n';
    }
    return 0;
}
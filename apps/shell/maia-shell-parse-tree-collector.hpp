#ifndef MAIA_SHELL_PARSE_TREE_COLLECTOR_HPP
#define MAIA_SHELL_PARSE_TREE_COLLECTOR_HPP

static const unsigned int kShellParseTreeNonterminal = 1;
static const unsigned int kShellParseTreeTerminal = 2;
static const unsigned int kShellParseTreeCapacity = 1024;

struct MaiaShellParseTreeNode {
    const char* name;
    const char* value;
    unsigned int token;
    unsigned int length;
    unsigned int tokenPosition;
    int parent;
    unsigned int kind;
};

struct MaiaShellParseTreeCollector {
    MaiaShellParseTreeNode* nodes;
    unsigned int capacity;
    unsigned int nodeCount;
    int activeNode;
    int overflow;
};

static void maiaShellParseTreeInit(
    MaiaShellParseTreeCollector* collector,
    MaiaShellParseTreeNode* nodes,
    unsigned int capacity)
{
    collector->nodes = nodes;
    collector->capacity = capacity;
    collector->nodeCount = 0;
    collector->activeNode = -1;
    collector->overflow = 0;
}

static int maiaShellParseTreeAppend(
    MaiaShellParseTreeCollector* collector,
    unsigned int kind,
    const char* name,
    unsigned int token,
    const char* value,
    unsigned int length,
    unsigned int tokenPosition)
{
    if (collector->nodeCount >= collector->capacity) {
        collector->overflow = 1;
        return -1;
    }
    const int index = static_cast<int>(collector->nodeCount);
    MaiaShellParseTreeNode* node = collector->nodes + collector->nodeCount;
    node->name = name;
    node->value = value;
    node->token = token;
    node->length = length;
    node->tokenPosition = tokenPosition;
    node->parent = collector->activeNode;
    node->kind = kind;
    ++collector->nodeCount;
    return index;
}

static unsigned int maiaShellParseTreeCheckpoint(void* context)
{
    MaiaShellParseTreeCollector* collector = (MaiaShellParseTreeCollector*)context;
    const unsigned int active = collector->activeNode < 0
        ? 0
        : static_cast<unsigned int>(collector->activeNode + 1);
    return (collector->nodeCount << 16) | active;
}

static void maiaShellParseTreeRestore(void* context, unsigned int mark)
{
    MaiaShellParseTreeCollector* collector = (MaiaShellParseTreeCollector*)context;
    collector->nodeCount = (mark >> 16) & 0x7fff;
    collector->activeNode = static_cast<int>(mark & 0xffff) - 1;
    /* Resource exhaustion remains sticky across parser backtracking. */
}

static void maiaShellParseTreeStart(void* context, const char* name, unsigned int position)
{
    MaiaShellParseTreeCollector* collector = (MaiaShellParseTreeCollector*)context;
    if (collector->overflow) return;
    const int index = maiaShellParseTreeAppend(
        collector, kShellParseTreeNonterminal, name, 0, 0, 0, position);
    if (index >= 0) collector->activeNode = index;
}

static void maiaShellParseTreeTerminal(
    void* context,
    unsigned int token,
    const char* value,
    unsigned int length,
    unsigned int position)
{
    MaiaShellParseTreeCollector* collector = (MaiaShellParseTreeCollector*)context;
    if (collector->overflow || collector->activeNode < 0) return;
    maiaShellParseTreeAppend(
        collector, kShellParseTreeTerminal, 0, token, value, length, position);
}

static void maiaShellParseTreeEnd(void* context, const char*, unsigned int)
{
    MaiaShellParseTreeCollector* collector = (MaiaShellParseTreeCollector*)context;
    if (collector->activeNode < 0) {
        collector->overflow = 1;
        return;
    }
    collector->activeNode = collector->nodes[collector->activeNode].parent;
}

static void maiaShellParseTreeAbort(void*, const char*, unsigned int)
{
    /* Generated rules restore their pre-start checkpoint before aborting. */
}

static void maiaShellParseTreeSetEvents(
    MaiaShellParseTreeCollector* collector,
    MaiaCCParseEvents* events)
{
    events->context = collector;
    events->checkpoint = maiaShellParseTreeCheckpoint;
    events->restore = maiaShellParseTreeRestore;
    events->startNonterminal = maiaShellParseTreeStart;
    events->terminal = maiaShellParseTreeTerminal;
    events->endNonterminal = maiaShellParseTreeEnd;
    events->abortNonterminal = maiaShellParseTreeAbort;
    events->matchesContextual = 0; /* Generated lexical NAME rule handles contextual matching. */
}

#endif

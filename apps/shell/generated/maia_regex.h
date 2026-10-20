#ifndef MAIA_REGEX_PROGRAM_H
#define MAIA_REGEX_PROGRAM_H

#include <stddef.h>

#define MAIA_REGEX_MATCH 0
#define MAIA_REGEX_NOMATCH 1
#define MAIA_REGEX_INVALID 2
#define MAIA_REGEX_NOMEM 3
#define MAIA_REGEX_LIMIT 4

#define MAIA_REGEX_ACCEPT 0
#define MAIA_REGEX_CHAR 1
#define MAIA_REGEX_SPLIT 2
#define MAIA_REGEX_CLASS 3
#define MAIA_REGEX_NOT_CLASS 4
#define MAIA_REGEX_END 5
#define MAIA_REGEX_NEGATIVE 6
#define MAIA_REGEX_POSITIVE 7

typedef struct MaiaRegexInstruction {
    int op;
    unsigned int first;
    unsigned int second;
    unsigned int next;
} MaiaRegexInstruction;

typedef struct MaiaRegexRange {
    unsigned int first;
    unsigned int last;
} MaiaRegexRange;

typedef struct MaiaRegexProgram {
    const MaiaRegexInstruction *code;
    const MaiaRegexRange *ranges;
    unsigned int instruction_count;
    unsigned int range_count;
    unsigned int entry;
} MaiaRegexProgram;

typedef struct MaiaRegexLimits {
    size_t max_memo_bytes;
    size_t max_frames;
    size_t max_steps;
} MaiaRegexLimits;

#ifdef __cplusplus
extern "C" {
#endif

int maia_regex_validate(const MaiaRegexProgram *program);
int maia_regex_exec(const MaiaRegexProgram *program, const unsigned int *input,
                    unsigned int length, unsigned int start,
                    const MaiaRegexLimits *limits, unsigned int *end);

#ifdef __cplusplus
}
#endif

#endif
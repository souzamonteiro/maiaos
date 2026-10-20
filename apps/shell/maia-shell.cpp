#ifndef MAIACC_GENERATED_CPP98_PARSER_H
#define MAIACC_GENERATED_CPP98_PARSER_H

#include <stdlib.h>
#include "maia_regex.h"

#define MAIACC_TOKEN_TOKEN__26__26_ 1
#define MAIACC_TOKEN_TOKEN__7C__7C_ 2
#define MAIACC_TOKEN_TOKEN__21_ 3
#define MAIACC_TOKEN_TOKEN__7C_ 4
#define MAIACC_TOKEN_TOKEN__3E_ 5
#define MAIACC_TOKEN_TOKEN__3E__3E_ 6
#define MAIACC_TOKEN_TOKEN__3C_ 7
#define MAIACC_TOKEN_TOKEN__3C__3E_ 8
#define MAIACC_TOKEN_TOKEN__3E__26_ 9
#define MAIACC_TOKEN_TOKEN__3C__26_ 10
#define MAIACC_TOKEN_TOKEN__3E__7C_ 11
#define MAIACC_TOKEN_TOKEN__28_ 12
#define MAIACC_TOKEN_TOKEN__29_ 13
#define MAIACC_TOKEN_TOKEN__7B_ 14
#define MAIACC_TOKEN_TOKEN__7D_ 15
#define MAIACC_TOKEN_TOKEN_if 16
#define MAIACC_TOKEN_TOKEN_then 17
#define MAIACC_TOKEN_TOKEN_elif 18
#define MAIACC_TOKEN_TOKEN_else 19
#define MAIACC_TOKEN_TOKEN_fi 20
#define MAIACC_TOKEN_TOKEN_while 21
#define MAIACC_TOKEN_TOKEN_until 22
#define MAIACC_TOKEN_TOKEN_for 23
#define MAIACC_TOKEN_TOKEN_in 24
#define MAIACC_TOKEN_TOKEN_do 25
#define MAIACC_TOKEN_TOKEN_done 26
#define MAIACC_TOKEN_TOKEN__3B_ 27
#define MAIACC_TOKEN_TOKEN__26_ 28
#define MAIACC_TOKEN_EOF 29
#define MAIACC_TOKEN_NAME 30
#define MAIACC_TOKEN_IO_NUMBER 31
#define MAIACC_TOKEN_ASSIGNMENT_WORD 32
#define MAIACC_TOKEN_WORD 33
#define MAIACC_TOKEN_UnquotedChar 34
#define MAIACC_TOKEN_SingleQuoted 35
#define MAIACC_TOKEN_DoubleQuoted 36
#define MAIACC_TOKEN_EscapedChar 37
#define MAIACC_TOKEN_NEWLINE 38
#define MAIACC_TOKEN_COMMENT 39
#define MAIACC_TOKEN_HORIZONTAL_SPACE 40
#define MAIACC_TOKEN_COUNT 41
#define MAIACC_RULE_COUNT 32

static const char* maiaCCParserTokenName(unsigned int type) {
  switch (type) {
    case MAIACC_TOKEN_TOKEN__26__26_: return "TOKEN__26__26_";
    case MAIACC_TOKEN_TOKEN__7C__7C_: return "TOKEN__7C__7C_";
    case MAIACC_TOKEN_TOKEN__21_: return "TOKEN__21_";
    case MAIACC_TOKEN_TOKEN__7C_: return "TOKEN__7C_";
    case MAIACC_TOKEN_TOKEN__3E_: return "TOKEN__3E_";
    case MAIACC_TOKEN_TOKEN__3E__3E_: return "TOKEN__3E__3E_";
    case MAIACC_TOKEN_TOKEN__3C_: return "TOKEN__3C_";
    case MAIACC_TOKEN_TOKEN__3C__3E_: return "TOKEN__3C__3E_";
    case MAIACC_TOKEN_TOKEN__3E__26_: return "TOKEN__3E__26_";
    case MAIACC_TOKEN_TOKEN__3C__26_: return "TOKEN__3C__26_";
    case MAIACC_TOKEN_TOKEN__3E__7C_: return "TOKEN__3E__7C_";
    case MAIACC_TOKEN_TOKEN__28_: return "TOKEN__28_";
    case MAIACC_TOKEN_TOKEN__29_: return "TOKEN__29_";
    case MAIACC_TOKEN_TOKEN__7B_: return "TOKEN__7B_";
    case MAIACC_TOKEN_TOKEN__7D_: return "TOKEN__7D_";
    case MAIACC_TOKEN_TOKEN_if: return "TOKEN_if";
    case MAIACC_TOKEN_TOKEN_then: return "TOKEN_then";
    case MAIACC_TOKEN_TOKEN_elif: return "TOKEN_elif";
    case MAIACC_TOKEN_TOKEN_else: return "TOKEN_else";
    case MAIACC_TOKEN_TOKEN_fi: return "TOKEN_fi";
    case MAIACC_TOKEN_TOKEN_while: return "TOKEN_while";
    case MAIACC_TOKEN_TOKEN_until: return "TOKEN_until";
    case MAIACC_TOKEN_TOKEN_for: return "TOKEN_for";
    case MAIACC_TOKEN_TOKEN_in: return "TOKEN_in";
    case MAIACC_TOKEN_TOKEN_do: return "TOKEN_do";
    case MAIACC_TOKEN_TOKEN_done: return "TOKEN_done";
    case MAIACC_TOKEN_TOKEN__3B_: return "TOKEN__3B_";
    case MAIACC_TOKEN_TOKEN__26_: return "TOKEN__26_";
    case MAIACC_TOKEN_EOF: return "EOF";
    case MAIACC_TOKEN_NAME: return "NAME";
    case MAIACC_TOKEN_IO_NUMBER: return "IO_NUMBER";
    case MAIACC_TOKEN_ASSIGNMENT_WORD: return "ASSIGNMENT_WORD";
    case MAIACC_TOKEN_WORD: return "WORD";
    case MAIACC_TOKEN_UnquotedChar: return "UnquotedChar";
    case MAIACC_TOKEN_SingleQuoted: return "SingleQuoted";
    case MAIACC_TOKEN_DoubleQuoted: return "DoubleQuoted";
    case MAIACC_TOKEN_EscapedChar: return "EscapedChar";
    case MAIACC_TOKEN_NEWLINE: return "NEWLINE";
    case MAIACC_TOKEN_COMMENT: return "COMMENT";
    case MAIACC_TOKEN_HORIZONTAL_SPACE: return "HORIZONTAL_SPACE";
    default: return "UNKNOWN";
  }
}

struct MaiaCCParserToken {
  unsigned int type;
  const char* value;
  unsigned int length;
  unsigned int start;
  unsigned int end;
};


typedef MaiaRegexInstruction MaiaCCLexInstruction;
typedef MaiaRegexRange MaiaCCLexRange;
struct MaiaCCLexPattern {
  const MaiaCCLexInstruction* code;
  const MaiaCCLexRange* ranges;
  unsigned int count;
  unsigned int entry;
  unsigned int token;
  int skip;
  int generic;
  int preferred;
  int role;
  unsigned int rangeCount;
};
struct MaiaCCLexerState {
  const char* input;
  unsigned int length;
  unsigned int position;
  unsigned int bytePosition;
  unsigned int tokenCount;
  int failed;
};
static void maiaCCLexerStateInit(MaiaCCLexerState* self, const char* input, unsigned int length) {
  self->input = input;
  self->length = length;
  self->position = 0;
  self->bytePosition = 0;
  self->tokenCount = 0;
  self->failed = 0;
}
static const MaiaCCLexInstruction maiaCCLexCode0[] = {
  { 0, 0, 0, 0 },
  { 1, 38, 0, 0 },
  { 1, 38, 0, 1 }
};
static const MaiaCCLexRange maiaCCLexRanges0[] = {
  { 0, 0 }
};
static const MaiaCCLexInstruction maiaCCLexCode1[] = {
  { 0, 0, 0, 0 },
  { 1, 124, 0, 0 },
  { 1, 124, 0, 1 }
};
static const MaiaCCLexRange maiaCCLexRanges1[] = {
  { 0, 0 }
};
static const MaiaCCLexInstruction maiaCCLexCode2[] = {
  { 0, 0, 0, 0 },
  { 1, 33, 0, 0 }
};
static const MaiaCCLexRange maiaCCLexRanges2[] = {
  { 0, 0 }
};
static const MaiaCCLexInstruction maiaCCLexCode3[] = {
  { 0, 0, 0, 0 },
  { 1, 124, 0, 0 }
};
static const MaiaCCLexRange maiaCCLexRanges3[] = {
  { 0, 0 }
};
static const MaiaCCLexInstruction maiaCCLexCode4[] = {
  { 0, 0, 0, 0 },
  { 1, 62, 0, 0 }
};
static const MaiaCCLexRange maiaCCLexRanges4[] = {
  { 0, 0 }
};
static const MaiaCCLexInstruction maiaCCLexCode5[] = {
  { 0, 0, 0, 0 },
  { 1, 62, 0, 0 },
  { 1, 62, 0, 1 }
};
static const MaiaCCLexRange maiaCCLexRanges5[] = {
  { 0, 0 }
};
static const MaiaCCLexInstruction maiaCCLexCode6[] = {
  { 0, 0, 0, 0 },
  { 1, 60, 0, 0 }
};
static const MaiaCCLexRange maiaCCLexRanges6[] = {
  { 0, 0 }
};
static const MaiaCCLexInstruction maiaCCLexCode7[] = {
  { 0, 0, 0, 0 },
  { 1, 62, 0, 0 },
  { 1, 60, 0, 1 }
};
static const MaiaCCLexRange maiaCCLexRanges7[] = {
  { 0, 0 }
};
static const MaiaCCLexInstruction maiaCCLexCode8[] = {
  { 0, 0, 0, 0 },
  { 1, 38, 0, 0 },
  { 1, 62, 0, 1 }
};
static const MaiaCCLexRange maiaCCLexRanges8[] = {
  { 0, 0 }
};
static const MaiaCCLexInstruction maiaCCLexCode9[] = {
  { 0, 0, 0, 0 },
  { 1, 38, 0, 0 },
  { 1, 60, 0, 1 }
};
static const MaiaCCLexRange maiaCCLexRanges9[] = {
  { 0, 0 }
};
static const MaiaCCLexInstruction maiaCCLexCode10[] = {
  { 0, 0, 0, 0 },
  { 1, 124, 0, 0 },
  { 1, 62, 0, 1 }
};
static const MaiaCCLexRange maiaCCLexRanges10[] = {
  { 0, 0 }
};
static const MaiaCCLexInstruction maiaCCLexCode11[] = {
  { 0, 0, 0, 0 },
  { 1, 40, 0, 0 }
};
static const MaiaCCLexRange maiaCCLexRanges11[] = {
  { 0, 0 }
};
static const MaiaCCLexInstruction maiaCCLexCode12[] = {
  { 0, 0, 0, 0 },
  { 1, 41, 0, 0 }
};
static const MaiaCCLexRange maiaCCLexRanges12[] = {
  { 0, 0 }
};
static const MaiaCCLexInstruction maiaCCLexCode13[] = {
  { 0, 0, 0, 0 },
  { 1, 123, 0, 0 }
};
static const MaiaCCLexRange maiaCCLexRanges13[] = {
  { 0, 0 }
};
static const MaiaCCLexInstruction maiaCCLexCode14[] = {
  { 0, 0, 0, 0 },
  { 1, 125, 0, 0 }
};
static const MaiaCCLexRange maiaCCLexRanges14[] = {
  { 0, 0 }
};
static const MaiaCCLexInstruction maiaCCLexCode15[] = {
  { 0, 0, 0, 0 },
  { 1, 102, 0, 0 },
  { 1, 105, 0, 1 }
};
static const MaiaCCLexRange maiaCCLexRanges15[] = {
  { 0, 0 }
};
static const MaiaCCLexInstruction maiaCCLexCode16[] = {
  { 0, 0, 0, 0 },
  { 1, 110, 0, 0 },
  { 1, 101, 0, 1 },
  { 1, 104, 0, 2 },
  { 1, 116, 0, 3 }
};
static const MaiaCCLexRange maiaCCLexRanges16[] = {
  { 0, 0 }
};
static const MaiaCCLexInstruction maiaCCLexCode17[] = {
  { 0, 0, 0, 0 },
  { 1, 102, 0, 0 },
  { 1, 105, 0, 1 },
  { 1, 108, 0, 2 },
  { 1, 101, 0, 3 }
};
static const MaiaCCLexRange maiaCCLexRanges17[] = {
  { 0, 0 }
};
static const MaiaCCLexInstruction maiaCCLexCode18[] = {
  { 0, 0, 0, 0 },
  { 1, 101, 0, 0 },
  { 1, 115, 0, 1 },
  { 1, 108, 0, 2 },
  { 1, 101, 0, 3 }
};
static const MaiaCCLexRange maiaCCLexRanges18[] = {
  { 0, 0 }
};
static const MaiaCCLexInstruction maiaCCLexCode19[] = {
  { 0, 0, 0, 0 },
  { 1, 105, 0, 0 },
  { 1, 102, 0, 1 }
};
static const MaiaCCLexRange maiaCCLexRanges19[] = {
  { 0, 0 }
};
static const MaiaCCLexInstruction maiaCCLexCode20[] = {
  { 0, 0, 0, 0 },
  { 1, 101, 0, 0 },
  { 1, 108, 0, 1 },
  { 1, 105, 0, 2 },
  { 1, 104, 0, 3 },
  { 1, 119, 0, 4 }
};
static const MaiaCCLexRange maiaCCLexRanges20[] = {
  { 0, 0 }
};
static const MaiaCCLexInstruction maiaCCLexCode21[] = {
  { 0, 0, 0, 0 },
  { 1, 108, 0, 0 },
  { 1, 105, 0, 1 },
  { 1, 116, 0, 2 },
  { 1, 110, 0, 3 },
  { 1, 117, 0, 4 }
};
static const MaiaCCLexRange maiaCCLexRanges21[] = {
  { 0, 0 }
};
static const MaiaCCLexInstruction maiaCCLexCode22[] = {
  { 0, 0, 0, 0 },
  { 1, 114, 0, 0 },
  { 1, 111, 0, 1 },
  { 1, 102, 0, 2 }
};
static const MaiaCCLexRange maiaCCLexRanges22[] = {
  { 0, 0 }
};
static const MaiaCCLexInstruction maiaCCLexCode23[] = {
  { 0, 0, 0, 0 },
  { 1, 110, 0, 0 },
  { 1, 105, 0, 1 }
};
static const MaiaCCLexRange maiaCCLexRanges23[] = {
  { 0, 0 }
};
static const MaiaCCLexInstruction maiaCCLexCode24[] = {
  { 0, 0, 0, 0 },
  { 1, 111, 0, 0 },
  { 1, 100, 0, 1 }
};
static const MaiaCCLexRange maiaCCLexRanges24[] = {
  { 0, 0 }
};
static const MaiaCCLexInstruction maiaCCLexCode25[] = {
  { 0, 0, 0, 0 },
  { 1, 101, 0, 0 },
  { 1, 110, 0, 1 },
  { 1, 111, 0, 2 },
  { 1, 100, 0, 3 }
};
static const MaiaCCLexRange maiaCCLexRanges25[] = {
  { 0, 0 }
};
static const MaiaCCLexInstruction maiaCCLexCode26[] = {
  { 0, 0, 0, 0 },
  { 1, 59, 0, 0 }
};
static const MaiaCCLexRange maiaCCLexRanges26[] = {
  { 0, 0 }
};
static const MaiaCCLexInstruction maiaCCLexCode27[] = {
  { 0, 0, 0, 0 },
  { 1, 38, 0, 0 }
};
static const MaiaCCLexRange maiaCCLexRanges27[] = {
  { 0, 0 }
};
static const MaiaCCLexInstruction maiaCCLexCode28[] = {
  { 0, 0, 0, 0 },
  { 2, 2, 0, 0 },
  { 3, 0, 1, 1 }
};
static const MaiaCCLexRange maiaCCLexRanges28[] = {
  { 48, 57 }
};
static const MaiaCCLexInstruction maiaCCLexCode29[] = {
  { 0, 0, 0, 0 },
  { 2, 32, 0, 0 },
  { 3, 0, 1, 1 },
  { 1, 92, 0, 2 },
  { 1, 34, 0, 1 },
  { 2, 9, 4, 0 },
  { 3, 1, 1, 5 },
  { 1, 92, 0, 6 },
  { 4, 2, 2, 5 },
  { 2, 8, 7, 0 },
  { 1, 34, 0, 5 },
  { 2, 10, 3, 0 },
  { 1, 39, 0, 1 },
  { 2, 14, 12, 0 },
  { 4, 4, 1, 13 },
  { 1, 39, 0, 13 },
  { 2, 15, 11, 0 },
  { 3, 5, 1, 1 },
  { 3, 6, 1, 1 },
  { 2, 18, 17, 0 },
  { 3, 7, 1, 1 },
  { 2, 20, 19, 0 },
  { 3, 8, 1, 1 },
  { 2, 22, 21, 0 },
  { 3, 9, 1, 1 },
  { 2, 24, 23, 0 },
  { 3, 10, 1, 1 },
  { 2, 26, 25, 0 },
  { 3, 11, 1, 1 },
  { 2, 28, 27, 0 },
  { 3, 12, 1, 1 },
  { 2, 30, 29, 0 },
  { 2, 31, 16, 0 },
  { 2, 32, 0, 0 },
  { 1, 61, 0, 33 },
  { 2, 36, 34, 0 },
  { 3, 13, 4, 35 },
  { 3, 17, 3, 35 }
};
static const MaiaCCLexRange maiaCCLexRanges29[] = {
  { 32, 126 },
  { 32, 126 },
  { 34, 34 },
  { 92, 92 },
  { 39, 39 },
  { 126, 126 },
  { 97, 122 },
  { 93, 95 },
  { 63, 91 },
  { 61, 61 },
  { 42, 58 },
  { 35, 37 },
  { 33, 33 },
  { 65, 90 },
  { 97, 122 },
  { 48, 57 },
  { 95, 95 },
  { 65, 90 },
  { 97, 122 },
  { 95, 95 }
};
static const MaiaCCLexInstruction maiaCCLexCode30[] = {
  { 0, 0, 0, 0 },
  { 2, 32, 0, 0 },
  { 3, 0, 1, 1 },
  { 1, 92, 0, 2 },
  { 1, 34, 0, 1 },
  { 2, 9, 4, 0 },
  { 3, 1, 1, 5 },
  { 1, 92, 0, 6 },
  { 4, 2, 2, 5 },
  { 2, 8, 7, 0 },
  { 1, 34, 0, 5 },
  { 2, 10, 3, 0 },
  { 1, 39, 0, 1 },
  { 2, 14, 12, 0 },
  { 4, 4, 1, 13 },
  { 1, 39, 0, 13 },
  { 2, 15, 11, 0 },
  { 3, 5, 1, 1 },
  { 3, 6, 1, 1 },
  { 2, 18, 17, 0 },
  { 3, 7, 1, 1 },
  { 2, 20, 19, 0 },
  { 3, 8, 1, 1 },
  { 2, 22, 21, 0 },
  { 3, 9, 1, 1 },
  { 2, 24, 23, 0 },
  { 3, 10, 1, 1 },
  { 2, 26, 25, 0 },
  { 3, 11, 1, 1 },
  { 2, 28, 27, 0 },
  { 3, 12, 1, 1 },
  { 2, 30, 29, 0 },
  { 2, 31, 16, 0 }
};
static const MaiaCCLexRange maiaCCLexRanges30[] = {
  { 32, 126 },
  { 32, 126 },
  { 34, 34 },
  { 92, 92 },
  { 39, 39 },
  { 126, 126 },
  { 97, 122 },
  { 93, 95 },
  { 63, 91 },
  { 61, 61 },
  { 42, 58 },
  { 35, 37 },
  { 33, 33 }
};
static const MaiaCCLexInstruction maiaCCLexCode31[] = {
  { 0, 0, 0, 0 },
  { 2, 2, 0, 0 },
  { 3, 0, 4, 1 },
  { 3, 4, 3, 1 }
};
static const MaiaCCLexRange maiaCCLexRanges31[] = {
  { 65, 90 },
  { 97, 122 },
  { 48, 57 },
  { 95, 95 },
  { 65, 90 },
  { 97, 122 },
  { 95, 95 }
};
static const MaiaCCLexInstruction maiaCCLexCode32[] = {
  { 0, 0, 0, 0 },
  { 1, 13, 0, 0 },
  { 1, 10, 0, 0 },
  { 2, 2, 1, 0 },
  { 1, 10, 0, 0 },
  { 1, 13, 0, 4 },
  { 2, 5, 3, 0 }
};
static const MaiaCCLexRange maiaCCLexRanges32[] = {
  { 0, 0 }
};
static const MaiaCCLexInstruction maiaCCLexCode33[] = {
  { 0, 0, 0, 0 },
  { 2, 2, 0, 0 },
  { 4, 0, 2, 1 },
  { 1, 35, 0, 1 }
};
static const MaiaCCLexRange maiaCCLexRanges33[] = {
  { 10, 10 },
  { 13, 13 }
};
static const MaiaCCLexInstruction maiaCCLexCode34[] = {
  { 0, 0, 0, 0 },
  { 2, 2, 0, 0 },
  { 3, 0, 4, 1 }
};
static const MaiaCCLexRange maiaCCLexRanges34[] = {
  { 32, 32 },
  { 9, 9 },
  { 11, 11 },
  { 12, 12 }
};
static const MaiaCCLexInstruction maiaCCLexCode35[] = {
  { 0, 0, 0, 0 },
  { 1, 38, 0, 0 },
  { 1, 38, 0, 1 }
};
static const MaiaCCLexRange maiaCCLexRanges35[] = {
  { 0, 0 }
};
static const MaiaCCLexInstruction maiaCCLexCode36[] = {
  { 0, 0, 0, 0 },
  { 1, 124, 0, 0 },
  { 1, 124, 0, 1 }
};
static const MaiaCCLexRange maiaCCLexRanges36[] = {
  { 0, 0 }
};
static const MaiaCCLexInstruction maiaCCLexCode37[] = {
  { 0, 0, 0, 0 },
  { 1, 33, 0, 0 }
};
static const MaiaCCLexRange maiaCCLexRanges37[] = {
  { 0, 0 }
};
static const MaiaCCLexInstruction maiaCCLexCode38[] = {
  { 0, 0, 0, 0 },
  { 1, 124, 0, 0 }
};
static const MaiaCCLexRange maiaCCLexRanges38[] = {
  { 0, 0 }
};
static const MaiaCCLexInstruction maiaCCLexCode39[] = {
  { 0, 0, 0, 0 },
  { 1, 62, 0, 0 }
};
static const MaiaCCLexRange maiaCCLexRanges39[] = {
  { 0, 0 }
};
static const MaiaCCLexInstruction maiaCCLexCode40[] = {
  { 0, 0, 0, 0 },
  { 1, 62, 0, 0 },
  { 1, 62, 0, 1 }
};
static const MaiaCCLexRange maiaCCLexRanges40[] = {
  { 0, 0 }
};
static const MaiaCCLexInstruction maiaCCLexCode41[] = {
  { 0, 0, 0, 0 },
  { 1, 60, 0, 0 }
};
static const MaiaCCLexRange maiaCCLexRanges41[] = {
  { 0, 0 }
};
static const MaiaCCLexInstruction maiaCCLexCode42[] = {
  { 0, 0, 0, 0 },
  { 1, 62, 0, 0 },
  { 1, 60, 0, 1 }
};
static const MaiaCCLexRange maiaCCLexRanges42[] = {
  { 0, 0 }
};
static const MaiaCCLexInstruction maiaCCLexCode43[] = {
  { 0, 0, 0, 0 },
  { 1, 38, 0, 0 },
  { 1, 62, 0, 1 }
};
static const MaiaCCLexRange maiaCCLexRanges43[] = {
  { 0, 0 }
};
static const MaiaCCLexInstruction maiaCCLexCode44[] = {
  { 0, 0, 0, 0 },
  { 1, 38, 0, 0 },
  { 1, 60, 0, 1 }
};
static const MaiaCCLexRange maiaCCLexRanges44[] = {
  { 0, 0 }
};
static const MaiaCCLexInstruction maiaCCLexCode45[] = {
  { 0, 0, 0, 0 },
  { 1, 124, 0, 0 },
  { 1, 62, 0, 1 }
};
static const MaiaCCLexRange maiaCCLexRanges45[] = {
  { 0, 0 }
};
static const MaiaCCLexInstruction maiaCCLexCode46[] = {
  { 0, 0, 0, 0 },
  { 1, 40, 0, 0 }
};
static const MaiaCCLexRange maiaCCLexRanges46[] = {
  { 0, 0 }
};
static const MaiaCCLexInstruction maiaCCLexCode47[] = {
  { 0, 0, 0, 0 },
  { 1, 41, 0, 0 }
};
static const MaiaCCLexRange maiaCCLexRanges47[] = {
  { 0, 0 }
};
static const MaiaCCLexInstruction maiaCCLexCode48[] = {
  { 0, 0, 0, 0 },
  { 1, 123, 0, 0 }
};
static const MaiaCCLexRange maiaCCLexRanges48[] = {
  { 0, 0 }
};
static const MaiaCCLexInstruction maiaCCLexCode49[] = {
  { 0, 0, 0, 0 },
  { 1, 125, 0, 0 }
};
static const MaiaCCLexRange maiaCCLexRanges49[] = {
  { 0, 0 }
};
static const MaiaCCLexInstruction maiaCCLexCode50[] = {
  { 0, 0, 0, 0 },
  { 1, 102, 0, 0 },
  { 1, 105, 0, 1 }
};
static const MaiaCCLexRange maiaCCLexRanges50[] = {
  { 0, 0 }
};
static const MaiaCCLexInstruction maiaCCLexCode51[] = {
  { 0, 0, 0, 0 },
  { 1, 110, 0, 0 },
  { 1, 101, 0, 1 },
  { 1, 104, 0, 2 },
  { 1, 116, 0, 3 }
};
static const MaiaCCLexRange maiaCCLexRanges51[] = {
  { 0, 0 }
};
static const MaiaCCLexInstruction maiaCCLexCode52[] = {
  { 0, 0, 0, 0 },
  { 1, 102, 0, 0 },
  { 1, 105, 0, 1 },
  { 1, 108, 0, 2 },
  { 1, 101, 0, 3 }
};
static const MaiaCCLexRange maiaCCLexRanges52[] = {
  { 0, 0 }
};
static const MaiaCCLexInstruction maiaCCLexCode53[] = {
  { 0, 0, 0, 0 },
  { 1, 101, 0, 0 },
  { 1, 115, 0, 1 },
  { 1, 108, 0, 2 },
  { 1, 101, 0, 3 }
};
static const MaiaCCLexRange maiaCCLexRanges53[] = {
  { 0, 0 }
};
static const MaiaCCLexInstruction maiaCCLexCode54[] = {
  { 0, 0, 0, 0 },
  { 1, 105, 0, 0 },
  { 1, 102, 0, 1 }
};
static const MaiaCCLexRange maiaCCLexRanges54[] = {
  { 0, 0 }
};
static const MaiaCCLexInstruction maiaCCLexCode55[] = {
  { 0, 0, 0, 0 },
  { 1, 101, 0, 0 },
  { 1, 108, 0, 1 },
  { 1, 105, 0, 2 },
  { 1, 104, 0, 3 },
  { 1, 119, 0, 4 }
};
static const MaiaCCLexRange maiaCCLexRanges55[] = {
  { 0, 0 }
};
static const MaiaCCLexInstruction maiaCCLexCode56[] = {
  { 0, 0, 0, 0 },
  { 1, 108, 0, 0 },
  { 1, 105, 0, 1 },
  { 1, 116, 0, 2 },
  { 1, 110, 0, 3 },
  { 1, 117, 0, 4 }
};
static const MaiaCCLexRange maiaCCLexRanges56[] = {
  { 0, 0 }
};
static const MaiaCCLexInstruction maiaCCLexCode57[] = {
  { 0, 0, 0, 0 },
  { 1, 114, 0, 0 },
  { 1, 111, 0, 1 },
  { 1, 102, 0, 2 }
};
static const MaiaCCLexRange maiaCCLexRanges57[] = {
  { 0, 0 }
};
static const MaiaCCLexInstruction maiaCCLexCode58[] = {
  { 0, 0, 0, 0 },
  { 1, 110, 0, 0 },
  { 1, 105, 0, 1 }
};
static const MaiaCCLexRange maiaCCLexRanges58[] = {
  { 0, 0 }
};
static const MaiaCCLexInstruction maiaCCLexCode59[] = {
  { 0, 0, 0, 0 },
  { 1, 111, 0, 0 },
  { 1, 100, 0, 1 }
};
static const MaiaCCLexRange maiaCCLexRanges59[] = {
  { 0, 0 }
};
static const MaiaCCLexInstruction maiaCCLexCode60[] = {
  { 0, 0, 0, 0 },
  { 1, 101, 0, 0 },
  { 1, 110, 0, 1 },
  { 1, 111, 0, 2 },
  { 1, 100, 0, 3 }
};
static const MaiaCCLexRange maiaCCLexRanges60[] = {
  { 0, 0 }
};
static const MaiaCCLexInstruction maiaCCLexCode61[] = {
  { 0, 0, 0, 0 },
  { 1, 59, 0, 0 }
};
static const MaiaCCLexRange maiaCCLexRanges61[] = {
  { 0, 0 }
};
static const MaiaCCLexInstruction maiaCCLexCode62[] = {
  { 0, 0, 0, 0 },
  { 1, 38, 0, 0 }
};
static const MaiaCCLexRange maiaCCLexRanges62[] = {
  { 0, 0 }
};
static const MaiaCCLexInstruction maiaCCLexCode63[] = {
  { 0, 0, 0, 0 },
  { 2, 2, 0, 0 },
  { 3, 0, 1, 1 }
};
static const MaiaCCLexRange maiaCCLexRanges63[] = {
  { 48, 57 }
};
static const MaiaCCLexInstruction maiaCCLexCode64[] = {
  { 0, 0, 0, 0 },
  { 2, 32, 0, 0 },
  { 3, 0, 1, 1 },
  { 1, 92, 0, 2 },
  { 1, 34, 0, 1 },
  { 2, 9, 4, 0 },
  { 3, 1, 1, 5 },
  { 1, 92, 0, 6 },
  { 4, 2, 2, 5 },
  { 2, 8, 7, 0 },
  { 1, 34, 0, 5 },
  { 2, 10, 3, 0 },
  { 1, 39, 0, 1 },
  { 2, 14, 12, 0 },
  { 4, 4, 1, 13 },
  { 1, 39, 0, 13 },
  { 2, 15, 11, 0 },
  { 3, 5, 1, 1 },
  { 3, 6, 1, 1 },
  { 2, 18, 17, 0 },
  { 3, 7, 1, 1 },
  { 2, 20, 19, 0 },
  { 3, 8, 1, 1 },
  { 2, 22, 21, 0 },
  { 3, 9, 1, 1 },
  { 2, 24, 23, 0 },
  { 3, 10, 1, 1 },
  { 2, 26, 25, 0 },
  { 3, 11, 1, 1 },
  { 2, 28, 27, 0 },
  { 3, 12, 1, 1 },
  { 2, 30, 29, 0 },
  { 2, 31, 16, 0 },
  { 2, 32, 0, 0 },
  { 1, 61, 0, 33 },
  { 2, 36, 34, 0 },
  { 3, 13, 4, 35 },
  { 3, 17, 3, 35 }
};
static const MaiaCCLexRange maiaCCLexRanges64[] = {
  { 32, 126 },
  { 32, 126 },
  { 34, 34 },
  { 92, 92 },
  { 39, 39 },
  { 126, 126 },
  { 97, 122 },
  { 93, 95 },
  { 63, 91 },
  { 61, 61 },
  { 42, 58 },
  { 35, 37 },
  { 33, 33 },
  { 65, 90 },
  { 97, 122 },
  { 48, 57 },
  { 95, 95 },
  { 65, 90 },
  { 97, 122 },
  { 95, 95 }
};
static const MaiaCCLexInstruction maiaCCLexCode65[] = {
  { 0, 0, 0, 0 },
  { 2, 32, 0, 0 },
  { 3, 0, 1, 1 },
  { 1, 92, 0, 2 },
  { 1, 34, 0, 1 },
  { 2, 9, 4, 0 },
  { 3, 1, 1, 5 },
  { 1, 92, 0, 6 },
  { 4, 2, 2, 5 },
  { 2, 8, 7, 0 },
  { 1, 34, 0, 5 },
  { 2, 10, 3, 0 },
  { 1, 39, 0, 1 },
  { 2, 14, 12, 0 },
  { 4, 4, 1, 13 },
  { 1, 39, 0, 13 },
  { 2, 15, 11, 0 },
  { 3, 5, 1, 1 },
  { 3, 6, 1, 1 },
  { 2, 18, 17, 0 },
  { 3, 7, 1, 1 },
  { 2, 20, 19, 0 },
  { 3, 8, 1, 1 },
  { 2, 22, 21, 0 },
  { 3, 9, 1, 1 },
  { 2, 24, 23, 0 },
  { 3, 10, 1, 1 },
  { 2, 26, 25, 0 },
  { 3, 11, 1, 1 },
  { 2, 28, 27, 0 },
  { 3, 12, 1, 1 },
  { 2, 30, 29, 0 },
  { 2, 31, 16, 0 }
};
static const MaiaCCLexRange maiaCCLexRanges65[] = {
  { 32, 126 },
  { 32, 126 },
  { 34, 34 },
  { 92, 92 },
  { 39, 39 },
  { 126, 126 },
  { 97, 122 },
  { 93, 95 },
  { 63, 91 },
  { 61, 61 },
  { 42, 58 },
  { 35, 37 },
  { 33, 33 }
};
static const MaiaCCLexInstruction maiaCCLexCode66[] = {
  { 0, 0, 0, 0 },
  { 2, 2, 0, 0 },
  { 3, 0, 4, 1 },
  { 3, 4, 3, 1 }
};
static const MaiaCCLexRange maiaCCLexRanges66[] = {
  { 65, 90 },
  { 97, 122 },
  { 48, 57 },
  { 95, 95 },
  { 65, 90 },
  { 97, 122 },
  { 95, 95 }
};
static const MaiaCCLexInstruction maiaCCLexCode67[] = {
  { 0, 0, 0, 0 },
  { 1, 13, 0, 0 },
  { 1, 10, 0, 0 },
  { 2, 2, 1, 0 },
  { 1, 10, 0, 0 },
  { 1, 13, 0, 4 },
  { 2, 5, 3, 0 }
};
static const MaiaCCLexRange maiaCCLexRanges67[] = {
  { 0, 0 }
};
static const MaiaCCLexPattern maiaCCLexPatterns[] = {
  { maiaCCLexCode0, maiaCCLexRanges0, 3, 2, MAIACC_TOKEN_TOKEN__26__26_, 0, 0, 0, 0, 0 },
  { maiaCCLexCode1, maiaCCLexRanges1, 3, 2, MAIACC_TOKEN_TOKEN__7C__7C_, 0, 0, 0, 0, 0 },
  { maiaCCLexCode2, maiaCCLexRanges2, 2, 1, MAIACC_TOKEN_TOKEN__21_, 0, 0, 0, 0, 0 },
  { maiaCCLexCode3, maiaCCLexRanges3, 2, 1, MAIACC_TOKEN_TOKEN__7C_, 0, 0, 0, 0, 0 },
  { maiaCCLexCode4, maiaCCLexRanges4, 2, 1, MAIACC_TOKEN_TOKEN__3E_, 0, 0, 0, 0, 0 },
  { maiaCCLexCode5, maiaCCLexRanges5, 3, 2, MAIACC_TOKEN_TOKEN__3E__3E_, 0, 0, 0, 0, 0 },
  { maiaCCLexCode6, maiaCCLexRanges6, 2, 1, MAIACC_TOKEN_TOKEN__3C_, 0, 0, 0, 0, 0 },
  { maiaCCLexCode7, maiaCCLexRanges7, 3, 2, MAIACC_TOKEN_TOKEN__3C__3E_, 0, 0, 0, 0, 0 },
  { maiaCCLexCode8, maiaCCLexRanges8, 3, 2, MAIACC_TOKEN_TOKEN__3E__26_, 0, 0, 0, 0, 0 },
  { maiaCCLexCode9, maiaCCLexRanges9, 3, 2, MAIACC_TOKEN_TOKEN__3C__26_, 0, 0, 0, 0, 0 },
  { maiaCCLexCode10, maiaCCLexRanges10, 3, 2, MAIACC_TOKEN_TOKEN__3E__7C_, 0, 0, 0, 0, 0 },
  { maiaCCLexCode11, maiaCCLexRanges11, 2, 1, MAIACC_TOKEN_TOKEN__28_, 0, 0, 0, 0, 0 },
  { maiaCCLexCode12, maiaCCLexRanges12, 2, 1, MAIACC_TOKEN_TOKEN__29_, 0, 0, 0, 0, 0 },
  { maiaCCLexCode13, maiaCCLexRanges13, 2, 1, MAIACC_TOKEN_TOKEN__7B_, 0, 0, 0, 4, 0 },
  { maiaCCLexCode14, maiaCCLexRanges14, 2, 1, MAIACC_TOKEN_TOKEN__7D_, 0, 0, 0, 5, 0 },
  { maiaCCLexCode15, maiaCCLexRanges15, 3, 2, MAIACC_TOKEN_TOKEN_if, 0, 0, 0, 0, 0 },
  { maiaCCLexCode16, maiaCCLexRanges16, 5, 4, MAIACC_TOKEN_TOKEN_then, 0, 0, 0, 0, 0 },
  { maiaCCLexCode17, maiaCCLexRanges17, 5, 4, MAIACC_TOKEN_TOKEN_elif, 0, 0, 0, 0, 0 },
  { maiaCCLexCode18, maiaCCLexRanges18, 5, 4, MAIACC_TOKEN_TOKEN_else, 0, 0, 0, 0, 0 },
  { maiaCCLexCode19, maiaCCLexRanges19, 3, 2, MAIACC_TOKEN_TOKEN_fi, 0, 0, 0, 0, 0 },
  { maiaCCLexCode20, maiaCCLexRanges20, 6, 5, MAIACC_TOKEN_TOKEN_while, 0, 0, 0, 0, 0 },
  { maiaCCLexCode21, maiaCCLexRanges21, 6, 5, MAIACC_TOKEN_TOKEN_until, 0, 0, 0, 0, 0 },
  { maiaCCLexCode22, maiaCCLexRanges22, 4, 3, MAIACC_TOKEN_TOKEN_for, 0, 0, 0, 0, 0 },
  { maiaCCLexCode23, maiaCCLexRanges23, 3, 2, MAIACC_TOKEN_TOKEN_in, 0, 0, 0, 0, 0 },
  { maiaCCLexCode24, maiaCCLexRanges24, 3, 2, MAIACC_TOKEN_TOKEN_do, 0, 0, 0, 0, 0 },
  { maiaCCLexCode25, maiaCCLexRanges25, 5, 4, MAIACC_TOKEN_TOKEN_done, 0, 0, 0, 0, 0 },
  { maiaCCLexCode26, maiaCCLexRanges26, 2, 1, MAIACC_TOKEN_TOKEN__3B_, 0, 0, 0, 0, 0 },
  { maiaCCLexCode27, maiaCCLexRanges27, 2, 1, MAIACC_TOKEN_TOKEN__26_, 0, 0, 0, 0, 0 },
  { maiaCCLexCode28, maiaCCLexRanges28, 3, 2, MAIACC_TOKEN_IO_NUMBER, 0, 0, 0, 0, 1 },
  { maiaCCLexCode29, maiaCCLexRanges29, 38, 37, MAIACC_TOKEN_ASSIGNMENT_WORD, 0, 0, 0, 0, 20 },
  { maiaCCLexCode30, maiaCCLexRanges30, 33, 32, MAIACC_TOKEN_WORD, 0, 0, 0, 0, 13 },
  { maiaCCLexCode31, maiaCCLexRanges31, 4, 3, MAIACC_TOKEN_NAME, 0, 0, 0, 0, 7 },
  { maiaCCLexCode32, maiaCCLexRanges32, 7, 6, MAIACC_TOKEN_NEWLINE, 0, 0, 0, 0, 0 },
  { maiaCCLexCode33, maiaCCLexRanges33, 4, 3, MAIACC_TOKEN_COMMENT, 1, 0, 0, 0, 2 },
  { maiaCCLexCode34, maiaCCLexRanges34, 3, 2, MAIACC_TOKEN_HORIZONTAL_SPACE, 1, 0, 0, 0, 4 },
  { maiaCCLexCode35, maiaCCLexRanges35, 3, 2, MAIACC_TOKEN_TOKEN__26__26_, 0, 0, 0, 0, 0 },
  { maiaCCLexCode36, maiaCCLexRanges36, 3, 2, MAIACC_TOKEN_TOKEN__7C__7C_, 0, 0, 0, 0, 0 },
  { maiaCCLexCode37, maiaCCLexRanges37, 2, 1, MAIACC_TOKEN_TOKEN__21_, 0, 0, 0, 0, 0 },
  { maiaCCLexCode38, maiaCCLexRanges38, 2, 1, MAIACC_TOKEN_TOKEN__7C_, 0, 0, 0, 0, 0 },
  { maiaCCLexCode39, maiaCCLexRanges39, 2, 1, MAIACC_TOKEN_TOKEN__3E_, 0, 0, 0, 0, 0 },
  { maiaCCLexCode40, maiaCCLexRanges40, 3, 2, MAIACC_TOKEN_TOKEN__3E__3E_, 0, 0, 0, 0, 0 },
  { maiaCCLexCode41, maiaCCLexRanges41, 2, 1, MAIACC_TOKEN_TOKEN__3C_, 0, 0, 0, 0, 0 },
  { maiaCCLexCode42, maiaCCLexRanges42, 3, 2, MAIACC_TOKEN_TOKEN__3C__3E_, 0, 0, 0, 0, 0 },
  { maiaCCLexCode43, maiaCCLexRanges43, 3, 2, MAIACC_TOKEN_TOKEN__3E__26_, 0, 0, 0, 0, 0 },
  { maiaCCLexCode44, maiaCCLexRanges44, 3, 2, MAIACC_TOKEN_TOKEN__3C__26_, 0, 0, 0, 0, 0 },
  { maiaCCLexCode45, maiaCCLexRanges45, 3, 2, MAIACC_TOKEN_TOKEN__3E__7C_, 0, 0, 0, 0, 0 },
  { maiaCCLexCode46, maiaCCLexRanges46, 2, 1, MAIACC_TOKEN_TOKEN__28_, 0, 0, 0, 0, 0 },
  { maiaCCLexCode47, maiaCCLexRanges47, 2, 1, MAIACC_TOKEN_TOKEN__29_, 0, 0, 0, 0, 0 },
  { maiaCCLexCode48, maiaCCLexRanges48, 2, 1, MAIACC_TOKEN_TOKEN__7B_, 0, 0, 0, 4, 0 },
  { maiaCCLexCode49, maiaCCLexRanges49, 2, 1, MAIACC_TOKEN_TOKEN__7D_, 0, 0, 0, 5, 0 },
  { maiaCCLexCode50, maiaCCLexRanges50, 3, 2, MAIACC_TOKEN_TOKEN_if, 0, 0, 0, 0, 0 },
  { maiaCCLexCode51, maiaCCLexRanges51, 5, 4, MAIACC_TOKEN_TOKEN_then, 0, 0, 0, 0, 0 },
  { maiaCCLexCode52, maiaCCLexRanges52, 5, 4, MAIACC_TOKEN_TOKEN_elif, 0, 0, 0, 0, 0 },
  { maiaCCLexCode53, maiaCCLexRanges53, 5, 4, MAIACC_TOKEN_TOKEN_else, 0, 0, 0, 0, 0 },
  { maiaCCLexCode54, maiaCCLexRanges54, 3, 2, MAIACC_TOKEN_TOKEN_fi, 0, 0, 0, 0, 0 },
  { maiaCCLexCode55, maiaCCLexRanges55, 6, 5, MAIACC_TOKEN_TOKEN_while, 0, 0, 0, 0, 0 },
  { maiaCCLexCode56, maiaCCLexRanges56, 6, 5, MAIACC_TOKEN_TOKEN_until, 0, 0, 0, 0, 0 },
  { maiaCCLexCode57, maiaCCLexRanges57, 4, 3, MAIACC_TOKEN_TOKEN_for, 0, 0, 0, 0, 0 },
  { maiaCCLexCode58, maiaCCLexRanges58, 3, 2, MAIACC_TOKEN_TOKEN_in, 0, 0, 0, 0, 0 },
  { maiaCCLexCode59, maiaCCLexRanges59, 3, 2, MAIACC_TOKEN_TOKEN_do, 0, 0, 0, 0, 0 },
  { maiaCCLexCode60, maiaCCLexRanges60, 5, 4, MAIACC_TOKEN_TOKEN_done, 0, 0, 0, 0, 0 },
  { maiaCCLexCode61, maiaCCLexRanges61, 2, 1, MAIACC_TOKEN_TOKEN__3B_, 0, 0, 0, 0, 0 },
  { maiaCCLexCode62, maiaCCLexRanges62, 2, 1, MAIACC_TOKEN_TOKEN__26_, 0, 0, 0, 0, 0 },
  { maiaCCLexCode63, maiaCCLexRanges63, 3, 2, MAIACC_TOKEN_IO_NUMBER, 0, 0, 0, 0, 1 },
  { maiaCCLexCode64, maiaCCLexRanges64, 38, 37, MAIACC_TOKEN_ASSIGNMENT_WORD, 0, 0, 0, 0, 20 },
  { maiaCCLexCode65, maiaCCLexRanges65, 33, 32, MAIACC_TOKEN_WORD, 0, 0, 0, 0, 13 },
  { maiaCCLexCode66, maiaCCLexRanges66, 4, 3, MAIACC_TOKEN_NAME, 0, 0, 0, 0, 7 },
  { maiaCCLexCode67, maiaCCLexRanges67, 7, 6, MAIACC_TOKEN_NEWLINE, 0, 0, 0, 0, 0 }
};
static const unsigned int maiaCCLexPatternCount = 35;
static const unsigned int maiaCCLexContextCount = 68;

static int maiaCCLexWhitespace(unsigned int value) {
  return (value >= 9 && value <= 13) || value == 32 || value == 160 || value == 5760
      || (value >= 8192 && value <= 8202) || value == 8232 || value == 8233
      || value == 8239 || value == 8287 || value == 12288 || value == 65279;
}

static int maiaCCLexDecode(const char* input, unsigned int length,
    unsigned int* units, unsigned int* offsets, unsigned int* count) {
  unsigned int position = 0;
  *count = 0;
  while (position < length) {
    unsigned int start = position;
    unsigned int first = (unsigned char)input[position++];
    unsigned int value = first;
    unsigned int extra = 0;
    unsigned int minimum = 0;
    if (first >= 194 && first <= 223) { value = first & 31; extra = 1; minimum = 128; }
    else if (first >= 224 && first <= 239) { value = first & 15; extra = 2; minimum = 2048; }
    else if (first >= 240 && first <= 244) { value = first & 7; extra = 3; minimum = 65536; }
    else if (first >= 128) return 0;
    if (extra > length - position) return 0;
    while (extra > 0) {
      unsigned int byte = (unsigned char)input[position++];
      if (byte < 128 || byte > 191) return 0;
      value = (value << 6) | (byte & 63);
      --extra;
    }
    if (value < minimum || value > 1114111 || (value >= 55296 && value <= 57343)) return 0;
    offsets[*count] = start;
    if (value > 65535) {
      value -= 65536;
      units[(*count)++] = 55296 + (value >> 10);
      offsets[*count] = start;
      units[(*count)++] = 56320 + (value & 1023);
    } else units[(*count)++] = value;
  }
  offsets[*count] = length;
  return 1;
}

static int maiaCCLexMatch(const MaiaCCLexPattern* pattern, const unsigned int* units,
    unsigned int length, unsigned int position) {
  MaiaRegexProgram program = { pattern->code, pattern->ranges, pattern->count, pattern->rangeCount, pattern->entry };
  unsigned int end = 0;
  int result = maia_regex_exec(&program, units, length, position, 0, &end);
  if (result == MAIA_REGEX_MATCH) return (int)end;
  return result == MAIA_REGEX_NOMATCH ? -1 : -2;
}

static int maiaCCLexerTokenize(MaiaCCLexerState* self, MaiaCCParserToken* tokens, unsigned int capacity) {
  self->tokenCount = 0;
  self->position = 0;
  self->bytePosition = 0;
  self->failed = 0;
  if (!self->input || !tokens || !capacity || self->length > 2147483646U) { self->failed = 1; return 0; }
  size_t entries = (size_t)self->length + 1;
  if (entries > ((size_t)-1) / (3 * sizeof(unsigned int))) { self->failed = 2; return 0; }
  unsigned int* storage = (unsigned int*)malloc(entries * 3 * sizeof(unsigned int));
  if (!storage) { self->failed = 2; return 0; }
  unsigned int* units = storage;
  unsigned int* offsets = storage + entries;
  unsigned int* braces = storage + 2 * entries;
  unsigned int length = 0;
  unsigned int classDepth = 0;
  unsigned int templateDepth = 0;
  if (!maiaCCLexDecode(self->input, self->length, units, offsets, &length)) self->failed = 1;
  int middle = -1;
  int tail = -1;
  for (unsigned int index = 0; index < maiaCCLexPatternCount; ++index) {
    if (maiaCCLexPatterns[index].role == 1) middle = (int)index;
    if (maiaCCLexPatterns[index].role == 2) tail = (int)index;
  }
  while (!self->failed && self->position < length) {
    int best = -1;
    int bestEnd = -1;
    int preferred = -1;
    int preferredEnd = -1;
    int whitespace = -1;
    int whitespaceEnd = -1;
    for (unsigned int index = 0; index < maiaCCLexPatternCount; ++index) {
      int candidate = (int)index;
      const MaiaCCLexPattern* pattern = maiaCCLexPatterns + candidate;
      if (pattern->role == 1 || pattern->role == 2) continue;
      int end = maiaCCLexMatch(pattern, units, length, self->position);
      if (end == -2) { self->failed = 2; break; }
      if (end <= (int)self->position) continue;
      if (templateDepth && pattern->role == 5 && braces[templateDepth - 1] == 0) {
        unsigned int limit = self->position + 256;
        if (limit > length) limit = length;
        for (unsigned int scan = self->position + 1; scan < limit; ++scan) {
          if (units[scan] == 92) { ++scan; continue; }
          int span = -1;
          if (units[scan] == 36 && scan + 1 < length && units[scan + 1] == 123) span = middle;
          else if (units[scan] == 96) span = tail;
          else continue;
          if (span >= 0) {
            int spanEnd = maiaCCLexMatch(maiaCCLexPatterns + span, units, length, self->position);
            if (spanEnd == -2) self->failed = 2;
            if (spanEnd > (int)self->position) { candidate = span; end = spanEnd; pattern = maiaCCLexPatterns + span; }
          }
          break;
        }
      }
      if (best < 0 || end > bestEnd || (end == bestEnd && pattern->skip && !maiaCCLexPatterns[best].skip)
          || (end == bestEnd && maiaCCLexPatterns[best].generic && !pattern->generic)) { best = candidate; bestEnd = end; }
      if (classDepth && pattern->preferred && end > preferredEnd) { preferred = candidate; preferredEnd = end; }
      if (pattern->skip && end > whitespaceEnd) { whitespace = candidate; whitespaceEnd = end; }
    }
    if (preferred >= 0) { best = preferred; bestEnd = preferredEnd; }
    if (whitespace >= 0 && maiaCCLexWhitespace(units[self->position])) { best = whitespace; bestEnd = whitespaceEnd; }
    if (self->failed) break;
    if (best < 0) { self->failed = 1; break; }
    const MaiaCCLexPattern* pattern = maiaCCLexPatterns + best;
    if (!pattern->skip) {
      if (self->tokenCount + 1 >= capacity) { self->failed = 3; break; }
      MaiaCCParserToken* token = tokens + self->tokenCount++;
      token->type = pattern->token;
      token->value = self->input + offsets[self->position];
      token->length = offsets[bestEnd] - offsets[self->position];
      token->start = self->position;
      token->end = (unsigned int)bestEnd;
      if (pattern->role == 6) ++classDepth;
      else if (pattern->role == 7 && classDepth) --classDepth;
      else if (pattern->role == 4 && templateDepth) ++braces[templateDepth - 1];
      else if (pattern->role == 5 && templateDepth && braces[templateDepth - 1]) --braces[templateDepth - 1];
      else if (pattern->role == 3) braces[templateDepth++] = 0;
      else if (pattern->role == 2 && templateDepth) --templateDepth;
    }
    self->position = (unsigned int)bestEnd;
    self->bytePosition = offsets[self->position];
  }
  if (!self->failed) {
    MaiaCCParserToken* token = tokens + self->tokenCount++;
    token->type = MAIACC_TOKEN_EOF;
    token->value = self->input + self->length;
    token->length = 0;
    token->start = length;
    token->end = length;
  }
  free(storage);
  return !self->failed;
}

static int maiaCCLexMatchesContextual(unsigned int expected, const MaiaCCParserToken* token) {
  size_t entries = (size_t)token->length + 1;
  if (entries > ((size_t)-1) / (2 * sizeof(unsigned int))) return 0;
  unsigned int* units = (unsigned int*)malloc(entries * 2 * sizeof(unsigned int));
  if (!units) return 0;
  unsigned int length = 0;
  int accepted = 0;
  if (maiaCCLexDecode(token->value, token->length, units, units + entries, &length)) {
    for (unsigned int index = maiaCCLexPatternCount; index < maiaCCLexContextCount; ++index) {
      if (maiaCCLexPatterns[index].token == expected) {
        accepted = maiaCCLexMatch(maiaCCLexPatterns + index, units, length, 0) == (int)length;
        break;
      }
    }
  }
  free(units);
  return accepted;
}


struct MaiaCCParseEvents {
  void* context;
  unsigned int (*checkpoint)(void*);
  void (*restore)(void*, unsigned int);
  void (*startNonterminal)(void*, const char*, unsigned int);
  void (*terminal)(void*, unsigned int, const char*, unsigned int, unsigned int);
  void (*endNonterminal)(void*, const char*, unsigned int);
  void (*abortNonterminal)(void*, const char*, unsigned int);
  int (*matchesContextual)(void*, unsigned int, const MaiaCCParserToken*);
};

struct MaiaCCParserState {
  const MaiaCCParserToken* tokens;
  unsigned int tokenCount;
  unsigned int position;
  const MaiaCCParseEvents* events;
  int failed;
  unsigned int errorCount;
  unsigned int errorPosition;
  unsigned int expectedToken;
  unsigned int foundToken;
  unsigned char* failureMemo;
};

static void maiaCCParserStateInit(
    MaiaCCParserState* self,
    const MaiaCCParserToken* tokens,
    unsigned int tokenCount,
    const MaiaCCParseEvents* events) {
  self->tokens = tokens;
  self->tokenCount = tokenCount;
  self->position = 0;
  self->events = events;
  self->failed = 0;
  self->errorCount = 0;
  self->errorPosition = 0;
  self->expectedToken = 0;
  self->foundToken = 0;
  self->failureMemo = 0;
}

static const MaiaCCParserToken* maiaCC_peek(const MaiaCCParserState* self) {
  return self->position < self->tokenCount ? self->tokens + self->position : 0;
}

static void maiaCC_recordError(MaiaCCParserState* self, unsigned int expected) {
  if (self->errorCount == 0) {
    const MaiaCCParserToken* token = maiaCC_peek(self);
    self->errorPosition = self->position;
    self->expectedToken = expected;
    self->foundToken = token ? token->type : MAIACC_TOKEN_EOF;
  }
  ++self->errorCount;
}

static unsigned int maiaCC_checkpointEvents(const MaiaCCParserState* self) {
  return self->events && self->events->checkpoint
      ? self->events->checkpoint(self->events->context)
      : 0;
}

static void maiaCC_restoreEvents(const MaiaCCParserState* self, unsigned int mark) {
  if (self->events && self->events->restore) {
    self->events->restore(self->events->context, mark);
  }
}

static void maiaCC_startNonterminal(const MaiaCCParserState* self, const char* name) {
  if (self->events && self->events->startNonterminal) {
    self->events->startNonterminal(self->events->context, name, self->position);
  }
}

static void maiaCC_endNonterminal(const MaiaCCParserState* self, const char* name) {
  if (self->events && self->events->endNonterminal) {
    self->events->endNonterminal(self->events->context, name, self->position);
  }
}

static void maiaCC_abortNonterminal(const MaiaCCParserState* self, const char* name) {
  if (self->events && self->events->abortNonterminal) {
    self->events->abortNonterminal(self->events->context, name, self->position);
  }
}

static void maiaCC_emitTerminal(
    const MaiaCCParserState* self,
    const MaiaCCParserToken* token) {
  if (self->events && self->events->terminal && token) {
    self->events->terminal(
        self->events->context,
        token->type,
        token->value,
        token->length,
        self->position);
  }
}

static int maiaCC_matchToken(MaiaCCParserState* self, unsigned int expected) {
  if (self->failed) return 0;
  const MaiaCCParserToken* token = maiaCC_peek(self);
  if (!token || token->type != expected) return 0;
  maiaCC_emitTerminal(self, token);
  ++self->position;
  return 1;
}

static int maiaCC_matchContextualToken(MaiaCCParserState* self, unsigned int expected) {
  if (self->failed) return 0;
  const MaiaCCParserToken* token = maiaCC_peek(self);
  if (!token) { maiaCC_recordError(self, expected); return 0; }
  const int accepted = token->type == expected
      || maiaCCLexMatchesContextual(expected, token)
      || (self->events && self->events->matchesContextual
          && self->events->matchesContextual(self->events->context, expected, token));
  if (!accepted) { maiaCC_recordError(self, expected); return 0; }
  maiaCC_emitTerminal(self, token);
  ++self->position;
  return 1;
}

static int maiaCC_expectToken(MaiaCCParserState* self, unsigned int expected) {
  if (maiaCC_matchToken(self, expected)) return 1;
  maiaCC_recordError(self, expected);
  self->failed = 1;
  return 0;
}

static int maiaCC_expectContextualToken(MaiaCCParserState* self, unsigned int expected) {
  if (maiaCC_matchContextualToken(self, expected)) return 1;
  self->failed = 1;
  return 0;
}

static int maiaCC_parse_Input(MaiaCCParserState* self);
static int maiaCC_parse_CompleteCommand(MaiaCCParserState* self);
static int maiaCC_parse_List(MaiaCCParserState* self);
static int maiaCC_parse_AndOr(MaiaCCParserState* self);
static int maiaCC_parse_AndOrOperator(MaiaCCParserState* self);
static int maiaCC_parse_Pipeline(MaiaCCParserState* self);
static int maiaCC_parse_Command(MaiaCCParserState* self);
static int maiaCC_parse_CompoundCommand(MaiaCCParserState* self);
static int maiaCC_parse_SimpleCommand(MaiaCCParserState* self);
static int maiaCC_parse_PrefixItem(MaiaCCParserState* self);
static int maiaCC_parse_CommandName(MaiaCCParserState* self);
static int maiaCC_parse_CommandTail(MaiaCCParserState* self);
static int maiaCC_parse_Assignment(MaiaCCParserState* self);
static int maiaCC_parse_Redirection(MaiaCCParserState* self);
static int maiaCC_parse_RedirectionOperator(MaiaCCParserState* self);
static int maiaCC_parse_Subshell(MaiaCCParserState* self);
static int maiaCC_parse_BraceGroup(MaiaCCParserState* self);
static int maiaCC_parse_IfClause(MaiaCCParserState* self);
static int maiaCC_parse_WhileClause(MaiaCCParserState* self);
static int maiaCC_parse_UntilClause(MaiaCCParserState* self);
static int maiaCC_parse_ForClause(MaiaCCParserState* self);
static int maiaCC_parse_DoGroup(MaiaCCParserState* self);
static int maiaCC_parse_CompoundList(MaiaCCParserState* self);
static int maiaCC_parse_Term(MaiaCCParserState* self);
static int maiaCC_parse_Separator(MaiaCCParserState* self);
static int maiaCC_parse_SeparatorOp(MaiaCCParserState* self);
static int maiaCC_parse_SequentialSeparator(MaiaCCParserState* self);
static int maiaCC_parse_Linebreak(MaiaCCParserState* self);
static int maiaCC_parse_NewlineList(MaiaCCParserState* self);
static int maiaCC_parse_WordList(MaiaCCParserState* self);
static int maiaCC_parse_Name(MaiaCCParserState* self);
static int maiaCC_parse_Word(MaiaCCParserState* self);


static int maiaCC_parse(MaiaCCParserState* self) {
  self->position = 0;
  self->failed = 0;
  self->errorCount = 0;
  size_t columns = (size_t)self->tokenCount + 1;
  if (columns == 0 || MAIACC_RULE_COUNT > ((size_t)-1) / columns) { self->failed = 1; return 0; }
  self->failureMemo = (unsigned char*)calloc(MAIACC_RULE_COUNT, columns);
  if (!self->failureMemo) { self->failed = 1; return 0; }
  int accepted = maiaCC_parse_Input(self) && !self->failed;
  if (accepted) accepted = self->position == self->tokenCount
      || (self->position + 1 == self->tokenCount
          && maiaCC_peek(self)->type == MAIACC_TOKEN_EOF);
  free(self->failureMemo);
  self->failureMemo = 0;
  return accepted;
}

static int maiaCC_parse_Input(MaiaCCParserState* self) {
  if (self->failed) return 0;
  const unsigned int __ruleStart = self->position;
  const size_t __memoSlot = (size_t)0 * ((size_t)self->tokenCount + 1) + __ruleStart;
  if (self->failureMemo && self->failureMemo[__memoSlot]) { self->failed = 1; return 0; }
  const unsigned int __eventMark = maiaCC_checkpointEvents(self);
  maiaCC_startNonterminal(self, "Input");
    if (!self->failed && !maiaCC_parse_Linebreak(self)) self->failed = 1;
    if (!self->failed) {
      const unsigned int _optionalStart = self->position;
      const unsigned int _eventMark = maiaCC_checkpointEvents(self);
    if (!self->failed && !maiaCC_parse_CompleteCommand(self)) self->failed = 1;
    while (!self->failed) {
      const unsigned int _iterationStart = self->position;
      const unsigned int _eventMark = maiaCC_checkpointEvents(self);
    if (!self->failed && !maiaCC_parse_NewlineList(self)) self->failed = 1;
    if (!self->failed && !maiaCC_parse_CompleteCommand(self)) self->failed = 1;
      if (self->failed) {
        self->position = _iterationStart;
        maiaCC_restoreEvents(self, _eventMark);
        self->failed = 0;
        break;
      }
      if (self->position == _iterationStart) break;
    }
    if (!self->failed) {
      const unsigned int _optionalStart = self->position;
      const unsigned int _eventMark = maiaCC_checkpointEvents(self);
      if (!maiaCC_parse_NewlineList(self)) {
        self->position = _optionalStart;
        maiaCC_restoreEvents(self, _eventMark);
        self->failed = 0;
      }
    }
      if (self->failed) {
        self->position = _optionalStart;
        maiaCC_restoreEvents(self, _eventMark);
        self->failed = 0;
      }
    }
    if (!self->failed) maiaCC_expectToken(self, MAIACC_TOKEN_EOF);
  if (!self->failed) {
    maiaCC_endNonterminal(self, "Input");
    return 1;
  }
  self->position = __ruleStart;
  if (self->failureMemo) self->failureMemo[__memoSlot] = 1;
  maiaCC_restoreEvents(self, __eventMark);
  maiaCC_abortNonterminal(self, "Input");
  return 0;
}

static int maiaCC_parse_CompleteCommand(MaiaCCParserState* self) {
  if (self->failed) return 0;
  const unsigned int __ruleStart = self->position;
  const size_t __memoSlot = (size_t)1 * ((size_t)self->tokenCount + 1) + __ruleStart;
  if (self->failureMemo && self->failureMemo[__memoSlot]) { self->failed = 1; return 0; }
  const unsigned int __eventMark = maiaCC_checkpointEvents(self);
  maiaCC_startNonterminal(self, "CompleteCommand");
    if (!self->failed && !maiaCC_parse_List(self)) self->failed = 1;
    if (!self->failed) {
      const unsigned int _optionalStart = self->position;
      const unsigned int _eventMark = maiaCC_checkpointEvents(self);
      if (!maiaCC_parse_SeparatorOp(self)) {
        self->position = _optionalStart;
        maiaCC_restoreEvents(self, _eventMark);
        self->failed = 0;
      }
    }
  if (!self->failed) {
    maiaCC_endNonterminal(self, "CompleteCommand");
    return 1;
  }
  self->position = __ruleStart;
  if (self->failureMemo) self->failureMemo[__memoSlot] = 1;
  maiaCC_restoreEvents(self, __eventMark);
  maiaCC_abortNonterminal(self, "CompleteCommand");
  return 0;
}

static int maiaCC_parse_List(MaiaCCParserState* self) {
  if (self->failed) return 0;
  const unsigned int __ruleStart = self->position;
  const size_t __memoSlot = (size_t)2 * ((size_t)self->tokenCount + 1) + __ruleStart;
  if (self->failureMemo && self->failureMemo[__memoSlot]) { self->failed = 1; return 0; }
  const unsigned int __eventMark = maiaCC_checkpointEvents(self);
  maiaCC_startNonterminal(self, "List");
    if (!self->failed && !maiaCC_parse_AndOr(self)) self->failed = 1;
    while (!self->failed) {
      const unsigned int _iterationStart = self->position;
      const unsigned int _eventMark = maiaCC_checkpointEvents(self);
    if (!self->failed && !maiaCC_parse_SeparatorOp(self)) self->failed = 1;
    if (!self->failed && !maiaCC_parse_AndOr(self)) self->failed = 1;
      if (self->failed) {
        self->position = _iterationStart;
        maiaCC_restoreEvents(self, _eventMark);
        self->failed = 0;
        break;
      }
      if (self->position == _iterationStart) break;
    }
  if (!self->failed) {
    maiaCC_endNonterminal(self, "List");
    return 1;
  }
  self->position = __ruleStart;
  if (self->failureMemo) self->failureMemo[__memoSlot] = 1;
  maiaCC_restoreEvents(self, __eventMark);
  maiaCC_abortNonterminal(self, "List");
  return 0;
}

static int maiaCC_parse_AndOr(MaiaCCParserState* self) {
  if (self->failed) return 0;
  const unsigned int __ruleStart = self->position;
  const size_t __memoSlot = (size_t)3 * ((size_t)self->tokenCount + 1) + __ruleStart;
  if (self->failureMemo && self->failureMemo[__memoSlot]) { self->failed = 1; return 0; }
  const unsigned int __eventMark = maiaCC_checkpointEvents(self);
  maiaCC_startNonterminal(self, "AndOr");
    if (!self->failed && !maiaCC_parse_Pipeline(self)) self->failed = 1;
    while (!self->failed) {
      const unsigned int _iterationStart = self->position;
      const unsigned int _eventMark = maiaCC_checkpointEvents(self);
    if (!self->failed && !maiaCC_parse_AndOrOperator(self)) self->failed = 1;
    if (!self->failed && !maiaCC_parse_Linebreak(self)) self->failed = 1;
    if (!self->failed && !maiaCC_parse_Pipeline(self)) self->failed = 1;
      if (self->failed) {
        self->position = _iterationStart;
        maiaCC_restoreEvents(self, _eventMark);
        self->failed = 0;
        break;
      }
      if (self->position == _iterationStart) break;
    }
  if (!self->failed) {
    maiaCC_endNonterminal(self, "AndOr");
    return 1;
  }
  self->position = __ruleStart;
  if (self->failureMemo) self->failureMemo[__memoSlot] = 1;
  maiaCC_restoreEvents(self, __eventMark);
  maiaCC_abortNonterminal(self, "AndOr");
  return 0;
}

static int maiaCC_parse_AndOrOperator(MaiaCCParserState* self) {
  if (self->failed) return 0;
  const unsigned int __ruleStart = self->position;
  const size_t __memoSlot = (size_t)4 * ((size_t)self->tokenCount + 1) + __ruleStart;
  if (self->failureMemo && self->failureMemo[__memoSlot]) { self->failed = 1; return 0; }
  const unsigned int __eventMark = maiaCC_checkpointEvents(self);
  maiaCC_startNonterminal(self, "AndOrOperator");
    int _matched = 0;
    if (!_matched && !self->failed) {
      const unsigned int _alternativeStart = self->position;
      const unsigned int _eventMark = maiaCC_checkpointEvents(self);
    if (!self->failed) maiaCC_expectToken(self, MAIACC_TOKEN_TOKEN__26__26_);
      if (!self->failed) {
        _matched = 1;
      } else {
        self->position = _alternativeStart;
        maiaCC_restoreEvents(self, _eventMark);
        self->failed = 0;
      }
    }
    if (!_matched && !self->failed) {
      const unsigned int _alternativeStart = self->position;
      const unsigned int _eventMark = maiaCC_checkpointEvents(self);
    if (!self->failed) maiaCC_expectToken(self, MAIACC_TOKEN_TOKEN__7C__7C_);
      if (!self->failed) {
        _matched = 1;
      } else {
        self->position = _alternativeStart;
        maiaCC_restoreEvents(self, _eventMark);
        self->failed = 0;
      }
    }
    if (!_matched) self->failed = 1;
  if (!self->failed) {
    maiaCC_endNonterminal(self, "AndOrOperator");
    return 1;
  }
  self->position = __ruleStart;
  if (self->failureMemo) self->failureMemo[__memoSlot] = 1;
  maiaCC_restoreEvents(self, __eventMark);
  maiaCC_abortNonterminal(self, "AndOrOperator");
  return 0;
}

static int maiaCC_parse_Pipeline(MaiaCCParserState* self) {
  if (self->failed) return 0;
  const unsigned int __ruleStart = self->position;
  const size_t __memoSlot = (size_t)5 * ((size_t)self->tokenCount + 1) + __ruleStart;
  if (self->failureMemo && self->failureMemo[__memoSlot]) { self->failed = 1; return 0; }
  const unsigned int __eventMark = maiaCC_checkpointEvents(self);
  maiaCC_startNonterminal(self, "Pipeline");
    maiaCC_matchToken(self, MAIACC_TOKEN_TOKEN__21_);
    if (!self->failed && !maiaCC_parse_Command(self)) self->failed = 1;
    while (!self->failed) {
      const unsigned int _iterationStart = self->position;
      const unsigned int _eventMark = maiaCC_checkpointEvents(self);
    if (!self->failed) maiaCC_expectToken(self, MAIACC_TOKEN_TOKEN__7C_);
    if (!self->failed && !maiaCC_parse_Linebreak(self)) self->failed = 1;
    if (!self->failed && !maiaCC_parse_Command(self)) self->failed = 1;
      if (self->failed) {
        self->position = _iterationStart;
        maiaCC_restoreEvents(self, _eventMark);
        self->failed = 0;
        break;
      }
      if (self->position == _iterationStart) break;
    }
  if (!self->failed) {
    maiaCC_endNonterminal(self, "Pipeline");
    return 1;
  }
  self->position = __ruleStart;
  if (self->failureMemo) self->failureMemo[__memoSlot] = 1;
  maiaCC_restoreEvents(self, __eventMark);
  maiaCC_abortNonterminal(self, "Pipeline");
  return 0;
}

static int maiaCC_parse_Command(MaiaCCParserState* self) {
  if (self->failed) return 0;
  const unsigned int __ruleStart = self->position;
  const size_t __memoSlot = (size_t)6 * ((size_t)self->tokenCount + 1) + __ruleStart;
  if (self->failureMemo && self->failureMemo[__memoSlot]) { self->failed = 1; return 0; }
  const unsigned int __eventMark = maiaCC_checkpointEvents(self);
  maiaCC_startNonterminal(self, "Command");
    int _matched = 0;
    if (!_matched && !self->failed) {
      const unsigned int _alternativeStart = self->position;
      const unsigned int _eventMark = maiaCC_checkpointEvents(self);
    if (!self->failed && !maiaCC_parse_SimpleCommand(self)) self->failed = 1;
      if (!self->failed) {
        _matched = 1;
      } else {
        self->position = _alternativeStart;
        maiaCC_restoreEvents(self, _eventMark);
        self->failed = 0;
      }
    }
    if (!_matched && !self->failed) {
      const unsigned int _alternativeStart = self->position;
      const unsigned int _eventMark = maiaCC_checkpointEvents(self);
    if (!self->failed && !maiaCC_parse_CompoundCommand(self)) self->failed = 1;
    while (!self->failed) {
      const unsigned int _iterationStart = self->position;
      const unsigned int _eventMark = maiaCC_checkpointEvents(self);
      if (!maiaCC_parse_Redirection(self)) {
        self->position = _iterationStart;
        maiaCC_restoreEvents(self, _eventMark);
        self->failed = 0;
        break;
      }
      if (self->position == _iterationStart) break;
    }
      if (!self->failed) {
        _matched = 1;
      } else {
        self->position = _alternativeStart;
        maiaCC_restoreEvents(self, _eventMark);
        self->failed = 0;
      }
    }
    if (!_matched) self->failed = 1;
  if (!self->failed) {
    maiaCC_endNonterminal(self, "Command");
    return 1;
  }
  self->position = __ruleStart;
  if (self->failureMemo) self->failureMemo[__memoSlot] = 1;
  maiaCC_restoreEvents(self, __eventMark);
  maiaCC_abortNonterminal(self, "Command");
  return 0;
}

static int maiaCC_parse_CompoundCommand(MaiaCCParserState* self) {
  if (self->failed) return 0;
  const unsigned int __ruleStart = self->position;
  const size_t __memoSlot = (size_t)7 * ((size_t)self->tokenCount + 1) + __ruleStart;
  if (self->failureMemo && self->failureMemo[__memoSlot]) { self->failed = 1; return 0; }
  const unsigned int __eventMark = maiaCC_checkpointEvents(self);
  maiaCC_startNonterminal(self, "CompoundCommand");
    int _matched = 0;
    if (!_matched && !self->failed) {
      const unsigned int _alternativeStart = self->position;
      const unsigned int _eventMark = maiaCC_checkpointEvents(self);
    if (!self->failed && !maiaCC_parse_Subshell(self)) self->failed = 1;
      if (!self->failed) {
        _matched = 1;
      } else {
        self->position = _alternativeStart;
        maiaCC_restoreEvents(self, _eventMark);
        self->failed = 0;
      }
    }
    if (!_matched && !self->failed) {
      const unsigned int _alternativeStart = self->position;
      const unsigned int _eventMark = maiaCC_checkpointEvents(self);
    if (!self->failed && !maiaCC_parse_BraceGroup(self)) self->failed = 1;
      if (!self->failed) {
        _matched = 1;
      } else {
        self->position = _alternativeStart;
        maiaCC_restoreEvents(self, _eventMark);
        self->failed = 0;
      }
    }
    if (!_matched && !self->failed) {
      const unsigned int _alternativeStart = self->position;
      const unsigned int _eventMark = maiaCC_checkpointEvents(self);
    if (!self->failed && !maiaCC_parse_IfClause(self)) self->failed = 1;
      if (!self->failed) {
        _matched = 1;
      } else {
        self->position = _alternativeStart;
        maiaCC_restoreEvents(self, _eventMark);
        self->failed = 0;
      }
    }
    if (!_matched && !self->failed) {
      const unsigned int _alternativeStart = self->position;
      const unsigned int _eventMark = maiaCC_checkpointEvents(self);
    if (!self->failed && !maiaCC_parse_WhileClause(self)) self->failed = 1;
      if (!self->failed) {
        _matched = 1;
      } else {
        self->position = _alternativeStart;
        maiaCC_restoreEvents(self, _eventMark);
        self->failed = 0;
      }
    }
    if (!_matched && !self->failed) {
      const unsigned int _alternativeStart = self->position;
      const unsigned int _eventMark = maiaCC_checkpointEvents(self);
    if (!self->failed && !maiaCC_parse_UntilClause(self)) self->failed = 1;
      if (!self->failed) {
        _matched = 1;
      } else {
        self->position = _alternativeStart;
        maiaCC_restoreEvents(self, _eventMark);
        self->failed = 0;
      }
    }
    if (!_matched && !self->failed) {
      const unsigned int _alternativeStart = self->position;
      const unsigned int _eventMark = maiaCC_checkpointEvents(self);
    if (!self->failed && !maiaCC_parse_ForClause(self)) self->failed = 1;
      if (!self->failed) {
        _matched = 1;
      } else {
        self->position = _alternativeStart;
        maiaCC_restoreEvents(self, _eventMark);
        self->failed = 0;
      }
    }
    if (!_matched) self->failed = 1;
  if (!self->failed) {
    maiaCC_endNonterminal(self, "CompoundCommand");
    return 1;
  }
  self->position = __ruleStart;
  if (self->failureMemo) self->failureMemo[__memoSlot] = 1;
  maiaCC_restoreEvents(self, __eventMark);
  maiaCC_abortNonterminal(self, "CompoundCommand");
  return 0;
}

static int maiaCC_parse_SimpleCommand(MaiaCCParserState* self) {
  if (self->failed) return 0;
  const unsigned int __ruleStart = self->position;
  const size_t __memoSlot = (size_t)8 * ((size_t)self->tokenCount + 1) + __ruleStart;
  if (self->failureMemo && self->failureMemo[__memoSlot]) { self->failed = 1; return 0; }
  const unsigned int __eventMark = maiaCC_checkpointEvents(self);
  maiaCC_startNonterminal(self, "SimpleCommand");
    int _matched = 0;
    if (!_matched && !self->failed) {
      const unsigned int _alternativeStart = self->position;
      const unsigned int _eventMark = maiaCC_checkpointEvents(self);
    while (!self->failed) {
      const unsigned int _iterationStart = self->position;
      const unsigned int _eventMark = maiaCC_checkpointEvents(self);
      if (!maiaCC_parse_PrefixItem(self)) {
        self->position = _iterationStart;
        maiaCC_restoreEvents(self, _eventMark);
        self->failed = 0;
        break;
      }
      if (self->position == _iterationStart) break;
    }
    if (!self->failed && !maiaCC_parse_CommandName(self)) self->failed = 1;
    while (!self->failed) {
      const unsigned int _iterationStart = self->position;
      const unsigned int _eventMark = maiaCC_checkpointEvents(self);
      if (!maiaCC_parse_CommandTail(self)) {
        self->position = _iterationStart;
        maiaCC_restoreEvents(self, _eventMark);
        self->failed = 0;
        break;
      }
      if (self->position == _iterationStart) break;
    }
      if (!self->failed) {
        _matched = 1;
      } else {
        self->position = _alternativeStart;
        maiaCC_restoreEvents(self, _eventMark);
        self->failed = 0;
      }
    }
    if (!_matched && !self->failed) {
      const unsigned int _alternativeStart = self->position;
      const unsigned int _eventMark = maiaCC_checkpointEvents(self);
    {
      unsigned int _count = 0;
      while (!self->failed) {
        const unsigned int _iterationStart = self->position;
        const unsigned int _eventMark = maiaCC_checkpointEvents(self);
        if (!maiaCC_parse_PrefixItem(self)) {
          self->position = _iterationStart;
          maiaCC_restoreEvents(self, _eventMark);
          self->failed = 0;
          break;
        }
        if (self->position == _iterationStart) break;
        ++_count;
      }
      if (_count == 0) self->failed = 1;
    }
      if (!self->failed) {
        _matched = 1;
      } else {
        self->position = _alternativeStart;
        maiaCC_restoreEvents(self, _eventMark);
        self->failed = 0;
      }
    }
    if (!_matched) self->failed = 1;
  if (!self->failed) {
    maiaCC_endNonterminal(self, "SimpleCommand");
    return 1;
  }
  self->position = __ruleStart;
  if (self->failureMemo) self->failureMemo[__memoSlot] = 1;
  maiaCC_restoreEvents(self, __eventMark);
  maiaCC_abortNonterminal(self, "SimpleCommand");
  return 0;
}

static int maiaCC_parse_PrefixItem(MaiaCCParserState* self) {
  if (self->failed) return 0;
  const unsigned int __ruleStart = self->position;
  const size_t __memoSlot = (size_t)9 * ((size_t)self->tokenCount + 1) + __ruleStart;
  if (self->failureMemo && self->failureMemo[__memoSlot]) { self->failed = 1; return 0; }
  const unsigned int __eventMark = maiaCC_checkpointEvents(self);
  maiaCC_startNonterminal(self, "PrefixItem");
    int _matched = 0;
    if (!_matched && !self->failed) {
      const unsigned int _alternativeStart = self->position;
      const unsigned int _eventMark = maiaCC_checkpointEvents(self);
    if (!self->failed && !maiaCC_parse_Assignment(self)) self->failed = 1;
      if (!self->failed) {
        _matched = 1;
      } else {
        self->position = _alternativeStart;
        maiaCC_restoreEvents(self, _eventMark);
        self->failed = 0;
      }
    }
    if (!_matched && !self->failed) {
      const unsigned int _alternativeStart = self->position;
      const unsigned int _eventMark = maiaCC_checkpointEvents(self);
    if (!self->failed && !maiaCC_parse_Redirection(self)) self->failed = 1;
      if (!self->failed) {
        _matched = 1;
      } else {
        self->position = _alternativeStart;
        maiaCC_restoreEvents(self, _eventMark);
        self->failed = 0;
      }
    }
    if (!_matched) self->failed = 1;
  if (!self->failed) {
    maiaCC_endNonterminal(self, "PrefixItem");
    return 1;
  }
  self->position = __ruleStart;
  if (self->failureMemo) self->failureMemo[__memoSlot] = 1;
  maiaCC_restoreEvents(self, __eventMark);
  maiaCC_abortNonterminal(self, "PrefixItem");
  return 0;
}

static int maiaCC_parse_CommandName(MaiaCCParserState* self) {
  if (self->failed) return 0;
  const unsigned int __ruleStart = self->position;
  const size_t __memoSlot = (size_t)10 * ((size_t)self->tokenCount + 1) + __ruleStart;
  if (self->failureMemo && self->failureMemo[__memoSlot]) { self->failed = 1; return 0; }
  const unsigned int __eventMark = maiaCC_checkpointEvents(self);
  maiaCC_startNonterminal(self, "CommandName");
    if (!self->failed && !maiaCC_parse_Word(self)) self->failed = 1;
  if (!self->failed) {
    maiaCC_endNonterminal(self, "CommandName");
    return 1;
  }
  self->position = __ruleStart;
  if (self->failureMemo) self->failureMemo[__memoSlot] = 1;
  maiaCC_restoreEvents(self, __eventMark);
  maiaCC_abortNonterminal(self, "CommandName");
  return 0;
}

static int maiaCC_parse_CommandTail(MaiaCCParserState* self) {
  if (self->failed) return 0;
  const unsigned int __ruleStart = self->position;
  const size_t __memoSlot = (size_t)11 * ((size_t)self->tokenCount + 1) + __ruleStart;
  if (self->failureMemo && self->failureMemo[__memoSlot]) { self->failed = 1; return 0; }
  const unsigned int __eventMark = maiaCC_checkpointEvents(self);
  maiaCC_startNonterminal(self, "CommandTail");
    int _matched = 0;
    if (!_matched && !self->failed) {
      const unsigned int _alternativeStart = self->position;
      const unsigned int _eventMark = maiaCC_checkpointEvents(self);
    if (!self->failed && !maiaCC_parse_Redirection(self)) self->failed = 1;
      if (!self->failed) {
        _matched = 1;
      } else {
        self->position = _alternativeStart;
        maiaCC_restoreEvents(self, _eventMark);
        self->failed = 0;
      }
    }
    if (!_matched && !self->failed) {
      const unsigned int _alternativeStart = self->position;
      const unsigned int _eventMark = maiaCC_checkpointEvents(self);
    if (!self->failed && !maiaCC_parse_Word(self)) self->failed = 1;
      if (!self->failed) {
        _matched = 1;
      } else {
        self->position = _alternativeStart;
        maiaCC_restoreEvents(self, _eventMark);
        self->failed = 0;
      }
    }
    if (!_matched) self->failed = 1;
  if (!self->failed) {
    maiaCC_endNonterminal(self, "CommandTail");
    return 1;
  }
  self->position = __ruleStart;
  if (self->failureMemo) self->failureMemo[__memoSlot] = 1;
  maiaCC_restoreEvents(self, __eventMark);
  maiaCC_abortNonterminal(self, "CommandTail");
  return 0;
}

static int maiaCC_parse_Assignment(MaiaCCParserState* self) {
  if (self->failed) return 0;
  const unsigned int __ruleStart = self->position;
  const size_t __memoSlot = (size_t)12 * ((size_t)self->tokenCount + 1) + __ruleStart;
  if (self->failureMemo && self->failureMemo[__memoSlot]) { self->failed = 1; return 0; }
  const unsigned int __eventMark = maiaCC_checkpointEvents(self);
  maiaCC_startNonterminal(self, "Assignment");
    if (!self->failed) maiaCC_expectToken(self, MAIACC_TOKEN_ASSIGNMENT_WORD);
  if (!self->failed) {
    maiaCC_endNonterminal(self, "Assignment");
    return 1;
  }
  self->position = __ruleStart;
  if (self->failureMemo) self->failureMemo[__memoSlot] = 1;
  maiaCC_restoreEvents(self, __eventMark);
  maiaCC_abortNonterminal(self, "Assignment");
  return 0;
}

static int maiaCC_parse_Redirection(MaiaCCParserState* self) {
  if (self->failed) return 0;
  const unsigned int __ruleStart = self->position;
  const size_t __memoSlot = (size_t)13 * ((size_t)self->tokenCount + 1) + __ruleStart;
  if (self->failureMemo && self->failureMemo[__memoSlot]) { self->failed = 1; return 0; }
  const unsigned int __eventMark = maiaCC_checkpointEvents(self);
  maiaCC_startNonterminal(self, "Redirection");
    maiaCC_matchToken(self, MAIACC_TOKEN_IO_NUMBER);
    if (!self->failed && !maiaCC_parse_RedirectionOperator(self)) self->failed = 1;
    if (!self->failed && !maiaCC_parse_Word(self)) self->failed = 1;
  if (!self->failed) {
    maiaCC_endNonterminal(self, "Redirection");
    return 1;
  }
  self->position = __ruleStart;
  if (self->failureMemo) self->failureMemo[__memoSlot] = 1;
  maiaCC_restoreEvents(self, __eventMark);
  maiaCC_abortNonterminal(self, "Redirection");
  return 0;
}

static int maiaCC_parse_RedirectionOperator(MaiaCCParserState* self) {
  if (self->failed) return 0;
  const unsigned int __ruleStart = self->position;
  const size_t __memoSlot = (size_t)14 * ((size_t)self->tokenCount + 1) + __ruleStart;
  if (self->failureMemo && self->failureMemo[__memoSlot]) { self->failed = 1; return 0; }
  const unsigned int __eventMark = maiaCC_checkpointEvents(self);
  maiaCC_startNonterminal(self, "RedirectionOperator");
    int _matched = 0;
    if (!_matched && !self->failed) {
      const unsigned int _alternativeStart = self->position;
      const unsigned int _eventMark = maiaCC_checkpointEvents(self);
    if (!self->failed) maiaCC_expectToken(self, MAIACC_TOKEN_TOKEN__3E_);
      if (!self->failed) {
        _matched = 1;
      } else {
        self->position = _alternativeStart;
        maiaCC_restoreEvents(self, _eventMark);
        self->failed = 0;
      }
    }
    if (!_matched && !self->failed) {
      const unsigned int _alternativeStart = self->position;
      const unsigned int _eventMark = maiaCC_checkpointEvents(self);
    if (!self->failed) maiaCC_expectToken(self, MAIACC_TOKEN_TOKEN__3E__3E_);
      if (!self->failed) {
        _matched = 1;
      } else {
        self->position = _alternativeStart;
        maiaCC_restoreEvents(self, _eventMark);
        self->failed = 0;
      }
    }
    if (!_matched && !self->failed) {
      const unsigned int _alternativeStart = self->position;
      const unsigned int _eventMark = maiaCC_checkpointEvents(self);
    if (!self->failed) maiaCC_expectToken(self, MAIACC_TOKEN_TOKEN__3C_);
      if (!self->failed) {
        _matched = 1;
      } else {
        self->position = _alternativeStart;
        maiaCC_restoreEvents(self, _eventMark);
        self->failed = 0;
      }
    }
    if (!_matched && !self->failed) {
      const unsigned int _alternativeStart = self->position;
      const unsigned int _eventMark = maiaCC_checkpointEvents(self);
    if (!self->failed) maiaCC_expectToken(self, MAIACC_TOKEN_TOKEN__3C__3E_);
      if (!self->failed) {
        _matched = 1;
      } else {
        self->position = _alternativeStart;
        maiaCC_restoreEvents(self, _eventMark);
        self->failed = 0;
      }
    }
    if (!_matched && !self->failed) {
      const unsigned int _alternativeStart = self->position;
      const unsigned int _eventMark = maiaCC_checkpointEvents(self);
    if (!self->failed) maiaCC_expectToken(self, MAIACC_TOKEN_TOKEN__3E__26_);
      if (!self->failed) {
        _matched = 1;
      } else {
        self->position = _alternativeStart;
        maiaCC_restoreEvents(self, _eventMark);
        self->failed = 0;
      }
    }
    if (!_matched && !self->failed) {
      const unsigned int _alternativeStart = self->position;
      const unsigned int _eventMark = maiaCC_checkpointEvents(self);
    if (!self->failed) maiaCC_expectToken(self, MAIACC_TOKEN_TOKEN__3C__26_);
      if (!self->failed) {
        _matched = 1;
      } else {
        self->position = _alternativeStart;
        maiaCC_restoreEvents(self, _eventMark);
        self->failed = 0;
      }
    }
    if (!_matched && !self->failed) {
      const unsigned int _alternativeStart = self->position;
      const unsigned int _eventMark = maiaCC_checkpointEvents(self);
    if (!self->failed) maiaCC_expectToken(self, MAIACC_TOKEN_TOKEN__3E__7C_);
      if (!self->failed) {
        _matched = 1;
      } else {
        self->position = _alternativeStart;
        maiaCC_restoreEvents(self, _eventMark);
        self->failed = 0;
      }
    }
    if (!_matched) self->failed = 1;
  if (!self->failed) {
    maiaCC_endNonterminal(self, "RedirectionOperator");
    return 1;
  }
  self->position = __ruleStart;
  if (self->failureMemo) self->failureMemo[__memoSlot] = 1;
  maiaCC_restoreEvents(self, __eventMark);
  maiaCC_abortNonterminal(self, "RedirectionOperator");
  return 0;
}

static int maiaCC_parse_Subshell(MaiaCCParserState* self) {
  if (self->failed) return 0;
  const unsigned int __ruleStart = self->position;
  const size_t __memoSlot = (size_t)15 * ((size_t)self->tokenCount + 1) + __ruleStart;
  if (self->failureMemo && self->failureMemo[__memoSlot]) { self->failed = 1; return 0; }
  const unsigned int __eventMark = maiaCC_checkpointEvents(self);
  maiaCC_startNonterminal(self, "Subshell");
    if (!self->failed) maiaCC_expectToken(self, MAIACC_TOKEN_TOKEN__28_);
    if (!self->failed && !maiaCC_parse_CompoundList(self)) self->failed = 1;
    if (!self->failed) maiaCC_expectToken(self, MAIACC_TOKEN_TOKEN__29_);
  if (!self->failed) {
    maiaCC_endNonterminal(self, "Subshell");
    return 1;
  }
  self->position = __ruleStart;
  if (self->failureMemo) self->failureMemo[__memoSlot] = 1;
  maiaCC_restoreEvents(self, __eventMark);
  maiaCC_abortNonterminal(self, "Subshell");
  return 0;
}

static int maiaCC_parse_BraceGroup(MaiaCCParserState* self) {
  if (self->failed) return 0;
  const unsigned int __ruleStart = self->position;
  const size_t __memoSlot = (size_t)16 * ((size_t)self->tokenCount + 1) + __ruleStart;
  if (self->failureMemo && self->failureMemo[__memoSlot]) { self->failed = 1; return 0; }
  const unsigned int __eventMark = maiaCC_checkpointEvents(self);
  maiaCC_startNonterminal(self, "BraceGroup");
    if (!self->failed) maiaCC_expectToken(self, MAIACC_TOKEN_TOKEN__7B_);
    if (!self->failed && !maiaCC_parse_CompoundList(self)) self->failed = 1;
    if (!self->failed) maiaCC_expectToken(self, MAIACC_TOKEN_TOKEN__7D_);
  if (!self->failed) {
    maiaCC_endNonterminal(self, "BraceGroup");
    return 1;
  }
  self->position = __ruleStart;
  if (self->failureMemo) self->failureMemo[__memoSlot] = 1;
  maiaCC_restoreEvents(self, __eventMark);
  maiaCC_abortNonterminal(self, "BraceGroup");
  return 0;
}

static int maiaCC_parse_IfClause(MaiaCCParserState* self) {
  if (self->failed) return 0;
  const unsigned int __ruleStart = self->position;
  const size_t __memoSlot = (size_t)17 * ((size_t)self->tokenCount + 1) + __ruleStart;
  if (self->failureMemo && self->failureMemo[__memoSlot]) { self->failed = 1; return 0; }
  const unsigned int __eventMark = maiaCC_checkpointEvents(self);
  maiaCC_startNonterminal(self, "IfClause");
    if (!self->failed) maiaCC_expectToken(self, MAIACC_TOKEN_TOKEN_if);
    if (!self->failed && !maiaCC_parse_CompoundList(self)) self->failed = 1;
    if (!self->failed) maiaCC_expectToken(self, MAIACC_TOKEN_TOKEN_then);
    if (!self->failed && !maiaCC_parse_CompoundList(self)) self->failed = 1;
    while (!self->failed) {
      const unsigned int _iterationStart = self->position;
      const unsigned int _eventMark = maiaCC_checkpointEvents(self);
    if (!self->failed) maiaCC_expectToken(self, MAIACC_TOKEN_TOKEN_elif);
    if (!self->failed && !maiaCC_parse_CompoundList(self)) self->failed = 1;
    if (!self->failed) maiaCC_expectToken(self, MAIACC_TOKEN_TOKEN_then);
    if (!self->failed && !maiaCC_parse_CompoundList(self)) self->failed = 1;
      if (self->failed) {
        self->position = _iterationStart;
        maiaCC_restoreEvents(self, _eventMark);
        self->failed = 0;
        break;
      }
      if (self->position == _iterationStart) break;
    }
    if (!self->failed) {
      const unsigned int _optionalStart = self->position;
      const unsigned int _eventMark = maiaCC_checkpointEvents(self);
    if (!self->failed) maiaCC_expectToken(self, MAIACC_TOKEN_TOKEN_else);
    if (!self->failed && !maiaCC_parse_CompoundList(self)) self->failed = 1;
      if (self->failed) {
        self->position = _optionalStart;
        maiaCC_restoreEvents(self, _eventMark);
        self->failed = 0;
      }
    }
    if (!self->failed) maiaCC_expectToken(self, MAIACC_TOKEN_TOKEN_fi);
  if (!self->failed) {
    maiaCC_endNonterminal(self, "IfClause");
    return 1;
  }
  self->position = __ruleStart;
  if (self->failureMemo) self->failureMemo[__memoSlot] = 1;
  maiaCC_restoreEvents(self, __eventMark);
  maiaCC_abortNonterminal(self, "IfClause");
  return 0;
}

static int maiaCC_parse_WhileClause(MaiaCCParserState* self) {
  if (self->failed) return 0;
  const unsigned int __ruleStart = self->position;
  const size_t __memoSlot = (size_t)18 * ((size_t)self->tokenCount + 1) + __ruleStart;
  if (self->failureMemo && self->failureMemo[__memoSlot]) { self->failed = 1; return 0; }
  const unsigned int __eventMark = maiaCC_checkpointEvents(self);
  maiaCC_startNonterminal(self, "WhileClause");
    if (!self->failed) maiaCC_expectToken(self, MAIACC_TOKEN_TOKEN_while);
    if (!self->failed && !maiaCC_parse_CompoundList(self)) self->failed = 1;
    if (!self->failed && !maiaCC_parse_DoGroup(self)) self->failed = 1;
  if (!self->failed) {
    maiaCC_endNonterminal(self, "WhileClause");
    return 1;
  }
  self->position = __ruleStart;
  if (self->failureMemo) self->failureMemo[__memoSlot] = 1;
  maiaCC_restoreEvents(self, __eventMark);
  maiaCC_abortNonterminal(self, "WhileClause");
  return 0;
}

static int maiaCC_parse_UntilClause(MaiaCCParserState* self) {
  if (self->failed) return 0;
  const unsigned int __ruleStart = self->position;
  const size_t __memoSlot = (size_t)19 * ((size_t)self->tokenCount + 1) + __ruleStart;
  if (self->failureMemo && self->failureMemo[__memoSlot]) { self->failed = 1; return 0; }
  const unsigned int __eventMark = maiaCC_checkpointEvents(self);
  maiaCC_startNonterminal(self, "UntilClause");
    if (!self->failed) maiaCC_expectToken(self, MAIACC_TOKEN_TOKEN_until);
    if (!self->failed && !maiaCC_parse_CompoundList(self)) self->failed = 1;
    if (!self->failed && !maiaCC_parse_DoGroup(self)) self->failed = 1;
  if (!self->failed) {
    maiaCC_endNonterminal(self, "UntilClause");
    return 1;
  }
  self->position = __ruleStart;
  if (self->failureMemo) self->failureMemo[__memoSlot] = 1;
  maiaCC_restoreEvents(self, __eventMark);
  maiaCC_abortNonterminal(self, "UntilClause");
  return 0;
}

static int maiaCC_parse_ForClause(MaiaCCParserState* self) {
  if (self->failed) return 0;
  const unsigned int __ruleStart = self->position;
  const size_t __memoSlot = (size_t)20 * ((size_t)self->tokenCount + 1) + __ruleStart;
  if (self->failureMemo && self->failureMemo[__memoSlot]) { self->failed = 1; return 0; }
  const unsigned int __eventMark = maiaCC_checkpointEvents(self);
  maiaCC_startNonterminal(self, "ForClause");
    if (!self->failed) maiaCC_expectToken(self, MAIACC_TOKEN_TOKEN_for);
    if (!self->failed && !maiaCC_parse_Name(self)) self->failed = 1;
    if (!self->failed && !maiaCC_parse_Linebreak(self)) self->failed = 1;
    if (!self->failed) {
      const unsigned int _optionalStart = self->position;
      const unsigned int _eventMark = maiaCC_checkpointEvents(self);
    if (!self->failed) maiaCC_expectToken(self, MAIACC_TOKEN_TOKEN_in);
    if (!self->failed) {
      const unsigned int _optionalStart = self->position;
      const unsigned int _eventMark = maiaCC_checkpointEvents(self);
      if (!maiaCC_parse_WordList(self)) {
        self->position = _optionalStart;
        maiaCC_restoreEvents(self, _eventMark);
        self->failed = 0;
      }
    }
      if (self->failed) {
        self->position = _optionalStart;
        maiaCC_restoreEvents(self, _eventMark);
        self->failed = 0;
      }
    }
    {
      int _matchedAlternative = 0;
      if (!_matchedAlternative && !self->failed) {
        const unsigned int _alternativeStart = self->position;
        const unsigned int _eventMark = maiaCC_checkpointEvents(self);
    if (!self->failed && !maiaCC_parse_SequentialSeparator(self)) self->failed = 1;
        if (!self->failed) {
          _matchedAlternative = 1;
        } else {
          self->position = _alternativeStart;
          maiaCC_restoreEvents(self, _eventMark);
          self->failed = 0;
        }
      }
      if (!_matchedAlternative && !self->failed) {
        const unsigned int _alternativeStart = self->position;
        const unsigned int _eventMark = maiaCC_checkpointEvents(self);
    if (!self->failed && !maiaCC_parse_Linebreak(self)) self->failed = 1;
        if (!self->failed) {
          _matchedAlternative = 1;
        } else {
          self->position = _alternativeStart;
          maiaCC_restoreEvents(self, _eventMark);
          self->failed = 0;
        }
      }
      if (!_matchedAlternative) self->failed = 1;
    }
    if (!self->failed && !maiaCC_parse_DoGroup(self)) self->failed = 1;
  if (!self->failed) {
    maiaCC_endNonterminal(self, "ForClause");
    return 1;
  }
  self->position = __ruleStart;
  if (self->failureMemo) self->failureMemo[__memoSlot] = 1;
  maiaCC_restoreEvents(self, __eventMark);
  maiaCC_abortNonterminal(self, "ForClause");
  return 0;
}

static int maiaCC_parse_DoGroup(MaiaCCParserState* self) {
  if (self->failed) return 0;
  const unsigned int __ruleStart = self->position;
  const size_t __memoSlot = (size_t)21 * ((size_t)self->tokenCount + 1) + __ruleStart;
  if (self->failureMemo && self->failureMemo[__memoSlot]) { self->failed = 1; return 0; }
  const unsigned int __eventMark = maiaCC_checkpointEvents(self);
  maiaCC_startNonterminal(self, "DoGroup");
    if (!self->failed) maiaCC_expectToken(self, MAIACC_TOKEN_TOKEN_do);
    if (!self->failed && !maiaCC_parse_CompoundList(self)) self->failed = 1;
    if (!self->failed) maiaCC_expectToken(self, MAIACC_TOKEN_TOKEN_done);
  if (!self->failed) {
    maiaCC_endNonterminal(self, "DoGroup");
    return 1;
  }
  self->position = __ruleStart;
  if (self->failureMemo) self->failureMemo[__memoSlot] = 1;
  maiaCC_restoreEvents(self, __eventMark);
  maiaCC_abortNonterminal(self, "DoGroup");
  return 0;
}

static int maiaCC_parse_CompoundList(MaiaCCParserState* self) {
  if (self->failed) return 0;
  const unsigned int __ruleStart = self->position;
  const size_t __memoSlot = (size_t)22 * ((size_t)self->tokenCount + 1) + __ruleStart;
  if (self->failureMemo && self->failureMemo[__memoSlot]) { self->failed = 1; return 0; }
  const unsigned int __eventMark = maiaCC_checkpointEvents(self);
  maiaCC_startNonterminal(self, "CompoundList");
    if (!self->failed && !maiaCC_parse_Linebreak(self)) self->failed = 1;
    if (!self->failed && !maiaCC_parse_Term(self)) self->failed = 1;
    if (!self->failed) {
      const unsigned int _optionalStart = self->position;
      const unsigned int _eventMark = maiaCC_checkpointEvents(self);
      if (!maiaCC_parse_Separator(self)) {
        self->position = _optionalStart;
        maiaCC_restoreEvents(self, _eventMark);
        self->failed = 0;
      }
    }
  if (!self->failed) {
    maiaCC_endNonterminal(self, "CompoundList");
    return 1;
  }
  self->position = __ruleStart;
  if (self->failureMemo) self->failureMemo[__memoSlot] = 1;
  maiaCC_restoreEvents(self, __eventMark);
  maiaCC_abortNonterminal(self, "CompoundList");
  return 0;
}

static int maiaCC_parse_Term(MaiaCCParserState* self) {
  if (self->failed) return 0;
  const unsigned int __ruleStart = self->position;
  const size_t __memoSlot = (size_t)23 * ((size_t)self->tokenCount + 1) + __ruleStart;
  if (self->failureMemo && self->failureMemo[__memoSlot]) { self->failed = 1; return 0; }
  const unsigned int __eventMark = maiaCC_checkpointEvents(self);
  maiaCC_startNonterminal(self, "Term");
    if (!self->failed && !maiaCC_parse_AndOr(self)) self->failed = 1;
    while (!self->failed) {
      const unsigned int _iterationStart = self->position;
      const unsigned int _eventMark = maiaCC_checkpointEvents(self);
    if (!self->failed && !maiaCC_parse_Separator(self)) self->failed = 1;
    if (!self->failed && !maiaCC_parse_AndOr(self)) self->failed = 1;
      if (self->failed) {
        self->position = _iterationStart;
        maiaCC_restoreEvents(self, _eventMark);
        self->failed = 0;
        break;
      }
      if (self->position == _iterationStart) break;
    }
  if (!self->failed) {
    maiaCC_endNonterminal(self, "Term");
    return 1;
  }
  self->position = __ruleStart;
  if (self->failureMemo) self->failureMemo[__memoSlot] = 1;
  maiaCC_restoreEvents(self, __eventMark);
  maiaCC_abortNonterminal(self, "Term");
  return 0;
}

static int maiaCC_parse_Separator(MaiaCCParserState* self) {
  if (self->failed) return 0;
  const unsigned int __ruleStart = self->position;
  const size_t __memoSlot = (size_t)24 * ((size_t)self->tokenCount + 1) + __ruleStart;
  if (self->failureMemo && self->failureMemo[__memoSlot]) { self->failed = 1; return 0; }
  const unsigned int __eventMark = maiaCC_checkpointEvents(self);
  maiaCC_startNonterminal(self, "Separator");
    int _matched = 0;
    if (!_matched && !self->failed) {
      const unsigned int _alternativeStart = self->position;
      const unsigned int _eventMark = maiaCC_checkpointEvents(self);
    if (!self->failed && !maiaCC_parse_SeparatorOp(self)) self->failed = 1;
      if (!self->failed) {
        _matched = 1;
      } else {
        self->position = _alternativeStart;
        maiaCC_restoreEvents(self, _eventMark);
        self->failed = 0;
      }
    }
    if (!_matched && !self->failed) {
      const unsigned int _alternativeStart = self->position;
      const unsigned int _eventMark = maiaCC_checkpointEvents(self);
    if (!self->failed && !maiaCC_parse_NewlineList(self)) self->failed = 1;
      if (!self->failed) {
        _matched = 1;
      } else {
        self->position = _alternativeStart;
        maiaCC_restoreEvents(self, _eventMark);
        self->failed = 0;
      }
    }
    if (!_matched) self->failed = 1;
  if (!self->failed) {
    maiaCC_endNonterminal(self, "Separator");
    return 1;
  }
  self->position = __ruleStart;
  if (self->failureMemo) self->failureMemo[__memoSlot] = 1;
  maiaCC_restoreEvents(self, __eventMark);
  maiaCC_abortNonterminal(self, "Separator");
  return 0;
}

static int maiaCC_parse_SeparatorOp(MaiaCCParserState* self) {
  if (self->failed) return 0;
  const unsigned int __ruleStart = self->position;
  const size_t __memoSlot = (size_t)25 * ((size_t)self->tokenCount + 1) + __ruleStart;
  if (self->failureMemo && self->failureMemo[__memoSlot]) { self->failed = 1; return 0; }
  const unsigned int __eventMark = maiaCC_checkpointEvents(self);
  maiaCC_startNonterminal(self, "SeparatorOp");
    {
      int _matchedAlternative = 0;
      if (!_matchedAlternative && !self->failed) {
        const unsigned int _alternativeStart = self->position;
        const unsigned int _eventMark = maiaCC_checkpointEvents(self);
    if (!self->failed) maiaCC_expectToken(self, MAIACC_TOKEN_TOKEN__3B_);
        if (!self->failed) {
          _matchedAlternative = 1;
        } else {
          self->position = _alternativeStart;
          maiaCC_restoreEvents(self, _eventMark);
          self->failed = 0;
        }
      }
      if (!_matchedAlternative && !self->failed) {
        const unsigned int _alternativeStart = self->position;
        const unsigned int _eventMark = maiaCC_checkpointEvents(self);
    if (!self->failed) maiaCC_expectToken(self, MAIACC_TOKEN_TOKEN__26_);
        if (!self->failed) {
          _matchedAlternative = 1;
        } else {
          self->position = _alternativeStart;
          maiaCC_restoreEvents(self, _eventMark);
          self->failed = 0;
        }
      }
      if (!_matchedAlternative) self->failed = 1;
    }
    if (!self->failed && !maiaCC_parse_Linebreak(self)) self->failed = 1;
  if (!self->failed) {
    maiaCC_endNonterminal(self, "SeparatorOp");
    return 1;
  }
  self->position = __ruleStart;
  if (self->failureMemo) self->failureMemo[__memoSlot] = 1;
  maiaCC_restoreEvents(self, __eventMark);
  maiaCC_abortNonterminal(self, "SeparatorOp");
  return 0;
}

static int maiaCC_parse_SequentialSeparator(MaiaCCParserState* self) {
  if (self->failed) return 0;
  const unsigned int __ruleStart = self->position;
  const size_t __memoSlot = (size_t)26 * ((size_t)self->tokenCount + 1) + __ruleStart;
  if (self->failureMemo && self->failureMemo[__memoSlot]) { self->failed = 1; return 0; }
  const unsigned int __eventMark = maiaCC_checkpointEvents(self);
  maiaCC_startNonterminal(self, "SequentialSeparator");
    int _matched = 0;
    if (!_matched && !self->failed) {
      const unsigned int _alternativeStart = self->position;
      const unsigned int _eventMark = maiaCC_checkpointEvents(self);
    if (!self->failed) maiaCC_expectToken(self, MAIACC_TOKEN_TOKEN__3B_);
    if (!self->failed && !maiaCC_parse_Linebreak(self)) self->failed = 1;
      if (!self->failed) {
        _matched = 1;
      } else {
        self->position = _alternativeStart;
        maiaCC_restoreEvents(self, _eventMark);
        self->failed = 0;
      }
    }
    if (!_matched && !self->failed) {
      const unsigned int _alternativeStart = self->position;
      const unsigned int _eventMark = maiaCC_checkpointEvents(self);
    if (!self->failed && !maiaCC_parse_NewlineList(self)) self->failed = 1;
      if (!self->failed) {
        _matched = 1;
      } else {
        self->position = _alternativeStart;
        maiaCC_restoreEvents(self, _eventMark);
        self->failed = 0;
      }
    }
    if (!_matched) self->failed = 1;
  if (!self->failed) {
    maiaCC_endNonterminal(self, "SequentialSeparator");
    return 1;
  }
  self->position = __ruleStart;
  if (self->failureMemo) self->failureMemo[__memoSlot] = 1;
  maiaCC_restoreEvents(self, __eventMark);
  maiaCC_abortNonterminal(self, "SequentialSeparator");
  return 0;
}

static int maiaCC_parse_Linebreak(MaiaCCParserState* self) {
  if (self->failed) return 0;
  const unsigned int __ruleStart = self->position;
  const size_t __memoSlot = (size_t)27 * ((size_t)self->tokenCount + 1) + __ruleStart;
  if (self->failureMemo && self->failureMemo[__memoSlot]) { self->failed = 1; return 0; }
  const unsigned int __eventMark = maiaCC_checkpointEvents(self);
  maiaCC_startNonterminal(self, "Linebreak");
    while (maiaCC_matchToken(self, MAIACC_TOKEN_NEWLINE)) {}
  if (!self->failed) {
    maiaCC_endNonterminal(self, "Linebreak");
    return 1;
  }
  self->position = __ruleStart;
  if (self->failureMemo) self->failureMemo[__memoSlot] = 1;
  maiaCC_restoreEvents(self, __eventMark);
  maiaCC_abortNonterminal(self, "Linebreak");
  return 0;
}

static int maiaCC_parse_NewlineList(MaiaCCParserState* self) {
  if (self->failed) return 0;
  const unsigned int __ruleStart = self->position;
  const size_t __memoSlot = (size_t)28 * ((size_t)self->tokenCount + 1) + __ruleStart;
  if (self->failureMemo && self->failureMemo[__memoSlot]) { self->failed = 1; return 0; }
  const unsigned int __eventMark = maiaCC_checkpointEvents(self);
  maiaCC_startNonterminal(self, "NewlineList");
    if (!self->failed) maiaCC_expectToken(self, MAIACC_TOKEN_NEWLINE);
    while (maiaCC_matchToken(self, MAIACC_TOKEN_NEWLINE)) {}
  if (!self->failed) {
    maiaCC_endNonterminal(self, "NewlineList");
    return 1;
  }
  self->position = __ruleStart;
  if (self->failureMemo) self->failureMemo[__memoSlot] = 1;
  maiaCC_restoreEvents(self, __eventMark);
  maiaCC_abortNonterminal(self, "NewlineList");
  return 0;
}

static int maiaCC_parse_WordList(MaiaCCParserState* self) {
  if (self->failed) return 0;
  const unsigned int __ruleStart = self->position;
  const size_t __memoSlot = (size_t)29 * ((size_t)self->tokenCount + 1) + __ruleStart;
  if (self->failureMemo && self->failureMemo[__memoSlot]) { self->failed = 1; return 0; }
  const unsigned int __eventMark = maiaCC_checkpointEvents(self);
  maiaCC_startNonterminal(self, "WordList");
    {
      unsigned int _count = 0;
      while (!self->failed) {
        const unsigned int _iterationStart = self->position;
        const unsigned int _eventMark = maiaCC_checkpointEvents(self);
        if (!maiaCC_parse_Word(self)) {
          self->position = _iterationStart;
          maiaCC_restoreEvents(self, _eventMark);
          self->failed = 0;
          break;
        }
        if (self->position == _iterationStart) break;
        ++_count;
      }
      if (_count == 0) self->failed = 1;
    }
  if (!self->failed) {
    maiaCC_endNonterminal(self, "WordList");
    return 1;
  }
  self->position = __ruleStart;
  if (self->failureMemo) self->failureMemo[__memoSlot] = 1;
  maiaCC_restoreEvents(self, __eventMark);
  maiaCC_abortNonterminal(self, "WordList");
  return 0;
}

static int maiaCC_parse_Name(MaiaCCParserState* self) {
  if (self->failed) return 0;
  const unsigned int __ruleStart = self->position;
  const size_t __memoSlot = (size_t)30 * ((size_t)self->tokenCount + 1) + __ruleStart;
  if (self->failureMemo && self->failureMemo[__memoSlot]) { self->failed = 1; return 0; }
  const unsigned int __eventMark = maiaCC_checkpointEvents(self);
  maiaCC_startNonterminal(self, "Name");
    if (!self->failed) maiaCC_expectContextualToken(self, MAIACC_TOKEN_NAME);
  if (!self->failed) {
    maiaCC_endNonterminal(self, "Name");
    return 1;
  }
  self->position = __ruleStart;
  if (self->failureMemo) self->failureMemo[__memoSlot] = 1;
  maiaCC_restoreEvents(self, __eventMark);
  maiaCC_abortNonterminal(self, "Name");
  return 0;
}

static int maiaCC_parse_Word(MaiaCCParserState* self) {
  if (self->failed) return 0;
  const unsigned int __ruleStart = self->position;
  const size_t __memoSlot = (size_t)31 * ((size_t)self->tokenCount + 1) + __ruleStart;
  if (self->failureMemo && self->failureMemo[__memoSlot]) { self->failed = 1; return 0; }
  const unsigned int __eventMark = maiaCC_checkpointEvents(self);
  maiaCC_startNonterminal(self, "Word");
    int _matched = 0;
    if (!_matched && !self->failed) {
      const unsigned int _alternativeStart = self->position;
      const unsigned int _eventMark = maiaCC_checkpointEvents(self);
    if (!self->failed) maiaCC_expectToken(self, MAIACC_TOKEN_WORD);
      if (!self->failed) {
        _matched = 1;
      } else {
        self->position = _alternativeStart;
        maiaCC_restoreEvents(self, _eventMark);
        self->failed = 0;
      }
    }
    if (!_matched && !self->failed) {
      const unsigned int _alternativeStart = self->position;
      const unsigned int _eventMark = maiaCC_checkpointEvents(self);
    if (!self->failed) maiaCC_expectToken(self, MAIACC_TOKEN_IO_NUMBER);
      if (!self->failed) {
        _matched = 1;
      } else {
        self->position = _alternativeStart;
        maiaCC_restoreEvents(self, _eventMark);
        self->failed = 0;
      }
    }
    if (!_matched && !self->failed) {
      const unsigned int _alternativeStart = self->position;
      const unsigned int _eventMark = maiaCC_checkpointEvents(self);
    if (!self->failed) maiaCC_expectToken(self, MAIACC_TOKEN_ASSIGNMENT_WORD);
      if (!self->failed) {
        _matched = 1;
      } else {
        self->position = _alternativeStart;
        maiaCC_restoreEvents(self, _eventMark);
        self->failed = 0;
      }
    }
    if (!_matched) self->failed = 1;
  if (!self->failed) {
    maiaCC_endNonterminal(self, "Word");
    return 1;
  }
  self->position = __ruleStart;
  if (self->failureMemo) self->failureMemo[__memoSlot] = 1;
  maiaCC_restoreEvents(self, __eventMark);
  maiaCC_abortNonterminal(self, "Word");
  return 0;
}

#endif

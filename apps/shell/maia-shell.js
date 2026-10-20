class Lexer {
  constructor(input) {
    this.input = input;
    this.position = 0;
    this.tokens = [];
    this.charClassDepth = 0;
    this.templateDepth = 0;
    this.templateBraceDepthStack = [];
    this.tokenPatterns = [    { type: 'TOKEN__26__26_', regex: /^&&/ },    { type: 'TOKEN__7C__7C_', regex: /^\|\|/ },    { type: 'TOKEN__21_', regex: /^!/ },    { type: 'TOKEN__7C_', regex: /^\|/ },    { type: 'TOKEN__3E_', regex: /^>/ },    { type: 'TOKEN__3E__3E_', regex: /^>>/ },    { type: 'TOKEN__3C_', regex: /^</ },    { type: 'TOKEN__3C__3E_', regex: /^<>/ },    { type: 'TOKEN__3E__26_', regex: /^>&/ },    { type: 'TOKEN__3C__26_', regex: /^<&/ },    { type: 'TOKEN__3E__7C_', regex: /^>\|/ },    { type: 'TOKEN__28_', regex: /^\(/ },    { type: 'TOKEN__29_', regex: /^\)/ },    { type: 'TOKEN__7B_', regex: /^\{/ },    { type: 'TOKEN__7D_', regex: /^\}/ },    { type: 'TOKEN_if', regex: /^if/ },    { type: 'TOKEN_then', regex: /^then/ },    { type: 'TOKEN_elif', regex: /^elif/ },    { type: 'TOKEN_else', regex: /^else/ },    { type: 'TOKEN_fi', regex: /^fi/ },    { type: 'TOKEN_while', regex: /^while/ },    { type: 'TOKEN_until', regex: /^until/ },    { type: 'TOKEN_for', regex: /^for/ },    { type: 'TOKEN_in', regex: /^in/ },    { type: 'TOKEN_do', regex: /^do/ },    { type: 'TOKEN_done', regex: /^done/ },    { type: 'TOKEN__3B_', regex: /^;/ },    { type: 'TOKEN__26_', regex: /^&/ },    { type: 'IO_NUMBER', regex: /^(?:[0-9])+/ },    { type: 'ASSIGNMENT_WORD', regex: /^[A-Za-z_](?:[A-Za-z0-9_])*=(?:(?:(?:(?:[!]|[\u0023-\u0025]|[\u002a-\u003a]|[=]|[\u003f-\u005b]|[\u005d-\u005f]|[\u0061-\u007a]|[~])|'(?:[^'])*'|"(?:(?:[^"\\]|\\[\u0020-\u007e]))*"|\\[\u0020-\u007e]))+)?/ },    { type: 'WORD', regex: /^(?:(?:(?:[!]|[\u0023-\u0025]|[\u002a-\u003a]|[=]|[\u003f-\u005b]|[\u005d-\u005f]|[\u0061-\u007a]|[~])|'(?:[^'])*'|"(?:(?:[^"\\]|\\[\u0020-\u007e]))*"|\\[\u0020-\u007e]))+/ },    { type: 'NAME', regex: /^[A-Za-z_](?:[A-Za-z0-9_])*/ },    { type: 'NEWLINE', regex: /^(?:\u000d\u000a|\u000a|\u000d)/ },    { type: 'skip', regex: /^#(?:[^\u000a\u000d])*/, skip: true },    { type: 'skip', regex: /^(?:[ \u0009\u000b\u000c])+/, skip: true },    ];
  }

  isTemplateSpanPattern(pos, kind) {
    // Deterministic scan to avoid regex escaping issues in generated code.
    if (this.input[pos] !== '}') return false;
    const BACKTICK = String.fromCharCode(96);
    const max = Math.min(this.input.length, pos + 256);
    let i = pos + 1;
    while (i < max) {
      const ch = this.input[i];
      const next = this.input[i + 1];

      if (ch === '\\') {
        i += 2;
        continue;
      }

      if (ch === '$' && next === '{') {
        return kind === 'TemplateMiddle';
      }

      if (ch === BACKTICK) {
        return kind === 'TemplateTail';
      }

      i++;
    }
    return false;
  }

  enterTemplateSpan() {
    this.templateDepth++;
    this.templateBraceDepthStack.push(0);
  }

  exitTemplateSpan() {
    if (this.templateDepth > 0) {
      this.templateDepth--;
    }
    if (this.templateBraceDepthStack.length > 0) {
      this.templateBraceDepthStack.pop();
    }
  }

  currentTemplateBraceDepth() {
    return this.templateBraceDepthStack.length === 0
      ? 0
      : this.templateBraceDepthStack[this.templateBraceDepthStack.length - 1];
  }

  incrementTemplateBraceDepth() {
    if (this.templateBraceDepthStack.length > 0) {
      this.templateBraceDepthStack[this.templateBraceDepthStack.length - 1] += 1;
    }
  }

  decrementTemplateBraceDepth() {
    const index = this.templateBraceDepthStack.length - 1;
    if (index >= 0 && this.templateBraceDepthStack[index] > 0) {
      this.templateBraceDepthStack[index] -= 1;
    }
  }
  
  tokenize() {
    while (this.position < this.input.length) {
      let bestPattern = null;
      let bestMatch = null;
      const candidates = [];

      const isGenericNameType = (type) => (
        type === 'Name' || type === 'NameChar' || type === 'NameStartChar'
      );

      for (const pattern of this.tokenPatterns) {
        // Template spans are synthesized only when a closing brace ends the
        // active interpolation. Their raw patterns must not consume ordinary
        // braces from nested expressions.
        if (pattern.type === 'TemplateMiddle' || pattern.type === 'TemplateTail') {
          continue;
        }

        const regex = pattern.regex;
        const match = this.input.substring(this.position).match(regex);

        if (match && match.index === 0 && match[0].length > 0) {
          let effectivePattern = pattern;
          let effectiveMatch = match;
          // When parsing template expressions, disambiguate closing brace as template span boundary.
          if (this.templateDepth > 0
            && pattern.type === 'TOKEN__7D_'
            && this.currentTemplateBraceDepth() === 0) {
            if (this.isTemplateSpanPattern(this.position, 'TemplateMiddle')) {
              const templateMiddle = this.tokenPatterns.find((candidate) => candidate.type === 'TemplateMiddle');
              const templateMatch = templateMiddle
                ? this.input.substring(this.position).match(templateMiddle.regex)
                : null;
              if (templateMatch && templateMatch.index === 0 && templateMatch[0].length > 0) {
                effectivePattern = templateMiddle;
                effectiveMatch = templateMatch;
              }
            } else if (this.isTemplateSpanPattern(this.position, 'TemplateTail')) {
              const templateTail = this.tokenPatterns.find((candidate) => candidate.type === 'TemplateTail');
              const templateMatch = templateTail
                ? this.input.substring(this.position).match(templateTail.regex)
                : null;
              if (templateMatch && templateMatch.index === 0 && templateMatch[0].length > 0) {
                effectivePattern = templateTail;
                effectiveMatch = templateMatch;
              }
            }
          }

          candidates.push({ pattern: effectivePattern, match: effectiveMatch });
          if (!bestMatch
              || effectiveMatch[0].length > bestMatch[0].length
              || (effectiveMatch[0].length === bestMatch[0].length && effectivePattern.skip && !bestPattern.skip)
              || (effectiveMatch[0].length === bestMatch[0].length
                  && bestPattern
                  && isGenericNameType(bestPattern.type)
                  && !isGenericNameType(effectivePattern.type))) {
            bestPattern = effectivePattern;
            bestMatch = effectiveMatch;
          }
        }
      }

      // Inside character classes, prefer Char/CharCode/CharRange-like tokens
      // over generic global terminals such as '?>' that can overmatch.
      if (this.charClassDepth > 0 && candidates.length > 0) {
        const preferredTypes = new Set(['CharCodeRange', 'CharRange', 'CharCode', 'Char', 'TOKEN__5D_']);
        const preferred = candidates.filter(c => preferredTypes.has(c.pattern.type));
        if (preferred.length > 0) {
          let localBest = preferred[0];
          for (const c of preferred) {
            if (c.match[0].length > localBest.match[0].length) {
              localBest = c;
            }
          }
          bestPattern = localBest.pattern;
          bestMatch = localBest.match;
        }
      }

      // If current input starts with whitespace and a skip token is available,
      // prefer skipping whitespace first instead of consuming it as grammar data.
      if (candidates.length > 0 && /^\s/.test(this.input.substring(this.position, this.position + 1))) {
        const skipCandidates = candidates.filter(c => c.pattern.skip);
        if (skipCandidates.length > 0) {
          let localBest = skipCandidates[0];
          for (const c of skipCandidates) {
            if (c.match[0].length > localBest.match[0].length) {
              localBest = c;
            }
          }
          bestPattern = localBest.pattern;
          bestMatch = localBest.match;
        }
      }

      if (!bestMatch) {
        throw new Error(`Unexpected character at position ${this.position}: '${this.input[this.position]}'`);
      }

      if (!bestPattern.skip) {
        const matchedToken = {
          type: bestPattern.type,
          value: bestMatch[0],
          start: this.position,
          end: this.position + bestMatch[0].length
        };
        this.tokens.push(matchedToken);

        if (bestPattern.type === 'TOKEN__5B_' || bestPattern.type === 'TOKEN__5B__5E_') {
          this.charClassDepth++;
        } else if (bestPattern.type === 'TOKEN__5D_' && this.charClassDepth > 0) {
          this.charClassDepth--;
        } else if (bestPattern.type === 'TOKEN__7B_' && this.templateDepth > 0) {
          this.incrementTemplateBraceDepth();
        } else if (bestPattern.type === 'TOKEN__7D_' && this.templateDepth > 0) {
          this.decrementTemplateBraceDepth();
        } else if (bestPattern.type === 'TemplateHead') {
          this.enterTemplateSpan();
        } else if (bestPattern.type === 'TemplateTail') {
          this.exitTemplateSpan();
        }
      }

      this.position += bestMatch[0].length;
    }
    
    // Add EOF token
    this.tokens.push({
      type: 'EOF',
      value: '',
      start: this.position,
      end: this.position
    });
    
    return this.tokens;
  }
}

class Parser {
  constructor(input, eventHandler = null) {
    this.lexer = new Lexer(input);
    this.tokens = this.lexer.tokenize();
    this.position = 0;
    this.errors = [];
    this.eventHandler = eventHandler;
    this.failureMemo = new Set();
  }
  
  peek(offset = 0) {
    return this.tokens[this.position + offset];
  }
  
  consume(expectedType) {
    const token = this.peek();
    if (!token || token.type !== expectedType) {
      this.errors.push({
        expected: expectedType,
        found: token ? token.type : 'EOF',
        position: this.position
      });
      throw new Error(`Expected '${expectedType}', got '${token ? token.type : 'EOF'}'`);
    }
    if (this.eventHandler && typeof this.eventHandler.terminal === 'function') {
      this.eventHandler.terminal(expectedType, token.value, this.position);
    }
    this.position++;
    return token;
  }
  
  match(expectedType) {
    const token = this.peek();
    if (token && token.type === expectedType) {
      if (this.eventHandler && typeof this.eventHandler.terminal === 'function') {
        this.eventHandler.terminal(expectedType, token.value, this.position);
      }
      this.position++;
      return true;
    }
    return false;
  }

  consumeContextual(expectedType) {
    const token = this.peek();
    if (token && token.type === expectedType) {
      return this.consume(expectedType);
    }

    const pattern = this.lexer.tokenPatterns.find((candidate) => candidate.type === expectedType);
    const match = pattern && token ? token.value.match(pattern.regex) : null;
    if (!match || match.index !== 0 || match[0].length !== token.value.length) {
      this.errors.push({
        expected: expectedType,
        found: token ? token.type : 'EOF',
        position: this.position
      });
      throw new Error('Expected contextual ' + expectedType + ', got ' + (token ? token.type : 'EOF'));
    }

    if (this.eventHandler && typeof this.eventHandler.terminal === 'function') {
      this.eventHandler.terminal(token.type, token.value, this.position);
    }
    this.position++;
    return token;
  }

  markEventState() {
    if (this.eventHandler && typeof this.eventHandler.checkpoint === 'function') {
      return this.eventHandler.checkpoint();
    }
    return null;
  }

  restoreEventState(mark) {
    if (mark !== null && this.eventHandler && typeof this.eventHandler.restore === 'function') {
      this.eventHandler.restore(mark);
    }
  }
  
  getErrorMessage() {
    if (this.errors.length === 0) return 'No errors';
    const err = this.errors[0];
    return `Syntax error: expected ${err.expected}, got ${err.found}`;
  }
  parse() {
    const result = this.parseInput();
    const next = this.peek();
    if (!next && this.position === this.tokens.length) {
      return result;
    }
    if (!next || next.type !== 'EOF') {
      throw new Error(`Unexpected token at end: ${next ? next.type : 'EOF(consumed)'}`);
    }
    return result;
  }
  parseInput() {
    const __memoStart = this.position;
    const __memoKey = 'Input@' + __memoStart;
    if (this.failureMemo.has(__memoKey)) {
      throw new Error('Previously failed rule Input at position ' + __memoStart);
    }
    if (this.eventHandler && typeof this.eventHandler.startNonterminal === 'function') {
      this.eventHandler.startNonterminal('Input', this.position);
    }
    let __ok = false;
    try {
    this.parseLinebreak();
    // Group ?
    {
      const _optStart = this.position;
      const _optMark = this.markEventState();
      try {
    this.parseCompleteCommand();
    // Group *
    while (true) {
      const _loopStart = this.position;
      const _loopMark = this.markEventState();
      try {
    this.parseNewlineList();
    this.parseCompleteCommand();
      } catch (e) {
        this.position = _loopStart;
        this.restoreEventState(_loopMark);
        break;
      }
      if (this.position === _loopStart) break;
    }
    // Optional: try parsing NewlineList
    {
      const savePos = this.position;
      const saveMark = this.markEventState();
      try {
        this.parseNewlineList();
      } catch(e) {
        this.position = savePos;
        this.restoreEventState(saveMark);
      }
    }
      } catch (e) {
        this.position = _optStart;
        this.restoreEventState(_optMark);
      }
    }
    this.consume('EOF');

      __ok = true;
    } finally {
      if (!__ok) {
        this.failureMemo.add(__memoKey);
      }
      if (this.eventHandler) {
        if (__ok && typeof this.eventHandler.endNonterminal === 'function') {
          this.eventHandler.endNonterminal('Input', this.position);
        }
        if (!__ok && typeof this.eventHandler.abortNonterminal === 'function') {
          this.eventHandler.abortNonterminal('Input', this.position);
        }
      }
    }
  }
  parseCompleteCommand() {
    const __memoStart = this.position;
    const __memoKey = 'CompleteCommand@' + __memoStart;
    if (this.failureMemo.has(__memoKey)) {
      throw new Error('Previously failed rule CompleteCommand at position ' + __memoStart);
    }
    if (this.eventHandler && typeof this.eventHandler.startNonterminal === 'function') {
      this.eventHandler.startNonterminal('CompleteCommand', this.position);
    }
    let __ok = false;
    try {
    this.parseList();
    // Optional: try parsing SeparatorOp
    {
      const savePos = this.position;
      const saveMark = this.markEventState();
      try {
        this.parseSeparatorOp();
      } catch(e) {
        this.position = savePos;
        this.restoreEventState(saveMark);
      }
    }

      __ok = true;
    } finally {
      if (!__ok) {
        this.failureMemo.add(__memoKey);
      }
      if (this.eventHandler) {
        if (__ok && typeof this.eventHandler.endNonterminal === 'function') {
          this.eventHandler.endNonterminal('CompleteCommand', this.position);
        }
        if (!__ok && typeof this.eventHandler.abortNonterminal === 'function') {
          this.eventHandler.abortNonterminal('CompleteCommand', this.position);
        }
      }
    }
  }
  parseList() {
    const __memoStart = this.position;
    const __memoKey = 'List@' + __memoStart;
    if (this.failureMemo.has(__memoKey)) {
      throw new Error('Previously failed rule List at position ' + __memoStart);
    }
    if (this.eventHandler && typeof this.eventHandler.startNonterminal === 'function') {
      this.eventHandler.startNonterminal('List', this.position);
    }
    let __ok = false;
    try {
    this.parseAndOr();
    // Group *
    while (true) {
      const _loopStart = this.position;
      const _loopMark = this.markEventState();
      try {
    this.parseSeparatorOp();
    this.parseAndOr();
      } catch (e) {
        this.position = _loopStart;
        this.restoreEventState(_loopMark);
        break;
      }
      if (this.position === _loopStart) break;
    }

      __ok = true;
    } finally {
      if (!__ok) {
        this.failureMemo.add(__memoKey);
      }
      if (this.eventHandler) {
        if (__ok && typeof this.eventHandler.endNonterminal === 'function') {
          this.eventHandler.endNonterminal('List', this.position);
        }
        if (!__ok && typeof this.eventHandler.abortNonterminal === 'function') {
          this.eventHandler.abortNonterminal('List', this.position);
        }
      }
    }
  }
  parseAndOr() {
    const __memoStart = this.position;
    const __memoKey = 'AndOr@' + __memoStart;
    if (this.failureMemo.has(__memoKey)) {
      throw new Error('Previously failed rule AndOr at position ' + __memoStart);
    }
    if (this.eventHandler && typeof this.eventHandler.startNonterminal === 'function') {
      this.eventHandler.startNonterminal('AndOr', this.position);
    }
    let __ok = false;
    try {
    this.parsePipeline();
    // Group *
    while (true) {
      const _loopStart = this.position;
      const _loopMark = this.markEventState();
      try {
    this.parseAndOrOperator();
    this.parseLinebreak();
    this.parsePipeline();
      } catch (e) {
        this.position = _loopStart;
        this.restoreEventState(_loopMark);
        break;
      }
      if (this.position === _loopStart) break;
    }

      __ok = true;
    } finally {
      if (!__ok) {
        this.failureMemo.add(__memoKey);
      }
      if (this.eventHandler) {
        if (__ok && typeof this.eventHandler.endNonterminal === 'function') {
          this.eventHandler.endNonterminal('AndOr', this.position);
        }
        if (!__ok && typeof this.eventHandler.abortNonterminal === 'function') {
          this.eventHandler.abortNonterminal('AndOr', this.position);
        }
      }
    }
  }
  parseAndOrOperator() {
    const __memoStart = this.position;
    const __memoKey = 'AndOrOperator@' + __memoStart;
    if (this.failureMemo.has(__memoKey)) {
      throw new Error('Previously failed rule AndOrOperator at position ' + __memoStart);
    }
    if (this.eventHandler && typeof this.eventHandler.startNonterminal === 'function') {
      this.eventHandler.startNonterminal('AndOrOperator', this.position);
    }
    let __ok = false;
    try {
    const _ruleStart = this.position;
    let _matched = false;
    if (!_matched) {
      const _ruleMark = this.markEventState();
      try {
    this.consume('TOKEN__26__26_');
        _matched = true;
      } catch (e) {
        this.position = _ruleStart;
        this.restoreEventState(_ruleMark);
      }
    }
    if (!_matched) {
      const _ruleMark = this.markEventState();
      try {
    this.consume('TOKEN__7C__7C_');
        _matched = true;
      } catch (e) {
        this.position = _ruleStart;
        this.restoreEventState(_ruleMark);
      }
    }
    if (!_matched) {
      throw new Error(`Expected one of: 2 alternatives`);
    }

      __ok = true;
    } finally {
      if (!__ok) {
        this.failureMemo.add(__memoKey);
      }
      if (this.eventHandler) {
        if (__ok && typeof this.eventHandler.endNonterminal === 'function') {
          this.eventHandler.endNonterminal('AndOrOperator', this.position);
        }
        if (!__ok && typeof this.eventHandler.abortNonterminal === 'function') {
          this.eventHandler.abortNonterminal('AndOrOperator', this.position);
        }
      }
    }
  }
  parsePipeline() {
    const __memoStart = this.position;
    const __memoKey = 'Pipeline@' + __memoStart;
    if (this.failureMemo.has(__memoKey)) {
      throw new Error('Previously failed rule Pipeline at position ' + __memoStart);
    }
    if (this.eventHandler && typeof this.eventHandler.startNonterminal === 'function') {
      this.eventHandler.startNonterminal('Pipeline', this.position);
    }
    let __ok = false;
    try {
    if (this.match('TOKEN__21_')) { /* optional matched */ }
    this.parseCommand();
    // Group *
    while (true) {
      const _loopStart = this.position;
      const _loopMark = this.markEventState();
      try {
    this.consume('TOKEN__7C_');
    this.parseLinebreak();
    this.parseCommand();
      } catch (e) {
        this.position = _loopStart;
        this.restoreEventState(_loopMark);
        break;
      }
      if (this.position === _loopStart) break;
    }

      __ok = true;
    } finally {
      if (!__ok) {
        this.failureMemo.add(__memoKey);
      }
      if (this.eventHandler) {
        if (__ok && typeof this.eventHandler.endNonterminal === 'function') {
          this.eventHandler.endNonterminal('Pipeline', this.position);
        }
        if (!__ok && typeof this.eventHandler.abortNonterminal === 'function') {
          this.eventHandler.abortNonterminal('Pipeline', this.position);
        }
      }
    }
  }
  parseCommand() {
    const __memoStart = this.position;
    const __memoKey = 'Command@' + __memoStart;
    if (this.failureMemo.has(__memoKey)) {
      throw new Error('Previously failed rule Command at position ' + __memoStart);
    }
    if (this.eventHandler && typeof this.eventHandler.startNonterminal === 'function') {
      this.eventHandler.startNonterminal('Command', this.position);
    }
    let __ok = false;
    try {
    const _ruleStart = this.position;
    let _matched = false;
    if (!_matched) {
      const _ruleMark = this.markEventState();
      try {
    this.parseSimpleCommand();
        _matched = true;
      } catch (e) {
        this.position = _ruleStart;
        this.restoreEventState(_ruleMark);
      }
    }
    if (!_matched) {
      const _ruleMark = this.markEventState();
      try {
    this.parseCompoundCommand();
    while (true) {
      const savePos = this.position;
      const saveMark = this.markEventState();
      try {
        this.parseRedirection();
        if (this.position === savePos) break;
      } catch(e) {
        this.position = savePos;
        this.restoreEventState(saveMark);
        break;
      }
    }
        _matched = true;
      } catch (e) {
        this.position = _ruleStart;
        this.restoreEventState(_ruleMark);
      }
    }
    if (!_matched) {
      throw new Error(`Expected one of: 2 alternatives`);
    }

      __ok = true;
    } finally {
      if (!__ok) {
        this.failureMemo.add(__memoKey);
      }
      if (this.eventHandler) {
        if (__ok && typeof this.eventHandler.endNonterminal === 'function') {
          this.eventHandler.endNonterminal('Command', this.position);
        }
        if (!__ok && typeof this.eventHandler.abortNonterminal === 'function') {
          this.eventHandler.abortNonterminal('Command', this.position);
        }
      }
    }
  }
  parseCompoundCommand() {
    const __memoStart = this.position;
    const __memoKey = 'CompoundCommand@' + __memoStart;
    if (this.failureMemo.has(__memoKey)) {
      throw new Error('Previously failed rule CompoundCommand at position ' + __memoStart);
    }
    if (this.eventHandler && typeof this.eventHandler.startNonterminal === 'function') {
      this.eventHandler.startNonterminal('CompoundCommand', this.position);
    }
    let __ok = false;
    try {
    const _ruleStart = this.position;
    let _matched = false;
    if (!_matched) {
      const _ruleMark = this.markEventState();
      try {
    this.parseSubshell();
        _matched = true;
      } catch (e) {
        this.position = _ruleStart;
        this.restoreEventState(_ruleMark);
      }
    }
    if (!_matched) {
      const _ruleMark = this.markEventState();
      try {
    this.parseBraceGroup();
        _matched = true;
      } catch (e) {
        this.position = _ruleStart;
        this.restoreEventState(_ruleMark);
      }
    }
    if (!_matched) {
      const _ruleMark = this.markEventState();
      try {
    this.parseIfClause();
        _matched = true;
      } catch (e) {
        this.position = _ruleStart;
        this.restoreEventState(_ruleMark);
      }
    }
    if (!_matched) {
      const _ruleMark = this.markEventState();
      try {
    this.parseWhileClause();
        _matched = true;
      } catch (e) {
        this.position = _ruleStart;
        this.restoreEventState(_ruleMark);
      }
    }
    if (!_matched) {
      const _ruleMark = this.markEventState();
      try {
    this.parseUntilClause();
        _matched = true;
      } catch (e) {
        this.position = _ruleStart;
        this.restoreEventState(_ruleMark);
      }
    }
    if (!_matched) {
      const _ruleMark = this.markEventState();
      try {
    this.parseForClause();
        _matched = true;
      } catch (e) {
        this.position = _ruleStart;
        this.restoreEventState(_ruleMark);
      }
    }
    if (!_matched) {
      throw new Error(`Expected one of: 6 alternatives`);
    }

      __ok = true;
    } finally {
      if (!__ok) {
        this.failureMemo.add(__memoKey);
      }
      if (this.eventHandler) {
        if (__ok && typeof this.eventHandler.endNonterminal === 'function') {
          this.eventHandler.endNonterminal('CompoundCommand', this.position);
        }
        if (!__ok && typeof this.eventHandler.abortNonterminal === 'function') {
          this.eventHandler.abortNonterminal('CompoundCommand', this.position);
        }
      }
    }
  }
  parseSimpleCommand() {
    const __memoStart = this.position;
    const __memoKey = 'SimpleCommand@' + __memoStart;
    if (this.failureMemo.has(__memoKey)) {
      throw new Error('Previously failed rule SimpleCommand at position ' + __memoStart);
    }
    if (this.eventHandler && typeof this.eventHandler.startNonterminal === 'function') {
      this.eventHandler.startNonterminal('SimpleCommand', this.position);
    }
    let __ok = false;
    try {
    const _ruleStart = this.position;
    let _matched = false;
    if (!_matched) {
      const _ruleMark = this.markEventState();
      try {
    while (true) {
      const savePos = this.position;
      const saveMark = this.markEventState();
      try {
        this.parsePrefixItem();
        if (this.position === savePos) break;
      } catch(e) {
        this.position = savePos;
        this.restoreEventState(saveMark);
        break;
      }
    }
    this.parseCommandName();
    while (true) {
      const savePos = this.position;
      const saveMark = this.markEventState();
      try {
        this.parseCommandTail();
        if (this.position === savePos) break;
      } catch(e) {
        this.position = savePos;
        this.restoreEventState(saveMark);
        break;
      }
    }
        _matched = true;
      } catch (e) {
        this.position = _ruleStart;
        this.restoreEventState(_ruleMark);
      }
    }
    if (!_matched) {
      const _ruleMark = this.markEventState();
      try {
    let count = 0;
    while (true) {
      const savePos = this.position;
      const saveMark = this.markEventState();
      try {
        this.parsePrefixItem();
        if (this.position === savePos) break;
        count++;
      } catch(e) {
        this.position = savePos;
        this.restoreEventState(saveMark);
        break;
      }
    }
    if (count === 0) {
      throw new Error('Expected at least one PrefixItem');
    }
        _matched = true;
      } catch (e) {
        this.position = _ruleStart;
        this.restoreEventState(_ruleMark);
      }
    }
    if (!_matched) {
      throw new Error(`Expected one of: 2 alternatives`);
    }

      __ok = true;
    } finally {
      if (!__ok) {
        this.failureMemo.add(__memoKey);
      }
      if (this.eventHandler) {
        if (__ok && typeof this.eventHandler.endNonterminal === 'function') {
          this.eventHandler.endNonterminal('SimpleCommand', this.position);
        }
        if (!__ok && typeof this.eventHandler.abortNonterminal === 'function') {
          this.eventHandler.abortNonterminal('SimpleCommand', this.position);
        }
      }
    }
  }
  parsePrefixItem() {
    const __memoStart = this.position;
    const __memoKey = 'PrefixItem@' + __memoStart;
    if (this.failureMemo.has(__memoKey)) {
      throw new Error('Previously failed rule PrefixItem at position ' + __memoStart);
    }
    if (this.eventHandler && typeof this.eventHandler.startNonterminal === 'function') {
      this.eventHandler.startNonterminal('PrefixItem', this.position);
    }
    let __ok = false;
    try {
    const _ruleStart = this.position;
    let _matched = false;
    if (!_matched) {
      const _ruleMark = this.markEventState();
      try {
    this.parseAssignment();
        _matched = true;
      } catch (e) {
        this.position = _ruleStart;
        this.restoreEventState(_ruleMark);
      }
    }
    if (!_matched) {
      const _ruleMark = this.markEventState();
      try {
    this.parseRedirection();
        _matched = true;
      } catch (e) {
        this.position = _ruleStart;
        this.restoreEventState(_ruleMark);
      }
    }
    if (!_matched) {
      throw new Error(`Expected one of: 2 alternatives`);
    }

      __ok = true;
    } finally {
      if (!__ok) {
        this.failureMemo.add(__memoKey);
      }
      if (this.eventHandler) {
        if (__ok && typeof this.eventHandler.endNonterminal === 'function') {
          this.eventHandler.endNonterminal('PrefixItem', this.position);
        }
        if (!__ok && typeof this.eventHandler.abortNonterminal === 'function') {
          this.eventHandler.abortNonterminal('PrefixItem', this.position);
        }
      }
    }
  }
  parseCommandName() {
    const __memoStart = this.position;
    const __memoKey = 'CommandName@' + __memoStart;
    if (this.failureMemo.has(__memoKey)) {
      throw new Error('Previously failed rule CommandName at position ' + __memoStart);
    }
    if (this.eventHandler && typeof this.eventHandler.startNonterminal === 'function') {
      this.eventHandler.startNonterminal('CommandName', this.position);
    }
    let __ok = false;
    try {
    this.parseWord();

      __ok = true;
    } finally {
      if (!__ok) {
        this.failureMemo.add(__memoKey);
      }
      if (this.eventHandler) {
        if (__ok && typeof this.eventHandler.endNonterminal === 'function') {
          this.eventHandler.endNonterminal('CommandName', this.position);
        }
        if (!__ok && typeof this.eventHandler.abortNonterminal === 'function') {
          this.eventHandler.abortNonterminal('CommandName', this.position);
        }
      }
    }
  }
  parseCommandTail() {
    const __memoStart = this.position;
    const __memoKey = 'CommandTail@' + __memoStart;
    if (this.failureMemo.has(__memoKey)) {
      throw new Error('Previously failed rule CommandTail at position ' + __memoStart);
    }
    if (this.eventHandler && typeof this.eventHandler.startNonterminal === 'function') {
      this.eventHandler.startNonterminal('CommandTail', this.position);
    }
    let __ok = false;
    try {
    const _ruleStart = this.position;
    let _matched = false;
    if (!_matched) {
      const _ruleMark = this.markEventState();
      try {
    this.parseRedirection();
        _matched = true;
      } catch (e) {
        this.position = _ruleStart;
        this.restoreEventState(_ruleMark);
      }
    }
    if (!_matched) {
      const _ruleMark = this.markEventState();
      try {
    this.parseWord();
        _matched = true;
      } catch (e) {
        this.position = _ruleStart;
        this.restoreEventState(_ruleMark);
      }
    }
    if (!_matched) {
      throw new Error(`Expected one of: 2 alternatives`);
    }

      __ok = true;
    } finally {
      if (!__ok) {
        this.failureMemo.add(__memoKey);
      }
      if (this.eventHandler) {
        if (__ok && typeof this.eventHandler.endNonterminal === 'function') {
          this.eventHandler.endNonterminal('CommandTail', this.position);
        }
        if (!__ok && typeof this.eventHandler.abortNonterminal === 'function') {
          this.eventHandler.abortNonterminal('CommandTail', this.position);
        }
      }
    }
  }
  parseAssignment() {
    const __memoStart = this.position;
    const __memoKey = 'Assignment@' + __memoStart;
    if (this.failureMemo.has(__memoKey)) {
      throw new Error('Previously failed rule Assignment at position ' + __memoStart);
    }
    if (this.eventHandler && typeof this.eventHandler.startNonterminal === 'function') {
      this.eventHandler.startNonterminal('Assignment', this.position);
    }
    let __ok = false;
    try {
    this.consume('ASSIGNMENT_WORD');

      __ok = true;
    } finally {
      if (!__ok) {
        this.failureMemo.add(__memoKey);
      }
      if (this.eventHandler) {
        if (__ok && typeof this.eventHandler.endNonterminal === 'function') {
          this.eventHandler.endNonterminal('Assignment', this.position);
        }
        if (!__ok && typeof this.eventHandler.abortNonterminal === 'function') {
          this.eventHandler.abortNonterminal('Assignment', this.position);
        }
      }
    }
  }
  parseRedirection() {
    const __memoStart = this.position;
    const __memoKey = 'Redirection@' + __memoStart;
    if (this.failureMemo.has(__memoKey)) {
      throw new Error('Previously failed rule Redirection at position ' + __memoStart);
    }
    if (this.eventHandler && typeof this.eventHandler.startNonterminal === 'function') {
      this.eventHandler.startNonterminal('Redirection', this.position);
    }
    let __ok = false;
    try {
    if (this.match('IO_NUMBER')) { /* optional token matched */ }
    this.parseRedirectionOperator();
    this.parseWord();

      __ok = true;
    } finally {
      if (!__ok) {
        this.failureMemo.add(__memoKey);
      }
      if (this.eventHandler) {
        if (__ok && typeof this.eventHandler.endNonterminal === 'function') {
          this.eventHandler.endNonterminal('Redirection', this.position);
        }
        if (!__ok && typeof this.eventHandler.abortNonterminal === 'function') {
          this.eventHandler.abortNonterminal('Redirection', this.position);
        }
      }
    }
  }
  parseRedirectionOperator() {
    const __memoStart = this.position;
    const __memoKey = 'RedirectionOperator@' + __memoStart;
    if (this.failureMemo.has(__memoKey)) {
      throw new Error('Previously failed rule RedirectionOperator at position ' + __memoStart);
    }
    if (this.eventHandler && typeof this.eventHandler.startNonterminal === 'function') {
      this.eventHandler.startNonterminal('RedirectionOperator', this.position);
    }
    let __ok = false;
    try {
    const _ruleStart = this.position;
    let _matched = false;
    if (!_matched) {
      const _ruleMark = this.markEventState();
      try {
    this.consume('TOKEN__3E_');
        _matched = true;
      } catch (e) {
        this.position = _ruleStart;
        this.restoreEventState(_ruleMark);
      }
    }
    if (!_matched) {
      const _ruleMark = this.markEventState();
      try {
    this.consume('TOKEN__3E__3E_');
        _matched = true;
      } catch (e) {
        this.position = _ruleStart;
        this.restoreEventState(_ruleMark);
      }
    }
    if (!_matched) {
      const _ruleMark = this.markEventState();
      try {
    this.consume('TOKEN__3C_');
        _matched = true;
      } catch (e) {
        this.position = _ruleStart;
        this.restoreEventState(_ruleMark);
      }
    }
    if (!_matched) {
      const _ruleMark = this.markEventState();
      try {
    this.consume('TOKEN__3C__3E_');
        _matched = true;
      } catch (e) {
        this.position = _ruleStart;
        this.restoreEventState(_ruleMark);
      }
    }
    if (!_matched) {
      const _ruleMark = this.markEventState();
      try {
    this.consume('TOKEN__3E__26_');
        _matched = true;
      } catch (e) {
        this.position = _ruleStart;
        this.restoreEventState(_ruleMark);
      }
    }
    if (!_matched) {
      const _ruleMark = this.markEventState();
      try {
    this.consume('TOKEN__3C__26_');
        _matched = true;
      } catch (e) {
        this.position = _ruleStart;
        this.restoreEventState(_ruleMark);
      }
    }
    if (!_matched) {
      const _ruleMark = this.markEventState();
      try {
    this.consume('TOKEN__3E__7C_');
        _matched = true;
      } catch (e) {
        this.position = _ruleStart;
        this.restoreEventState(_ruleMark);
      }
    }
    if (!_matched) {
      throw new Error(`Expected one of: 7 alternatives`);
    }

      __ok = true;
    } finally {
      if (!__ok) {
        this.failureMemo.add(__memoKey);
      }
      if (this.eventHandler) {
        if (__ok && typeof this.eventHandler.endNonterminal === 'function') {
          this.eventHandler.endNonterminal('RedirectionOperator', this.position);
        }
        if (!__ok && typeof this.eventHandler.abortNonterminal === 'function') {
          this.eventHandler.abortNonterminal('RedirectionOperator', this.position);
        }
      }
    }
  }
  parseSubshell() {
    const __memoStart = this.position;
    const __memoKey = 'Subshell@' + __memoStart;
    if (this.failureMemo.has(__memoKey)) {
      throw new Error('Previously failed rule Subshell at position ' + __memoStart);
    }
    if (this.eventHandler && typeof this.eventHandler.startNonterminal === 'function') {
      this.eventHandler.startNonterminal('Subshell', this.position);
    }
    let __ok = false;
    try {
    this.consume('TOKEN__28_');
    this.parseCompoundList();
    this.consume('TOKEN__29_');

      __ok = true;
    } finally {
      if (!__ok) {
        this.failureMemo.add(__memoKey);
      }
      if (this.eventHandler) {
        if (__ok && typeof this.eventHandler.endNonterminal === 'function') {
          this.eventHandler.endNonterminal('Subshell', this.position);
        }
        if (!__ok && typeof this.eventHandler.abortNonterminal === 'function') {
          this.eventHandler.abortNonterminal('Subshell', this.position);
        }
      }
    }
  }
  parseBraceGroup() {
    const __memoStart = this.position;
    const __memoKey = 'BraceGroup@' + __memoStart;
    if (this.failureMemo.has(__memoKey)) {
      throw new Error('Previously failed rule BraceGroup at position ' + __memoStart);
    }
    if (this.eventHandler && typeof this.eventHandler.startNonterminal === 'function') {
      this.eventHandler.startNonterminal('BraceGroup', this.position);
    }
    let __ok = false;
    try {
    this.consume('TOKEN__7B_');
    this.parseCompoundList();
    this.consume('TOKEN__7D_');

      __ok = true;
    } finally {
      if (!__ok) {
        this.failureMemo.add(__memoKey);
      }
      if (this.eventHandler) {
        if (__ok && typeof this.eventHandler.endNonterminal === 'function') {
          this.eventHandler.endNonterminal('BraceGroup', this.position);
        }
        if (!__ok && typeof this.eventHandler.abortNonterminal === 'function') {
          this.eventHandler.abortNonterminal('BraceGroup', this.position);
        }
      }
    }
  }
  parseIfClause() {
    const __memoStart = this.position;
    const __memoKey = 'IfClause@' + __memoStart;
    if (this.failureMemo.has(__memoKey)) {
      throw new Error('Previously failed rule IfClause at position ' + __memoStart);
    }
    if (this.eventHandler && typeof this.eventHandler.startNonterminal === 'function') {
      this.eventHandler.startNonterminal('IfClause', this.position);
    }
    let __ok = false;
    try {
    this.consume('TOKEN_if');
    this.parseCompoundList();
    this.consume('TOKEN_then');
    this.parseCompoundList();
    // Group *
    while (true) {
      const _loopStart = this.position;
      const _loopMark = this.markEventState();
      try {
    this.consume('TOKEN_elif');
    this.parseCompoundList();
    this.consume('TOKEN_then');
    this.parseCompoundList();
      } catch (e) {
        this.position = _loopStart;
        this.restoreEventState(_loopMark);
        break;
      }
      if (this.position === _loopStart) break;
    }
    // Group ?
    {
      const _optStart = this.position;
      const _optMark = this.markEventState();
      try {
    this.consume('TOKEN_else');
    this.parseCompoundList();
      } catch (e) {
        this.position = _optStart;
        this.restoreEventState(_optMark);
      }
    }
    this.consume('TOKEN_fi');

      __ok = true;
    } finally {
      if (!__ok) {
        this.failureMemo.add(__memoKey);
      }
      if (this.eventHandler) {
        if (__ok && typeof this.eventHandler.endNonterminal === 'function') {
          this.eventHandler.endNonterminal('IfClause', this.position);
        }
        if (!__ok && typeof this.eventHandler.abortNonterminal === 'function') {
          this.eventHandler.abortNonterminal('IfClause', this.position);
        }
      }
    }
  }
  parseWhileClause() {
    const __memoStart = this.position;
    const __memoKey = 'WhileClause@' + __memoStart;
    if (this.failureMemo.has(__memoKey)) {
      throw new Error('Previously failed rule WhileClause at position ' + __memoStart);
    }
    if (this.eventHandler && typeof this.eventHandler.startNonterminal === 'function') {
      this.eventHandler.startNonterminal('WhileClause', this.position);
    }
    let __ok = false;
    try {
    this.consume('TOKEN_while');
    this.parseCompoundList();
    this.parseDoGroup();

      __ok = true;
    } finally {
      if (!__ok) {
        this.failureMemo.add(__memoKey);
      }
      if (this.eventHandler) {
        if (__ok && typeof this.eventHandler.endNonterminal === 'function') {
          this.eventHandler.endNonterminal('WhileClause', this.position);
        }
        if (!__ok && typeof this.eventHandler.abortNonterminal === 'function') {
          this.eventHandler.abortNonterminal('WhileClause', this.position);
        }
      }
    }
  }
  parseUntilClause() {
    const __memoStart = this.position;
    const __memoKey = 'UntilClause@' + __memoStart;
    if (this.failureMemo.has(__memoKey)) {
      throw new Error('Previously failed rule UntilClause at position ' + __memoStart);
    }
    if (this.eventHandler && typeof this.eventHandler.startNonterminal === 'function') {
      this.eventHandler.startNonterminal('UntilClause', this.position);
    }
    let __ok = false;
    try {
    this.consume('TOKEN_until');
    this.parseCompoundList();
    this.parseDoGroup();

      __ok = true;
    } finally {
      if (!__ok) {
        this.failureMemo.add(__memoKey);
      }
      if (this.eventHandler) {
        if (__ok && typeof this.eventHandler.endNonterminal === 'function') {
          this.eventHandler.endNonterminal('UntilClause', this.position);
        }
        if (!__ok && typeof this.eventHandler.abortNonterminal === 'function') {
          this.eventHandler.abortNonterminal('UntilClause', this.position);
        }
      }
    }
  }
  parseForClause() {
    const __memoStart = this.position;
    const __memoKey = 'ForClause@' + __memoStart;
    if (this.failureMemo.has(__memoKey)) {
      throw new Error('Previously failed rule ForClause at position ' + __memoStart);
    }
    if (this.eventHandler && typeof this.eventHandler.startNonterminal === 'function') {
      this.eventHandler.startNonterminal('ForClause', this.position);
    }
    let __ok = false;
    try {
    this.consume('TOKEN_for');
    this.parseName();
    this.parseLinebreak();
    // Group ?
    {
      const _optStart = this.position;
      const _optMark = this.markEventState();
      try {
    this.consume('TOKEN_in');
    // Optional: try parsing WordList
    {
      const savePos = this.position;
      const saveMark = this.markEventState();
      try {
        this.parseWordList();
      } catch(e) {
        this.position = savePos;
        this.restoreEventState(saveMark);
      }
    }
      } catch (e) {
        this.position = _optStart;
        this.restoreEventState(_optMark);
      }
    }
    // Group
    {
      let _matchedAlt = false;
      if (!_matchedAlt) {
        const _altStart = this.position;
        const _altMark = this.markEventState();
        try {
    this.parseSequentialSeparator();
          _matchedAlt = true;
        } catch (e) {
          this.position = _altStart;
          this.restoreEventState(_altMark);
        }
      }
      if (!_matchedAlt) {
        const _altStart = this.position;
        const _altMark = this.markEventState();
        try {
    this.parseLinebreak();
          _matchedAlt = true;
        } catch (e) {
          this.position = _altStart;
          this.restoreEventState(_altMark);
        }
      }
      if (!_matchedAlt) { throw new Error('No group alternative matched'); }
    }
    this.parseDoGroup();

      __ok = true;
    } finally {
      if (!__ok) {
        this.failureMemo.add(__memoKey);
      }
      if (this.eventHandler) {
        if (__ok && typeof this.eventHandler.endNonterminal === 'function') {
          this.eventHandler.endNonterminal('ForClause', this.position);
        }
        if (!__ok && typeof this.eventHandler.abortNonterminal === 'function') {
          this.eventHandler.abortNonterminal('ForClause', this.position);
        }
      }
    }
  }
  parseDoGroup() {
    const __memoStart = this.position;
    const __memoKey = 'DoGroup@' + __memoStart;
    if (this.failureMemo.has(__memoKey)) {
      throw new Error('Previously failed rule DoGroup at position ' + __memoStart);
    }
    if (this.eventHandler && typeof this.eventHandler.startNonterminal === 'function') {
      this.eventHandler.startNonterminal('DoGroup', this.position);
    }
    let __ok = false;
    try {
    this.consume('TOKEN_do');
    this.parseCompoundList();
    this.consume('TOKEN_done');

      __ok = true;
    } finally {
      if (!__ok) {
        this.failureMemo.add(__memoKey);
      }
      if (this.eventHandler) {
        if (__ok && typeof this.eventHandler.endNonterminal === 'function') {
          this.eventHandler.endNonterminal('DoGroup', this.position);
        }
        if (!__ok && typeof this.eventHandler.abortNonterminal === 'function') {
          this.eventHandler.abortNonterminal('DoGroup', this.position);
        }
      }
    }
  }
  parseCompoundList() {
    const __memoStart = this.position;
    const __memoKey = 'CompoundList@' + __memoStart;
    if (this.failureMemo.has(__memoKey)) {
      throw new Error('Previously failed rule CompoundList at position ' + __memoStart);
    }
    if (this.eventHandler && typeof this.eventHandler.startNonterminal === 'function') {
      this.eventHandler.startNonterminal('CompoundList', this.position);
    }
    let __ok = false;
    try {
    this.parseLinebreak();
    this.parseTerm();
    // Optional: try parsing Separator
    {
      const savePos = this.position;
      const saveMark = this.markEventState();
      try {
        this.parseSeparator();
      } catch(e) {
        this.position = savePos;
        this.restoreEventState(saveMark);
      }
    }

      __ok = true;
    } finally {
      if (!__ok) {
        this.failureMemo.add(__memoKey);
      }
      if (this.eventHandler) {
        if (__ok && typeof this.eventHandler.endNonterminal === 'function') {
          this.eventHandler.endNonterminal('CompoundList', this.position);
        }
        if (!__ok && typeof this.eventHandler.abortNonterminal === 'function') {
          this.eventHandler.abortNonterminal('CompoundList', this.position);
        }
      }
    }
  }
  parseTerm() {
    const __memoStart = this.position;
    const __memoKey = 'Term@' + __memoStart;
    if (this.failureMemo.has(__memoKey)) {
      throw new Error('Previously failed rule Term at position ' + __memoStart);
    }
    if (this.eventHandler && typeof this.eventHandler.startNonterminal === 'function') {
      this.eventHandler.startNonterminal('Term', this.position);
    }
    let __ok = false;
    try {
    this.parseAndOr();
    // Group *
    while (true) {
      const _loopStart = this.position;
      const _loopMark = this.markEventState();
      try {
    this.parseSeparator();
    this.parseAndOr();
      } catch (e) {
        this.position = _loopStart;
        this.restoreEventState(_loopMark);
        break;
      }
      if (this.position === _loopStart) break;
    }

      __ok = true;
    } finally {
      if (!__ok) {
        this.failureMemo.add(__memoKey);
      }
      if (this.eventHandler) {
        if (__ok && typeof this.eventHandler.endNonterminal === 'function') {
          this.eventHandler.endNonterminal('Term', this.position);
        }
        if (!__ok && typeof this.eventHandler.abortNonterminal === 'function') {
          this.eventHandler.abortNonterminal('Term', this.position);
        }
      }
    }
  }
  parseSeparator() {
    const __memoStart = this.position;
    const __memoKey = 'Separator@' + __memoStart;
    if (this.failureMemo.has(__memoKey)) {
      throw new Error('Previously failed rule Separator at position ' + __memoStart);
    }
    if (this.eventHandler && typeof this.eventHandler.startNonterminal === 'function') {
      this.eventHandler.startNonterminal('Separator', this.position);
    }
    let __ok = false;
    try {
    const _ruleStart = this.position;
    let _matched = false;
    if (!_matched) {
      const _ruleMark = this.markEventState();
      try {
    this.parseSeparatorOp();
        _matched = true;
      } catch (e) {
        this.position = _ruleStart;
        this.restoreEventState(_ruleMark);
      }
    }
    if (!_matched) {
      const _ruleMark = this.markEventState();
      try {
    this.parseNewlineList();
        _matched = true;
      } catch (e) {
        this.position = _ruleStart;
        this.restoreEventState(_ruleMark);
      }
    }
    if (!_matched) {
      throw new Error(`Expected one of: 2 alternatives`);
    }

      __ok = true;
    } finally {
      if (!__ok) {
        this.failureMemo.add(__memoKey);
      }
      if (this.eventHandler) {
        if (__ok && typeof this.eventHandler.endNonterminal === 'function') {
          this.eventHandler.endNonterminal('Separator', this.position);
        }
        if (!__ok && typeof this.eventHandler.abortNonterminal === 'function') {
          this.eventHandler.abortNonterminal('Separator', this.position);
        }
      }
    }
  }
  parseSeparatorOp() {
    const __memoStart = this.position;
    const __memoKey = 'SeparatorOp@' + __memoStart;
    if (this.failureMemo.has(__memoKey)) {
      throw new Error('Previously failed rule SeparatorOp at position ' + __memoStart);
    }
    if (this.eventHandler && typeof this.eventHandler.startNonterminal === 'function') {
      this.eventHandler.startNonterminal('SeparatorOp', this.position);
    }
    let __ok = false;
    try {
    // Group
    {
      let _matchedAlt = false;
      if (!_matchedAlt) {
        const _altStart = this.position;
        const _altMark = this.markEventState();
        try {
    this.consume('TOKEN__3B_');
          _matchedAlt = true;
        } catch (e) {
          this.position = _altStart;
          this.restoreEventState(_altMark);
        }
      }
      if (!_matchedAlt) {
        const _altStart = this.position;
        const _altMark = this.markEventState();
        try {
    this.consume('TOKEN__26_');
          _matchedAlt = true;
        } catch (e) {
          this.position = _altStart;
          this.restoreEventState(_altMark);
        }
      }
      if (!_matchedAlt) { throw new Error('No group alternative matched'); }
    }
    this.parseLinebreak();

      __ok = true;
    } finally {
      if (!__ok) {
        this.failureMemo.add(__memoKey);
      }
      if (this.eventHandler) {
        if (__ok && typeof this.eventHandler.endNonterminal === 'function') {
          this.eventHandler.endNonterminal('SeparatorOp', this.position);
        }
        if (!__ok && typeof this.eventHandler.abortNonterminal === 'function') {
          this.eventHandler.abortNonterminal('SeparatorOp', this.position);
        }
      }
    }
  }
  parseSequentialSeparator() {
    const __memoStart = this.position;
    const __memoKey = 'SequentialSeparator@' + __memoStart;
    if (this.failureMemo.has(__memoKey)) {
      throw new Error('Previously failed rule SequentialSeparator at position ' + __memoStart);
    }
    if (this.eventHandler && typeof this.eventHandler.startNonterminal === 'function') {
      this.eventHandler.startNonterminal('SequentialSeparator', this.position);
    }
    let __ok = false;
    try {
    const _ruleStart = this.position;
    let _matched = false;
    if (!_matched) {
      const _ruleMark = this.markEventState();
      try {
    this.consume('TOKEN__3B_');
    this.parseLinebreak();
        _matched = true;
      } catch (e) {
        this.position = _ruleStart;
        this.restoreEventState(_ruleMark);
      }
    }
    if (!_matched) {
      const _ruleMark = this.markEventState();
      try {
    this.parseNewlineList();
        _matched = true;
      } catch (e) {
        this.position = _ruleStart;
        this.restoreEventState(_ruleMark);
      }
    }
    if (!_matched) {
      throw new Error(`Expected one of: 2 alternatives`);
    }

      __ok = true;
    } finally {
      if (!__ok) {
        this.failureMemo.add(__memoKey);
      }
      if (this.eventHandler) {
        if (__ok && typeof this.eventHandler.endNonterminal === 'function') {
          this.eventHandler.endNonterminal('SequentialSeparator', this.position);
        }
        if (!__ok && typeof this.eventHandler.abortNonterminal === 'function') {
          this.eventHandler.abortNonterminal('SequentialSeparator', this.position);
        }
      }
    }
  }
  parseLinebreak() {
    const __memoStart = this.position;
    const __memoKey = 'Linebreak@' + __memoStart;
    if (this.failureMemo.has(__memoKey)) {
      throw new Error('Previously failed rule Linebreak at position ' + __memoStart);
    }
    if (this.eventHandler && typeof this.eventHandler.startNonterminal === 'function') {
      this.eventHandler.startNonterminal('Linebreak', this.position);
    }
    let __ok = false;
    try {
    while (this.match('NEWLINE')) { /* zero or more */ }

      __ok = true;
    } finally {
      if (!__ok) {
        this.failureMemo.add(__memoKey);
      }
      if (this.eventHandler) {
        if (__ok && typeof this.eventHandler.endNonterminal === 'function') {
          this.eventHandler.endNonterminal('Linebreak', this.position);
        }
        if (!__ok && typeof this.eventHandler.abortNonterminal === 'function') {
          this.eventHandler.abortNonterminal('Linebreak', this.position);
        }
      }
    }
  }
  parseNewlineList() {
    const __memoStart = this.position;
    const __memoKey = 'NewlineList@' + __memoStart;
    if (this.failureMemo.has(__memoKey)) {
      throw new Error('Previously failed rule NewlineList at position ' + __memoStart);
    }
    if (this.eventHandler && typeof this.eventHandler.startNonterminal === 'function') {
      this.eventHandler.startNonterminal('NewlineList', this.position);
    }
    let __ok = false;
    try {
    this.consume('NEWLINE');
    while (this.match('NEWLINE')) { /* one or more */ }

      __ok = true;
    } finally {
      if (!__ok) {
        this.failureMemo.add(__memoKey);
      }
      if (this.eventHandler) {
        if (__ok && typeof this.eventHandler.endNonterminal === 'function') {
          this.eventHandler.endNonterminal('NewlineList', this.position);
        }
        if (!__ok && typeof this.eventHandler.abortNonterminal === 'function') {
          this.eventHandler.abortNonterminal('NewlineList', this.position);
        }
      }
    }
  }
  parseWordList() {
    const __memoStart = this.position;
    const __memoKey = 'WordList@' + __memoStart;
    if (this.failureMemo.has(__memoKey)) {
      throw new Error('Previously failed rule WordList at position ' + __memoStart);
    }
    if (this.eventHandler && typeof this.eventHandler.startNonterminal === 'function') {
      this.eventHandler.startNonterminal('WordList', this.position);
    }
    let __ok = false;
    try {
    let count = 0;
    while (true) {
      const savePos = this.position;
      const saveMark = this.markEventState();
      try {
        this.parseWord();
        if (this.position === savePos) break;
        count++;
      } catch(e) {
        this.position = savePos;
        this.restoreEventState(saveMark);
        break;
      }
    }
    if (count === 0) {
      throw new Error('Expected at least one Word');
    }

      __ok = true;
    } finally {
      if (!__ok) {
        this.failureMemo.add(__memoKey);
      }
      if (this.eventHandler) {
        if (__ok && typeof this.eventHandler.endNonterminal === 'function') {
          this.eventHandler.endNonterminal('WordList', this.position);
        }
        if (!__ok && typeof this.eventHandler.abortNonterminal === 'function') {
          this.eventHandler.abortNonterminal('WordList', this.position);
        }
      }
    }
  }
  parseName() {
    const __memoStart = this.position;
    const __memoKey = 'Name@' + __memoStart;
    if (this.failureMemo.has(__memoKey)) {
      throw new Error('Previously failed rule Name at position ' + __memoStart);
    }
    if (this.eventHandler && typeof this.eventHandler.startNonterminal === 'function') {
      this.eventHandler.startNonterminal('Name', this.position);
    }
    let __ok = false;
    try {
    this.consumeContextual('NAME');

      __ok = true;
    } finally {
      if (!__ok) {
        this.failureMemo.add(__memoKey);
      }
      if (this.eventHandler) {
        if (__ok && typeof this.eventHandler.endNonterminal === 'function') {
          this.eventHandler.endNonterminal('Name', this.position);
        }
        if (!__ok && typeof this.eventHandler.abortNonterminal === 'function') {
          this.eventHandler.abortNonterminal('Name', this.position);
        }
      }
    }
  }
  parseWord() {
    const __memoStart = this.position;
    const __memoKey = 'Word@' + __memoStart;
    if (this.failureMemo.has(__memoKey)) {
      throw new Error('Previously failed rule Word at position ' + __memoStart);
    }
    if (this.eventHandler && typeof this.eventHandler.startNonterminal === 'function') {
      this.eventHandler.startNonterminal('Word', this.position);
    }
    let __ok = false;
    try {
    const _ruleStart = this.position;
    let _matched = false;
    if (!_matched) {
      const _ruleMark = this.markEventState();
      try {
    this.consume('WORD');
        _matched = true;
      } catch (e) {
        this.position = _ruleStart;
        this.restoreEventState(_ruleMark);
      }
    }
    if (!_matched) {
      const _ruleMark = this.markEventState();
      try {
    this.consume('IO_NUMBER');
        _matched = true;
      } catch (e) {
        this.position = _ruleStart;
        this.restoreEventState(_ruleMark);
      }
    }
    if (!_matched) {
      const _ruleMark = this.markEventState();
      try {
    this.consume('ASSIGNMENT_WORD');
        _matched = true;
      } catch (e) {
        this.position = _ruleStart;
        this.restoreEventState(_ruleMark);
      }
    }
    if (!_matched) {
      throw new Error(`Expected one of: 3 alternatives`);
    }

      __ok = true;
    } finally {
      if (!__ok) {
        this.failureMemo.add(__memoKey);
      }
      if (this.eventHandler) {
        if (__ok && typeof this.eventHandler.endNonterminal === 'function') {
          this.eventHandler.endNonterminal('Word', this.position);
        }
        if (!__ok && typeof this.eventHandler.abortNonterminal === 'function') {
          this.eventHandler.abortNonterminal('Word', this.position);
        }
      }
    }
  }
}

module.exports = Parser;
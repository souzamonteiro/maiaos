// Tiny educational WASM *function-body* interpreter, NOT a module loader.
// Supports i32.const, local.get, i32.add, end. Not WASM 3.0 compliant.
export function runBody(body, locals = [], maxInstructions = 1000) {
  const stack = [];
  let pc = 0;
  let count = 0;
  function readU32() {
    let result = 0;
    let shift = 0;
    for (let i = 0; i < 5; i++) {
      if (pc >= body.length) throw new Error('truncated LEB');
      const b = body[pc++];
      result |= (b & 0x7f) << shift;
      if ((b & 0x80) === 0) return result >>> 0;
      shift += 7;
    }
    throw new Error('invalid u32 LEB');
  }
  function readI32() {
    let result = 0;
    let shift = 0;
    let b = 0;
    for (let i = 0; i < 5; i++) {
      if (pc >= body.length) throw new Error('truncated LEB');
      b = body[pc++];
      result |= (b & 0x7f) << shift;
      shift += 7;
      if ((b & 0x80) === 0) {
        if (shift < 32 && (b & 0x40)) result |= (~0 << shift);
        return result | 0;
      }
    }
    throw new Error('invalid i32 LEB');
  }
  while (pc < body.length) {
    if (++count > maxInstructions) throw new Error('fuel exhausted');
    const op = body[pc++];
    if (op === 0x41) stack.push(readI32());
    else if (op === 0x20) {
      const index = readU32();
      if (index >= locals.length) throw new Error('invalid local');
      stack.push(locals[index] | 0);
    } else if (op === 0x6a) {
      if (stack.length < 2) throw new Error('stack underflow');
      const b = stack.pop(), a = stack.pop();
      stack.push((a + b) | 0);
    } else if (op === 0x0b) {
      if (pc !== body.length || stack.length !== 1) throw new Error('invalid result');
      return stack[0];
    } else throw new Error(`unsupported opcode 0x${op.toString(16)}`);
  }
  throw new Error('missing end');
}

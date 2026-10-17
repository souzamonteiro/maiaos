import test from 'node:test';
import assert from 'node:assert/strict';
import { runBody } from '../runtime/experimental/mini-vm.js';
test('constant addition', () => assert.equal(runBody(Uint8Array.from([0x41, 10, 0x41, 20, 0x6a, 0x0b])), 30));
test('local addition', () => assert.equal(runBody(Uint8Array.from([0x20, 0, 0x20, 1, 0x6a, 0x0b]), [12, 18]), 30));
test('negative i32 constant', () => assert.equal(runBody(Uint8Array.from([0x41, 0x7f, 0x0b])), -1));
test('unknown opcode rejected', () => assert.throws(() => runBody(Uint8Array.from([0xff, 0x0b])), /unsupported/));
test('fuel exhausted', () => assert.throws(() => runBody(Uint8Array.from([0x41, 1, 0x0b]), [], 1), /fuel/));
test('truncated immediate rejected', () => assert.throws(() => runBody(Uint8Array.from([0x41, 0x80])), /truncated/));

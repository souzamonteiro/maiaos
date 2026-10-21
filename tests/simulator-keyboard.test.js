import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";

// Exercise the actual browser host's key listeners in isolation. This is a
// focus/routing unit test, not evidence of DOM rendering or a browser smoke run.
const source = readFileSync(new URL("../platform/desktop-web/main.js", import.meta.url), "utf8");
const begin = source.indexOf('  window.addEventListener("keydown",');
const end = source.indexOf("  screen.focus();", begin);
assert.ok(begin >= 0 && end > begin, "Browser key listeners must be identifiable");
const listenersSource = source.slice(begin, end);

function harness({ focused = false, shell = false } = {}) {
  const listeners = {}, forwarded = [];
  const screen = {};
  runInNewContext(listenersSource, {
    window: { addEventListener: (type, listener) => { listeners[type] = listener; } },
    document: { activeElement: focused ? screen : {} },
    screen,
    keyboardTargetProcess: () => shell ? {} : null,
    routeKeyboardEvent: event => {
      if (!shell) return false;
      event.preventDefault(); forwarded.push(["shell", event.key]); return true;
    },
    lvglModule: { _maiaos_lvgl_key: (key, pressed) => forwarded.push(["lvgl", key, pressed]) },
  });
  function send(type, key) {
    let prevented = false;
    listeners[type]({ key, preventDefault: () => { prevented = true; } });
    return prevented;
  }
  return { send, forwarded };
}

test("simulator controls keep Enter and Tab when the display is unfocused", () => {
  for (const shell of [false, true]) {
    const host = harness({ shell });
    for (const type of ["keydown", "keyup"]) for (const key of ["Enter", "Tab"]) {
      assert.equal(host.send(type, key), false);
    }
    assert.deepEqual(host.forwarded, []);
  }
});

test("focused display forwards LVGL navigation with press and release", () => {
  const host = harness({ focused: true });
  for (const key of ["Enter", "Tab"]) {
    assert.equal(host.send("keydown", key), true);
    assert.equal(host.send("keyup", key), true);
  }
  assert.deepEqual(host.forwarded, [["lvgl", 1, 1], ["lvgl", 1, 0], ["lvgl", 2, 1], ["lvgl", 2, 0]]);
});

test("focused shell handles Enter without duplicate LVGL navigation", () => {
  const host = harness({ focused: true, shell: true });
  assert.equal(host.send("keydown", "Enter"), true);
  assert.equal(host.send("keyup", "Enter"), false);
  assert.deepEqual(host.forwarded, [["shell", "Enter"]]);
});

// Tests for the mobile terminal key toolbar: the main row and the separate,
// independently toggled control-key row (^C ^D ^Z ...).
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { load, cleanupAll, jsonResponse } from "./harness.mjs";

after(() => cleanupAll());

// jsdom has no PointerEvent, and the key row only needs the coordinates it
// reads from the gesture, so dispatch a generic Event carrying them.
function pointer(window, type, target, props = {}) {
  const ev = new window.Event(type, { bubbles: true, cancelable: true });
  Object.assign(ev, props);
  target.dispatchEvent(ev);
  return ev;
}

test("the control row starts collapsed and off the stored default", () => {
  const { api, document } = load();
  assert.equal(api.ctrlKeysVisible(), false, "default is collapsed");
  assert.equal(document.getElementById("keys-ctrl").hidden, true);
  assert.equal(
    document.getElementById("keys-more").getAttribute("aria-expanded"),
    "false"
  );
});

test("the more button expands and collapses the control row", () => {
  const { api, document } = load();
  const more = document.getElementById("keys-more");
  const ctrl = document.getElementById("keys-ctrl");

  more.click();
  assert.equal(ctrl.hidden, false, "first click expands");
  assert.equal(more.getAttribute("aria-expanded"), "true");
  assert.equal(api.ctrlKeysVisible(), true, "state is persisted");

  more.click();
  assert.equal(ctrl.hidden, true, "second click collapses");
  assert.equal(more.getAttribute("aria-expanded"), "false");
});

test("the control row expands automatically from the stored preference", () => {
  const { document } = load([], {
    beforeEval: (w) => w.localStorage.setItem("dominion.ctrlkeys", "1"),
  });
  assert.equal(document.getElementById("keys-ctrl").hidden, false);
  assert.equal(
    document.getElementById("keys-more").getAttribute("aria-expanded"),
    "true"
  );
});

test("control keys live in the extra row, main keys in the main row", () => {
  const { document } = load();
  const ctrl = document.getElementById("keys-ctrl");
  const main = document.getElementById("keys-main");

  for (const key of ["ctrl-c", "ctrl-d", "ctrl-r"]) {
    assert.ok(
      ctrl.querySelector(`[data-key="${key}"]`),
      `${key} belongs to the control row`
    );
  }
  for (const key of ["esc", "btab", "tab", "enter", "bs", "left"]) {
    assert.ok(
      main.querySelector(`[data-key="${key}"]`),
      `${key} stays in the main row`
    );
  }
});

test("the key rows lead with Shift+Tab, Tab and the arrows", () => {
  const { document } = load();
  const rows = document.querySelectorAll("#keys-main .keys-row");
  const nav = [...rows[0].querySelectorAll("button.key")].map((b) => b.dataset.key);
  assert.deepEqual(nav, ["btab", "tab", "left", "up", "down", "right"]);

  const editing = [...rows[1].querySelectorAll("button.key")].map(
    (b) => b.dataset.key || b.dataset.mod || b.id
  );
  assert.deepEqual(editing, ["esc", "ctrl", "alt", "ctrl-c", "bs", "enter", "keys-more"]);
});

test("armed modifiers rewrite cursor keys with xterm CSI parameters", () => {
  const { api } = load();
  assert.equal(api.keySequence("left"), "\x1b[D");
  api.setMod("ctrl", true);
  assert.equal(api.keySequence("left"), "\x1b[1;5D");
  api.setMod("alt", true);
  assert.equal(api.keySequence("down"), "\x1b[1;7B");
  api.setMod("ctrl", false);
  assert.equal(api.keySequence("up"), "\x1b[1;3A");
  assert.equal(api.keySequence("pgup"), "\x1b[5;3~");
  api.clearMods();
  assert.equal(api.keySequence("pgup"), "\x1b[5~");
});

test("a locked modifier survives typed input, a one-shot does not", () => {
  const { api, document } = load();
  const ctrl = document.querySelector('.key-mod[data-mod="ctrl"]');

  api.setMod("ctrl", true, true);
  assert.ok(ctrl.classList.contains("locked"), "locked modifiers are marked");
  assert.equal(api.applyModifiers("a"), "\x01");
  assert.ok(api.activeMods.has("ctrl"), "lock persists across a key");
  assert.ok(api.lockedMods.has("ctrl"));

  api.setMod("alt", true);
  api.applyModifiers("b");
  assert.ok(!api.activeMods.has("alt"), "one-shot modifiers clear after a key");
  assert.ok(api.activeMods.has("ctrl"), "the lock is untouched");

  api.clearMods();
  assert.equal(ctrl.classList.contains("locked"), false);
  assert.equal(ctrl.classList.contains("armed"), false);
});

test("a held arrow repeats until release", async () => {
  const decoder = new TextDecoder();
  // Keep the periodic session poll from tearing the tab down while we wait.
  const session = { name: "a", windows: 1, attached: false };
  const { api, document, window, tick } = load([
    {
      match: (p) => p === "/api/sessions",
      respond: () => jsonResponse(200, { sessions: [session] }),
    },
  ]);
  api.applySessions({ sessions: [session] });
  const tab = api.state.tabs.get("a");
  tab.ws.readyState = 1;
  const btn = document.querySelector('#keys-main [data-key="left"]');

  pointer(window, "pointerdown", btn, { clientY: 200 });
  await tick(430);
  const held = tab.ws.sent.length;
  assert.ok(held >= 1, "holding sends before release");

  pointer(window, "pointerup", btn, { clientY: 200 });
  await tick(200);
  assert.equal(tab.ws.sent.length, held, "release stops the repeat");

  const bytes = tab.ws.sent.map((b) => decoder.decode(b)).join("");
  assert.ok(bytes.startsWith("\x1b[D"), "repeats send the arrow sequence");
  api.stopPolling();
});

test("swiping up on an arrow sends its popup key", () => {
  const decoder = new TextDecoder();
  const { api, document, window } = load();
  api.applySessions({ sessions: [{ name: "a", windows: 1, attached: false }] });
  const tab = api.state.tabs.get("a");
  tab.ws.readyState = 1;
  const btn = document.querySelector('#keys-main [data-key="right"]');

  pointer(window, "pointerdown", btn, { clientY: 200 });
  pointer(window, "pointermove", btn, { clientY: 170 });
  assert.ok(btn.querySelector(".key-popup"), "the popup key is shown");

  pointer(window, "pointerup", btn, { clientY: 170 });
  const bytes = tab.ws.sent.map((b) => decoder.decode(b)).join("");
  assert.equal(bytes, "\x1b[F", "the popup sends End");
  assert.equal(btn.querySelector(".key-popup"), null, "the chip is removed");
  api.stopPolling();
});

test("the shift+tab key sits left of Tab and sends the backtab sequence", () => {
  const decoder = new TextDecoder();
  const { api, document } = load();
  const btab = document.querySelector('#keys-main [data-key="btab"]');
  const tabBtn = document.querySelector('#keys-main [data-key="tab"]');
  assert.equal(tabBtn.previousElementSibling, btab, "it sits left of Tab");

  api.applySessions({ sessions: [{ name: "a", windows: 1, attached: false }] });
  const tab = api.state.tabs.get("a");
  tab.ws.readyState = 1;

  btab.click();

  const bytes = tab.ws.sent.map((b) => decoder.decode(b)).join("");
  assert.equal(bytes, "\x1b[Z");
  api.stopPolling();
});

test("a control key tapped in the extra row still sends its sequence", () => {
  const decoder = new TextDecoder();
  const { api, document } = load();
  api.applySessions({ sessions: [{ name: "a", windows: 1, attached: false }] });
  const tab = api.state.tabs.get("a");
  tab.ws.readyState = 1;

  document.getElementById("keys-more").click();
  document.querySelector('#keys-ctrl [data-key="ctrl-c"]').click();

  const bytes = tab.ws.sent.map((b) => decoder.decode(b)).join("");
  assert.equal(bytes, "\x03");
  api.stopPolling();
});

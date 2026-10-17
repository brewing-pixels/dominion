// Tests for sizing the app to the visual viewport. A mobile soft keyboard
// shrinks the visual viewport but leaves the layout viewport alone, so without
// this the terminal and the key row sit behind the keyboard.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { load, cleanupAll } from "./harness.mjs";

after(() => cleanupAll());

function loadWithViewport(height) {
  return load([], {
    beforeEval: (w) => {
      const vv = new w.EventTarget();
      vv.height = height;
      Object.defineProperty(w, "visualViewport", { configurable: true, value: vv });
      w.__vv = vv;
    },
  });
}

test("the app height follows the visual viewport", async () => {
  const { document, window, tick } = loadWithViewport(500);
  const height = () =>
    document.documentElement.style.getPropertyValue("--app-height");

  assert.equal(height(), "500px", "the initial height is applied");

  window.__vv.height = 320; // the soft keyboard opened
  window.__vv.dispatchEvent(new window.Event("resize"));
  await tick(120);
  assert.equal(height(), "320px", "the app shrinks above the keyboard");

  window.__vv.height = 700; // the keyboard closed
  window.__vv.dispatchEvent(new window.Event("scroll"));
  await tick(120);
  assert.equal(height(), "700px", "the app expands again");
});

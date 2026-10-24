import { test } from "node:test";
import * as assert from "node:assert/strict";
import { èModello } from "../src/ui/chat/testi";

test("èModello: un id non è il prefisso di un altro (#834)", () => {
  assert.equal(èModello("claude-opus-4-1", "claude-opus-4"), false);
  assert.equal(èModello("claude-opus-4-1", "claude-opus-4-1"), true);
  assert.equal(èModello("claude-opus-4-1-20250805", "claude-opus-4-1"), true);
  assert.equal(èModello("claude-opus-5-5[1m]", "claude-opus-5-5"), true);
  assert.equal(èModello(null, "claude-opus-4"), false);
});

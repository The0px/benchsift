import assert from "node:assert/strict";
import test from "node:test";

import { errorReason } from "./logger.ts";

test("errorReason returns the network code from a nested cause", () => {
  const network = Object.assign(new Error("connect failed to https://example.test?key=secret"), { code: "ConnectionRefused" });
  const wrapped = new Error("Artificial Analysis /x failed for all configured API keys", {
    cause: new Error("key 1/2", { cause: network }),
  });
  assert.equal(errorReason(wrapped), "ConnectionRefused");
});

test("errorReason keeps a specific error name such as a timeout", () => {
  assert.equal(errorReason(new DOMException("The operation timed out.", "TimeoutError")), "TimeoutError");
});

test("errorReason never returns a message or an unsafe code", () => {
  assert.equal(errorReason(new Error("https://example.test/api?key=secret")), undefined);
  assert.equal(errorReason(Object.assign(new Error("x"), { code: "bad code/with spaces" })), undefined);
  assert.equal(errorReason("plain string"), undefined);
  assert.equal(errorReason(null), undefined);
});

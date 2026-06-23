import test from "node:test";
import assert from "node:assert/strict";
import { can, isAdmin } from "../src/lib/permissions";

test("admin can perform every protected action", () => {
  assert.equal(can("admin", "users.manage"), true);
  assert.equal(can("admin", "data.export"), true);
  assert.equal(can("admin", "data.import"), true);
  assert.equal(can("admin", "contacts.delete"), true);
  assert.equal(can("admin", "corrections.write"), true);
  assert.equal(can("admin", "hubspot.view"), true);
  assert.equal(isAdmin("admin"), true);
});

test("ldr can import and correct, but cannot manage sensitive areas", () => {
  assert.equal(can("ldr", "data.import"), true);
  assert.equal(can("ldr", "corrections.write"), true);
  assert.equal(can("ldr", "hubspot.view"), false);
  assert.equal(can("ldr", "data.export"), false);
  assert.equal(can("ldr", "contacts.delete"), false);
  assert.equal(can("ldr", "users.manage"), false);
  assert.equal(isAdmin("ldr"), false);
});

test("missing roles are denied", () => {
  assert.equal(can(undefined, "data.import"), false);
  assert.equal(can(null, "data.import"), false);
  assert.equal(isAdmin(undefined), false);
});

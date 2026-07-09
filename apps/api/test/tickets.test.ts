import { test } from "node:test";
import assert from "node:assert/strict";
import { Store } from "../src/store.js";

function makeTicket(store: Store) {
  return store.createTicket({
    title: "t",
    description: "d",
    assigneeRole: "frontend",
    projectId: "p",
  });
}

test("tickets start in todo and advance one state at a time", () => {
  const store = new Store();
  const ticket = makeTicket(store);
  assert.equal(ticket.status, "todo");

  const r1 = store.transitionTicket(ticket.id, "in_progress");
  assert.ok(r1.ok && r1.ticket.status === "in_progress");
  const r2 = store.transitionTicket(ticket.id, "review");
  assert.ok(r2.ok && r2.ticket.status === "review");
  const r3 = store.transitionTicket(ticket.id, "complete");
  assert.ok(r3.ok && r3.ticket.status === "complete");
});

test("skipping states is refused", () => {
  const store = new Store();
  const ticket = makeTicket(store);
  const result = store.transitionTicket(ticket.id, "complete");
  assert.equal(result.ok, false);
});

test("moving backwards is refused", () => {
  const store = new Store();
  const ticket = makeTicket(store);
  store.transitionTicket(ticket.id, "in_progress");
  const result = store.transitionTicket(ticket.id, "todo");
  assert.equal(result.ok, false);
});

test("complete is terminal", () => {
  const store = new Store();
  const ticket = makeTicket(store);
  store.transitionTicket(ticket.id, "in_progress");
  store.transitionTicket(ticket.id, "review");
  store.transitionTicket(ticket.id, "complete");
  const result = store.transitionTicket(ticket.id, "complete");
  assert.equal(result.ok, false);
});

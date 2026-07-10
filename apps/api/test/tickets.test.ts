import { test } from "node:test";
import assert from "node:assert/strict";
import { Store } from "../src/store.js";

async function makeTicket(store: Store) {
  return await store.createTicket({
    title: "t",
    description: "d",
    assigneeRole: "frontend",
    projectId: "p",
  });
}

test("tickets start in todo and advance one state at a time", async () => {
  const store = new Store();
  const ticket = await makeTicket(store);
  assert.equal(ticket.status, "todo");

  const r1 = await store.transitionTicket(ticket.id, "in_progress");
  assert.ok(r1.ok && r1.ticket.status === "in_progress");
  const r2 = await store.transitionTicket(ticket.id, "review");
  assert.ok(r2.ok && r2.ticket.status === "review");
  const r3 = await store.transitionTicket(ticket.id, "complete");
  assert.ok(r3.ok && r3.ticket.status === "complete");
});

test("skipping states is refused", async () => {
  const store = new Store();
  const ticket = await makeTicket(store);
  const result = await store.transitionTicket(ticket.id, "complete");
  assert.equal(result.ok, false);
});

test("moving backwards is refused", async () => {
  const store = new Store();
  const ticket = await makeTicket(store);
  await store.transitionTicket(ticket.id, "in_progress");
  const result = await store.transitionTicket(ticket.id, "todo");
  assert.equal(result.ok, false);
});

test("complete is terminal", async () => {
  const store = new Store();
  const ticket = await makeTicket(store);
  await store.transitionTicket(ticket.id, "in_progress");
  await store.transitionTicket(ticket.id, "review");
  await store.transitionTicket(ticket.id, "complete");
  const result = await store.transitionTicket(ticket.id, "complete");
  assert.equal(result.ok, false);
});

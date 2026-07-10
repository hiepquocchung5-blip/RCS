import { test } from "node:test";
import assert from "node:assert/strict";
import type { Role, SkillLevel } from "@rcs/shared";
import { Store } from "../src/store.js";

function user(store: Store, name: string, role: Role, skillLevel: SkillLevel) {
  return store.createUser({
    email: `${name}@rcs.dev`,
    name,
    role,
    skillLevel,
    password: "x".repeat(16),
  });
}

function makeProject(store: Store) {
  return store.createProject({
    name: "atlas",
    type: "web_app",
    description: "d",
    clientName: "Atlas Co",
    isPublic: false,
    techStack: ["Next.js"],
    resourceMatrix: [
      { role: "backend", skillLevel: "senior", count: 1 },
      { role: "frontend", skillLevel: "junior", count: 2 },
    ],
  });
}

test("candidates match unfilled matrix seats only", () => {
  const store = new Store();
  const project = makeProject(store);
  const seniorBackend = user(store, "sb", "backend", "senior");
  user(store, "jf1", "frontend", "junior");
  user(store, "if1", "frontend", "intern"); // no intern seat
  user(store, "sd1", "devops", "senior"); // no devops seat
  user(store, "pm1", "pm", "senior"); // PMs are not matrix resources

  const names = store.candidatesFor(project.id).map((c) => c.name).sort();
  assert.deepEqual(names, ["jf1", "sb"]);

  // Filling the senior backend seat removes matching candidates.
  const assigned = store.assignTeamMember(project.id, seniorBackend.id);
  assert.ok(assigned.ok);
  assert.deepEqual(
    store.candidatesFor(project.id).map((c) => c.name),
    ["jf1"],
  );
});

test("seat limits are enforced", () => {
  const store = new Store();
  const project = makeProject(store);
  const j1 = user(store, "j1", "frontend", "junior");
  const j2 = user(store, "j2", "frontend", "junior");
  const j3 = user(store, "j3", "frontend", "junior");
  assert.ok(store.assignTeamMember(project.id, j1.id).ok);
  assert.ok(store.assignTeamMember(project.id, j2.id).ok);
  const third = store.assignTeamMember(project.id, j3.id);
  assert.equal(third.ok, false); // only 2 junior frontend seats

  const mid = user(store, "m1", "frontend", "mid");
  const wrongLevel = store.assignTeamMember(project.id, mid.id);
  assert.equal(wrongLevel.ok, false); // matrix asks for juniors, not mids
});

test("duplicate assignment is refused and showcase hides private projects", () => {
  const store = new Store();
  const project = makeProject(store);
  const dev = user(store, "d1", "backend", "senior");
  assert.ok(store.assignTeamMember(project.id, dev.id).ok);
  assert.equal(store.assignTeamMember(project.id, dev.id).ok, false);

  assert.equal(store.listShowcase().length, 0); // isPublic=false
  store.createProject({
    name: "public-one",
    type: "ecommerce",
    description: "d",
    clientName: "c",
    isPublic: true,
    techStack: [],
    resourceMatrix: [],
  });
  const showcase = store.listShowcase();
  assert.equal(showcase.length, 1);
  assert.equal(showcase[0]?.name, "public-one");
});

import { test } from "node:test";
import assert from "node:assert/strict";
import type { Role, SkillLevel } from "@rcs/shared";
import { Store } from "../src/store.js";

async function user(store: Store, name: string, role: Role, skillLevel: SkillLevel) {
  return await store.createUser({
    email: `${name}@rcs.dev`,
    name,
    role,
    skillLevel,
    password: "x".repeat(16),
  });
}

async function makeProject(store: Store) {
  return await store.createProject({
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

test("candidates match unfilled matrix seats only", async () => {
  const store = new Store();
  const project = await makeProject(store);
  const seniorBackend = await user(store, "sb", "backend", "senior");
  await user(store, "jf1", "frontend", "junior");
  await user(store, "if1", "frontend", "intern"); // no intern seat
  await user(store, "sd1", "devops", "senior"); // no devops seat
  await user(store, "pm1", "pm", "senior"); // PMs are not matrix resources

  const candidates = await store.candidatesFor(project.id);
  const names = candidates.map((c) => c.name).sort();
  assert.deepEqual(names, ["jf1", "sb"]);

  // Filling the senior backend seat removes matching candidates.
  const assigned = await store.assignTeamMember(project.id, seniorBackend.id);
  assert.ok(assigned.ok);
  
  const updatedCandidates = await store.candidatesFor(project.id);
  assert.deepEqual(
    updatedCandidates.map((c) => c.name),
    ["jf1"],
  );
});

test("seat limits are enforced", async () => {
  const store = new Store();
  const project = await makeProject(store);
  const j1 = await user(store, "j1", "frontend", "junior");
  const j2 = await user(store, "j2", "frontend", "junior");
  const j3 = await user(store, "j3", "frontend", "junior");
  
  const assign1 = await store.assignTeamMember(project.id, j1.id);
  assert.ok(assign1.ok);
  const assign2 = await store.assignTeamMember(project.id, j2.id);
  assert.ok(assign2.ok);
  
  const third = await store.assignTeamMember(project.id, j3.id);
  assert.equal(third.ok, false); // only 2 junior frontend seats

  const mid = await user(store, "m1", "frontend", "mid");
  const wrongLevel = await store.assignTeamMember(project.id, mid.id);
  assert.equal(wrongLevel.ok, false); // matrix asks for juniors, not mids
});

test("duplicate assignment is refused and showcase hides private projects", async () => {
  const store = new Store();
  const project = await makeProject(store);
  const dev = await user(store, "d1", "backend", "senior");
  
  const assign1 = await store.assignTeamMember(project.id, dev.id);
  assert.ok(assign1.ok);
  const assign2 = await store.assignTeamMember(project.id, dev.id);
  assert.equal(assign2.ok, false);

  const showcase1 = await store.listShowcase();
  assert.equal(showcase1.length, 0); // isPublic=false
  await store.createProject({
    name: "public-one",
    type: "ecommerce",
    description: "d",
    clientName: "c",
    isPublic: true,
    techStack: [],
    resourceMatrix: [],
  });
  const showcase2 = await store.listShowcase();
  assert.equal(showcase2.length, 1);
  assert.equal(showcase2[0]?.name, "public-one");
});

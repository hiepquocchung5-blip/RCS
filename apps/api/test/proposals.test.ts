import { test } from "node:test";
import assert from "node:assert/strict";
import { Store } from "../src/store.js";

test("developer can create and list project proposals", async () => {
  const store = new Store();
  const dev = await store.createUser({
    email: "dev@risecorestudio.com",
    name: "Alex Dev",
    role: "frontend",
    skillLevel: "mid",
    password: "Password123!@#$",
  });

  const proposal = await store.createProposal({
    title: "AI Code Assistant",
    description: "An automated pair programmer widget for developers",
    projectType: "web_app",
    techStack: ["Next.js", "TypeScript", "Tailwind"],
    proposerId: dev.id,
    proposerName: dev.name,
  });

  assert.equal(proposal.status, "pending");
  assert.equal(proposal.title, "AI Code Assistant");

  const list = await store.listProposals(dev.id);
  assert.equal(list.length, 1);
  assert.equal(list[0].id, proposal.id);
});

test("admin approval converts proposal to project and assigns proposer", async () => {
  const store = new Store();
  const dev = await store.createUser({
    email: "dev2@risecorestudio.com",
    name: "Sam Dev",
    role: "backend",
    skillLevel: "senior",
    password: "Password123!@#$",
  });

  const proposal = await store.createProposal({
    title: "Realtime Analytics Microservice",
    description: "High throughput event ingestion service",
    projectType: "api_service",
    techStack: ["Go", "Kafka", "Postgres"],
    proposerId: dev.id,
    proposerName: dev.name,
  });

  const approved = await store.approveProposal(proposal.id);
  assert.ok(approved);
  assert.equal(approved.proposal.status, "approved");
  assert.equal(approved.project.name, "Realtime Analytics Microservice");

  const isOnTeam = await store.isOnTeam(approved.project.id, dev.id);
  assert.equal(isOnTeam, true);
});

test("proposal rejection marks status as rejected", async () => {
  const store = new Store();
  const dev = await store.createUser({
    email: "dev3@risecorestudio.com",
    name: "Jordan Dev",
    role: "devops",
    skillLevel: "mid",
    password: "Password123!@#$",
  });

  const proposal = await store.createProposal({
    title: "Experimental Tool",
    description: "Internal proof of concept",
    projectType: "cli_tool",
    techStack: ["Rust"],
    proposerId: dev.id,
    proposerName: dev.name,
  });

  const rejected = await store.rejectProposal(proposal.id);
  assert.ok(rejected);
  assert.equal(rejected.status, "rejected");
});

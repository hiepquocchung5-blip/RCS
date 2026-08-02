import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import request from "supertest";
import { Store } from "../src/store.js";
import { stockRoutes } from "../src/routes/stock.js";
import { signSessionToken } from "../src/auth/tokens.js";
import type { ApiConfig } from "../src/config.js";

const secret = "stock-test-secret";
const config: ApiConfig = {
  port: 0,
  apiBaseUrl: "http://localhost",
  jwtSecret: secret,
  redisUrl: null,
  databaseUrl: null,
  githubWebhookSecret: null,
  webOrigins: ["http://localhost"],
  isProduction: false,
};

function bearer(user: { id: string; email: string; role: string }): string {
  return `Bearer ${signSessionToken(secret, { sub: user.id, email: user.email, role: user.role })}`;
}

test("stock routes enforce founder authentication and validate ledger entries", async () => {
  const store = new Store(secret);
  const filip = await store.createUser({
    email: "filip@risecorestudio.com",
    name: "Filip",
    role: "admin",
    skillLevel: "senior",
    password: "Filip!Password123",
  });
  const outsider = await store.createUser({
    email: "outsider@test.dev",
    name: "Outsider",
    role: "admin",
    skillLevel: "mid",
    password: "Outsid!Password12",
  });

  const app = express();
  app.use(express.json());
  app.use("/stock", stockRoutes(config, store));

  // 1. Unauthenticated request should fail
  assert.equal((await request(app).get("/stock")).status, 401);

  // 2. Non-founder request should fail with 403 Forbidden
  assert.equal(
    (await request(app).get("/stock").set("authorization", bearer(outsider))).status,
    403
  );

  // 3. Founder request should succeed (200) and return seeded shares
  const initialGet = await request(app).get("/stock").set("authorization", bearer(filip));
  assert.equal(initialGet.status, 200);
  assert.equal(initialGet.body.shares.length, 3);
  
  const filipShare = initialGet.body.shares.find(
    (s: { founderEmail: string }) => s.founderEmail === "filip@risecorestudio.com"
  );
  assert.equal(filipShare.sharesCount, 5);

  // 4. Adding shares for a founder should succeed
  const addSharesRes = await request(app)
    .post("/stock/shares")
    .set("authorization", bearer(filip))
    .send({
      founderEmail: "paihtookhant@risecorestudio.com",
      sharesCount: 3,
    });
  assert.equal(addSharesRes.status, 200);

  const afterSharesGet = await request(app).get("/stock").set("authorization", bearer(filip));
  const paiShare = afterSharesGet.body.shares.find(
    (s: { founderEmail: string }) => s.founderEmail === "paihtookhant@risecorestudio.com"
  );
  assert.equal(paiShare.sharesCount, 4); // 1 initial + 3 added = 4

  // 5. Recording transaction should succeed
  const addTxRes = await request(app)
    .post("/stock/transactions")
    .set("authorization", bearer(filip))
    .send({
      type: "income",
      amount: 150000,
      description: "Q3 Project Retainer",
    });
  assert.equal(addTxRes.status, 200);
  assert.equal(addTxRes.body.transaction.amount, 150000);
  assert.equal(addTxRes.body.transaction.createdBy, "filip@risecorestudio.com");

  // 6. Verification of transactions list
  const afterTxGet = await request(app).get("/stock").set("authorization", bearer(filip));
  assert.equal(afterTxGet.body.transactions.length, 1);
  assert.equal(afterTxGet.body.transactions[0].description, "Q3 Project Retainer");
});

import { expect, test } from "bun:test";
import { FORGET, withUpdate } from "../../src/connectors/connections";

const client = { client_id: "registered" };
const tokens = { access_token: "granted", token_type: "Bearer" };

test("saving tokens connects the plugin and keeps the registered client", () => {
  expect(withUpdate({ client, verifier: "pending" }, { tokens })).toEqual({
    secrets: { client, tokens, verifier: "pending" },
    connected: true,
  });
});

test("forgetting tokens disconnects the plugin but keeps the registered client", () => {
  expect(withUpdate({ client, tokens }, FORGET.tokens)).toEqual({
    secrets: { client },
    connected: false,
  });
});

test("forgetting everything leaves nothing stored", () => {
  expect(withUpdate({ client, tokens, verifier: "pending", state: "x" }, FORGET.all)).toEqual({
    secrets: {},
    connected: false,
  });
});

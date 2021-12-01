import { Schema } from "./schema.ts";
import { assertExists, describe, it } from "../test.deps.ts";

describe("schema", () => {
  it("schema meta", () => {
    const shcemaMeta = Schema.getMeta();
    assertExists(shcemaMeta.createTime);
    assertExists(shcemaMeta.modifyTime);
  });
});

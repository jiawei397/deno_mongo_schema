import { getSchemaMetadata, Schema } from "./schema.ts";
import { assertEquals, assertExists, describe, it } from "../test.deps.ts";
import { User } from "../tests/common.ts";

describe("metadata", () => {
  it("User meta", () => {
    const userMeta = User.getMeta();
    assertEquals(userMeta.name, {
      required: true,
      index: true,
    });
    assertEquals(userMeta.age, {
      required: false,
    });
    assertExists(userMeta.createTime);
    assertExists(userMeta.modifyTime);
  });

  it("get User meta", () => {
    const ageMeta = getSchemaMetadata(User, "age");
    assertEquals(ageMeta, {
      required: false,
    });

    const nameMeta = getSchemaMetadata(User, "name");
    assertEquals(nameMeta, {
      required: true,
      index: true,
    });
  });
});

describe("schema", () => {
  it("schema meta", () => {
    const shcemaMeta = Schema.getMeta();
    assertExists(shcemaMeta.createTime);
    assertExists(shcemaMeta.modifyTime);
  });
});

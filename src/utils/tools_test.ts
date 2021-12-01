import { assertEquals, assertExists, describe, it } from "../../test.deps.ts";
import { User } from "../../tests/common.ts";
import { getInstance, getMetadata } from "./tools.ts";

describe("tools", () => {
  it("instance", () => {
    const instance1 = getInstance(User);
    const instance2 = getInstance(User);
    assertEquals(instance1, instance2);
  });

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
    const ageMeta = getMetadata(User, "age");
    assertEquals(ageMeta, {
      required: false,
    });

    const nameMeta = getMetadata(User, "name");
    assertEquals(nameMeta, {
      required: true,
      index: true,
    });
  });
});

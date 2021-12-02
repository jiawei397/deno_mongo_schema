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
      require: true,
      index: true,
    });
    assertEquals(userMeta.age, {
      require: false,
    });
    assertExists(userMeta.createTime);
    assertExists(userMeta.modifyTime);
  });

  it("get User meta", () => {
    const ageMeta = getMetadata(User, "age");
    assertEquals(ageMeta, {
      require: false,
    });

    const nameMeta = getMetadata(User, "name");
    assertEquals(nameMeta, {
      require: true,
      index: true,
    });
  });
});

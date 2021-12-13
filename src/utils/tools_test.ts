import { assertEquals, describe, it } from "../../test.deps.ts";
import { User } from "../../tests/common.ts";
import { getInstance } from "./tools.ts";

describe("tools", () => {
  it("instance", () => {
    const instance1 = getInstance(User);
    const instance2 = getInstance(User);
    assertEquals(instance1, instance2);
  });
});

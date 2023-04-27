import { assertEquals, test } from "../../test.deps.ts";
import { User } from "../../tests/common.ts";
import { getInstance } from "./tools.ts";

test("tools", async (t) => {
  await t.step("instance", () => {
    const instance1 = getInstance(User);
    const instance2 = getInstance(User);
    assertEquals(instance1, instance2);
  });
});

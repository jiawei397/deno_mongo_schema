import { assertEquals, describe, it } from "../test.deps.ts";
import { dbUrl } from "../tests/common.ts";
import { getDB } from "./utils/helper.ts";

const db = await getDB(dbUrl);
describe("database", () => {
  it("getCollection", () => {
    const collection = db.getCollection("test");
    assertEquals(collection.name, "test");
  });
});

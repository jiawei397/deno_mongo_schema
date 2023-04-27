import { assert } from "../test.deps.ts";
import { close, connect, User } from "../tests/common.ts";
import { MongoFactory, Schema, SchemaFactory } from "./factory.ts";
import { SchemaHelper } from "./schema.ts";

Deno.test("SchemaFactory", async (t) => {
  await t.step("register by decorator", () => {
    const modelName = "user1";
    @Schema(modelName)
    // deno-lint-ignore no-unused-vars
    class User1 {}

    const schema = SchemaFactory.getSchemaByName(modelName);
    assert(schema);
    assert(schema instanceof SchemaHelper);

    SchemaFactory.unregister(modelName);
  });

  await t.step("no name", () => {
    @Schema()
    class User2 {}

    const schema = SchemaFactory.getSchemaByName(User2.name);
    assert(schema);

    SchemaFactory.unregister(User2.name);
  });

  await t.step("forFeature", () => {
    class User3 {}
    const schema1 = new SchemaHelper(User3);
    const schema2 = new SchemaHelper(User3);

    const schemas = [
      {
        name: "user1",
        schema: schema1,
      },
      {
        name: "user2",
        schema: schema2,
      },
    ];
    SchemaFactory.forFeature(schemas);
    assert(SchemaFactory.getSchemaByName("user1"));
    assert(SchemaFactory.getSchemaByName("user1") === schema1);
    assert(SchemaFactory.getSchemaByName("user2"));
    assert(SchemaFactory.getSchemaByName("user2") === schema2);

    SchemaFactory.unregister("user1");
    SchemaFactory.unregister("user2");
  });
});

Deno.test({
  name: "MongoFactory",
  sanitizeResources: false, // has TCP connections left open
  sanitizeOps: false,
  fn: async (t) => {
    await connect();

    await t.step("getModel", async () => {
      const model1 = await MongoFactory.getModel<User>("user");
      const model2 = await MongoFactory.getModel<User>("users");
      const model3 = await MongoFactory.getModel<User>("User");
      const model4 = await MongoFactory.getModel<User>("Users");
      const model5 = await MongoFactory.getModel(User);
      assert(model1);
      assert(model2);
      assert(model3);
      assert(model4);
      assert(model5);
      assert(model1 === model2);
      assert(model1 === model3);
      assert(model1 === model4);
      assert(model1 === model5);
    });

    await close();
  },
});

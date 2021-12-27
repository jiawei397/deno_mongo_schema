import { assert, describe, it } from "../test.deps.ts";
import { User } from "../tests/common.ts";
import { MongoFactory, SchemaDecorator, SchemaFactory } from "./factory.ts";
import { BaseSchema } from "./schema.ts";

describe("SchemaFactory", () => {
  it("register by decorator", () => {
    const modelName = "user1";
    @SchemaDecorator(modelName)
    // deno-lint-ignore no-unused-vars
    class User1 {}

    const schema = SchemaFactory.getSchemaByName(modelName);
    assert(schema);
    assert(schema instanceof BaseSchema);

    SchemaFactory.unregister(modelName);
  });

  it("no name", () => {
    @SchemaDecorator()
    class User2 {}

    const schema = SchemaFactory.getSchemaByName(User2.name);
    assert(schema);

    SchemaFactory.unregister(User2.name);
  });

  it("forFeature", () => {
    class User3 {}
    const schema1 = new BaseSchema(User3);
    const schema2 = new BaseSchema(User3);

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

describe("MongoFactory", () => {
  it("getModel", async () => {
    const model1 = await MongoFactory.getModel("user");
    const model2 = await MongoFactory.getModel("users");
    const model3 = await MongoFactory.getModel("User");
    const model4 = await MongoFactory.getModel("Users");
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
});

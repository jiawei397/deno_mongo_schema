// deno-lint-ignore-file no-explicit-any
import { Prop, Schema, SchemaDecorator, SchemaFactory } from "./schema.ts";
import {
  assert,
  assertEquals,
  assertExists,
  assertNotEquals,
  beforeEach,
  describe,
  it,
} from "../test.deps.ts";
import { dbUrl, User } from "../tests/common.ts";
import { MongoHookMethod, UpdateExOptions } from "./types.ts";
import { Bson, Document } from "../deps.ts";
import { MongoFactory } from "./factory.ts";

await MongoFactory.forRoot(dbUrl);

// if want to use other name, must use `SchemaFactory.register` to register and use ` MongoFactory.getModel(User, "xxx")`
// SchemaFactory.register("mongo_test_schema_users", User);
const userModel = await MongoFactory.getModel(User);

@SchemaDecorator()
class Role extends Schema {
  @Prop()
  userId!: string | Bson.ObjectId;

  @Prop()
  name!: string;

  user?: User;
}

const RoleSchema = SchemaFactory.createForClass(Role);

RoleSchema.virtual("user", {
  ref: User, //"mongo_test_schema_users", // if use default name, can use class like `ref: User`
  localField: "userId",
  foreignField: "_id",
  justOne: true,
  isTransformLocalFieldToObjectID: true,
});

// SchemaFactory.register("mongo_test_schema_roles", Role);
const roleModel = await MongoFactory.getModel(Role); // "mongo_test_schema_roles");

describe("collection", () => {
  beforeEach(() => {
    User.clearHooks();
  });

  const user1Data = {
    "name": "zhangsan",
    "age": 18,
  };
  const user2Data = {
    "name": "lisi",
    "age": 3,
  };
  let id = "";
  let id2 = "";
  it("insert", async () => {
    id = await userModel.insertOne(user1Data).then((res: any) => {
      assert(res instanceof Bson.ObjectId, "maybe mongoId");
      return res.toString();
    });
    assertEquals(typeof id, "string");

    id2 = await userModel.insertOne(user2Data).then((res: any) =>
      res.toString()
    );
    assertEquals(typeof id2, "string");
  });

  it("find", async () => {
    assert(id, "id is not null");

    const inserted = "MongoHookMethod.find";
    User.post(MongoHookMethod.findOne, function (doc) {
      assertNotEquals(doc, null, "hook findOne, doc must not be null");
      doc["inserted"] = inserted;
    });

    User.post(MongoHookMethod.findMany, function (_docs) {
      assert(false, "this will not be in");
    });

    const doc: any = await userModel.findById(id);
    assertNotEquals(doc, null, "doc must not be null");
    assertEquals(doc["inserted"], inserted);
  });

  it("update hooks", async () => {
    const update = {
      $set: {
        "name": "bb",
        "age": 222,
        "sex": "man", // ex insert key
      },
    };
    const options = {
      new: true,
    };
    User.pre(
      MongoHookMethod.update,
      function (
        filter: Document,
        doc: Document,
        _options?: UpdateExOptions,
      ) {
        assertExists(filter._id, "只测试findByIdAndUpdate，这时条件里肯定有_id");
        assertEquals(doc, update);
        assertEquals(_options!.new, true);
      },
    );

    const insertedAddr = "haha";
    User.post(MongoHookMethod.findOneAndUpdate, function (doc) {
      assertNotEquals(
        doc,
        null,
        "hook findOneAndUpdate, doc must not be null",
      );
      doc.addr = insertedAddr;
    });

    const res: any = await userModel.findByIdAndUpdate(id, update, options);
    assertEquals(res.name, update.$set.name);
    assertEquals(res.age, update.$set.age);
    assertEquals(res.sex, undefined);
    assertEquals(
      res.addr,
      insertedAddr,
      "hook findOneAndUpdate will inster name",
    );
  });

  it("find many", async () => {
    const manyInserted = "MongoHookMethod.findMany";
    User.post(MongoHookMethod.findOne, function (_doc) {
      assert(false, "this will not be in");
    });

    User.post(MongoHookMethod.findMany, function (docs) {
      assert(Array.isArray(docs), "docs must be array");
      docs.forEach((doc) => {
        doc["inserted"] = manyInserted;
      });
    });

    assert(typeof id === "string", "test a string");
    assert(typeof id2 === "string", "test a string");
    const arr = await userModel.findMany({
      _id: {
        $in: [id, id2],
      },
    });
    arr.forEach((doc: any) => {
      assertEquals(doc._id, undefined);
      assert([id, id2].find((_id) => _id === doc.id));
      assertEquals(doc.inserted, manyInserted);
    });
  });

  it("find remainOriginId", async () => {
    const arr = await userModel.findMany({
      _id: {
        $in: [id, id2],
      },
    }, {
      remainOriginId: true,
    });
    arr.forEach((doc: any) => {
      assertExists(doc._id, "this time _id will be remained");
    });
  });

  it("find skip", async () => {
    const arr = await userModel.findMany({
      _id: {
        $in: [id, id2],
      },
    }, {
      skip: 0, // 从0开始
      limit: 1,
      // sort: {
      //   age: 1,
      // },
    });

    assertEquals(arr.length, 1);
    assertEquals((arr[0] as any).id, id);
  });

  it("find sort", async () => {
    const arr = await userModel.findMany({
      _id: {
        $in: [id, id2],
      },
    }, {
      sort: {
        age: 1,
      },
    });

    assertEquals(arr.length, 2);
    assertEquals((arr[0] as any).id, id2);
  });

  it("findByIdAndDelete", async () => {
    const deleteResult = await userModel.findByIdAndDelete(id2);
    assertEquals(deleteResult, 1);

    const deleteResult2 = await userModel.findByIdAndDelete(id);
    assertEquals(deleteResult2, 1);
  });

  it("createIndexes", async () => {
    await userModel.createIndexes({
      indexes: [{
        name: "_name2",
        key: { name: -1 },
      }],
    });
    const indexes = await userModel.listIndexes().toArray();
    assertEquals(indexes.length, 3);
    assertEquals(indexes[0].name, "_id_");
    assertEquals(indexes[0].key, { _id: 1 });

    assertEquals(indexes[1].name, "name_1");
    assertEquals(indexes[1].key, { name: 1 });

    assertEquals(indexes[2].name, "_name2");
    assertEquals(indexes[2].key, { name: -1 });
  });

  it("syncIndexes", async () => {
    await userModel.syncIndexes();

    const indexes = await userModel.listIndexes().toArray();
    assertEquals(indexes.length, 2);
    assertEquals(indexes[0].name, "_id_");
    assertEquals(indexes[0].key, { _id: 1 });

    assertEquals(indexes[1].name, "name_1");
    assertEquals(indexes[1].key, { name: 1 });
  });

  it("delete all", async () => {
    await userModel.deleteMany({});
    const nowArr = await userModel.find().toArray();
    assertEquals(nowArr.length, 0, "clear all");
  });
});

describe("populates", () => {
  let userId1;
  let userId2;
  const user1 = {
    name: "zhangsan",
    age: 18,
  };
  const user2 = {
    name: "lisi",
    age: 22,
  };
  it("insertData", async () => {
    userId1 = await userModel.insertOne(user1);
    userId2 = await userModel.insertOne(user2);

    const role1 = {
      name: "admin",
      userId: userId1,
    };
    await roleModel.insertOne(role1);

    const role2 = {
      name: "normal",
      userId: userId2,
    };
    await roleModel.insertOne(role2);
  });

  it("find populates is empty", async () => {
    const arr = await roleModel.findMany({}, {
      populates: {},
    });
    assertEquals(arr.length, 2);
    assertEquals(arr[0].user, undefined);
    assertEquals(arr[1].user, undefined);
  });

  it("find populates is object and pick some fields", async () => {
    const arr = await roleModel.findMany({}, {
      populates: {
        user: {
          name: 1,
          age: 1,
        },
      },
    });
    assertEquals(arr.length, 2);
    assert(!Array.isArray(arr[0].user), "justOne work");
    assertEquals(arr[0].user!.name, user1.name);
    assertEquals(arr[0].user!.age, user1.age);
    assertEquals(arr[1].user!.name, user2.name);
    assertEquals(arr[1].user!.age, user2.age);
    const user = arr[0].user!;
    assertEquals(Object.keys(user).length, 2);
    assertEquals(Object.keys(user), ["name", "age"]);
    assertEquals(arr[0].user!._id, undefined);
    assertEquals(arr[1].user!._id, undefined);
  });

  it("find populates is array and drop some fields", async () => {
    const arr = await roleModel.findMany({}, {
      populates: {
        user: {
          _id: 0,
          name: 0,
          // age: 1,
        },
        // user: "group",
        // user: "-_id -title",
      },
    });
    assertEquals(arr.length, 2);
    const user = arr[0].user!;
    assertEquals(user.name, undefined);
    assertEquals(user._id, undefined);
    assertExists(user.age);
  });

  it("find populates is string and pick some fields", async () => {
    const arr = await roleModel.findMany({}, {
      populates: {
        user: "name age",
      },
    });
    assertEquals(arr.length, 2);
    const user = arr[0].user!;
    assertEquals(Object.keys(user).length, 2);
    assertEquals(Object.keys(user), ["name", "age"]);
    assertEquals(arr[0].user!._id, undefined);
    assertEquals(arr[1].user!._id, undefined);
  });

  it("find populates is string and drop some fields", async () => {
    const arr = await roleModel.findMany({}, {
      populates: {
        user: "-_id -name",
      },
    });
    assertEquals(arr.length, 2);
    assertEquals(arr.length, 2);
    const user = arr[0].user!;
    assertEquals(user.name, undefined);
    assertEquals(user._id, undefined);
    assertExists(user.age);
  });
});

describe("close", () => {
  it("drop collection", async () => {
    await userModel.drop();
    await roleModel.drop();
    assert(true, "drop collection ok");
  });
});

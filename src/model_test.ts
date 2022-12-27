// deno-lint-ignore-file no-explicit-any
import { BaseSchema, Prop } from "./schema.ts";
import {
  assert,
  assertEquals,
  assertExists,
  assertNotEquals,
} from "../test.deps.ts";
import { User, UserSchema } from "../tests/common.ts";
import { MongoHookMethod, UpdateExOptions } from "./types.ts";
import { Document, ObjectId } from "../deps.ts";
import { MongoFactory, Schema, SchemaFactory } from "./factory.ts";

// if want to use other name, must use `SchemaFactory.createForClass` to register and use ` MongoFactory.getModel<User>("xxx")`
// SchemaFactory.createForClass(User, "mongo_test_schema_users");
// const userModel = await MongoFactory.getModel<User>('mongo_test_schema_users');
const userModel = await MongoFactory.getModel(User);

@Schema()
class Role extends BaseSchema {
  @Prop()
  userId!: string | ObjectId;

  @Prop()
  name!: string;

  user?: User;
  userCount?: number;
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

Deno.test("collection", async (t) => {
  // beforeEach(() => {
  //   UserSchema.clearHooks();
  // });

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
  await t.step("insert", async () => {
    UserSchema.clearHooks();

    id = await userModel.insertOne(user1Data).then((res: any) => {
      assert(res instanceof ObjectId, "maybe mongoId");
      return res.toString();
    });
    assertEquals(typeof id, "string");

    id2 = await userModel.insertOne(user2Data).then((res: any) =>
      res.toString()
    );
    assertEquals(typeof id2, "string");
  });

  await t.step("find", async () => {
    UserSchema.clearHooks();

    assert(id, "id is not null");

    const inserted = "MongoHookMethod.find";
    UserSchema.post(MongoHookMethod.findOne, function (doc: any) {
      assert(this === userModel, "this is userModel");
      assertNotEquals(doc, null, "hook findOne, doc must not be null");
      doc["inserted"] = inserted;
    });

    UserSchema.post(MongoHookMethod.findMany, function () {
      assert(this === userModel, "this is userModel");
      assert(false, "this will not be in");
    });

    const doc: any = await userModel.findById(id);
    assertNotEquals(doc, null, "doc must not be null");
    assertEquals(doc["inserted"], inserted);
  });

  await t.step("update hooks", async () => {
    UserSchema.clearHooks();
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
    UserSchema.pre(
      MongoHookMethod.update,
      function (
        filter: Document,
        doc: Document,
        _options?: UpdateExOptions,
      ) {
        assert(this === userModel, "this is userModel");
        assertExists(
          filter._id,
          "只测试findByIdAndUpdate，这时条件里肯定有_id",
        );
        assertEquals(doc, update);
      },
    );

    const insertedAddr = "haha";
    UserSchema.post(MongoHookMethod.findOneAndUpdate, function (doc) {
      assert(this === userModel, "this is userModel");
      assertNotEquals(
        doc,
        null,
        "hook findOneAndUpdate, doc must not be null",
      );

      doc.addr = insertedAddr;
    });

    {
      const res = await userModel.findByIdAndUpdate(id, update, options);
      assert(res);
      assert(!res._id, "res._id is dropped");
      assert(res.id, "res.id is not null");
      assertEquals(res.name, update.$set.name);
      assertEquals(res.age, update.$set.age);
      assertEquals((res as any).sex, undefined);
      assertEquals(
        (res as any).addr,
        insertedAddr,
        "hook findOneAndUpdate will inster name",
      );
    }

    {
      const res = await userModel.findByIdAndUpdate(id, update, {
        new: true,
        remainOriginId: true,
      });
      assert(res);
      assert(res._id, "res._id should be remained");
      assert(res.id, "res.id cannot be null");
    }
  });

  await t.step("find many", async () => {
    UserSchema.clearHooks();

    const manyInserted = "MongoHookMethod.findMany";
    UserSchema.post(MongoHookMethod.findOne, function (_doc) {
      assert(false, "this will not be in");
    });

    UserSchema.post(MongoHookMethod.findMany, function (docs) {
      assert(this === userModel, "this is userModel");
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

  await t.step("find remainOriginId", async () => {
    UserSchema.clearHooks();

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

  await t.step("find skip", async () => {
    UserSchema.clearHooks();

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

  await t.step("find sort", async () => {
    UserSchema.clearHooks();

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

  await t.step("findByIdAndDelete", async () => {
    UserSchema.clearHooks();

    const deleteResult = await userModel.findByIdAndDelete(id2);
    assertEquals(deleteResult, 1);

    const deleteResult2 = await userModel.findByIdAndDelete(id);
    assertEquals(deleteResult2, 1);
  });

  await t.step("createIndexes", async () => {
    UserSchema.clearHooks();

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

  await t.step("syncIndexes", async () => {
    UserSchema.clearHooks();

    await userModel.syncIndexes();

    const indexes = await userModel.listIndexes().toArray();
    assertEquals(indexes.length, 2);
    assertEquals(indexes[0].name, "_id_");
    assertEquals(indexes[0].key, { _id: 1 });

    assertEquals(indexes[1].name, "name_1");
    assertEquals(indexes[1].key, { name: 1 });
  });

  await t.step("delete all", async () => {
    UserSchema.clearHooks();

    await userModel.deleteMany({});
    const nowArr = await userModel.find().toArray();
    assertEquals(nowArr.length, 0, "clear all");
  });
});

Deno.test("populates", async (t) => {
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
  await t.step("insertData", async () => {
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

  await t.step("find populates is empty", async () => {
    const arr = await roleModel.findMany({}, {
      populates: {},
    });
    assertEquals(arr.length, 2);
    assertEquals(arr[0].user, undefined);
    assertEquals(arr[1].user, undefined);
  });

  await t.step("find populates is object and pick some fields", async () => {
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

  await t.step("find populates is object and drop some fields", async () => {
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

  await t.step("find populates is string and pick some fields", async () => {
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

  await t.step("find populates is string and drop some fields", async () => {
    const arr = await roleModel.findMany({}, {
      populates: {
        user: "-_id -name",
      },
    });
    assertEquals(arr.length, 2);
    const user = arr[0].user!;
    assertEquals(user.name, undefined);
    assertEquals(user._id, undefined);
    assertExists(user.age);
  });

  await t.step("find populates is array and pick some fields", async () => {
    const arr = await roleModel.findMany({}, {
      populates: {
        user: ["name", "age"],
      },
    });
    assertEquals(arr.length, 2);
    const user = arr[0].user!;
    assertEquals(Object.keys(user).length, 2);
    assertEquals(Object.keys(user), ["name", "age"]);
    assertEquals(arr[0].user!._id, undefined);
    assertEquals(arr[1].user!._id, undefined);
  });

  await t.step("find populates is true", async () => {
    const arr = await roleModel.findMany({}, {
      populates: {
        user: true,
      },
    });
    assertEquals(arr.length, 2);
    const user = arr[0].user!;
    assertEquals(Object.keys(user), [
      "name",
      "age",
      "createTime",
      "modifyTime",
      "id",
    ]);
    assert(user.name);
    assert(user.age);
    assert(user.id);
  });

  await t.step("find populates is false", async () => {
    const arr = await roleModel.findMany({}, {
      populates: {
        user: false,
      },
    });
    assertEquals(arr.length, 2);
    assert(!arr[0].user);
    assert(!arr[1].user);
  });

  await t.step("find populate count", async () => {
    RoleSchema.virtual("userCount", {
      ref: User,
      localField: "userId",
      foreignField: "_id",
      justOne: true,
      isTransformLocalFieldToObjectID: true,
      count: true,
    });
    const arr = await roleModel.findMany({}, {
      populates: {
        user: false,
        userCount: true,
      },
    });
    assertEquals(arr.length, 2);
    assertEquals(arr[0].userCount, 1);
    assertEquals(arr[0].user, undefined);

    RoleSchema.unVirtual("userCount");
  });

  await t.step("find populate count with match", async () => {
    RoleSchema.virtual("userCount", {
      ref: User,
      localField: "userId",
      foreignField: "_id",
      justOne: true,
      isTransformLocalFieldToObjectID: true,
      count: true,
      match: {
        age: user2.age,
      },
    });
    const arr = await roleModel.findMany({}, {
      populates: {
        userCount: true,
      },
    });
    assertEquals(arr.length, 2);
    assertEquals(arr[0].userCount, 0);
    assertEquals(arr[1].userCount, 1);

    RoleSchema.unVirtual("userCount");
  });
});

Deno.test("Prop", async (t) => {
  class Base extends BaseSchema {
    @Prop({
      default: "hello",
    })
    name?: string;
  }
  @Schema()
  class Blog extends Base {
    @Prop()
    title!: string;

    @Prop({
      default: false,
    })
    deleted?: boolean;

    @Prop({
      default: () => "function",
    })
    func?: string;

    @Prop({
      default: Date,
    })
    date?: Date;
  }
  const blogModel = await MongoFactory.getModel(Blog);

  await t.step("default", async () => {
    const id = await blogModel.insertOne({
      title: "test",
    });
    assert(id);
    const find = await blogModel.findById(id);
    assert(find);
    assertEquals(find.title, "test");
    assertEquals(find.deleted, false);
    assertEquals(find.func, "function");
    assert(find.date instanceof Date);
    assertEquals(find.name, "hello");
  });

  await t.step("save", async () => {
    const data = await blogModel.save({
      title: "test",
    });
    assert(data);
    assert(data.id);
    assertEquals(data.title, "test");
    assertEquals(data.deleted, false);
    assertEquals(data.func, "function");
    assert(data.date instanceof Date);
    assertEquals(data.name, "hello");
  });

  // clear
  await blogModel.drop();
});

Deno.test("close", async (t) => {
  await t.step("drop collection", async () => {
    await userModel.drop();
    await roleModel.drop();
    assert(true, "drop collection ok");
  });
});

# deno_mongo_schema

Extend from **[deno_mongo v0.29.2](https://deno.land/x/mongo)**, support Schema
and extend some API.

[![ci](https://github.com/jiawei397/deno_mongo_schema/actions/workflows/ci.yml/badge.svg)](https://github.com/jiawei397/deno_mongo_schema/actions/workflows/ci.yml)
[![tag](https://img.shields.io/badge/deno-v1.19.0-green.svg)](https://github.com/denoland/deno)

## hooks

```ts
import {
  getDB,
  getModel,
  MongoFactory,
  MongoHookMethod,
  Prop,
  Schema,
  SchemaDecorator,
  UpdateExOptions,
} from "https://deno.land/x/deno_mongo_schema@v0.8.2/mod.ts";
import type { Document } from "https://deno.land/x/deno_mongo_schema@v0.8.2/mod.ts";

await MongoFactory.forRoot("mongodb://localhost:27017/test");

@SchemaDecorator()
class User extends Schema {
  @Prop()
  age!: number;

  @Prop({
    required: true,
  })
  name!: string;

  @Prop({
    default: Date.now,
    expires: 60, // seconds
  })
  expires?: Date;
}

const UserSchema = SchemaFactory.createForClass(User);

UserSchema.pre(
  MongoHookMethod.update,
  function (filter: Document, doc: Document, options?: UpdateExOptions) {
    console.log("----pre----", filter, doc, options);
    if (!doc.$set) {
      doc.$set = {};
    }
    doc.$set.modifyTime = new Date();
  },
);

UserSchema.post(MongoHookMethod.findOneAndUpdate, function (doc) {
  console.log("----post----", doc);
  doc.name = "haha";
});

const userModel = await MongoFactory.getModel(User);

const id = await userModel.insertOne({
  "name": "zhangsan",
  "age": 18,
});

UserSchema.post(MongoHookMethod.findOne, function (doc) {
  console.log("----post---findOne----", doc);
});

// console.log(id);
const info = await userModel.findById(id, {
  projection: {
    name: 1,
  },
});
console.log(info);

UserSchema.post(MongoHookMethod.findMany, function (doc) {
  console.log("----post---findMany----", doc);
});

const arr = await userModel.findMany({});
console.log(arr);

UserSchema.post(MongoHookMethod.delete, function (doc) {
  console.log("----post---delete----", doc);
});

const del = await userModel.deleteOne({
  name: "zhangsan",
});
console.log(del);

const delMulti = await userModel.deleteMany({
  name: "zhangsan",
});
console.log(delMulti);
```

## Virtual

Or you can use virtual like this:

```ts
import {
  MongoFactory,
  Prop,
  Schema,
  SchemaDecorator,
} from "https://deno.land/x/deno_mongo_schema@v0.8.2/mod.ts";

await MongoFactory.forRoot("mongodb://localhost:27017/test");

@SchemaDecorator()
class User extends Schema {
  @Prop()
  group!: string;

  @Prop()
  title!: string;
}

@SchemaDecorator()
class Role extends Schema {
  @Prop()
  userId!: string;

  @Prop()
  name!: string;
}

const RoleSchema = SchemaFactory.createForClass(Role);

RoleSchema.virtual("user", {
  ref: User,
  localField: "userId",
  foreignField: "_id",
  justOne: true,
  isTransformLocalFieldToObjectID: true,
});

// Role.populate("user", {
//   // _id: 0,
//   group: 1,
//   // title: 1,
// });
// Role.populate("user", "group");
// Role.populate("user", "-group -createTime");
// Role.populate("user", "title group");

const roleModel = await MongoFactory.getModel(Role);

// roleModel.insertOne({
//   userId: id,
//   name: "normal",
// });

console.log(
  await roleModel.findMany({}, {
    projection: {
      name: 1,
      userId: 1,
    },
    // skip: 1,
    // limit: 1,
    populates: {
      // user: {
      //   // _id: 0,
      //   group: 1,
      //   title: 1,
      // },
      // user: "group",
      user: true,
      // user: "-_id -title",
    },
  }),
);
```

## Special collection name

If you donnot want to use the default collection name, you must regiter it by
yourself.

```ts
SchemaFactory.createForClass(Role, "mongo_test_schema_roles");
```

Then if you still want to use virtual, you must use your registered name instead
of Schema Class.

```ts
UserSchema.virtual("role", {
  ref: "mongo_test_schema_roles",
  localField: "roleId",
  foreignField: "_id",
  justOne: true,
  // isTransformLocalFieldToObjectID: true,
  // isTransformObjectIDToLocalField: true
});
```

## TODO

- [x] Modify schema as a decorator
- [x] Unit
- [ ] Configurable whether to convert _id
- [ ] Configurable the createTime and modifyTime

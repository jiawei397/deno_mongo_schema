# deno_mongo_schema

Extend from the Node.js
**[mongodb client v5.3.0](https://github.com/mongodb/node-mongodb-native)**,
support Schema and extend some API.

[![ci](https://github.com/jiawei397/deno_mongo_schema/actions/workflows/ci.yml/badge.svg)](https://github.com/jiawei397/deno_mongo_schema/actions/workflows/ci.yml)
[![tag](https://img.shields.io/badge/deno-v1.32.5-green.svg)](https://github.com/denoland/deno)

> Breaking changes on v1.0.0.
>
> I have to switch client from [deno_mongo](https://deno.land/x/mongo) to
> Node.js. Because it is officially maintained, it looks more robust.
>
> If it is to be used in production, reconnecting after wire breakage is an
> important function.

## hooks

```ts
import {
  BaseSchema,
  getDB,
  getModel,
  MongoFactory,
  MongoHookMethod,
  Prop,
  Schema,
  UpdateExOptions,
} from "https://deno.land/x/deno_mongo_schema@v0.10.5/mod.ts";
import type { Document } from "https://deno.land/x/deno_mongo_schema@v0.10.5/mod.ts";

await MongoFactory.forRoot("mongodb://localhost:27017/test");

@Schema()
class User extends BaseSchema {
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

Here are some useful APIs:

- find
  - findById
  - findOne
  - findMany
  - countDocuments
  - aggregate
  - distinct
- insert
  - insertOne
  - insertMany
- update
  - findByIdAndUpdate
  - findOneAndUpdate
  - updateMany
  - updateOne
- delete
  - deleteMany
  - deleteOne/findOneAndDelete
  - deleteById/findByIdAndDelete
- index
  - syncIndexes
  - dropIndexes
  - listIndexes
  - createIndexes
- drop collection
  - drop

## Virtual

Or you can use virtual like this:

```ts
import {
  BaseSchema,
  MongoFactory,
  Prop,
  Schema,
} from "https://deno.land/x/deno_mongo_schema@v0.10.5/mod.ts";

await MongoFactory.forRoot("mongodb://localhost:27017/test");

@Schema()
class User extends BaseSchema {
  @Prop()
  group!: string;

  @Prop()
  title!: string;
}

@Schema()
class Role extends BaseSchema {
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
- [x] Configurable whether to convert _id
- [x] Configurable the createTime and modifyTime
- [x] Switch the underlying layer to the official Node.js version library

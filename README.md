# deno_mongo_schema

Extend from **[deno_mongo v0.28.0](https://deno.land/x/mongo)**, support Schema
and extend some API.

[![ci](https://github.com/jiawei397/deno_mongo_schema/actions/workflows/ci.yml/badge.svg)](https://github.com/jiawei397/deno_mongo_schema/actions/workflows/ci.yml)
[![tag](https://img.shields.io/badge/deno-v1.8.1-green.svg)](https://github.com/denoland/deno)

## hooks

```ts
import {
  getDB,
  getModel,
  MongoFactory,
  MongoHookMethod,
  Prop,
  Schema,
  UpdateExOptions,
} from "https://deno.land/x/deno_mongo_schema@v0.1.0/mod.ts";
import type { Document } from "https://deno.land/x/deno_mongo_schema@v0.1.0/mod.ts";

// const db = await getDB("mongodb://localhost:27017/test");
await MongoFactory.forRoot("mongodb://localhost:27017/test");

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

User.pre(
  MongoHookMethod.update,
  function (filter: Document, doc: Document, options?: UpdateExOptions) {
    console.log("----pre----", filter, doc, options);
    if (!doc.$set) {
      doc.$set = {};
    }
    doc.$set.modifyTime = new Date();
  },
);

User.post(MongoHookMethod.findOneAndUpdate, function (doc) {
  console.log("----post----", doc);
  doc.name = "haha";
});

// const model = await getModel<User>(db, User);
const model = await MongoFactory.getModel<User>(User);

const id = await model.insertOne({
  "name": "zhangsan",
  "age": 18,
});

User.post(MongoHookMethod.findOne, function (doc) {
  console.log("----post---findOne----", doc);
});

// console.log(id);
const info = await model.findById(id, {
  projection: {
    name: 1,
  },
});
console.log(info);

User.post(MongoHookMethod.findMany, function (doc) {
  console.log("----post---findMany----", doc);
});

const arr = await model.findMany({});
console.log(arr);

User.post(MongoHookMethod.delete, function (doc) {
  console.log("----post---delete----", doc);
});

const del = await model.deleteOne({
  name: "zhangsan",
});
console.log(del);

const delMulti = await model.deleteMany({
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
} from "https://deno.land/x/deno_mongo_schema@v0.1.0/mod.ts";

await MongoFactory.forRoot("mongodb://localhost:27017/test");

class User extends Schema {
  @Prop()
  group!: string;

  @Prop()
  title!: string;
}

class Role extends Schema {
  @Prop()
  userId!: string;

  @Prop()
  name!: string;
}

Role.virtual("user", {
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

// const userModel = await MongoFactory.getModel<User>(db, User);
const roleModel = await MongoFactory.getModel<Role>(db, Role);

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

## TODO

- [ ] Modify schema as a decorator

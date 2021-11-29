import {
  getDB,
  getModel,
  MongoHookMethod,
  Prop,
  Schema,
  UpdateExOptions,
} from "../mod.ts";
import type { Document } from "../mod.ts";

const db = await getDB("mongodb://localhost:27017/test");

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

const model = await getModel<User>(db, User);

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

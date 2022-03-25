// deno-lint-ignore-file no-explicit-any
import {
  BaseSchema,
  MongoFactory,
  MongoHookMethod,
  Prop,
  Schema,
  SchemaFactory,
  UpdateExOptions,
} from "../mod.ts";
import type { Document } from "../mod.ts";

await MongoFactory.forRoot("mongodb://localhost:27017/test");

@Schema()
class User extends BaseSchema {
  @Prop()
  age!: number;

  @Prop({
    required: true,
    index: true,
    // index: "text",
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

UserSchema.post(MongoHookMethod.findOneAndUpdate, function (doc: any) {
  console.log("----post----", doc);
  doc.name = "haha";
});

const model = await MongoFactory.getModel(User);

const id = await model.insertOne({
  "name": "zhangsan",
  "age": 18,
});

// const wangwuInfo = await model.save({
//   "name": "wangwu",
//   "age": 20,
// });
// console.log("wangwuInfo", wangwuInfo);

UserSchema.post(MongoHookMethod.findOne, function (doc: any) {
  console.log("----post---findOne----", doc);
});

// console.log(id);
const info = await model.findById(id, {
  projection: {
    name: 1,
  },
});
console.log(info);

UserSchema.post(MongoHookMethod.findMany, function (doc: any) {
  console.log("----post---findMany----", doc);
});

const arr = await model.findMany({});
console.log(arr);

UserSchema.post(MongoHookMethod.delete, function (doc: any) {
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

const res = await model.findByIdAndUpdate(id, {
  $set: {
    name: "lisi",
  },
});
console.log(res);

const res2 = await model.findByIdAndUpdate(id, {
  $set: {
    name: "lisi2",
  },
}, {
  new: true,
});
console.log(res2);

const res3 = await model.findOneAndUpdate({
  name: "lisi2",
}, {
  $set: {
    name: "wangwu",
  },
}, {
  new: true,
});
console.log(res3);

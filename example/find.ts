// deno-lint-ignore-file no-explicit-any
import {
  MongoFactory,
  MongoHookMethod,
  Prop,
  Schema,
  SchemaDecorator,
  SchemaFactory,
  UpdateExOptions,
} from "../mod.ts";
import type { Document } from "../mod.ts";

await MongoFactory.forRoot("mongodb://192.168.21.176:27018/wiki");

@SchemaDecorator()
class OneHourOnline extends Schema {
  @Prop({
    required: true,
    unique: true,
    index: true,
  })
  userId!: string;

  @Prop({
    default: Date.now,
    expires: 60 * 60, //以秒为单位
  })
  expires?: Date;

  @Prop()
  name?: string;
}

const model = await MongoFactory.getModel(OneHourOnline);

const res3 = await model.findOneAndUpdate({
  "userId": "81",
}, {
  // $set: {
  name: "wangwu",
  // },
}, {
  new: true,
});
console.log(res3);

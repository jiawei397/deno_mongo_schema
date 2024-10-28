import { BaseSchema, MongoFactory, Prop, Schema } from "../mod.ts";

await MongoFactory.forRoot("mongodb://root:123456@192.168.21.125:27017/wiki?authSource=admin");

@Schema()
class OneHourOnline extends BaseSchema {
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
  upsert: true,
});
if (res3) {
  console.log(res3);
}

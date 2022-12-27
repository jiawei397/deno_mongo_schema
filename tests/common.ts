import {
  BaseSchema,
  MongoFactory,
  Prop,
  Schema,
  SchemaFactory,
} from "../mod.ts";

export const dbUrl = "mongodb://localhost:27017/test";
// export const dbUrl = "mongodb://10.100.30.65:27017/test";

await MongoFactory.forRoot(dbUrl);

@Schema()
export class User extends BaseSchema {
  @Prop({
    required: true,
    index: true,
  })
  name!: string;

  @Prop({
    required: false,
  })
  age!: number;
}

export const UserSchema = SchemaFactory.createForClass(User);

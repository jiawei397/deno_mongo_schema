import {
  BaseSchema,
  MongoFactory,
  Prop,
  Schema,
  SchemaFactory,
} from "../mod.ts";

// export const dbUrl = "mongodb://localhost:27017/test";
export const dbUrl = Deno.env.get("BASE_URL") ||
  "mongodb://root:123456@192.168.21.125:27017/wiki?authSource=admin";

@Schema()
export class User extends BaseSchema {
  @Prop({
    required: true,
    index: true,
  })
  name: string;

  @Prop({
    required: false,
  })
  age: number;
}

export const UserSchema = SchemaFactory.createForClass(User);

export function connect() {
  return MongoFactory.forRoot(dbUrl);
}

export async function close() {
  await MongoFactory.close();
  console.info("Mongodb connection closed");
}

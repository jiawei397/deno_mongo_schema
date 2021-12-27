import {
  MongoFactory,
  Prop,
  Schema,
  SchemaDecorator,
  SchemaFactory,
} from "../mod.ts";

export const dbUrl = "mongodb://localhost:27017/test";

await MongoFactory.forRoot(dbUrl);

@SchemaDecorator()
export class User extends Schema {
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

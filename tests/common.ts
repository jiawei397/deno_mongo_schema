import { Prop, Schema, SchemaDecorator } from "../mod.ts";

export const dbUrl = "mongodb://localhost:27017/test";

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

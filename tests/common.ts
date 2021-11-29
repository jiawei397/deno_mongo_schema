import { Prop, Schema } from "../mod.ts";

export const dbUrl = "mongodb://localhost:27017/test";

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

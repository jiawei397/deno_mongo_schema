import { Prop, Schema } from "../mod.ts";

export const dbUrl = "mongodb://localhost:27017/test";

export class User extends Schema {
  @Prop({
    require: true,
    index: true,
  })
  name!: string;

  @Prop({
    require: false,
  })
  age!: number;
}

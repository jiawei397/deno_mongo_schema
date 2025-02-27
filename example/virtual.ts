// deno-lint-ignore-file no-unused-vars
import {
  BaseSchema,
  InjectIndexes,
  MongoFactory,
  Prop,
  Schema,
  SchemaFactory,
} from "../mod.ts";
import { dbUrl } from "../tests/common.ts";

await MongoFactory.forRoot(dbUrl);

@Schema("user1")
@InjectIndexes(
  [{
    key: {
      group: 1,
      title: 1,
    },
    name: "test",
  }],
)
class User extends BaseSchema {
  @Prop()
  group!: string;

  @Prop()
  title!: string;
}

// const UserSchema = SchemaFactory.createForClass(User);

@Schema()
class Role extends BaseSchema {
  @Prop()
  userId!: string;

  @Prop()
  name!: string;
}

const RoleSchema = SchemaFactory.createForClass(Role);

RoleSchema.virtual("user", {
  ref: "user1",
  localField: "userId",
  foreignField: "_id",
  justOne: true,
  isTransformLocalFieldToObjectID: true,
});

RoleSchema.populate("user");
// Role.populate("user", {
//   // _id: 0,
//   group: 1,
//   // title: 1,
// });
// Role.populate("user", "group");
// Role.populate("user", "-group -createTime");
// Role.populate("user", "title group");
const roleModel = await MongoFactory.getModel<Role>(Role.name);
// const roleModel = await MongoFactory.getModel(Role);

async function init() {
  const userModel = await MongoFactory.getModel<User>("user1");

  const id = await userModel.insertOne({
    group: "spacex",
    title: "zn",
  });
  console.log(id);

  const arr = await userModel.find().toArray();
  console.log(arr);

  await roleModel.insertOne({
    userId: id.toString(),
    name: "normal",
  });
}

async function main() {
  console.log(
    await roleModel.findMany({}, {
      projection: {
        name: 1,
        userId: 1,
      },
      // skip: 1,
      // limit: 1,
      // populates: {
      //   // user: {
      //   //   // _id: 0,
      //   //   group: 1,
      //   //   title: 1,
      //   // },
      //   user: "group",
      //   // user: true,
      //   // user: "-_id -title",
      // },
    }),
  );
}

// await init();

await main();

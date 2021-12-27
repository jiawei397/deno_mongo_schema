import { getSchemaMetadata, Prop, Schema } from "./schema.ts";
import {
  assert,
  assertEquals,
  assertExists,
  describe,
  it,
} from "../test.deps.ts";
import { User, UserSchema } from "../tests/common.ts";
import { MongoFactory, SchemaDecorator, SchemaFactory } from "./factory.ts";
import { Bson } from "../deps.ts";

describe("metadata", () => {
  it("User meta", () => {
    const userMeta = UserSchema.getMeta();
    assertEquals(userMeta.name, {
      required: true,
      index: true,
    });
    assertEquals(userMeta.age, {
      required: false,
    });
    assertExists(userMeta.createTime);
    assertExists(userMeta.modifyTime);
  });

  it("get User meta", () => {
    const ageMeta = getSchemaMetadata(User, "age");
    assertEquals(ageMeta, {
      required: false,
    });

    const nameMeta = getSchemaMetadata(User, "name");
    assertEquals(nameMeta, {
      required: true,
      index: true,
    });
  });
});

describe("virtual", () => {
  const userSchemaName = "user_schema_test";
  const roleSchemaName = "role_schema_test";
  @SchemaDecorator(userSchemaName)
  class User extends Schema {
    @Prop()
    group!: string;

    @Prop()
    title!: string;
  }

  class Role extends Schema {
    @Prop()
    userId!: string;

    @Prop()
    name!: string;

    user?: User;
  }

  const RoleSchema = SchemaFactory.createForClass(Role, roleSchemaName);

  it("populate", async () => {
    const roleModel = await MongoFactory.getModel<Role>(roleSchemaName);
    const userModel = await MongoFactory.getModel<User>(userSchemaName);
    const userData = {
      group: "base",
      title: "test",
    };
    const userId = await userModel.insertOne(userData);

    assert(userId instanceof Bson.ObjectId);

    const roleId = await roleModel.insertOne({
      userId: userId.toString(),
      name: "normal",
    });
    assert(roleId instanceof Bson.ObjectId);

    {
      RoleSchema.virtual("user", {
        ref: userSchemaName,
        localField: "userId",
        foreignField: "_id",
        justOne: true,
        isTransformLocalFieldToObjectID: true,
      });

      const result = await roleModel.findById(roleId, {
        projection: {
          name: 1,
          userId: 1,
        },
        populates: {
          user: true,
        },
      });
      assert(result);
      assertEquals(result.name, "normal");
      assertEquals(result.userId, userId);
      assert(result.user);
      assertEquals(result.user.group, userData.group);
      assertEquals(result.user.title, userData.title);

      RoleSchema.unVirtual("user");
    }

    { // test ref not exists
      RoleSchema.virtual("user", {
        ref: User,
        localField: "userId",
        foreignField: "_id",
        justOne: true,
        isTransformLocalFieldToObjectID: true,
      });

      const result = await roleModel.findById(roleId, {
        populates: {
          user: true,
        },
      });
      assert(result);
      assert(!result.user);

      RoleSchema.unVirtual(User.name);
    }

    // last drop
    await userModel.drop();
    await roleModel.drop();
  });
});

import {
  BaseSchema,
  getSchemaInjectedIndexes,
  getSchemaMetadata,
  InjectIndexes,
  Prop,
} from "./schema.ts";
import { assert, assertEquals, assertExists } from "../test.deps.ts";
import { close, connect, User, UserSchema } from "../tests/common.ts";
import { MongoFactory, Schema, SchemaFactory } from "./factory.ts";
import { ObjectId } from "../deps.ts";

Deno.test({
  name: "metadata",
  fn: async (t) => {
    await connect();
    await t.step("User meta", () => {
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

    await t.step("get User meta", () => {
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

    await t.step("extends", () => {
      @Schema()
      class A {
        @Prop({
          index: true,
        })
        name: string;
      }

      @Schema()
      class B extends A {
        @Prop({
          required: true,
        })
        age: string;
      }
      const schema = SchemaFactory.createForClass(A);
      assertEquals(schema.getMeta(), {
        name: {
          index: true,
        },
      });
      const schema2 = SchemaFactory.createForClass(B);
      assertEquals(schema2.getMeta(), {
        name: {
          index: true,
        },
        age: {
          required: true,
        },
      });
    });

    await t.step("InjectIndexes", () => {
      @Schema()
      @InjectIndexes([{
        key: {
          name: 1,
          age: -1,
        },
        name: "test",
      }])
      class A {
        @Prop()
        name: string;

        @Prop()
        age: number;
      }

      const options = getSchemaInjectedIndexes(A);
      assert(options);
      assertEquals(options, [{
        key: {
          name: 1,
          age: -1,
        },
        name: "test",
      }]);
    });

    await close();
  },
  sanitizeResources: false, // has TCP connections left open
  sanitizeOps: false,
});

Deno.test({
  name: "virtual",
  sanitizeResources: false, // has TCP connections left open
  sanitizeOps: false,
  fn: async (t) => {
    await connect();

    const userSchemaName = "user_schema_test";
    const roleSchemaName = "role_schema_test";
    @Schema(userSchemaName)
    class User extends BaseSchema {
      @Prop()
      group!: string;

      @Prop()
      title!: string;
    }

    class Role extends BaseSchema {
      @Prop()
      userId!: string;

      @Prop()
      name!: string;

      user?: User;
    }

    const RoleSchema = SchemaFactory.createForClass(Role, roleSchemaName);

    await t.step("populate", async () => {
      const roleModel = await MongoFactory.getModel<Role>(roleSchemaName);
      const userModel = await MongoFactory.getModel<User>(userSchemaName);
      const userData = {
        group: "base",
        title: "test",
      };
      const userId = await userModel.insertOne(userData);
      assert(userId instanceof ObjectId, "userId is not ObjectId");

      const roleId = await roleModel.insertOne({
        userId: userId.toString(),
        name: "normal",
      });
      assert(roleId instanceof ObjectId);

      {
        const UserVirtual = {
          ref: userSchemaName,
          localField: "userId",
          foreignField: "_id",
          justOne: true,
          isTransformLocalFieldToObjectID: true,
        };

        RoleSchema.virtual("user", UserVirtual);
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
        assert(!Array.isArray(result.user));
        assertEquals(result.user.group, userData.group);
        assertEquals(result.user.title, userData.title);

        RoleSchema.unVirtual("user");
      }

      { // test schema populate
        const UserVirtual = {
          ref: userSchemaName,
          localField: "userId",
          foreignField: "_id",
          justOne: true,
          isTransformLocalFieldToObjectID: true,
        };

        RoleSchema.virtual("user", UserVirtual);
        RoleSchema.populate("user");

        const result = await roleModel.findById(roleId, {
          projection: {
            name: 1,
            userId: 1,
          },
        });
        assert(result);
        assertEquals(result.name, "normal");
        assertEquals(result.userId, userId);
        assert(result.user);
        assert(!Array.isArray(result.user));
        assertEquals(result.user.group, userData.group);
        assertEquals(result.user.title, userData.title);

        RoleSchema.unVirtual("user");
        RoleSchema.unpopulate("user");
      }

      { // test ref not exists
        const UserVirtual = {
          ref: User,
          localField: "userId",
          foreignField: "_id",
          justOne: true,
          isTransformLocalFieldToObjectID: true,
        };
        RoleSchema.virtual("user", UserVirtual);
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

    await close();
  },
});

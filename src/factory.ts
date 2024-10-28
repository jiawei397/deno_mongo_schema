import {
  assert,
  blue,
  type Document,
  green,
  type MongoServerError,
  Reflect,
  yellow,
} from "../deps.ts";
import { MongoClient } from "./client.ts";
import { Model } from "./model.ts";
import { getFormattedModelName, SchemaHelper } from "./schema.ts";
import { Constructor } from "./types.ts";
import { ErrorCode } from "./error.ts";
import { Cache, clearCacheTimeout } from "./utils/cache.ts";

export class MongoFactory {
  static #client: MongoClient | undefined;
  static #initPromise: Promise<unknown> | undefined;

  static get client() {
    return this.#client;
  }

  static forRoot(url: string) {
    this.#client = new MongoClient(url);
    this.#initPromise = this.#client.initDB(url);
    return this.#initPromise;
  }

  static async close() {
    clearCacheTimeout();
    await this.#client?.close(true);
    this.#client = undefined;
    this.#initPromise = undefined;
  }

  /**
   * If you donnot pass the name, then will use the default name.
   *
   * If you want to use other name, you have to use `SchemaFactory.register` first and pass the name parameter.
   */
  static getModel<T extends Constructor>(
    Cls: T,
  ): Promise<Model<InstanceType<T>>>;
  static getModel<T extends Document>(
    name: string,
  ): Promise<Model<T>>;
  static getModel<T extends Document>(
    name: string,
  ): Promise<Model<T>>;
  // deno-lint-ignore no-explicit-any
  static getModel(modelNameOrCls: any) {
    let modelName;
    if (typeof modelNameOrCls === "string") {
      modelName = getFormattedModelName(modelNameOrCls);
    } else {
      modelName = getFormattedModelName(modelNameOrCls.name);
    }
    return this.getModelByName(modelName);
  }

  @Cache(-1)
  private static async getModelByName<T extends Document>(
    name: string,
  ): Promise<Model<T>> {
    assert(this.client, "must be inited");
    await this.#initPromise;
    const model = await this.client.getCollection(name);
    try {
      await model.initModel();
    } catch (e) {
      const err = e as MongoServerError;
      if (
        err.code === ErrorCode.IndexOptionsConflict ||
        err.code === ErrorCode.IndexKeySpecsConflict
      ) { //Error: MongoError: {"ok":0,"errmsg":"Index with name: username_1 already exists with different options","code":85,"codeName":"IndexOptionsConflict"}
        console.debug(
          `Init index caused conflict error: ${err.message}, and will try to drop it and create it again`,
        );
        await model!.syncIndexes().catch((err: Error) => {
          console.error(
            "Tried to syncIndexes but still failed and the reason is ",
            err,
          );
        });
      } else {
        console.error("InitModel error", err);
      }
    }
    console.log(`${yellow("Schema")} [${green(name)}] ${blue("init ok")}`);
    return model as unknown as Model<T>;
  }
}

/**
 * Register a model in the service and is used by [oak_nest](https://deno.land/x/oak_nest)
 */
export function InjectModel(modelNameOrCls: Constructor | string) {
  return (target: Constructor, _property: unknown, index: number) => {
    Reflect.defineMetadata(
      "design:inject" + index,
      () => {
        if (typeof modelNameOrCls === "string") {
          return MongoFactory.getModel(modelNameOrCls);
        } else {
          return MongoFactory.getModel(modelNameOrCls);
        }
      },
      target,
    );
  };
}

export class SchemaFactory {
  private static caches = new Map<string, SchemaHelper>();

  static register(name: string, schema: SchemaHelper) {
    this.caches.set(getFormattedModelName(name), schema);
  }

  static unregister(name: string) {
    this.caches.delete(getFormattedModelName(name));
  }

  static getSchemaByName(name: string) {
    return this.caches.get(getFormattedModelName(name));
  }

  static createForClass(Cls: Constructor, name = Cls.name) {
    let schema = this.getSchemaByName(name);
    if (!schema) {
      schema = new SchemaHelper(Cls);
      this.register(name, schema);
    }
    return schema;
  }

  static forFeature(arr: {
    name: string;
    schema: SchemaHelper;
  }[]) {
    arr.forEach((item) => {
      this.register(item.name, item.schema);
    });
  }
}

/**
 * An decorator to create Schema
 */
export function Schema(name?: string) {
  return (target: Constructor) => {
    SchemaFactory.createForClass(target, name);
  };
}

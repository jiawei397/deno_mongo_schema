// deno-lint-ignore-file no-explicit-any
import {
  assert,
  blue,
  green,
  MongoServerError,
  Reflect,
  yellow,
} from "../deps.ts";
import { MongoClient } from "./client.ts";
import { Model } from "./model.ts";
import { BaseSchema, getFormattedModelName } from "./schema.ts";
import { Constructor } from "./types.ts";
import { ErrorCode } from "./error.ts";
import { Cache } from "./utils/cache.ts";

export class MongoFactory {
  static #client: MongoClient | undefined;
  static #initPromise: Promise<any> | undefined;

  static get client() {
    if (!this.#client) {
      this.#client = new MongoClient();
    }
    return this.#client;
  }

  static forRoot(url: string) {
    this.#initPromise = this.client.initDB(url);
    return this.#initPromise;
  }

  /**
   * If you donnot pass the name, then will use the default name.
   *
   * If you want to use other name, you have to use `SchemaFactory.register` first and pass the name parameter.
   */
  static getModel<T extends Constructor>(
    Cls: T,
  ): Promise<Model<InstanceType<T>>>;
  static getModel<T>(
    name: string,
  ): Promise<Model<T>>;
  static getModel<T>(
    name: string,
  ): Promise<Model<T>>;
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
  private static async getModelByName<T>(
    name: string,
  ): Promise<Model<T>> {
    console.log("--------one---");
    assert(this.#initPromise, "must be inited");
    await this.#initPromise;
    const model = await this.client.getCollection<T>(name);
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
    return model;
  }
}

/**
 * Register a model in the service and is used by [oak_nest](https://deno.land/x/oak_nest)
 */
export function InjectModel(modelNameOrCls: Constructor | string) {
  return (target: Constructor, _property: any, index: number) => {
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
  private static caches = new Map<string, BaseSchema>();

  static register(name: string, schema: BaseSchema) {
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
      schema = new BaseSchema(Cls);
      this.register(name, schema);
    }
    return schema;
  }

  static forFeature(arr: {
    name: string;
    schema: BaseSchema;
  }[]) {
    arr.forEach((item) => {
      this.register(item.name, item.schema);
    });
  }
}

export function SchemaDecorator(name?: string) {
  return (target: Constructor) => {
    SchemaFactory.createForClass(target, name);
  };
}

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
import { getFormattedModelName, SchemaCls } from "./schema.ts";
import { Constructor } from "./types.ts";
import { ErrorCode } from "./error.ts";

export class MongoFactory {
  static #client: MongoClient | undefined;
  static #initPromise: Promise<any> | undefined;
  static #modelCaches = new Map<string, Promise<Model<any>>>();

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
  static getModel<T extends SchemaCls>(
    cls: T,
    name?: string,
  ): Promise<Model<InstanceType<T>>> {
    const modelName = name || getFormattedModelName(cls.name);
    return this.getModelByName<T>(modelName);
  }

  static async #getModelByName<T extends SchemaCls>(
    name: string,
  ): Promise<Model<InstanceType<T>>> {
    assert(this.#initPromise, "must be inited");
    await this.#initPromise;
    const model = await this.client.getCollection<InstanceType<T>>(name);
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

  static getModelByName<T extends SchemaCls>(name: string) {
    let promise = this.#modelCaches.get(name);
    if (promise) {
      return promise;
    }
    promise = this.#getModelByName<T>(name);
    this.#modelCaches.set(name, promise);
    return promise;
  }
}

/**
 * Register a model in the service and is used by [oak_nest](https://deno.land/x/oak_nest)
 */
export function InjectModel(modelNameOrCls: SchemaCls | string) {
  return (target: Constructor, _property: any, index: number) => {
    Reflect.defineMetadata("design:inject" + index, () => {
      if (typeof modelNameOrCls === "string") {
        return MongoFactory.getModelByName(modelNameOrCls);
      } else {
        return MongoFactory.getModel(modelNameOrCls);
      }
    }, target);
  };
}

export class SchemaFactory {
  static caches = new Map<string, SchemaCls>();

  static register(name: string, schema: SchemaCls) {
    this.caches.set(name, schema);
  }

  static getSchemaByName(name: string) {
    return this.caches.get(name);
  }

  static createForClass(schema: SchemaCls) {
    SchemaFactory.register(getFormattedModelName(schema.name), schema);
    return schema;
  }

  static forFeature(arr: {
    name: string;
    schema: SchemaCls;
  }[]) {
    arr.forEach((item) => {
      this.register(item.name, item.schema);
    });
  }
}

export function SchemaDecorator() {
  return (target: SchemaCls) => {
    SchemaFactory.createForClass(target);
  };
}

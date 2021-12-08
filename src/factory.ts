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
import { getModelByName, Schema, SchemaCls } from "./schema.ts";
import { Constructor } from "./types.ts";
import { ErrorCode } from "./error.ts";

export class MongoFactory {
  static #client: MongoClient | undefined;
  static #initPromise: Promise<any> | undefined;
  static #modelCaches = new Map<SchemaCls, Model<any>>();
  static #schemaCaches = new Map<SchemaCls, string>();

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

  static async getModel<T extends Schema>(
    cls: SchemaCls,
    name?: string,
  ): Promise<Model<T>> {
    assert(this.#initPromise, "must be inited");
    await this.#initPromise;
    let model = this.#modelCaches.get(cls);
    if (model) {
      return model;
    }
    const modelName = getModelByName(
      cls,
      name || this.getSchemaName(cls),
    );
    assert(modelName, "model name is empty");
    model = await this.client.getCollection<T>(
      modelName,
      cls,
    );
    this.#modelCaches.set(cls, model);
    await model.initModel()
      .catch((err: MongoServerError) => {
        if (err.code === ErrorCode.IndexOptionsConflict) { //Error: MongoError: {"ok":0,"errmsg":"Index with name: username_1 already exists with different options","code":85,"codeName":"IndexOptionsConflict"}
          return model!.syncIndexes();
        }
        return Promise.reject(err);
      })
      .catch(console.error); // this will not stop the app`s startup.
    console.log(`${yellow("Schema")} [${green(modelName)}] ${blue("init ok")}`);
    return model;
  }

  static registerSchema(name: string, cls: SchemaCls) {
    this.#schemaCaches.set(cls, name);
  }

  static getSchemaName(cls: SchemaCls) {
    return this.#schemaCaches.get(cls);
  }

  static forFeature(arr: {
    name: string;
    schema: typeof Schema;
  }[]) {
    arr.forEach((item) => {
      this.registerSchema(item.name, item.schema);
    });
  }
}

export const InjectModel = (Cls: Constructor) =>
  (target: Constructor, _property: any, index: number) => {
    Reflect.defineMetadata("design:inject" + index, {
      params: [Cls],
      fn: MongoFactory.getModel.bind(MongoFactory),
    }, target);
  };

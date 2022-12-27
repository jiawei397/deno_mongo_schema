// deno-lint-ignore-file
import {
  assert,
  Collection,
  Database,
  Document,
  OriginalMongoClient,
  yellow,
} from "../deps.ts";
import { SchemaFactory } from "./factory.ts";
import { Model } from "./model.ts";
import { getFormattedModelName, SchemaHelper } from "./schema.ts";

export class MongoClient extends OriginalMongoClient {
  #initedDBPromise?: Promise<Database>;
  // below is my extend functions
  initDB(uri: string) {
    if (!this.#initedDBPromise) {
      this.#initedDBPromise = this.connect()
        .then(() => {
          let db = uri.split("?")[0].split("/").at(-1);
          console.log("db: " + db);
          return this.db(db);
        })
        .then((database) => {
          console.info(
            `connected mongo：${yellow(uri)} `,
          );
          return database;
        });
    }
    return this.#initedDBPromise;
  }

  async getCollection(name: string) {
    assert(this.#initedDBPromise);
    const db = await this.#initedDBPromise;
    const schema = SchemaFactory.getSchemaByName(name);
    assert(schema, `Schema [${name}] must be registered`);
    const modelName = getFormattedModelName(name);
    return this.getCollectionByDb(db, modelName, schema);
  }

  async getCollectionByDb(
    db: Database,
    name: string,
    schema: SchemaHelper,
  ) {
    const collection = db.collection(name);
    return new Model(schema, collection);
  }
}

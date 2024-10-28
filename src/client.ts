import { assert, type Database, type Document, OriginalMongoClient, yellow } from "../deps.ts";
import { SchemaFactory } from "./factory.ts";
import { Model } from "./model.ts";
import { getFormattedModelName, type SchemaHelper } from "./schema.ts";

export class MongoClient extends OriginalMongoClient {
  #initedDBPromise?: Promise<Database>;
  // below is my extend functions
  initDB(uri: string): Promise<Database> {
    if (!this.#initedDBPromise) {
      this.#initedDBPromise = this.#initDB(uri);
    }
    return this.#initedDBPromise;
  }

  async #initDB(uri: string): Promise<Database> {
    await this.connect();
    const db = uri.split("?")[0].split("/").at(-1);
    console.info(`connected mongo：${yellow(uri)} `);
    return this.db(db);
  }

  async getCollection(name: string): Promise<Model<Document>> {
    assert(this.#initedDBPromise);
    const db = await this.#initedDBPromise;
    const schema = SchemaFactory.getSchemaByName(name);
    assert(schema, `Schema [${name}] must be registered`);
    const modelName = getFormattedModelName(name);
    return this.getCollectionByDb(db, modelName, schema);
  }

  private getCollectionByDb(db: Database, name: string, schema: SchemaHelper) {
    const collection = db.collection(name);
    return new Model(schema, collection);
  }

  override close(force?: boolean | undefined): Promise<void> {
    this.#initedDBPromise = undefined;
    return super.close(force);
  }
}

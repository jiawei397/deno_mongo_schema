// deno-lint-ignore-file
import {
  assert,
  BuildInfo,
  Cluster,
  ConnectOptions,
  Database,
  Document,
  ListDatabaseInfo,
  MongoDriverError,
  parse,
  yellow,
} from "../deps.ts";
import { SchemaFactory } from "./factory.ts";
import { Model } from "./model.ts";
import { SchemaCls } from "./schema.ts";

export class MongoClient {
  #cluster?: Cluster;
  #defaultDbName = "admin";
  #buildInfo?: BuildInfo;

  #initedDBPromise?: Promise<Database>;

  get buildInfo() {
    return this.#buildInfo;
  }

  async connect(
    options: ConnectOptions | string,
  ): Promise<Database> {
    try {
      const parsedOptions = typeof options === "string"
        ? await parse(options)
        : options;

      this.#defaultDbName = parsedOptions.db;
      const cluster = new Cluster(parsedOptions);
      await cluster.connect();
      await cluster.authenticate();
      await cluster.updateMaster();

      this.#cluster = cluster;
      this.#buildInfo = await this.runCommand(this.#defaultDbName, {
        buildInfo: 1,
      });
    } catch (e) {
      throw new MongoDriverError(`Connection failed: ${e.message || e}`);
    }
    return this.database((options as ConnectOptions).db);
  }

  async listDatabases(options: {
    filter?: Document;
    nameOnly?: boolean;
    authorizedCollections?: boolean;
    comment?: Document;
  } = {}): Promise<ListDatabaseInfo[]> {
    assert(this.#cluster);
    const { databases } = await this.#cluster.protocol.commandSingle("admin", {
      listDatabases: 1,
      ...options,
    });
    return databases;
  }

  // TODO: add test cases
  async runCommand<T = any>(db: string, body: Document): Promise<T> {
    assert(this.#cluster);
    return await this.#cluster.protocol.commandSingle(db, body);
  }

  database(name = this.#defaultDbName): Database {
    assert(this.#cluster);
    return new Database(this.#cluster, name);
  }

  close() {
    if (this.#cluster) {
      this.#cluster.close();
    }
  }

  // below is my extend functions
  initDB(db: string): Promise<Database> {
    if (!this.#initedDBPromise) {
      const arr = db.split("/");
      if (db.endsWith("/")) {
        arr.pop();
      }
      const dbName = arr.pop();
      const url = arr.join("/");
      this.#initedDBPromise = this.connect(url).then(() => {
        console.info(`connected mongo：${yellow(url)}`);
        return this.database(dbName!);
      });
    }
    return this.#initedDBPromise;
  }

  async getCollection<T = Document>(name: string) {
    assert(this.#initedDBPromise);
    const db = await this.#initedDBPromise;
    const schema = SchemaFactory.getSchemaByName(name);
    assert(schema, `Schema [${name}] must be registered`);
    return this.getCollectionByDb<T>(db, name, schema);
  }

  async getCollectionByDb<T>(
    db: Database,
    name: string,
    schema: SchemaCls,
  ) {
    assert(this.#cluster);
    const model = new Model<T>(
      this.#cluster.protocol,
      db.name,
      name,
    );
    model.setSchema(schema);
    return model;
  }
}

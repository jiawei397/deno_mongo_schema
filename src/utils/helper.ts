// deno-lint-ignore-file no-explicit-any
import { yellow } from "../../deps.ts";
import { MongoClient } from "../client.ts";
import { Collection } from "../collection/mod.ts";
import { Database } from "../database.ts";
import { getModel, SchemaCls } from "../schema.ts";

let connectedPromise: Promise<any>;
const client = new MongoClient();

export function closeConnection() {
  return client.close();
}

export function getDB(db: string): Promise<Database> {
  if (!connectedPromise) {
    const arr = db.split("/");
    if (db.endsWith("/")) {
      arr.pop();
    }
    const dbName = arr.pop();
    const url = arr.join("/");
    connectedPromise = client.connect(url).then(() => {
      console.info(`connected mongo：${yellow(url)}`);
      return client.database(dbName!);
    });
  }
  return connectedPromise;
}

export class BaseService {
  protected model: Collection<any> | undefined;

  constructor(db: Database, modelCls: SchemaCls, name?: string) {
    getModel(db, modelCls, name).then((model) => {
      this.model = model;
    });
  }
}

// class SchemaFactory {
//   db: Database;
//   constructor(db: Database) {
//     this.db = db;
//   }
// }

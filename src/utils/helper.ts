// deno-lint-ignore-file no-explicit-any
import { MongoClient } from "../client.ts";
import { Model } from "../model.ts";
import { Database } from "../../deps.ts";
import { getModelByName, SchemaCls } from "../schema.ts";

let client: MongoClient | undefined;

function getClient() {
  if (!client) {
    client = new MongoClient();
  }
  return client;
}

export function closeConnection() {
  const client = getClient();
  return client.close();
}

export function getDB(db: string): Promise<Database> {
  const client = getClient();
  return client.initDB(db);
}

export function getModel<T>(
  db: Database,
  cls: SchemaCls,
  name?: string,
): Promise<Model<T>> {
  const client = getClient();
  const modelName = getModelByName(cls, name);
  return client.getCollectionByDb<T>(db, modelName!, cls);
}

export class BaseService {
  protected model: Model<any> | undefined;

  constructor(db: Database, modelCls: SchemaCls, name?: string) {
    getModel(db, modelCls, name).then((model) => {
      this.model = model;
    });
  }
}

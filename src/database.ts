import { Collection } from "./collection/mod.ts";
import { SchemaCls } from "./schema.ts";
import { Cluster, Document, OriginalDatabase } from "../deps.ts";

export class Database extends OriginalDatabase {
  private cluster: Cluster;

  constructor(cluster: Cluster, readonly name: string) {
    super(cluster, name);
    this.cluster = cluster;
  }

  getCollection<T = Document>(name: string, schema?: SchemaCls) {
    return new Collection<T>(
      this.cluster.protocol,
      this.name,
      name,
      schema,
    );
  }
}

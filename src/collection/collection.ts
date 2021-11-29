// deno-lint-ignore-file no-explicit-any
import {
  blue,
  Bson,
  DeleteOptions,
  Document,
  Filter,
  FindOptions,
  InsertDocument,
  InsertOptions,
  OriginalCollection,
  UpdateFilter,
  WireProtocol,
  yellow,
} from "../../deps.ts";
import {
  getModelByName,
  initModel,
  SchemaCls,
  transferPopulateSelect,
} from "../schema.ts";
import {
  FindExOptions,
  MongoHookMethod,
  PopulateSelect,
  RealPopulateSelect,
  SchemaType,
  UpdateExOptions,
  VirtualTypeOptions,
} from "../types.ts";
import { transStringToMongoId } from "../utils/tools.ts";

export class Collection<T> extends OriginalCollection<T> {
  #schema: SchemaCls | undefined;

  constructor(
    protocol: WireProtocol,
    dbName: string,
    readonly name: string,
    schema?: SchemaCls,
  ) {
    super(protocol, dbName, name);
    this.#schema = schema;
  }

  private getPopulateMap(populates?: Record<string, PopulateSelect>) {
    let populateMap: Map<string, RealPopulateSelect> | undefined;
    if (populates) {
      populateMap = new Map();
      for (const key in populates) {
        populateMap.set(key, transferPopulateSelect(populates[key]));
      }
    } else {
      populateMap = this.#schema?.getPopulateMap();
    }
    return populateMap;
  }

  protected getPopulateParams() {
    return this.#schema?.getPopulateParams();
  }

  private _find(
    filter?: Filter<T>,
    options?: FindExOptions,
  ) {
    const {
      remainOriginId: _,
      populates,
      ...others
    } = options || {}; // must drop it otherwise will call error
    const populateParams = this.getPopulateParams();
    const populateMap = this.getPopulateMap(populates);
    if (populateParams && populateMap) {
      return this.findWithVirtual({
        populateMap,
        populateParams,
        filter,
        options,
      });
    } else {
      const res = super.find(
        filter,
        others,
      );
      if (options?.skip) {
        res.skip(options.skip);
      }
      if (options?.limit) {
        res.limit(options.limit);
      }
      if (options?.sort) {
        res.sort(options.sort);
      }
      return res;
    }
  }

  private findWithVirtual(virturalOptions: {
    populateMap: Map<string, PopulateSelect>;
    populateParams: Map<string, VirtualTypeOptions>;
    filter?: Document;
    options?: FindOptions;
  }) {
    const { populateMap, populateParams, filter, options } = virturalOptions;
    const paramsArray = [];
    if (filter) {
      paramsArray.push({
        $match: filter,
      });
    }
    if (options?.sort) {
      paramsArray.push({
        $sort: options.sort,
      });
    }
    if (options?.skip !== undefined) {
      paramsArray.push({
        $skip: options.skip,
      });
    }
    if (options?.limit) {
      paramsArray.push({
        $limit: options.limit,
      });
    }
    if (options?.projection) {
      paramsArray.push({
        $project: options.projection,
      });
    }
    const addFields: any = {};
    for (const [key, value] of populateParams) {
      if (!populateMap.has(key)) {
        continue;
      }
      let from = value.ref;
      if (typeof from === "function") {
        from = getModelByName(from);
      }
      if (
        value.isTransformLocalFieldToObjectID ||
        value.isTransformObjectIDToLocalField
      ) {
        if (value.isTransformLocalFieldToObjectID) {
          addFields[value.localField] = {
            $toObjectId: "$" + value.localField,
          };
        } else if (value.isTransformLocalFieldToString) {
          addFields[value.localField] = {
            $toString: "$" + value.localField,
          };
        }
        paramsArray.push({
          $addFields: addFields,
        });
      }
      paramsArray.push({
        $lookup: {
          from,
          localField: value.localField,
          foreignField: value.foreignField,
          as: key,
        },
      });
    }

    return this.aggregate(paramsArray);
  }

  private async preFind(
    hookType: MongoHookMethod,
    filter?: Document,
    options?: FindOptions,
  ) {
    this.formatBsonId(filter);
    await this.preHooks(hookType, filter, options);
  }

  private async afterFind(
    docs: unknown | unknown[],
    filter?: Document,
    options?: FindOptions,
  ) {
    if (Array.isArray(docs)) {
      await this.postHooks(MongoHookMethod.findMany, docs, filter, options);
      docs.forEach((doc) => this.formatFindDoc(doc, options));
    } else {
      await this.postHooks(MongoHookMethod.findOne, docs, filter, options);
      this.formatFindDoc(docs, options);
    }
  }

  async findOne(
    filter?: Filter<T>,
    options?: FindExOptions,
  ) {
    await this.preFind(MongoHookMethod.findOne, filter, options);
    const doc = await this._find(filter, options).next();
    await this.afterFind(doc, filter, options);
    return doc as T;
  }

  async findMany(
    filter?: Filter<T>,
    options?: FindExOptions,
  ) {
    await this.preFind(MongoHookMethod.findMany, filter, options);
    const docs = await this._find(filter, options).toArray();
    await this.afterFind(docs, filter, options);
    return docs as T[];
  }

  private formatFindDoc(doc: any, options?: FindExOptions) {
    if (!doc) {
      return;
    }
    const { remainOriginId, populates } = options || {};
    this.transferId(doc, remainOriginId);
    const params = this.getPopulateParams();
    if (!params) {
      return;
    }
    const map = this.getPopulateMap(populates);
    if (!map) {
      return;
    }
    for (const [key, value] of params) {
      if (!map.has(key) || !doc[key]) {
        continue;
      }
      const arr = doc[key] as any[];
      const pickMap = map.get(key);
      for (let i = 0; i < arr.length; i++) {
        const item = arr[i];
        if (value.justOne) {
          doc[key] = this.pickVirtual(item, pickMap!, remainOriginId);
          break;
        } else {
          arr[i] = this.pickVirtual(item, pickMap!, remainOriginId);
        }
      }
    }
  }

  private transferId(doc: any, remainOriginId?: boolean) {
    const hasOwnId = "id" in doc;
    if (!hasOwnId) {
      doc.id = doc._id.toString();
      if (!remainOriginId) {
        delete doc._id;
      }
    }
  }

  private pickVirtual(
    virtualDoc: any,
    pickMap: Exclude<PopulateSelect, string>,
    remainOriginId?: boolean,
  ) {
    let needPick = false; // if specified some key, then will pick this keys
    if (typeof pickMap === "object") {
      for (const k in pickMap) {
        if (pickMap[k]) {
          needPick = true;
          break;
        }
      }
    }
    if (needPick) {
      const newObj: any = {};
      if (typeof pickMap === "object") {
        for (const k in pickMap) {
          if (pickMap[k]) {
            newObj[k] = virtualDoc[k];
          }
        }
        if (pickMap.id) {
          newObj._id = virtualDoc._id;
          this.transferId(newObj, remainOriginId);
        }
      }
      return newObj;
    } else {
      if (pickMap === true) {
        this.transferId(virtualDoc, remainOriginId);
      } else {
        for (const k in pickMap) {
          if (!pickMap[k]) {
            delete virtualDoc[k];
          }
        }
        if (pickMap.id) {
          this.transferId(virtualDoc, remainOriginId);
        }
      }
      return virtualDoc;
    }
  }

  private formatBsonId(filter?: Document) {
    if (filter) {
      if (filter?._id) {
        const id = filter._id;
        if (typeof id === "string") {
          filter._id = transStringToMongoId(id);
        } else if (Array.isArray(id.$in)) {
          id.$in = id.$in.map((_id: any) => {
            return transStringToMongoId(_id);
          });
        }
      }
    }
  }

  /**
   * this will remove after some version
   * @deprecated
   */
  save = this.insert;

  private async preHooks(hook: MongoHookMethod, ...args: any[]) {
    if (!this.#schema) {
      return;
    }

    const fns = this.#schema.getPreHookByMethod(hook);
    if (fns) {
      await Promise.all(fns.map((fn) => fn(...args)));
    }
  }

  private async postHooks(hook: MongoHookMethod, ...args: any[]) {
    if (!this.#schema) {
      return;
    }
    const fns = this.#schema.getPostHookByMethod(hook);
    if (fns) {
      await Promise.all(fns.map((fn) => fn(...args)));
    }
  }

  // check before insert
  private async preInsert(docs: Document[]) {
    if (!this.#schema) {
      return;
    }

    await this.preHooks(MongoHookMethod.create, docs);

    const data = this.#schema.getMeta();
    for (const key in data) {
      const val: SchemaType = data[key];
      docs.forEach((doc) => {
        for (const dk in doc) {
          if (!Object.prototype.hasOwnProperty.call(data, dk) && dk !== "_id") {
            console.warn(
              yellow(`remove undefined key [${blue(dk)}] in Schema`),
            );
            delete doc[dk];
          }
        }
        if (doc[key] === undefined && val.default !== undefined) {
          if (typeof val.default === "function") {
            if (val.default === Date.now) { // means to get a new Date
              doc[key] = new Date();
            } else {
              doc[key] = val.default();
            }
          } else {
            doc[key] = val.default;
          }
        }
        if (val.required) {
          if (doc[key] == null) {
            if (Array.isArray(val.required)) {
              if (val.required[0]) {
                throw new Error(val.required[1]);
              }
            } else {
              throw new Error(`${key} is required!`);
            }
          }
        }
        if (val.validate) {
          const result = val.validate.validator(doc[key]);
          if (!result) {
            throw new Error(val.validate.message);
          }
        }
      });
    }
  }

  private async afterInsert(docs: Document[]) {
    await this.postHooks(MongoHookMethod.create, docs);
  }

  async insertMany(
    docs: InsertDocument<T>[],
    options?: InsertOptions,
  ) {
    await this.preInsert(docs);
    const res = await super.insertMany(docs, options);
    await this.afterInsert(docs);
    return res;
  }

  private async preFindOneAndUpdate(
    filter: Document,
    update: Document,
    options?: UpdateExOptions,
  ) {
    this.formatBsonId(filter);
    await this.preHooks(
      MongoHookMethod.findOneAndUpdate,
      filter,
      update,
      options,
    );
  }

  private async afterFindOneAndUpdate(
    doc?: Document,
  ) {
    await this.postHooks(MongoHookMethod.findOneAndUpdate, doc);
  }

  findByIdAndUpdate(
    id: string | Bson.ObjectId,
    update: UpdateFilter<T>,
    options?: UpdateExOptions,
  ) {
    const filter = {
      _id: transStringToMongoId(id),
    };
    return this.findOneAndUpdate(filter, update, options);
  }

  findById(
    id: string | Bson.ObjectId,
    options?: FindOptions,
  ) {
    const filter = {
      _id: transStringToMongoId(id),
    };
    return this.findOne(filter, options);
  }

  async findOneAndUpdate(
    filter: Filter<T>,
    update: UpdateFilter<T>,
    options?: UpdateExOptions,
  ) {
    await this.preFindOneAndUpdate(filter, update, options);
    const res = await this.updateOne(filter, update, options);
    if (options?.new) {
      if (res.matchedCount > 0) {
        const updatedDoc = await this.findOne(filter);
        await this.afterFindOneAndUpdate(updatedDoc);
        return updatedDoc;
      } else {
        return null;
      }
    }
    return res;
  }

  private async preUpdate(
    filter: Document,
    doc: Document,
    options?: UpdateExOptions,
  ) {
    this.formatBsonId(filter);

    if (this.#schema) {
      const data = this.#schema.getMeta();
      const removeKey = (doc: any) => {
        for (const dk in doc) {
          if (!Object.prototype.hasOwnProperty.call(doc, dk)) {
            continue;
          }
          if (dk.startsWith("$")) { // mean is mongo query
            removeKey(doc[dk]);
          } else {
            if (!Object.prototype.hasOwnProperty.call(data, dk)) {
              console.warn(
                yellow(`remove undefined key [${blue(dk)}] in Schema`),
              );
              delete doc[dk];
            }
          }
        }
      };
      removeKey(doc);
    }

    // add modifyTime
    if (doc["$set"]) {
      doc["$set"]["modifyTime"] = new Date();
    } else {
      doc["$set"] = {
        modifyTime: new Date(),
      };
    }
    await this.preHooks(MongoHookMethod.update, filter, doc, options);
  }

  private async afterUpdate(
    filter: Document,
    doc: Document,
    options?: UpdateExOptions,
  ) {
    await this.postHooks(MongoHookMethod.update, filter, doc, options);
  }

  async updateMany(
    filter: Filter<T>,
    doc: UpdateFilter<T>,
    options?: UpdateExOptions,
  ) {
    await this.preUpdate(filter, doc, options);
    const res = await super.updateMany(filter, doc, options);
    await this.afterUpdate(filter, doc, options);
    return res;
  }

  private async preDelete(
    filter: Document,
    options?: DeleteOptions,
  ) {
    this.formatBsonId(filter);
    await this.preHooks(MongoHookMethod.delete, filter, options);
  }

  private async afterDelete(
    filter: Document,
    options?: DeleteOptions,
    res?: number,
  ) {
    await this.postHooks(MongoHookMethod.delete, filter, options, res);
  }

  async deleteMany(
    filter: Filter<T>,
    options?: DeleteOptions,
  ): Promise<number> {
    await this.preDelete(filter, options);
    const res = await super.deleteMany(filter, options);
    await this.afterDelete(filter, options, res);
    return res;
  }

  delete = this.deleteMany;

  deleteOne(
    filter: Filter<T>,
    options?: DeleteOptions,
  ) {
    return this.delete(filter, { ...options, limit: 1 });
  }

  findOneAndDelete = this.deleteOne;

  deleteById(id: string) {
    const filter = {
      _id: transStringToMongoId(id),
    };
    return this.deleteOne(filter);
  }

  findByIdAndDelete = this.deleteById;

  async syncIndexes() {
    if (!this.#schema) {
      return false;
    }
    await this.dropIndexes({
      index: "*",
    });
    await initModel(this, this.#schema);
    return true;
  }
}

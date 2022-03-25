// deno-lint-ignore-file no-explicit-any
import {
  AggregateOptions,
  AggregatePipeline,
  assert,
  blue,
  Bson,
  Collection,
  CountOptions,
  CreateIndexOptions,
  DeleteOptions,
  DistinctOptions,
  Document,
  DropIndexOptions,
  Filter,
  FindOptions,
  hasAtomicOperators,
  IndexOptions,
  InsertDocument,
  InsertOptions,
  UpdateFilter,
  yellow,
} from "../deps.ts";
import {
  BaseSchema,
  getFormattedModelName,
  transferPopulateSelect,
} from "./schema.ts";
import {
  FindAndUpdateExOptions,
  FindExOptions,
  InsertExOptions,
  MongoHookMethod,
  PopulateSelect,
  SchemaType,
  UpdateExOptions,
  VirtualTypeOptions,
} from "./types.ts";
import { transToMongoId } from "./utils/tools.ts";

export class Model<T> {
  #collection: Collection<T>;

  #schema: BaseSchema;

  constructor(
    schema: BaseSchema,
    collection: Collection<T>,
  ) {
    this.#schema = schema;
    this.#collection = collection;
  }

  get collection() {
    return this.#collection;
  }

  private get schema() {
    return this.#schema;
  }

  private getPopulateMap(populates?: Record<string, PopulateSelect>) {
    if (populates) {
      const populateMap = new Map();
      for (const key in populates) {
        if (populates[key]) {
          populateMap.set(key, transferPopulateSelect(populates[key]));
        }
      }
      if (populateMap.size > 0) {
        return populateMap;
      }
    } else {
      return this.schema?.getPopulateMap();
    }
  }

  private getPopulateParams() {
    return this.schema?.getPopulateParams();
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
      const res = this.#collection.find(
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
    options?: FindExOptions;
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
      const from = typeof value.ref === "string"
        ? getFormattedModelName(value.ref)
        : getFormattedModelName(value.ref.name);
      if (
        // transform id to mongoid or monogoid to string
        value.isTransformLocalFieldToObjectID ||
        value.isTransformLocalFieldToString
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
      const lookup: any = {
        from,
        as: key,
        let: { localField: "$" + value.localField },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ["$" + value.foreignField, "$$localField"] },
              ...value.match,
            },
          },
        ],
      };
      if (value.count) {
        lookup.pipeline.push(
          { $group: { _id: null, "count": { "$sum": 1 } } },
        );
      }
      paramsArray.push({
        $lookup: lookup,
      });
    }

    return this.#collection.aggregate(paramsArray);
  }

  private async preFind(
    hookType: MongoHookMethod,
    filter?: Document,
    options?: FindExOptions,
  ) {
    this.formatBsonId(filter);
    if (options) {
      for (const key in options) {
        if ((options as any)[key] === undefined) {
          delete (options as any)[key];
        }
      }
    }
    await this.preHooks(hookType, filter, options);
  }

  private async afterFind(
    docs: unknown | unknown[],
    filter?: Document,
    options?: FindExOptions,
  ) {
    if (Array.isArray(docs)) {
      await this.postHooks(MongoHookMethod.findMany, docs, filter, options);
      docs.forEach((doc) => this.formatFindDoc(doc, options));
    } else {
      await this.postHooks(MongoHookMethod.findOne, docs, filter, options);
      this.formatFindDoc(docs, options);
    }
  }

  /**
   * This is the origin find method,
   * but it will not call pre/post hooks, will not format the id, and not use virtual populate.
   *
   * So it is not recommended to use it directly.
   * Please use findOne and findMany instead.
   * @deprecated
   */
  find(
    filter?: Filter<T>,
    options?: FindOptions,
  ) {
    return this.#collection.find(filter, options);
  }

  async findOne(
    filter?: Filter<T>,
    options?: FindExOptions,
  ) {
    await this.preFind(MongoHookMethod.findOne, filter, options);
    const doc = await this._find(filter, options).next();
    await this.afterFind(doc, filter, options);
    return doc as T | undefined;
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
      if (populates && !populates[key]) {
        delete doc[key];
        continue;
      }
      const arr = doc[key] as any[];
      const pickMap = map.get(key);
      if (arr?.length === 0) {
        if (value.count) {
          doc[key] = 0;
        } else if (value.justOne) {
          doc[key] = null;
        }
      } else {
        for (let i = 0; i < arr.length; i++) {
          const item = arr[i];
          if (value.count) {
            doc[key] = item.count;
            break;
          } else {
            if (value.justOne) {
              doc[key] = this.pickVirtual(item, pickMap!, remainOriginId);
              break;
            } else {
              arr[i] = this.pickVirtual(item, pickMap!, remainOriginId);
            }
          }
        }
      }
    }
  }

  private transferId(doc: any, remainOriginId?: boolean) {
    if (!doc) {
      return doc;
    }
    const hasOwnId = "id" in doc;
    if (!hasOwnId && doc._id) {
      doc.id = doc._id.toString();
      if (!remainOriginId) {
        delete doc._id;
      }
    }
    return doc;
  }

  private pickVirtual(
    virtualDoc: any,
    pickMap: Exclude<PopulateSelect, string | string[]>,
    remainOriginId?: boolean,
  ) {
    let needPick = false; // if specified some key, then will only pick this keys
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
      if (typeof pickMap === "boolean") {
        if (pickMap) {
          this.transferId(virtualDoc, remainOriginId);
        }
      } else {
        for (const k in pickMap) {
          if (!pickMap[k]) {
            delete virtualDoc[k];
          }
        }
        // if (pickMap.id) {
        this.transferId(virtualDoc, remainOriginId);
        // }
      }
      return virtualDoc;
    }
  }

  private formatBsonId(filter?: Document) {
    if (!filter) {
      return;
    }
    if (filter._id) {
      const id = filter._id;
      if (typeof id === "string") {
        filter._id = transToMongoId(id);
      } else if (Array.isArray(id.$in)) {
        id.$in = id.$in.map(transToMongoId);
      }
    }
    if (Array.isArray(filter.$or)) {
      filter.$or.forEach(this.formatBsonId.bind(this));
    }
    if (Array.isArray(filter.$and)) {
      filter.$and.forEach(this.formatBsonId.bind(this));
    }
  }

  private async preHooks(hook: MongoHookMethod, ...args: any[]) {
    if (!this.schema) {
      return;
    }

    const fns = this.schema.getPreHookByMethod(hook);
    if (fns) {
      await Promise.all(fns.map((fn) => fn.apply(this, args)));
    }
  }

  private async postHooks(hook: MongoHookMethod, ...args: any[]) {
    if (!this.schema) {
      return;
    }
    const fns = this.schema.getPostHookByMethod(hook);
    if (fns) {
      await Promise.all(fns.map((fn) => fn.apply(this, args)));
    }
  }

  private async preInsert(docs: Document[]) {
    docs.forEach((doc) => {
      if (doc._id) {
        doc._id = transToMongoId(doc._id);
      }
    });
    if (!this.schema) {
      return;
    }

    await this.preHooks(MongoHookMethod.create, docs);

    this.checkMetaBeforeInsert(docs);
  }

  private getFormattedDefault(defaultData: any) {
    if (defaultData !== undefined) {
      if (typeof defaultData === "function") {
        if (defaultData === Date.now || defaultData === Date) { // means to get a new Date
          return new Date();
        } else {
          return defaultData();
        }
      }
    }
    return defaultData;
  }

  private checkMetaBeforeInsert(docs: Document[]) {
    const data = this.schema.getMeta();
    if (!data) {
      return;
    }
    for (const key in data) {
      const val: SchemaType = data[key];
      if (!val || Object.keys(val).length === 0) {
        continue;
      }
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
          doc[key] = this.getFormattedDefault(val.default);
        }
        const required = val.required;
        if (required) {
          if (doc[key] == null) {
            if (Array.isArray(required)) {
              if (required[0]) {
                throw new Error(required[1]);
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

  async insertOne(doc: InsertDocument<T>, options?: InsertOptions) {
    const { insertedIds } = await this.insertMany([doc], options);
    return insertedIds[0];
  }

  async insertMany(
    docs: InsertDocument<T>[],
    options?: InsertExOptions,
  ) {
    const clonedDocs = docs.map((doc) => ({ ...doc }));
    await this.preInsert(clonedDocs);
    const res = await this.#collection.insertMany(clonedDocs, options);
    await this.afterInsert(clonedDocs);
    return res;
  }

  /** @deprecated please use insertOne instead */
  async save(doc: InsertDocument<T>, options?: InsertExOptions) {
    const id = await this.insertOne(doc, options);
    const res = {
      ...doc,
      _id: id,
    };
    this.transferId(res, options?.remainOriginId);

    const meta = this.schema.getMeta();
    if (meta) {
      const newDoc: any = res;
      Object.keys(meta).forEach((key) => {
        const val: SchemaType = meta[key];
        if (!val || newDoc[key] !== undefined || val.default === undefined) {
          return;
        }
        newDoc[key] = this.getFormattedDefault(val.default);
      });
    }
    return res;
  }

  private async preFindOneAndUpdate(
    filter: Document,
    update: Document,
    options?: UpdateExOptions,
  ) {
    await this.preUpdateHook(
      MongoHookMethod.findOneAndUpdate,
      filter,
      update,
      options,
    );
  }

  private async afterFindOneAndUpdate(
    doc?: Document,
    options?: FindAndUpdateExOptions,
  ) {
    await this.postHooks(MongoHookMethod.findOneAndUpdate, doc);
    if (options?.new) {
      this.transferId(doc, options.remainOriginId);
    }
  }

  findByIdAndUpdate(
    id: string | Bson.ObjectId,
    update: UpdateFilter<T>,
    options?: FindAndUpdateExOptions,
  ) {
    const filter = {
      _id: transToMongoId(id),
    };
    if (options) {
      return this.findOneAndUpdate(filter, update, options);
    }
    return this.findOneAndUpdate(filter, update);
  }

  findById(
    id: string | Bson.ObjectId,
    options?: FindExOptions,
  ) {
    const filter = {
      _id: transToMongoId(id),
    };
    return this.findOne(filter, options);
  }

  async findOneAndUpdate(
    filter: Filter<T>,
    update: UpdateFilter<T>,
    options: FindAndUpdateExOptions = {},
  ) {
    await this.preFindOneAndUpdate(filter, update, options);
    const updatedDoc = await this.#collection.findAndModify(filter, {
      update,
      sort: options?.sort,
      new: options?.new,
      upsert: options?.upsert,
      fields: options?.fields,
    });
    await this.afterFindOneAndUpdate(updatedDoc, options);
    return updatedDoc;
  }

  /**
   * pre upate hook, will format the update filter
   */
  private async preUpdateHook(
    hook: MongoHookMethod,
    filter: Document,
    doc: Document,
    options?: UpdateExOptions,
  ) {
    this.formatBsonId(filter);

    if (this.schema) {
      const data = this.schema.getMeta();
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

    const now = new Date();
    if (!hasAtomicOperators(doc)) {
      const oldDoc = { ...doc, modifyTime: now };
      for (const key in doc) {
        if (Object.prototype.hasOwnProperty.call(doc, key)) {
          delete doc[key];
        }
      }
      doc["$set"] = oldDoc;
      doc["$setOnInsert"] = {
        createTime: now,
      };
    } else {
      // add modifyTime
      if (doc["$set"]) {
        doc["$set"]["modifyTime"] = now;
      } else {
        doc["$set"] = {
          modifyTime: now,
        };
      }
      // add createTime
      if (doc["$setOnInsert"]) {
        doc["$setOnInsert"]["createTime"] = now;
      } else {
        doc["$setOnInsert"] = {
          createTime: now,
        };
      }
    }
    await this.preHooks(hook, filter, doc, options);
  }
  private async preUpdate(
    filter: Document,
    doc: Document,
    options?: UpdateExOptions,
  ) {
    await this.preUpdateHook(MongoHookMethod.update, filter, doc, options);
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
    const res = await this.#collection.updateMany(filter, doc, options);
    await this.afterUpdate(filter, doc, options);
    return res;
  }

  async updateOne(
    filter: Filter<T>,
    update: UpdateFilter<T>,
    options?: UpdateExOptions,
  ) {
    await this.preUpdate(filter, update, options);
    const res = await this.#collection.updateOne(filter, update, options);
    await this.afterUpdate(filter, update, options);
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
    const res = await this.#collection.deleteMany(filter, options);
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

  deleteById(id: string | Bson.ObjectId) {
    const filter = {
      _id: transToMongoId(id),
    };
    return this.deleteOne(filter);
  }

  findByIdAndDelete = this.deleteById;

  distinct(key: string, query?: Filter<T>, options?: DistinctOptions) {
    return this.#collection.distinct(key, query, options);
  }

  aggregate<U = T>(
    pipeline: AggregatePipeline<U>[],
    options?: AggregateOptions,
  ) {
    return this.#collection.aggregate(pipeline, options);
  }

  async syncIndexes() {
    if (!this.#schema) {
      return false;
    }
    await this.dropIndexes({
      index: "*",
    });
    await this.initModel();
    return true;
  }

  dropIndexes(options: DropIndexOptions) {
    return this.#collection.dropIndexes(options);
  }

  drop() {
    return this.#collection.drop();
  }

  listIndexes() {
    return this.#collection.listIndexes();
  }

  createIndexes(options: CreateIndexOptions) {
    return this.#collection.createIndexes(options);
  }

  countDocuments(filter?: Filter<T>, options?: CountOptions) {
    this.formatBsonId(filter);
    return this.#collection.countDocuments(filter, options);
  }

  async initModel() {
    assert(this.schema, "schema is not defined");
    const data = this.schema.getMeta();
    const indexes: IndexOptions[] = [];
    for (const key in data) {
      const map: SchemaType = data[key];
      if (!map || Object.keys(map).length === 0 || !map.index) {
        continue;
      }
      const {
        index,
        required: _required,
        default: _default,
        validate: _validate,
        ...otherParams
      } = map;
      indexes.push({
        expireAfterSeconds: map.expires,
        name: key + "_1",
        key: { [key]: index === "text" ? "text" : 1 },
        ...otherParams,
      });
    }

    if (indexes.length === 0) {
      return;
    }
    await this.#collection.createIndexes({
      indexes,
    });
  }
}

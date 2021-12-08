// deno-lint-ignore-file no-explicit-any ban-types
import {
  Bson,
  Document,
  Filter,
  FindOptions,
  IndexOptions,
  InsertOptions,
  UpdateOptions,
} from "../deps.ts";

export type PopulateSelect = string | Record<string, 0 | 1> | true;

export type RealPopulateSelect = Exclude<PopulateSelect, string>;

export type ExOptions = {
  remainOriginId?: boolean; // is keep _id
};

export type FindExOptions = FindOptions & {
  populates?: Record<string, PopulateSelect>;
} & ExOptions;

export type InsertExOptions = InsertOptions & ExOptions;

export interface UpdateExOptions extends UpdateOptions {
  new?: boolean;
  /** @deprecated Please drop it soon */
  useFindAndModify?: boolean;
}

export type Constructor = new (...args: any[]) => any;

export enum MongoHookMethod {
  create,
  update,
  delete,
  findMany,
  findOne,
  findOneAndUpdate,
}

export type MongoHookCallback = (...args: any[]) => void;

export type Hooks = Map<MongoHookMethod, MongoHookCallback[]>;

export interface SchemaType extends Partial<IndexOptions> {
  index?: boolean | "text";

  /**
   * Adds a required validator to this SchemaType
   */
  required?: boolean | [required: boolean, errorMsg: string];

  /**
   * It can be a function or be an real object. If you want to use current Date, you can set it to `Date.now`.
   */
  default?: () => any | any;

  /**
   * An alias as expireAfterSeconds
   */
  expires?: number; // seconds

  validate?: {
    validator: (value: any) => boolean;
    message: string;
  };
}

export type Target = Constructor & {
  [x: string]: any;
};

export type TargetInstance = any;

export interface VirtualTypeOptions {
  /** If `ref` is not nullish, this becomes a populated virtual. */
  ref: Constructor;

  /**  The local field to populate on if this is a populated virtual. */
  localField: string;

  /** The foreign field to populate on if this is a populated virtual. */
  foreignField: string;

  /**
   * By default, a populated virtual is an array. If you set `justOne`,
   * the populated virtual will be a single doc or `null`.
   */
  justOne?: boolean;

  /** If you set this to `true`, Mongoose will call any custom getters you defined on this virtual. */
  getters?: boolean;

  /**
   * If you set this to `true`, `populate()` will set this virtual to the number of populated
   * documents, as opposed to the documents themselves, using `Query#countDocuments()`.
   */
  count?: boolean;

  /** Add an extra match condition to `populate()`. */
  match?: Filter<any> | Function;

  /** Add a default `limit` to the `populate()` query. */
  limit?: number;

  /** Add a default `skip` to the `populate()` query. */
  skip?: number;

  /**
   * For legacy reasons, `limit` with `populate()` may give incorrect results because it only
   * executes a single query for every document being populated. If you set `perDocumentLimit`,
   * Mongoose will ensure correct `limit` per document by executing a separate query for each
   * document to `populate()`. For example, `.find().populate({ path: 'test', perDocumentLimit: 2 })`
   * will execute 2 additional queries if `.find()` returns 2 documents.
   */
  perDocumentLimit?: number;

  /** Additional options like `limit` and `lean`. */
  // options?: QueryOptions;

  isTransformLocalFieldToString?: boolean;
  isTransformLocalFieldToObjectID?: boolean;

  /** Additional options for plugins */
  [extra: string]: any;
}

export interface VirtualType {
  /** Applies getters to `value`. */
  applyGetters(value: any, doc: Document): any;

  /** Applies setters to `value`. */
  applySetters(value: any, doc: Document): any;

  /** Adds a custom getter to this virtual. */
  get(fn: Function): this;

  /** Adds a custom setter to this virtual. */
  set(fn: Function): this;
}

export type UpdateOneResult = {
  upsertedId: Bson.ObjectId;
  upsertedCount: number;
  matchedCount: number;
  modifiedCount: number;
};

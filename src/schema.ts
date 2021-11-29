// deno-lint-ignore-file no-explicit-any
import { green } from "../deps.ts";
import { Collection } from "./collection/mod.ts";
import { Database } from "./database.ts";
import {
  Constructor,
  Hooks,
  MongoHookCallback,
  MongoHookMethod,
  PopulateSelect,
  RealPopulateSelect,
  SchemaType,
  Target,
  TargetInstance,
  VirtualTypeOptions,
} from "./types.ts";

export const metadataCache = new Map();
let modelCaches: Map<SchemaCls, any> | undefined;
const modelNameCaches = new Map<Constructor, string>();

export const instanceCache = new Map();

export function transferPopulateSelect(
  select?: PopulateSelect,
): RealPopulateSelect {
  let _select: any = select || true;
  if (typeof select === "string") {
    _select = {};
    select.split(" ").forEach((item) => {
      if (item.startsWith("-")) {
        _select[item.substr(1)] = 0;
      } else {
        _select[item] = 1;
      }
    });
  }
  return _select;
}

export class Schema {
  static preHooks: Hooks = new Map();
  static postHooks: Hooks = new Map();

  static populateMap: Map<string, RealPopulateSelect> = new Map();
  static populateParams: Map<string, VirtualTypeOptions> = new Map();

  static pre(method: MongoHookMethod, callback: MongoHookCallback) {
    return this.hook(this.preHooks, method, callback);
  }
  static post(method: MongoHookMethod, callback: MongoHookCallback) {
    return this.hook(this.postHooks, method, callback);
  }

  static clearHooks() {
    this.preHooks.clear();
    this.postHooks.clear();
  }

  static hook(
    hooks: Hooks,
    method: MongoHookMethod,
    callback: MongoHookCallback,
  ) {
    let arr = hooks.get(method);
    if (!arr) {
      arr = [];
      hooks.set(method, arr);
    }
    arr.push(callback.bind(this));
    return arr;
  }

  /** Specifies paths which should be populated with other documents. */
  static populate(
    path: string,
    select?: PopulateSelect,
  ) {
    const _select = transferPopulateSelect(select);
    this.populateMap.set(path, _select);
    return this;
  }

  static getMeta() {
    const map = getMetadata(this);
    const baseMap = getMetadata(Schema);
    return {
      ...baseMap,
      ...map,
    };
  }

  static getPreHookByMethod(
    method: MongoHookMethod,
  ): MongoHookCallback[] | undefined {
    return this.preHooks.get(method);
  }

  static getPostHookByMethod(
    method: MongoHookMethod,
  ): MongoHookCallback[] | undefined {
    return this.postHooks.get(method);
  }

  static virtual(name: string, options: VirtualTypeOptions) {
    this.populateParams.set(name, options);
    return this;
  }

  static getPopulateMap() {
    if (this.populateMap.size === 0) {
      return;
    }
    return this.populateMap;
  }

  static getPopulateParams() {
    if (this.populateParams.size === 0) {
      return;
    }
    return this.populateParams;
  }

  @Prop({
    default: Date.now,
  })
  createTime?: Date;

  @Prop({
    default: Date.now,
  })
  modifyTime?: Date;

  _id!: string; // default id
}

export type SchemaCls = typeof Schema;

export function getInstance(cls: Target) {
  if (instanceCache.has(cls)) {
    return instanceCache.get(cls);
  }
  const instance = new cls();
  instanceCache.set(cls, instance);
  return instance;
}

export function addMetadata(
  target: Target,
  propertyKey: string,
  props: any = {},
) {
  const instance = getInstance(target);
  let map = metadataCache.get(instance);
  if (!map) {
    map = {};
    metadataCache.set(instance, map);
  }
  map[propertyKey] = props;
}

export function getMetadata(
  target: Target,
  propertyKey?: string,
) {
  const map = metadataCache.get(getInstance(target));
  if (propertyKey) {
    return map[propertyKey];
  }
  return map;
}

export function Prop(props?: SchemaType) {
  return function (target: TargetInstance, propertyKey: string) {
    addMetadata(target.constructor, propertyKey, props);
    return target;
  };
}

export function getModelByName(cls: Constructor, name?: string) {
  if (modelNameCaches.has(cls)) {
    return modelNameCaches.get(cls);
  }
  let modelName = name || cls.name;
  if (!modelName.endsWith("s")) {
    modelName += "s";
  }
  const last = modelName.toLowerCase();
  modelNameCaches.set(cls, last);
  return last;
}

export async function getModel<T extends Schema>(
  db: Database,
  cls: SchemaCls,
  name?: string,
): Promise<Collection<T>> {
  if (!modelCaches) {
    modelCaches = new Map<SchemaCls, Collection<T>>();
  } else {
    if (modelCaches.has(cls)) {
      return modelCaches.get(cls);
    }
  }
  const modelName = getModelByName(cls, name)!;
  const model = db.getCollection(modelName, cls);
  modelCaches.set(cls, model);
  await initModel(model, cls);
  console.log(green(`Schema [${modelName}] init ok`));
  return model as Collection<T>;
}

export async function initModel(model: Collection<unknown>, cls: SchemaCls) {
  const data = getMetadata(cls);
  const indexes = [];
  for (const key in data) {
    const map: SchemaType = data[key];
    if (Object.keys(map).length === 0) {
      continue;
    }
    if (!map.index && !map.unique && !map.expires && !map.sparse) {
      continue;
    }
    indexes.push({
      name: key + "_1",
      key: { [key]: 1 },
      unique: map.unique,
      sparse: map.sparse,
      expireAfterSeconds: map.expires,
    });
  }

  if (indexes.length === 0) {
    return;
  }
  await model.createIndexes({
    indexes,
  });
}

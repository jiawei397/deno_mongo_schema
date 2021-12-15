// deno-lint-ignore-file no-explicit-any
import {
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
import { Bson } from "../deps.ts";
import { getInstance } from "./utils/tools.ts";
const metadataCache = new Map();

export function transferPopulateSelect(
  select?: PopulateSelect,
): RealPopulateSelect {
  let _select: any = select ?? true;
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
    if (_select) {
      this.populateMap.set(path, _select);
    }
    return this;
  }

  static getMeta() {
    const map = getSchemaMetadata(this);
    const baseMap = getSchemaMetadata(Schema);
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

  _id?: Bson.ObjectId | string; // default id
  id?: string; // default id
}

export type SchemaCls = typeof Schema;

export function Prop(props?: SchemaType) {
  return function (target: TargetInstance, propertyKey: string) {
    addSchemaMetadata(target.constructor, propertyKey, props);
    return target;
  };
}

export function getFormattedModelName(name: string) {
  let modelName = name;
  if (!modelName.endsWith("s")) {
    modelName += "s";
  }
  return modelName.toLowerCase();
}

export function addSchemaMetadata(
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

export function getSchemaMetadata(
  target: Target,
  propertyKey?: string,
) {
  const map = metadataCache.get(getInstance(target));
  if (propertyKey) {
    return map[propertyKey];
  }
  return map;
}

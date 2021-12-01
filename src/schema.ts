// deno-lint-ignore-file no-explicit-any
import {
  Constructor,
  Hooks,
  MongoHookCallback,
  MongoHookMethod,
  PopulateSelect,
  RealPopulateSelect,
  SchemaType,
  TargetInstance,
  VirtualTypeOptions,
} from "./types.ts";
import { addMetadata, getMetadata } from "./utils/tools.ts";

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

export function Prop(props?: SchemaType) {
  return function (target: TargetInstance, propertyKey: string) {
    addMetadata(target.constructor, propertyKey, props);
    return target;
  };
}

const modelNameCaches = new Map<Constructor, string>();

// one model can only have one schema
export function getModelByName(cls: Constructor, name = cls.name) {
  if (modelNameCaches.has(cls)) {
    return modelNameCaches.get(cls);
  }
  let modelName = name;
  if (!modelName.endsWith("s")) {
    modelName += "s";
  }
  const last = modelName.toLowerCase();
  modelNameCaches.set(cls, last);
  return last;
}

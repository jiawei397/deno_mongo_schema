// deno-lint-ignore-file no-explicit-any
import { type IndexDescription, type ObjectId, Reflect } from "../deps.ts";
import type {
  Constructor,
  Hooks,
  MongoHookCallback,
  MongoHookMethod,
  PopulateSelect,
  RealPopulateSelect,
  RequiredKeys,
  SchemaType,
  Target,
  TargetInstance,
  VirtualTypeOptions,
} from "./types.ts";
import { getInstance } from "./utils/tools.ts";

const PROP_META_KEY = Symbol("design:prop");
const INDEX_KEY = Symbol("design:index");
const CREATED_AT_KEY = "createTime";
const UPDATED_AT_KEY = "modifyTime";

export function transferPopulateSelect(
  select?: PopulateSelect,
): RealPopulateSelect {
  let _select: any = select ?? true;
  if (typeof select === "string") {
    _select = {};
    select.split(" ").forEach((item) => {
      if (item.startsWith("-")) {
        _select[item.substring(1)] = 0;
      } else {
        _select[item] = 1;
      }
    });
  } else if (Array.isArray(select)) {
    _select = {};
    select.forEach((item) => {
      _select[item] = 1;
    });
  }
  return _select;
}

export class BaseSchema {
  @Prop({
    default: Date.now,
  })
  @SetCreatedAt()
  createTime?: Date;

  @Prop({
    default: Date.now,
  })
  @SetUpdatedAt()
  modifyTime?: Date;

  _id?: ObjectId | string; // default id
  id?: string; // default id
}

export interface SchemaWithOptionId {
  _id?: ObjectId | string; // default id
  id?: string; // default id
}

export type RequiredId<
  T extends SchemaWithOptionId,
> = RequiredKeys<
  T,
  "id" | "_id"
>;

export class SchemaHelper {
  Cls: Constructor;
  constructor(Cls: Constructor) {
    this.Cls = Cls;
  }

  private preHooks: Hooks = new Map();
  private postHooks: Hooks = new Map();

  private populateMap: Map<string, RealPopulateSelect> = new Map();
  private populateParams: Map<string, VirtualTypeOptions> = new Map();
  private timestamp!: {
    createdAt: string;
    updatedAt: string;
  };

  pre(method: MongoHookMethod, callback: MongoHookCallback): MongoHookCallback[] {
    return this.hook(this.preHooks, method, callback);
  }

  post(method: MongoHookMethod, callback: MongoHookCallback): MongoHookCallback[] {
    return this.hook(this.postHooks, method, callback);
  }

  clearHooks(): void {
    this.preHooks.clear();
    this.postHooks.clear();
  }

  private hook(
    hooks: Hooks,
    method: MongoHookMethod,
    callback: MongoHookCallback,
  ): MongoHookCallback[] {
    let arr = hooks.get(method);
    if (!arr) {
      arr = [];
      hooks.set(method, arr);
    }
    arr.push(callback);
    return arr;
  }

  /** Specifies paths which should be populated with other documents. */
  populate(
    path: string,
    select?: PopulateSelect,
  ): this {
    const _select = transferPopulateSelect(select);
    if (_select) {
      this.populateMap.set(path, _select);
    }
    return this;
  }

  unpopulate(path: string): this {
    this.populateMap.delete(path);
    return this;
  }

  getMeta(): Record<string, any> {
    return getSchemaMetadata(this.Cls);
  }

  getPreHookByMethod(
    method: MongoHookMethod,
  ): MongoHookCallback[] | undefined {
    return this.preHooks.get(method);
  }

  getPostHookByMethod(
    method: MongoHookMethod,
  ): MongoHookCallback[] | undefined {
    return this.postHooks.get(method);
  }

  virtual(name: string, options: VirtualTypeOptions): this {
    this.populateParams.set(name, options);
    return this;
  }

  unVirtual(name: string): this {
    this.populateParams.delete(name);
    return this;
  }

  getPopulateMap(): Map<string, RealPopulateSelect> | undefined {
    if (this.populateMap.size === 0) {
      return;
    }
    return this.populateMap;
  }

  getPopulateParams(): Map<string, VirtualTypeOptions> | undefined {
    if (this.populateParams.size === 0) {
      return;
    }
    return this.populateParams;
  }

  getTimestamps(): { createdAt: string; updatedAt: string } {
    if (!this.timestamp) {
      const instance = getInstance(this.Cls);
      const createdAt = Reflect.getMetadata(CREATED_AT_KEY, instance) ||
        CREATED_AT_KEY;
      const updatedAt = Reflect.getMetadata(UPDATED_AT_KEY, instance) ||
        UPDATED_AT_KEY;
      this.timestamp = {
        createdAt,
        updatedAt,
      };
    }
    return this.timestamp;
  }
}

export function Prop(props?: SchemaType): (target: TargetInstance, propertyKey: string) => any {
  return function (target: TargetInstance, propertyKey: string) {
    addSchemaMetadata(target, propertyKey, props);
    return target;
  };
}

export function SetCreatedAt(): (target: TargetInstance, propertyKey: string) => any {
  return function (target, propertyKey) {
    Reflect.defineMetadata(CREATED_AT_KEY, propertyKey, target);
    return target;
  };
}

export function SetUpdatedAt(): (
  target: TargetInstance,
  propertyKey: string,
) => any {
  return function (target, propertyKey) {
    Reflect.defineMetadata(UPDATED_AT_KEY, propertyKey, target);
    return target;
  };
}

export function getFormattedModelName(name: string): string {
  let modelName = name;
  if (!modelName.endsWith("s")) {
    modelName += "s";
  }
  return modelName.toLowerCase();
}

export function addSchemaMetadata(
  target: TargetInstance,
  propertyKey: string,
  props: any = {},
): void {
  Reflect.defineMetadata(PROP_META_KEY, props, target, propertyKey);
}

export function InjectIndexes(options: IndexDescription[]): (target: Constructor) => Constructor {
  return (target: Constructor) => {
    Reflect.defineMetadata(INDEX_KEY, options, target);
    return target;
  };
}

export function getSchemaInjectedIndexes(
  target: Target,
): IndexDescription[] | undefined {
  return Reflect.getMetadata(INDEX_KEY, target);
}

const schemaPropsCaches = new Map();

export function getSchemaMetadata(
  target: Target,
  propertyKey?: string,
): Record<string, any> {
  const instance = getInstance(target);
  if (propertyKey) {
    return Reflect.getMetadata(PROP_META_KEY, instance, propertyKey);
  }
  let map: Record<string, any> = schemaPropsCaches.get(target);
  if (!map) {
    map = {};
    Object.keys(instance).forEach((key) => {
      const meta = Reflect.getMetadata(PROP_META_KEY, instance, key);
      if (meta !== undefined) {
        map[key] = meta;
      }
    });
    schemaPropsCaches.set(target, map);
  }
  return map;
}
// deno-lint-ignore-file no-explicit-any
import { Bson } from "../../deps.ts";
import { Target } from "../types.ts";
const instanceCache = new Map();

export function pick(obj: any, keys: string[]) {
  const result: any = {};
  for (const key of keys) {
    result[key] = obj[key];
  }
  return result;
}

export function createMongoId() {
  return new Bson.ObjectId();
}

export function transStringToMongoId(id: string | Bson.ObjectId) {
  if (typeof id === "string") {
    return new Bson.ObjectId(id);
  }
  return id;
}

export function getInstance(cls: Target) {
  if (instanceCache.has(cls)) {
    return instanceCache.get(cls);
  }
  const instance = new cls();
  instanceCache.set(cls, instance);
  return instance;
}

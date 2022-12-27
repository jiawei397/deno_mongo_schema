// deno-lint-ignore-file no-explicit-any
import { Document, ObjectId } from "../../deps.ts";
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
  return new ObjectId();
}

export function transToMongoId(
  id: string | number | Uint8Array | ObjectId,
) {
  if (id && id instanceof ObjectId) {
    return id;
  }
  return new ObjectId(id);
}

export function getInstance(cls: Target) {
  if (instanceCache.has(cls)) {
    return instanceCache.get(cls);
  }
  const instance = new cls();
  instanceCache.set(cls, instance);
  return instance;
}

export function hasAtomicOperators(doc: Document | Document[]) {
  if (Array.isArray(doc)) {
    for (const document of doc) {
      if (hasAtomicOperators(document)) {
        return true;
      }
    }
    return false;
  }
  const keys = Object.keys(doc);
  return keys.length > 0 && keys[0][0] === "$";
}

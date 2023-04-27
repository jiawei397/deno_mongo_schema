// deno-lint-ignore-file no-explicit-any
import { Reflect } from "../../deps.ts";

export type GetCacheKey = (...args: any[]) => string;
const cacheKey = Symbol("cache");
const cacheTimeoutArr: number[] = [];
const cacheSet = new Set<Map<string, unknown>>();

/**
 * Cache decorator
 */
export function Cache(
  timeout: number,
  getCacheKey?: GetCacheKey,
): MethodDecorator {
  return (
    target: any,
    methodName: string | symbol,
    descriptor: PropertyDescriptor,
  ) => {
    const originalMethod = descriptor.value;
    descriptor.value = function (...args: any[]) {
      const key = getCacheKey ? getCacheKey.apply(this, args) : args.join("-");
      let cache: Map<string, any> = Reflect.getMetadata(
        cacheKey,
        target,
        methodName,
      );
      if (cache) {
        const val = cache.get(key);
        if (val !== undefined) {
          // console.debug("cache hit", key, cache[key]);
          return val;
        }
      } else {
        cache = new Map();
        cacheSet.add(cache);
        Reflect.defineMetadata(cacheKey, cache, target, methodName);
      }
      const result = originalMethod.apply(this, args);
      cache.set(key, result);
      if (timeout >= 0) {
        const timeid = setTimeout(() => {
          cache.delete(key);
        }, timeout);
        cacheTimeoutArr.push(timeid);
      }
      Promise.resolve(result).catch(() => {
        cache.delete(key);
      });
      return result;
    };
    return descriptor;
  };
}

export function clearCacheTimeout() {
  cacheTimeoutArr.forEach(clearTimeout);
  cacheTimeoutArr.length = 0;
  for (const cache of cacheSet) {
    cache.clear();
  }
  cacheSet.clear();
}

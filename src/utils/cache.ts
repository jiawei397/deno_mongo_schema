// deno-lint-ignore-file no-explicit-any
import { Reflect } from "../../deps.ts";

export type GetCacheKey = (...args: any[]) => string;

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
      let cache: Record<string, any> = Reflect.getMetadata(
        "cache",
        target,
        methodName,
      );
      if (cache) {
        if (cache[key] !== undefined) {
          // console.debug("cache hit", key, cache[key]);
          return cache[key];
        }
      } else {
        cache = {};
        Reflect.defineMetadata("cache", cache, target, methodName);
      }
      const result = originalMethod.apply(this, args);
      cache[key] = result;
      if (timeout >= 0) {
        setTimeout(() => {
          cache[key] = undefined;
        }, timeout);
      }
      Promise.resolve(result).catch(() => {
        cache[key] = undefined;
      });
      return result;
    };
    return descriptor;
  };
}

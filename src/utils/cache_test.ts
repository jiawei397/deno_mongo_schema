import { assert, assertEquals } from "../../deps.ts";
import { Cache } from "./cache.ts";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

Deno.test("cache", async () => {
  const callStacks: number[] = [];
  class A {
    @Cache(-1)
    get() {
      callStacks.push(1);
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve(1);
        }, 100);
      });
    }

    @Cache(100)
    time() {
      callStacks.push(2);
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve(2);
        }, 10);
      });
    }

    @Cache(-1)
    param(a: number) {
      callStacks.push(3);
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve(a);
        }, 10);
      });
    }

    @Cache(-1)
    sync() {
      return "sync";
    }
  }

  const a = new A();

  const p = a.get();
  {
    const p2 = a.get();
    assertEquals(p, p2);
    assertEquals(callStacks, [1]);

    assertEquals(await p, await p2);

    callStacks.length = 0;
  }

  {
    const time1 = a.time();
    const time2 = a.time();
    assertEquals(time1, time2);
    assertEquals(callStacks, [2]);
    assert(p !== time1);

    assertEquals(await time1, await time2);
    await delay(100);

    const time3 = a.time();
    assertEquals(await time3, await time1);
    assertEquals(callStacks, [2, 2]);

    callStacks.length = 0;
  }

  {
    const p1 = a.param(1);
    const p2 = a.param(2);
    const p3 = a.param(1);
    assert(p1 !== p2);
    assert(p1 === p3);

    callStacks.length = 0;
  }

  {
    const sync1 = a.sync();
    const sync2 = a.sync();
    assertEquals(sync1, sync2);
    assertEquals(sync1, "sync");

    callStacks.length = 0;
  }

  await delay(100);
});

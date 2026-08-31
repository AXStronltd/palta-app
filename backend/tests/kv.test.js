// KV store — memory backend behavior (TTL, incr, del).
const { makeMemoryStore } = require("../src/services/kv");

describe("KV store (memory backend)", () => {
  let kv;
  beforeEach(() => { kv = makeMemoryStore(); });

  test("set and get a value", async () => {
    await kv.set("a", "hello");
    expect(await kv.get("a")).toBe("hello");
  });

  test("missing key returns null", async () => {
    expect(await kv.get("nope")).toBeNull();
  });

  test("del removes a value", async () => {
    await kv.set("a", "x");
    await kv.del("a");
    expect(await kv.get("a")).toBeNull();
  });

  test("TTL expires a value", async () => {
    await kv.set("a", "x", 0.05); // 50ms
    expect(await kv.get("a")).toBe("x");
    await new Promise((r) => setTimeout(r, 70));
    expect(await kv.get("a")).toBeNull();
  });

  test("incr increments and sets TTL on first call", async () => {
    expect(await kv.incr("c", 60)).toBe(1);
    expect(await kv.incr("c", 60)).toBe(2);
    expect(await kv.incr("c", 60)).toBe(3);
  });

  test("incr resets after TTL expiry", async () => {
    await kv.incr("c", 0.05);
    await new Promise((r) => setTimeout(r, 70));
    expect(await kv.incr("c", 0.05)).toBe(1); // window rolled over
  });

  test("ttl reports remaining seconds", async () => {
    await kv.set("a", "x", 100);
    const ttl = await kv.ttl("a");
    expect(ttl).toBeGreaterThan(90);
    expect(ttl).toBeLessThanOrEqual(100);
  });
});

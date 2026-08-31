// Rate limiter — enforces a cap per window, then 429s.
const { rateLimit } = require("../src/middleware/rateLimit");

function mockRes() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    set(k, v) { this.headers[k] = v; return this; },
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
  };
}
function mockReq(ip = "1.2.3.4") {
  return { headers: { "x-forwarded-for": ip }, socket: { remoteAddress: ip }, body: {} };
}

describe("rate limiter", () => {
  test("allows up to max, then blocks with 429", async () => {
    const limit = rateLimit({ windowSeconds: 60, max: 3, keyPrefix: `t1-${Date.now()}` });
    const req = mockReq("9.9.9.9");
    let allowed = 0, blocked = 0;

    for (let i = 0; i < 5; i++) {
      const res = mockRes();
      let nexted = false;
      await limit(req, res, () => { nexted = true; });
      if (nexted) allowed++;
      else if (res.statusCode === 429) blocked++;
    }

    expect(allowed).toBe(3);
    expect(blocked).toBe(2);
  });

  test("sets rate-limit headers on allowed requests", async () => {
    const limit = rateLimit({ windowSeconds: 60, max: 10, keyPrefix: `t2-${Date.now()}` });
    const res = mockRes();
    await limit(mockReq("8.8.8.8"), res, () => {});
    expect(res.headers["X-RateLimit-Limit"]).toBe("10");
    expect(res.headers["X-RateLimit-Remaining"]).toBe("9");
  });

  test("different keys have independent budgets", async () => {
    const limit = rateLimit({ windowSeconds: 60, max: 1, keyPrefix: `t3-${Date.now()}` });
    const a = mockRes(); let aNext = false;
    await limit(mockReq("1.1.1.1"), a, () => { aNext = true; });
    const b = mockRes(); let bNext = false;
    await limit(mockReq("2.2.2.2"), b, () => { bNext = true; });
    expect(aNext).toBe(true);
    expect(bNext).toBe(true); // different IP, own budget
  });

  test("keyFn keys off custom field (e.g. phone)", async () => {
    const limit = rateLimit({ windowSeconds: 60, max: 1, keyPrefix: `t4-${Date.now()}`, keyFn: (r) => r.body.phone });
    const req = { headers: {}, socket: {}, body: { phone: "+1555" } };
    const r1 = mockRes(); let n1 = false;
    await limit(req, r1, () => { n1 = true; });
    const r2 = mockRes(); let n2 = false;
    await limit(req, r2, () => { n2 = true; });
    expect(n1).toBe(true);
    expect(n2).toBe(false);      // same phone, blocked
    expect(r2.statusCode).toBe(429);
  });
});

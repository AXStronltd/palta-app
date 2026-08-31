// Country layer — registry, resolver, formatting, validation.
process.env.ENABLED_COUNTRIES = "AE,US,GB,IN,EG";
process.env.DEFAULT_COUNTRY = "AE";

const countries = require("../src/config/countries");
const resolver = require("../src/config/resolver");

describe("country registry", () => {
  test("supports the five shipped countries", () => {
    for (const c of ["AE", "US", "GB", "IN", "EG"]) {
      expect(countries.isSupported(c)).toBe(true);
    }
  });
  test("rejects unknown country", () => {
    expect(countries.isSupported("ZZ")).toBe(false);
  });
  test("getCountry throws on unknown", () => {
    expect(() => countries.getCountry("ZZ")).toThrow();
  });
  test("carries currency + dial code", () => {
    expect(countries.getCountry("AE").currency).toBe("AED");
    expect(countries.getCountry("US").dialCode).toBe("+1");
  });
});

describe("resolver picks the right provider per country", () => {
  test.each([
    ["US", "stripe"],
    ["AE", "paytabs"],
    ["IN", "razorpay"],
    ["EG", "paymob"],
  ])("%s -> %s payment", (code, vendor) => {
    expect(resolver.paymentFor(code).name).toBe(vendor);
  });

  test("GB uses onfido KYC", () => {
    expect(resolver.kycFor("GB").name).toBe("onfido");
  });

  test("default country used when none given", () => {
    expect(resolver.paymentFor().name).toBe("paytabs"); // AE default
  });

  test("providers are cached (same instance)", () => {
    expect(resolver.paymentFor("US")).toBe(resolver.paymentFor("US"));
  });
});

describe("locale-aware formatting + validation", () => {
  test("formats currency by locale", () => {
    expect(resolver.formatMoney(21.5, "US")).toContain("$");
    expect(resolver.formatMoney(21.5, "IN")).toContain("₹");
  });
  test("validates phones per country", () => {
    expect(resolver.isValidPhone("+15551234567", "US")).toBe(true);
    expect(resolver.isValidPhone("+971551234567", "US")).toBe(false);
    expect(resolver.isValidPhone("+971551234567", "AE")).toBe(true);
  });
});

describe("stripe adapter (mock mode)", () => {
  test("creates a mock intent and refunds it", async () => {
    const p = resolver.paymentFor("US");
    const intent = await p.createPaymentIntent({ amount: 21.5, currency: "USD", orderId: "o1" });
    expect(intent.mock).toBe(true);
    expect(intent.clientSecret).toBe("mock_secret_o1");
    const refund = await p.refund({ paymentIntentId: "pi_mock_o1", amount: 21.5, currency: "USD" });
    expect(refund.status).toBe("succeeded");
  });
});

describe("unimplemented regional stub", () => {
  test("loads but throws clearly when invoked", async () => {
    const eg = resolver.paymentFor("EG"); // paymob stub
    expect(eg.name).toBe("paymob");
    await expect(eg.createPaymentIntent({ amount: 1, currency: "EGP", orderId: "x" }))
      .rejects.toThrow(/not implemented/);
  });
});

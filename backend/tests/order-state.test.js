// Order state machine — the guard that protects every status change.
const { canTransition, ORDER_TRANSITIONS } = require("../src/services/orderStateMachine");

describe("order state machine", () => {
  test("allows the happy path end to end", () => {
    const path = ["PLACED", "ACCEPTED", "PREPARING", "READY", "DRIVER_ASSIGNED", "PICKED_UP", "DELIVERING", "DELIVERED"];
    for (let i = 0; i < path.length - 1; i++) {
      expect(canTransition(path[i], path[i + 1])).toBe(true);
    }
  });

  test("rejects skipping a step", () => {
    expect(canTransition("PLACED", "DELIVERED")).toBe(false);
    expect(canTransition("ACCEPTED", "PICKED_UP")).toBe(false);
  });

  test("rejects going backwards", () => {
    expect(canTransition("DELIVERING", "PREPARING")).toBe(false);
  });

  test("terminal states allow no further transitions", () => {
    expect(ORDER_TRANSITIONS.DELIVERED).toEqual([]);
    expect(canTransition("DELIVERED", "PLACED")).toBe(false);
    expect(canTransition("CANCELLED", "ACCEPTED")).toBe(false);
  });

  test("early states can be cancelled or rejected", () => {
    expect(canTransition("PLACED", "REJECTED")).toBe(true);
    expect(canTransition("PLACED", "CANCELLED")).toBe(true);
  });
});

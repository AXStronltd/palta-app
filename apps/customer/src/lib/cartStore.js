// Shared cart store — the single source of truth for the current order.
// Both the AI chat flow and tap-to-add write here, so a customer can mix
// both and checkout sees one cart.
//
// A cart is scoped to ONE restaurant at a time (you can't order from two
// kitchens in one delivery). Adding an item from a different restaurant
// prompts a reset — handled in the UI.

import { useSyncExternalStore } from "react";

let state = {
  restaurantId: null,
  restaurantName: null,
  lines: [], // { key, menuItemId, name, price, quantity, options[], notes }
};
const listeners = new Set();
const emit = () => listeners.forEach((l) => l());

// A line's identity includes its options, so "Burger + cheese" and
// "Burger + bacon" are separate lines but two identical ones merge.
function lineKey(menuItemId, options, notes) {
  const opt = (options || []).map((o) => o.id).sort().join(",");
  return `${menuItemId}|${opt}|${notes || ""}`;
}

export const cart = {
  get: () => state,

  // Add an item. `options` is an array of { id, name, price }.
  add({ restaurantId, restaurantName, menuItemId, name, price, quantity = 1, options = [], notes = "" }) {
    // Different restaurant -> caller should have confirmed a reset.
    if (state.restaurantId && state.restaurantId !== restaurantId) {
      state = { restaurantId: null, restaurantName: null, lines: [] };
    }
    state.restaurantId = restaurantId;
    state.restaurantName = restaurantName;

    const key = lineKey(menuItemId, options, notes);
    const optionsTotal = options.reduce((s, o) => s + (o.price || 0), 0);
    const unitPrice = price + optionsTotal;

    const existing = state.lines.find((l) => l.key === key);
    if (existing) {
      existing.quantity += quantity;
    } else {
      state.lines.push({ key, menuItemId, name, price: unitPrice, basePrice: price, quantity, options, notes });
    }
    state = { ...state, lines: [...state.lines] };
    emit();
  },

  // Replace the whole cart from the AI flow (which returns verified lines).
  setFromAi({ restaurantId, restaurantName, aiLines }) {
    state = {
      restaurantId,
      restaurantName,
      lines: aiLines.map((l) => ({
        key: lineKey(l.menuItemId, [], l.notes),
        menuItemId: l.menuItemId,
        name: l.name,
        price: l.price,
        basePrice: l.price,
        quantity: l.quantity,
        options: [],
        notes: l.notes || "",
      })),
    };
    emit();
  },

  setQuantity(key, quantity) {
    if (quantity <= 0) {
      state = { ...state, lines: state.lines.filter((l) => l.key !== key) };
    } else {
      const line = state.lines.find((l) => l.key === key);
      if (line) line.quantity = quantity;
      state = { ...state, lines: [...state.lines] };
    }
    if (state.lines.length === 0) state.restaurantId = null;
    emit();
  },

  clear() {
    state = { restaurantId: null, restaurantName: null, lines: [] };
    emit();
  },

  subtotal() {
    return Number(state.lines.reduce((s, l) => s + l.price * l.quantity, 0).toFixed(2));
  },
  count() {
    return state.lines.reduce((s, l) => s + l.quantity, 0);
  },
  subscribe: (l) => {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};

export function useCart() {
  return useSyncExternalStore(cart.subscribe, cart.get, cart.get);
}

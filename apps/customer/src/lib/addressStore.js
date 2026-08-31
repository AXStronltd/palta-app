// Minimal global store for the currently selected delivery address.
// Uses React's useSyncExternalStore so any screen can read/subscribe
// without a heavy state library.

import { useSyncExternalStore } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

let current = null; // { id?, label, fullAddress, lat, lng, notes? }
const listeners = new Set();

function emit() {
  listeners.forEach((l) => l());
}

export const addressStore = {
  get: () => current,
  set: (addr) => {
    current = addr;
    AsyncStorage.setItem("palta_address", JSON.stringify(addr)).catch(() => {});
    emit();
  },
  clear: () => {
    current = null;
    AsyncStorage.removeItem("palta_address").catch(() => {});
    emit();
  },
  subscribe: (l) => {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem("palta_address");
      if (raw) {
        current = JSON.parse(raw);
        emit();
      }
    } catch {}
  },
};

export function useSelectedAddress() {
  return useSyncExternalStore(addressStore.subscribe, addressStore.get, addressStore.get);
}

import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";

// API base URL resolution order:
//   1. EXPO_PUBLIC_API_URL env var (set per environment / in EAS build)
//   2. `extra.apiUrl` in app.json / app.config.js
//   3. localhost fallback for local dev on a simulator
// In production this points at the deployed backend, e.g.
//   https://palta-backend.onrender.com
export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  Constants?.expoConfig?.extra?.apiUrl ||
  "http://localhost:4000";

export const api = axios.create({ baseURL: API_URL });

// Attach the saved token to every request automatically.
api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem("palta_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export async function saveToken(token) {
  await AsyncStorage.setItem("palta_token", token);
}
export async function getToken() {
  return AsyncStorage.getItem("palta_token");
}
export async function clearToken() {
  await AsyncStorage.removeItem("palta_token");
}

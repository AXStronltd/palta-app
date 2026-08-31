import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";

// Points at the deployed backend in production (EXPO_PUBLIC_API_URL /
// app.json extra.apiUrl), falls back to localhost for local dev.
export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  Constants?.expoConfig?.extra?.apiUrl ||
  "http://localhost:4000";
export const api = axios.create({ baseURL: API_URL });

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem("palta_driver_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export async function saveToken(t) { await AsyncStorage.setItem("palta_driver_token", t); }
export async function getToken() { return AsyncStorage.getItem("palta_driver_token"); }
export async function clearToken() { await AsyncStorage.removeItem("palta_driver_token"); }

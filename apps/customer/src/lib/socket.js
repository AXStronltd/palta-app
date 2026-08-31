// Socket.IO client for the customer app. Connects, authenticates with the
// JWT, and exposes a tiny on/off wrapper. Mirrors the driver app.

import { io } from "socket.io-client";
import { API_URL, getToken } from "./api";

let socket = null;

export async function connectSocket() {
  if (socket?.connected) return socket;
  const token = await getToken();
  socket = io(API_URL, { transports: ["websocket"], autoConnect: true });
  socket.on("connect", () => { if (token) socket.emit("auth", token); });
  return socket;
}

export function onEvent(event, handler) {
  socket?.on(event, handler);
  return () => socket?.off(event, handler);
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}

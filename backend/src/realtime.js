// Realtime layer over Socket.IO.
//
// Each connected client joins a room named `user:<userId>` after
// authenticating with their JWT. Routes then push events to a specific
// user via emitToUser(). This is how a driver gets a delivery request
// and how a customer gets live order status.

const jwt = require("jsonwebtoken");
const { JWT_SECRET } = require("./middleware/auth");

let ioRef = null;

function init(io) {
  ioRef = io;

  io.on("connection", (socket) => {
    // Client sends its token right after connecting.
    socket.on("auth", (token) => {
      try {
        const payload = jwt.verify(token, JWT_SECRET);
        socket.userId = payload.userId;
        socket.join(`user:${payload.userId}`);
        socket.emit("auth:ok", { userId: payload.userId });
      } catch {
        socket.emit("auth:error", { error: "Invalid token" });
      }
    });

    socket.on("disconnect", () => {
      // rooms are cleaned up automatically
    });
  });
}

function emitToUser(userId, event, payload) {
  if (!ioRef) return;
  ioRef.to(`user:${userId}`).emit(event, payload);
}

module.exports = { init, emitToUser };

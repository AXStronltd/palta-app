// ============================================================
// Palta Backend
// Production entry point
// ============================================================

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");

// ============================================================
// CURRENT ROUTES
// These are the route files that currently exist in the repo.
// ============================================================

const healthRoutes = require("./routes/health");
const aiRoutes = require("./routes/ai");
const authRoutes = require("./routes/auth");
const restaurantRoutes = require("./routes/restaurants");
const geoRoutes = require("./routes/geo");
const configRoutes = require("./routes/config");

// ============================================================
// REALTIME
// ============================================================

const realtime = require("./realtime");

// ============================================================
// EXPRESS APP
// ============================================================

const app = express();

// ------------------------------------------------------------
// CORS
// ------------------------------------------------------------

app.use(
  cors({
    origin: "*",
    credentials: false,
  })
);

// ------------------------------------------------------------
// JSON BODY
// ------------------------------------------------------------

app.use(
  express.json({
    limit: "12mb",
  })
);

// ============================================================
// BASIC REQUEST LOGGING
// ============================================================

app.use((req, _res, next) => {
  console.log(`[Palta] ${req.method} ${req.path}`);
  next();
});

// ============================================================
// ROUTES
// ============================================================

// Health
app.use("/health", healthRoutes);

// Authentication
app.use("/auth", authRoutes);

// Restaurants
app.use("/restaurants", restaurantRoutes);

// Geography
app.use("/geo", geoRoutes);

// Public configuration
app.use("/config", configRoutes);

// AI
app.use("/ai", aiRoutes);

// ============================================================
// 404 HANDLER
// ============================================================

app.use((req, res) => {
  res.status(404).json({
    error: "Not found",
    path: req.path,
  });
});

// ============================================================
// GLOBAL ERROR HANDLER
// ============================================================

app.use((err, req, res, _next) => {
  console.error("[Palta] Unhandled error:", err);

  if (res.headersSent) {
    return;
  }

  res.status(err.status || 500).json({
    error: "Something went wrong",
  });
});

// ============================================================
// HTTP SERVER
// ============================================================

const server = http.createServer(app);

// ============================================================
// SOCKET.IO
// ============================================================

const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

// Initialize realtime safely
try {
  realtime.init(io);
  console.log("[Palta] Realtime initialized");
} catch (err) {
  console.error(
    "[Palta] Realtime initialization failed:",
    err.message
  );
}

// ============================================================
// PORT
// Render provides process.env.PORT automatically.
// ============================================================

const PORT = process.env.PORT || 4000;

// ============================================================
// START SERVER
// ============================================================

server.listen(PORT, () => {
  console.log("");
  console.log("==========================================");
  console.log("       PALTA BACKEND IS RUNNING");
  console.log("==========================================");
  console.log(`Port: ${PORT}`);
  console.log("");
  console.log("Routes:");
  console.log("GET  /health");
  console.log("GET  /health/ready");
  console.log("POST /auth/request-otp");
  console.log("POST /auth/verify");
  console.log("GET  /restaurants");
  console.log("GET  /restaurants/:id");
  console.log("GET  /restaurants/cuisines");
  console.log("GET  /geo/search");
  console.log("GET  /geo/reverse");
  console.log("GET  /config/countries");
  console.log("POST /ai/ping");
  console.log("POST /ai/order");
  console.log("");
  console.log("==========================================");
});

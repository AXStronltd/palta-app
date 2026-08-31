// ============================================================
// Palta Backend Entry Point
// Express API + Socket.IO realtime server
// ============================================================

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");

// ------------------------------------------------------------
// Routes that currently exist in backend/src/routes/
// ------------------------------------------------------------

const healthRoutes = require("./routes/health");
const authRoutes = require("./routes/auth");
const restaurantRoutes = require("./routes/restaurants");
const geoRoutes = require("./routes/geo");
const orderRoutes = require("./routes/orders");
const aiRoutes = require("./routes/ai");
const configRoutes = require("./routes/config");

// ------------------------------------------------------------
// Services / middleware
// ------------------------------------------------------------

const { UPLOAD_DIR } = require("./services/storage");
const realtime = require("./realtime");

// ------------------------------------------------------------
// App
// ------------------------------------------------------------

const app = express();

app.use(cors());

app.use(
  express.json({
    limit: "12mb",
  })
);

// ------------------------------------------------------------
// Request context
// ------------------------------------------------------------

try {
  const { requestContext } = require("./middleware/requestContext");

  if (typeof requestContext === "function") {
    app.use(requestContext);
  }
} catch (err) {
  console.warn(
    "[startup] requestContext middleware not loaded:",
    err.message
  );
}

// ------------------------------------------------------------
// Uploaded files
// ------------------------------------------------------------

if (UPLOAD_DIR) {
  app.use("/uploads", express.static(UPLOAD_DIR));
}

// ------------------------------------------------------------
// Routes
// ------------------------------------------------------------

app.use("/health", healthRoutes);

app.use("/auth", authRoutes);

app.use("/restaurants", restaurantRoutes);

app.use("/geo", geoRoutes);

app.use("/orders", orderRoutes);

app.use("/ai", aiRoutes);

app.use("/config", configRoutes);

// ------------------------------------------------------------
// 404 handler
// ------------------------------------------------------------

app.use((req, res) => {
  res.status(404).json({
    error: "Not found",
    path: req.path,
  });
});

// ------------------------------------------------------------
// Central error handler
// ------------------------------------------------------------

app.use((err, req, res, next) => {
  console.error("[Unhandled Error]", {
    message: err.message,
    stack: err.stack,
    requestId: req.id,
  });

  if (res.headersSent) {
    return next(err);
  }

  res.status(err.status || 500).json({
    error: "Something went wrong",
  });
});

// ------------------------------------------------------------
// HTTP + Socket.IO
// ------------------------------------------------------------

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  },
});

// Initialize realtime functionality
if (realtime && typeof realtime.init === "function") {
  realtime.init(io);
}

// ------------------------------------------------------------
// Port
// ------------------------------------------------------------

const PORT = Number(process.env.PORT) || 4000;

// ------------------------------------------------------------
// Start server
// ------------------------------------------------------------

server.listen(PORT, "0.0.0.0", () => {
  console.log("==============================================");
  console.log("Palta backend started");
  console.log(`Port: ${PORT}`);
  console.log("==============================================");

  console.log("GET  /health");
  console.log("POST /auth/request-otp");
  console.log("POST /auth/verify");
  console.log("GET  /restaurants");
  console.log("GET  /restaurants/:id");
  console.log("GET  /geo/search");
  console.log("GET  /geo/reverse");
  console.log("POST /orders");
  console.log("GET  /orders");
  console.log("POST /ai/ping");
  console.log("POST /ai/order");
  console.log("GET  /config");
});

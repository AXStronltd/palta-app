// ============================================================
// Palta Backend Entry Point
// ============================================================
// Express API + Socket.IO realtime server.
//
// Payment providers are NOT connected yet.
// This entry point only loads modules that currently exist.
// ============================================================

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");

// ------------------------------------------------------------
// Routes
// ------------------------------------------------------------

const healthRoutes = require("./routes/health");
const authRoutes = require("./routes/auth");
const restaurantRoutes = require("./routes/restaurants");
const geoRoutes = require("./routes/geo");
const orderRoutes = require("./routes/orders");
const aiRoutes = require("./routes/ai");

// ------------------------------------------------------------
// Realtime
// ------------------------------------------------------------

const realtime = require("./realtime");

// ------------------------------------------------------------
// App
// ------------------------------------------------------------

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
// JSON
// ------------------------------------------------------------

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
    "[startup] requestContext unavailable:",
    err.message
  );
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

// ------------------------------------------------------------
// 404
// ------------------------------------------------------------

app.use((req, res) => {
  res.status(404).json({
    error: "Not found",
    path: req.path,
  });
});

// ------------------------------------------------------------
// Error handler
// ------------------------------------------------------------

app.use((err, req, res, next) => {
  console.error("[Unhandled request error]", {
    requestId: req.id,
    message: err?.message,
    stack: err?.stack,
  });

  if (res.headersSent) {
    return next(err);
  }

  res.status(err?.status || 500).json({
    error: "Something went wrong",
    requestId: req.id || null,
  });
});

// ------------------------------------------------------------
// HTTP server
// ------------------------------------------------------------

const server = http.createServer(app);

// ------------------------------------------------------------
// Socket.IO
// ------------------------------------------------------------

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: [
      "GET",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
    ],
  },
});

// ------------------------------------------------------------
// Realtime initialization
// ------------------------------------------------------------

try {
  if (
    realtime &&
    typeof realtime.init === "function"
  ) {
    realtime.init(io);
    console.log("[startup] Realtime initialized");
  }
} catch (err) {
  console.error(
    "[startup] Realtime initialization failed:",
    err.message
  );
}

// ------------------------------------------------------------
// Port
// ------------------------------------------------------------

const PORT =
  Number(process.env.PORT) || 4000;

// ------------------------------------------------------------
// Start
// ------------------------------------------------------------

server.listen(PORT, () => {
  console.log(
    `Palta backend running on port ${PORT}`
  );

  console.log("GET  /health");

  console.log("POST /auth/request-otp");
  console.log("POST /auth/verify");
  console.log("GET  /auth/me");
  console.log("POST /auth/push-token");

  console.log("GET  /restaurants");
  console.log("GET  /restaurants/:id");
  console.log("GET  /restaurants/cuisines");

  console.log("GET  /geo/config");
  console.log("GET  /geo/search");
  console.log("GET  /geo/reverse");

  console.log("POST /orders");
  console.log("GET  /orders");
  console.log("GET  /orders/:id");
  console.log("POST /orders/:id/cancel");
  console.log("POST /orders/:id/rate");
  console.log("GET  /orders/:id/receipt");
  console.log("GET  /orders/:id/reorder");

  console.log("POST /ai/ping");
  console.log("POST /ai/order");
});

// ------------------------------------------------------------
// Graceful shutdown
// ------------------------------------------------------------

function shutdown(signal) {
  console.log(
    `[shutdown] ${signal} received`
  );

  server.close(() => {
    console.log(
      "[shutdown] HTTP server closed"
    );

    process.exit(0);
  });

  setTimeout(() => {
    console.error(
      "[shutdown] Forced shutdown"
    );

    process.exit(1);
  }, 10000).unref();
}

process.on(
  "SIGTERM",
  () => shutdown("SIGTERM")
);

process.on(
  "SIGINT",
  () => shutdown("SIGINT")
);

// ------------------------------------------------------------
// Process errors
// ------------------------------------------------------------

process.on(
  "unhandledRejection",
  (reason) => {
    console.error(
      "[process] Unhandled rejection:",
      reason
    );
  }
);

process.on(
  "uncaughtException",
  (err) => {
    console.error(
      "[process] Uncaught exception:",
      err
    );

    process.exit(1);
  }
);

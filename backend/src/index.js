// ============================================================
// Palta Backend Entry Point
// ============================================================
// Express API + Socket.IO realtime server.
//
// Only routes that currently exist in backend/src/routes are
// loaded here. Payment providers are NOT connected yet.
// ============================================================

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");

// ------------------------------------------------------------
// Routes that currently exist
// ------------------------------------------------------------

const healthRoutes = require("./routes/health");
const aiRoutes = require("./routes/ai");
const authRoutes = require("./routes/auth");
const restaurantRoutes = require("./routes/restaurants");
const addressRoutes = require("./routes/addresses");
const geoRoutes = require("./routes/geo");
const orderRoutes = require("./routes/orders");

// ------------------------------------------------------------
// Existing services
// ------------------------------------------------------------

const { UPLOAD_DIR } = require("./services/storage");
const realtime = require("./realtime");

// ------------------------------------------------------------
// App
// ------------------------------------------------------------

const app = express();

app.use(
  cors({
    origin: "*",
    credentials: false,
  })
);

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

  if (requestContext) {
    app.use(requestContext);
  }
} catch (err) {
  console.warn(
    "[startup] requestContext middleware not available:",
    err.message
  );
}

// ------------------------------------------------------------
// Static uploads
// ------------------------------------------------------------

if (UPLOAD_DIR) {
  app.use(
    "/uploads",
    express.static(UPLOAD_DIR)
  );
}

// ------------------------------------------------------------
// Routes
// ------------------------------------------------------------

app.use("/health", healthRoutes);

app.use("/auth", authRoutes);

app.use("/restaurants", restaurantRoutes);

app.use("/addresses", addressRoutes);

app.use("/geo", geoRoutes);

app.use("/orders", orderRoutes);

app.use("/ai", aiRoutes);

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

try {
  const { logger } = require("./services/logger");

  app.use((err, req, res, next) => {
    logger.error("Unhandled request error", {
      requestId: req.id,
      message: err.message,
      stack: err.stack,
    });

    if (res.headersSent) {
      return next(err);
    }

    res.status(err.status || 500).json({
      error: "Something went wrong",
      requestId: req.id,
    });
  });
} catch (loggerError) {
  console.warn(
    "[startup] logger unavailable, using console error handler"
  );

  app.use((err, req, res, next) => {
    console.error("[Unhandled]", err);

    if (res.headersSent) {
      return next(err);
    }

    res.status(err.status || 500).json({
      error: "Something went wrong",
    });
  });
}

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

// Initialize Palta realtime layer

try {
  if (
    realtime &&
    typeof realtime.init === "function"
  ) {
    realtime.init(io);
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

  console.log(
    `GET  /health`
  );

  console.log(
    `POST /auth/request-otp`
  );

  console.log(
    `POST /auth/verify`
  );

  console.log(
    `GET  /auth/me`
  );

  console.log(
    `GET  /restaurants`
  );

  console.log(
    `GET  /addresses`
  );

  console.log(
    `GET  /geo/search`
  );

  console.log(
    `GET  /geo/reverse`
  );

  console.log(
    `POST /orders`
  );

  console.log(
    `GET  /orders`
  );

  console.log(
    `POST /ai/ping`
  );

  console.log(
    `POST /ai/order`
  );
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
// Unhandled process errors
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

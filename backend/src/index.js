// Palta backend entry point (Day 1).
// Express API + Socket.IO realtime scaffold.

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");

const healthRoutes = require("./routes/health");
const aiRoutes = require("./routes/ai");
const authRoutes = require("./routes/auth");
const restaurantRoutes = require("./routes/restaurants");
const addressRoutes = require("./routes/addresses");
const geoRoutes = require("./routes/geo");
const orderRoutes = require("./routes/orders");
const parcelRoutes = require("./routes/parcels");
const { router: driverRoutes } = require("./routes/driver");
const opsRoutes = require("./routes/ops");
const adminRoutes = require("./routes/admin");
const restaurantOwnerRoutes = require("./routes/restaurant-owner");
const configRoutes = require("./routes/config");
const { UPLOAD_DIR } = require("./services/storage");
const realtime = require("./realtime");

const app = express();
app.use(cors());
app.use(express.json({ limit: "12mb" })); // base64 doc uploads

const { requestContext } = require("./middleware/requestContext");
app.use(requestContext);

// Serve uploaded documents in dev (prod uses S3/R2 URLs directly).
app.use("/uploads", express.static(UPLOAD_DIR));

// Routes
app.use("/health", healthRoutes);
app.use("/auth", authRoutes);
app.use("/restaurants", restaurantRoutes);
app.use("/addresses", addressRoutes);
app.use("/geo", geoRoutes);
app.use("/orders", orderRoutes);
app.use("/parcels", parcelRoutes);
app.use("/driver", driverRoutes);
app.use("/ops", opsRoutes);
app.use("/admin", adminRoutes);
app.use("/restaurant", restaurantOwnerRoutes);
app.use("/config", configRoutes);
app.use("/ai", aiRoutes);

// 404 for unmatched routes — consistent error envelope.
app.use((req, res) => {
  res.status(404).json({ error: "Not found", path: req.path });
});

// Centralized error handler — catches thrown/async errors so nothing
// leaks a stack trace to clients. Logs with the request id.
const { logger } = require("./services/logger");
app.use((err, req, res, _next) => {
  logger.error(`Unhandled: ${err.message}`, { reqId: req.id, stack: err.stack });
  if (res.headersSent) return;
  res.status(err.status || 500).json({ error: "Something went wrong" });
});

// HTTP + Socket.IO server
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });
realtime.init(io);

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Palta backend running on http://localhost:${PORT}`);
  console.log(`  GET  /health`);
  console.log(`  POST /auth/request-otp`);
  console.log(`  POST /auth/verify`);
  console.log(`  GET  /restaurants`);
  console.log(`  GET  /restaurants/:id`);
  console.log(`  GET  /addresses`);
  console.log(`  POST /addresses`);
  console.log(`  GET  /geo/search`);
  console.log(`  GET  /geo/reverse`);
  console.log(`  POST /orders`);
  console.log(`  GET  /orders`);
  console.log(`  GET  /driver/me`);
  console.log(`  POST /driver/submit`);
  console.log(`  POST /driver/online`);
  console.log(`  POST /driver/accept`);
  console.log(`  POST /ops/advance`);
  console.log(`  POST /ai/order`);
});

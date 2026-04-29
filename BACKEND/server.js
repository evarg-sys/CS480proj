require("dotenv").config();

const path = require("path");
const express = require("express");
const cors = require("cors");

const managersRouter = require("./routes/managers");
const clientsRouter = require("./routes/clients");
const hotelsRouter = require("./routes/hotels");
const roomsRouter = require("./routes/rooms");
const bookingsRouter = require("./routes/bookings");
const reviewsRouter = require("./routes/reviews");
const reportsRouter = require("./routes/reports");

const app = express();
const port = Number.parseInt(process.env.PORT, 10) || 5000;
const publicDir = path.join(__dirname, "..", "public");

app.use(cors());
app.use(express.json());
app.use(express.static(publicDir));

app.get("/api/health", (req, res) => {
  res.json({ success: true, message: "Server is healthy" });
});

app.use("/api/managers", managersRouter);
app.use("/api/clients", clientsRouter);
app.use("/api/hotels", hotelsRouter);
app.use("/api/rooms", roomsRouter);
app.use("/api/bookings", bookingsRouter);
app.use("/api/reviews", reviewsRouter);
app.use("/api/reports", reportsRouter);

app.use("/api", (req, res) => {
  res.status(404).json({ success: false, message: "API route not found" });
});

app.use((error, req, res, next) => {
  console.error("Unhandled server error:", error);
  res.status(500).json({
    success: false,
    message: "Unexpected server error",
    error: error.message,
  });
});

if (require.main === module) {
  app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
  });
}

module.exports = app;

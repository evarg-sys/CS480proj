require("dotenv").config();

const path = require("path");
const express = require("express");
const cors = require("cors");
const pool = require("./db/pool");

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

async function ensureRoomSchema() {
  await pool.query("ALTER TABLE Room ADD COLUMN IF NOT EXISTS price_per_night NUMERIC(10, 2)");
  await pool.query("UPDATE Room SET price_per_night = COALESCE(price_per_night, 100.00)");
  await pool.query("ALTER TABLE Room ALTER COLUMN price_per_night SET NOT NULL");
  await pool.query("ALTER TABLE Room ALTER COLUMN price_per_night SET DEFAULT 100.00");

  await pool.query(`
    UPDATE Room
    SET acces_type = CASE
      WHEN LOWER(COALESCE(acces_type, '')) = 'elevator' THEN 'elevator'
      WHEN LOWER(COALESCE(acces_type, '')) = 'stairs' THEN 'stairs'
      ELSE 'stairs'
    END
  `);
  await pool.query("ALTER TABLE Room ALTER COLUMN acces_type SET DEFAULT 'stairs'");
  await pool.query("ALTER TABLE Room ALTER COLUMN acces_type SET NOT NULL");

  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'room_access_type_check'
      ) THEN
        ALTER TABLE Room
        ADD CONSTRAINT room_access_type_check
        CHECK (acces_type IN ('elevator', 'stairs'));
      END IF;
    END$$;
  `);
}

if (require.main === module) {
  ensureRoomSchema()
    .then(() => {
      app.listen(port, () => {
        console.log(`Server running on http://localhost:${port}`);
      });
    })
    .catch((error) => {
      console.error("Failed to initialize schema:", error);
      process.exit(1);
    });
}

module.exports = app;

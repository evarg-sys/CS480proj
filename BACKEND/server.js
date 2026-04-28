require("dotenv").config();

const express = require("express");
const cors = require("cors");
const managerRoutes = require("./routes/managerRoutes");
const clientRoutes = require("./routes/clientRoutes");

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/manager", managerRoutes);
app.use("/api/client", clientRoutes);

app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

app.use((error, req, res, next) => {
  return res.status(500).json({
    message: "Unexpected server error",
    error: error.message,
  });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

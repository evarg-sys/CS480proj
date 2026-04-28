const express = require("express");
const clientController = require("../controllers/clientController");

const router = express.Router();

router.post("/register", clientController.registerClient);
router.post("/login", clientController.loginClient);
router.put("/:email", clientController.updateClient);

router.get("/rooms/search", clientController.searchAvailableRooms);
router.post("/bookings", clientController.bookSpecificRoom);
router.post("/bookings/auto", clientController.autoBookRoom);
router.get("/:email/bookings", clientController.viewBookings);
router.post("/reviews", clientController.submitReview);

module.exports = router;

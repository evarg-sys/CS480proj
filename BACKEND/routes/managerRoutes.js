const express = require("express");
const managerController = require("../controllers/managerController");

const router = express.Router();

router.post("/register", managerController.registerManager);
router.post("/login", managerController.loginManager);

router.post("/hotels", managerController.addHotel);
router.put("/hotels/:hotelId", managerController.updateHotel);
router.delete("/hotels/:hotelId", managerController.deleteHotel);

router.post("/rooms", managerController.addRoom);
router.put("/rooms/:hotelId/:roomNumber", managerController.updateRoom);
router.delete("/rooms/:hotelId/:roomNumber", managerController.deleteRoom);

router.delete("/clients/:clientEmail", managerController.deleteClient);

router.get("/reports/top-clients", managerController.getTopKClients);
router.get("/reports/rooms-booking-counts", managerController.getRoomsWithBookingCounts);
router.get("/reports/hotel-stats", managerController.getHotelStats);
router.get("/reports/clients-address-c1-booked-c2", managerController.getClientsAddressC1BookedC2);
router.get("/reports/problematic-chicago-hotels", managerController.getProblematicChicagoHotels);
router.get("/reports/client-spending", managerController.getClientSpending);

module.exports = router;

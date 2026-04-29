const express = require("express");

const pool = require("../db/pool");
const {
  getAlternativeHotels,
  getAvailableRoomInHotel,
  getClientEmail,
  getRoomConflict,
  handleDatabaseError,
  isValidDateRange,
  sendError,
  sendSuccess,
} = require("./utils");

const router = express.Router();

router.post("/", async (req, res) => {
  const client = await pool.connect();

  try {
    const clientId = getClientEmail(req.body.clientId || req.body.clientEmail);
    const { hotelId, roomNumber, startDate, endDate, pricePerDay } = req.body;

    if (!clientId || !hotelId || roomNumber === undefined || pricePerDay === undefined) {
      return sendError(
        res,
        400,
        "clientId, hotelId, roomNumber, startDate, endDate, and pricePerDay are required"
      );
    }

    if (!isValidDateRange(startDate, endDate)) {
      return sendError(res, 400, "Valid startDate and endDate are required, and endDate must be after startDate");
    }

    await client.query("BEGIN");

    const roomResult = await client.query(
      `
        SELECT hotel_id, room_number
        FROM Room
        WHERE hotel_id = $1
          AND room_number = $2
      `,
      [hotelId, roomNumber]
    );

    if (roomResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return sendError(res, 404, "Room not found");
    }

    const conflict = await getRoomConflict(client, hotelId, roomNumber, startDate, endDate);
    if (conflict) {
      await client.query("ROLLBACK");
      return sendError(res, 409, "Room is not available for the requested dates");
    }

    const bookingResult = await client.query(
      `
        INSERT INTO Booking (start_date, end_date, price_per_day, client_email, room_number, hotel_id)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING booking_id, start_date, end_date, price_per_day, client_email, room_number, hotel_id
      `,
      [startDate, endDate, pricePerDay, clientId, roomNumber, hotelId]
    );

    await client.query("COMMIT");
    return sendSuccess(res, 201, "Room booked successfully", bookingResult.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK");
    return handleDatabaseError(res, error, "Failed to create booking");
  } finally {
    client.release();
  }
});

router.post("/auto", async (req, res) => {
  const client = await pool.connect();

  try {
    const clientId = getClientEmail(req.body.clientId || req.body.clientEmail);
    const { hotelId, startDate, endDate, pricePerDay } = req.body;

    if (!clientId || !hotelId || pricePerDay === undefined) {
      return sendError(res, 400, "clientId, hotelId, startDate, endDate, and pricePerDay are required");
    }

    if (!isValidDateRange(startDate, endDate)) {
      return sendError(res, 400, "Valid startDate and endDate are required, and endDate must be after startDate");
    }

    await client.query("BEGIN");

    const availableRoom = await getAvailableRoomInHotel(client, hotelId, startDate, endDate);
    if (!availableRoom) {
      await client.query("ROLLBACK");
      const alternatives = await getAlternativeHotels(pool, hotelId, startDate, endDate);
      return sendError(res, 409, "No room is available in the selected hotel", { alternatives });
    }

    const bookingResult = await client.query(
      `
        INSERT INTO Booking (start_date, end_date, price_per_day, client_email, room_number, hotel_id)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING booking_id, start_date, end_date, price_per_day, client_email, room_number, hotel_id
      `,
      [startDate, endDate, pricePerDay, clientId, availableRoom.room_number, hotelId]
    );

    await client.query("COMMIT");
    return sendSuccess(res, 201, "Auto-booking successful", bookingResult.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK");
    return handleDatabaseError(res, error, "Failed to auto-book room");
  } finally {
    client.release();
  }
});

module.exports = router;
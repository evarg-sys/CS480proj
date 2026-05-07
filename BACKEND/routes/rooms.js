const express = require("express");

const pool = require("../db/pool");
const { handleDatabaseError, isValidDateRange, sendError, sendSuccess } = require("./utils");

const router = express.Router();

router.get("/available", async (req, res) => {
  try {
    const { start, end, hotelId, maxPrice } = req.query;

    if (!isValidDateRange(start, end)) {
      return sendError(res, 400, "Valid start and end dates are required, and end must be after start");
    }

    const values = [start, end];
    let hotelFilter = "";
    let priceFilter = "";

    const parsedHotelId = Number.parseInt(hotelId, 10);
    if (Number.isInteger(parsedHotelId) && parsedHotelId > 0) {
      values.push(parsedHotelId);
      hotelFilter = ` AND r.hotel_id = $${values.length}`;
    }

    const parsedMaxPrice = Number.parseFloat(maxPrice);
    if (Number.isFinite(parsedMaxPrice) && parsedMaxPrice > 0) {
      values.push(parsedMaxPrice);
      priceFilter = ` AND r.price_per_night <= $${values.length}`;
    }

    const result = await pool.query(
      `
        SELECT r.hotel_id,
               h.name AS hotel_name,
               a.city,
               r.room_number,
               r.num_windows,
               r.year_of_last_renovation,
               r.acces_type,
               r.price_per_night
        FROM Room r
        JOIN Hotel h ON h.hotel_id = r.hotel_id
        LEFT JOIN Address a ON a.address_id = h.address_id
        WHERE NOT EXISTS (
          SELECT 1
          FROM Booking b
          WHERE b.hotel_id = r.hotel_id
            AND b.room_number = r.room_number
            AND b.start_date <= $2::date
            AND b.end_date >= $1::date
        )
        ${hotelFilter}
        ${priceFilter}
        ORDER BY r.hotel_id ASC, r.room_number ASC
      `,
      values
    );

    return sendSuccess(res, 200, "Available rooms retrieved", result.rows);
  } catch (error) {
    return handleDatabaseError(res, error, "Failed to fetch available rooms");
  }
});

router.get("/", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT r.hotel_id,
             h.name AS hotel_name,
             a.city,
             r.room_number,
             r.num_windows,
             r.year_of_last_renovation,
                  r.acces_type,
                  r.price_per_night
      FROM Room r
      JOIN Hotel h ON h.hotel_id = r.hotel_id
      LEFT JOIN Address a ON a.address_id = h.address_id
      ORDER BY r.hotel_id ASC, r.room_number ASC
    `);

    return sendSuccess(res, 200, "Rooms retrieved", result.rows);
  } catch (error) {
    return handleDatabaseError(res, error, "Failed to fetch rooms");
  }
});

router.post("/", async (req, res) => {
  try {
    const { hotelId, roomNumber, numWindows, yearOfLastRenovation, accesType, pricePerNight } = req.body;

    if (!hotelId || roomNumber === undefined || roomNumber === null || pricePerNight === undefined || pricePerNight === null) {
      return sendError(res, 400, "hotelId, roomNumber, and pricePerNight are required");
    }

    const normalizedAccess = String(accesType || "").trim().toLowerCase();
    if (!["elevator", "stairs"].includes(normalizedAccess)) {
      return sendError(res, 400, "accesType must be either 'elevator' or 'stairs'");
    }

    const parsedPricePerNight = Number.parseFloat(pricePerNight);
    if (!Number.isFinite(parsedPricePerNight) || parsedPricePerNight <= 0) {
      return sendError(res, 400, "pricePerNight must be a positive number");
    }

    const result = await pool.query(
      `
        INSERT INTO Room (hotel_id, room_number, num_windows, year_of_last_renovation, acces_type, price_per_night)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING hotel_id, room_number, num_windows, year_of_last_renovation, acces_type, price_per_night
      `,
      [
        hotelId,
        roomNumber,
        numWindows ?? null,
        yearOfLastRenovation ?? null,
        normalizedAccess,
        parsedPricePerNight,
      ]
    );

    return sendSuccess(res, 201, "Room added successfully", result.rows[0]);
  } catch (error) {
    return handleDatabaseError(res, error, "Failed to add room");
  }
});

router.put("/:hotelId/:roomNumber", async (req, res) => {
  try {
    const { hotelId, roomNumber } = req.params;
    const { newRoomNumber, numWindows, yearOfLastRenovation, accesType, pricePerNight } = req.body;

    let normalizedAccess = null;
    if (typeof accesType !== "undefined") {
      normalizedAccess = String(accesType || "").trim().toLowerCase();
      if (!["elevator", "stairs"].includes(normalizedAccess)) {
        return sendError(res, 400, "accesType must be either 'elevator' or 'stairs'");
      }
    }

    let parsedPricePerNight = null;
    if (typeof pricePerNight !== "undefined") {
      parsedPricePerNight = Number.parseFloat(pricePerNight);
      if (!Number.isFinite(parsedPricePerNight) || parsedPricePerNight <= 0) {
        return sendError(res, 400, "pricePerNight must be a positive number");
      }
    }

    const result = await pool.query(
      `
        UPDATE Room
        SET room_number = COALESCE($1, room_number),
            num_windows = COALESCE($2, num_windows),
            year_of_last_renovation = COALESCE($3, year_of_last_renovation),
            acces_type = COALESCE($4, acces_type),
            price_per_night = COALESCE($5, price_per_night)
        WHERE hotel_id = $6
          AND room_number = $7
        RETURNING hotel_id, room_number, num_windows, year_of_last_renovation, acces_type, price_per_night
      `,
      [
        newRoomNumber ?? null,
        numWindows ?? null,
        yearOfLastRenovation ?? null,
        normalizedAccess,
        parsedPricePerNight,
        hotelId,
        roomNumber,
      ]
    );

    if (result.rows.length === 0) {
      return sendError(res, 404, "Room not found");
    }

    return sendSuccess(res, 200, "Room updated successfully", result.rows[0]);
  } catch (error) {
    return handleDatabaseError(res, error, "Failed to update room");
  }
});

router.delete("/:hotelId/:roomNumber", async (req, res) => {
  try {
    const { hotelId, roomNumber } = req.params;

    const result = await pool.query(
      `
        DELETE FROM Room
        WHERE hotel_id = $1
          AND room_number = $2
        RETURNING hotel_id, room_number
      `,
      [hotelId, roomNumber]
    );

    if (result.rows.length === 0) {
      return sendError(res, 404, "Room not found");
    }

    return sendSuccess(res, 200, "Room deleted successfully", result.rows[0]);
  } catch (error) {
    return handleDatabaseError(res, error, "Failed to delete room");
  }
});

module.exports = router;
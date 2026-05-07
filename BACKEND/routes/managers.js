const express = require("express");

const pool = require("../db/pool");
const { handleDatabaseError, sendError, sendSuccess } = require("./utils");

const router = express.Router();

router.post("/register", async (req, res) => {
  try {
    const { name, ssn, email } = req.body;

    if (!name || !ssn || !email) {
      return sendError(res, 400, "name, ssn, and email are required");
    }

    const result = await pool.query(
      `
        INSERT INTO Manager (name, ssn, email)
        VALUES ($1, $2, $3)
        RETURNING ssn, name, email
      `,
      [name, ssn, email]
    );

    return sendSuccess(res, 201, "Manager registered successfully", result.rows[0]);
  } catch (error) {
    return handleDatabaseError(res, error, "Failed to register manager");
  }
});

router.post("/login", async (req, res) => {
  try {
    const { ssn } = req.body;

    if (!ssn) {
      return sendError(res, 400, "ssn is required");
    }

    const result = await pool.query(
      `
        SELECT ssn, name, email
        FROM Manager
        WHERE ssn = $1
      `,
      [ssn]
    );

    if (result.rows.length === 0) {
      return sendError(res, 401, "Invalid manager SSN");
    }

    return sendSuccess(res, 200, "Manager login successful", result.rows[0]);
  } catch (error) {
    return handleDatabaseError(res, error, "Failed to login manager");
  }
});

router.get("/:ssn/hotels-with-rooms", async (req, res) => {
  try {
    const { ssn } = req.params;

    if (!ssn) {
      return sendError(res, 400, "manager ssn is required");
    }

    const result = await pool.query(
      `
        SELECT h.hotel_id,
               h.name,
               h.manager_ssn,
               a.street_name,
               a.street_number,
               a.city,
               COALESCE(
                 json_agg(
                   json_build_object(
                     'room_number', r.room_number,
                     'num_windows', r.num_windows,
                     'year_of_last_renovation', r.year_of_last_renovation,
                    'acces_type', r.acces_type,
                    'price_per_night', r.price_per_night,
                    'booking_id', rb.booking_id,
                    'booked_by', rb.client_email,
                    'booking_start_date', rb.start_date,
                    'booking_end_date', rb.end_date,
                    'booking_status', CASE
                      WHEN rb.booking_id IS NULL THEN 'available'
                      WHEN CURRENT_DATE BETWEEN rb.start_date AND rb.end_date THEN 'booked'
                      ELSE 'reserved'
                    END
                   )
                   ORDER BY r.room_number
                 ) FILTER (WHERE r.room_number IS NOT NULL),
                 '[]'::json
               ) AS rooms
        FROM Hotel h
        LEFT JOIN Address a ON a.address_id = h.address_id
        LEFT JOIN Room r ON r.hotel_id = h.hotel_id
        LEFT JOIN LATERAL (
          SELECT b.booking_id, b.client_email, b.start_date, b.end_date
          FROM Booking b
          WHERE b.hotel_id = r.hotel_id
            AND b.room_number = r.room_number
            AND b.end_date >= CURRENT_DATE
          ORDER BY b.start_date ASC
          LIMIT 1
        ) rb ON true
        WHERE h.manager_ssn = $1
        GROUP BY h.hotel_id, h.name, h.manager_ssn, a.street_name, a.street_number, a.city
        ORDER BY h.hotel_id ASC
      `,
      [ssn]
    );

    return sendSuccess(res, 200, "Manager hotels retrieved", result.rows);
  } catch (error) {
    return handleDatabaseError(res, error, "Failed to fetch manager hotels");
  }
});

module.exports = router;
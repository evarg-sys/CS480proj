const express = require("express");

const pool = require("../db/pool");
const { handleDatabaseError, sendError, sendSuccess } = require("./utils");

const router = express.Router();

router.get("/top-clients", async (req, res) => {
  try {
    const limit = Number.parseInt(req.query.k, 10) || 5;

    const result = await pool.query(
      `
        SELECT c.email,
               c.name,
               COUNT(b.booking_id)::int AS booking_count
        FROM Client c
        LEFT JOIN Booking b ON b.client_email = c.email
        GROUP BY c.email, c.name
        ORDER BY booking_count DESC, c.email ASC
        LIMIT $1
      `,
      [limit]
    );

    return sendSuccess(res, 200, "Top clients report generated", result.rows);
  } catch (error) {
    return handleDatabaseError(res, error, "Failed to generate top clients report");
  }
});

router.get("/room-bookings", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT r.hotel_id,
             h.name AS hotel_name,
             r.room_number,
             r.num_windows,
             r.year_of_last_renovation,
             r.acces_type,
             COUNT(b.booking_id)::int AS booking_count
      FROM Room r
      JOIN Hotel h ON h.hotel_id = r.hotel_id
      LEFT JOIN Booking b
        ON b.hotel_id = r.hotel_id
       AND b.room_number = r.room_number
      GROUP BY r.hotel_id, h.name, r.room_number, r.num_windows, r.year_of_last_renovation, r.acces_type
      ORDER BY r.hotel_id ASC, r.room_number ASC
    `);

    return sendSuccess(res, 200, "Room bookings report generated", result.rows);
  } catch (error) {
    return handleDatabaseError(res, error, "Failed to generate room bookings report");
  }
});

router.get("/hotel-stats", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT h.hotel_id,
             h.name AS hotel_name,
             a.city,
             COUNT(DISTINCT r.room_number)::int AS total_rooms,
             COUNT(DISTINCT b.booking_id)::int AS total_bookings,
             COALESCE(ROUND(AVG(rv.rating)::numeric, 2), 0) AS average_rating
      FROM Hotel h
      LEFT JOIN Address a ON a.address_id = h.address_id
      LEFT JOIN Room r ON r.hotel_id = h.hotel_id
      LEFT JOIN Booking b ON b.hotel_id = h.hotel_id
      LEFT JOIN Review rv ON rv.hotel_id = h.hotel_id
      GROUP BY h.hotel_id, h.name, a.city
      ORDER BY h.hotel_id ASC
    `);

    return sendSuccess(res, 200, "Hotel statistics report generated", result.rows);
  } catch (error) {
    return handleDatabaseError(res, error, "Failed to generate hotel stats report");
  }
});

router.get("/clients-by-cities", async (req, res) => {
  try {
    const { c1, c2 } = req.query;

    if (!c1 || !c2) {
      return sendError(res, 400, "c1 and c2 query parameters are required");
    }

    const result = await pool.query(
      `
        SELECT DISTINCT c.email, c.name
        FROM Client c
        JOIN Address ca ON ca.address_id = c.address_id
        JOIN Booking b ON b.client_email = c.email
        JOIN Hotel h ON h.hotel_id = b.hotel_id
        JOIN Address ha ON ha.address_id = h.address_id
        WHERE ca.city = $1
          AND ha.city = $2
        ORDER BY c.email ASC
      `,
      [c1, c2]
    );

    return sendSuccess(res, 200, "Clients by cities report generated", result.rows);
  } catch (error) {
    return handleDatabaseError(res, error, "Failed to generate clients by cities report");
  }
});

router.get("/problem-hotels", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT h.hotel_id,
             h.name,
             a.city,
             COALESCE(ROUND(AVG(rv.rating)::numeric, 2), 0) AS average_rating,
             COUNT(DISTINCT CASE WHEN ca.city IS NOT NULL AND ca.city <> a.city THEN c.email END)::int AS out_of_city_clients
      FROM Hotel h
      LEFT JOIN Address a ON a.address_id = h.address_id
      LEFT JOIN Review rv ON rv.hotel_id = h.hotel_id
      LEFT JOIN Booking b ON b.hotel_id = h.hotel_id
      LEFT JOIN Client c ON c.email = b.client_email
      LEFT JOIN Address ca ON ca.address_id = c.address_id
      GROUP BY h.hotel_id, h.name, a.city
      HAVING COALESCE(AVG(rv.rating), 0) < 2
         AND COUNT(DISTINCT CASE WHEN ca.city IS NOT NULL AND ca.city <> a.city THEN c.email END) >= 2
      ORDER BY h.hotel_id ASC
    `);

    return sendSuccess(res, 200, "Problem hotels report generated", result.rows);
  } catch (error) {
    return handleDatabaseError(res, error, "Failed to generate problem hotels report");
  }
});

router.get("/client-spending", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT c.email,
             c.name,
             COUNT(b.booking_id)::int AS total_bookings,
             COALESCE(ROUND(SUM((b.end_date - b.start_date) * b.price_per_day)::numeric, 2), 0) AS total_spending
      FROM Client c
      LEFT JOIN Booking b ON b.client_email = c.email
      GROUP BY c.email, c.name
      ORDER BY total_spending DESC, c.email ASC
    `);

    return sendSuccess(res, 200, "Client spending report generated", result.rows);
  } catch (error) {
    return handleDatabaseError(res, error, "Failed to generate client spending report");
  }
});

module.exports = router;
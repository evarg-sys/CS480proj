const express = require("express");

const pool = require("../db/pool");
const { getClientEmail, handleDatabaseError, sendError, sendSuccess } = require("./utils");

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const clientId = getClientEmail(req.body.clientId || req.body.clientEmail);
    const { hotelId, rating, message } = req.body;

    if (!clientId || !hotelId || rating === undefined || rating === null) {
      return sendError(res, 400, "clientId, hotelId, and rating are required");
    }

    if (rating < 1 || rating > 5) {
      return sendError(res, 400, "rating must be between 1 and 5");
    }

    const bookingCheck = await pool.query(
      `
        SELECT 1
        FROM Booking
        WHERE client_email = $1
          AND hotel_id = $2
        LIMIT 1
      `,
      [clientId, hotelId]
    );

    if (bookingCheck.rows.length === 0) {
      return sendError(res, 403, "A client can review a hotel only after booking there");
    }

    const result = await pool.query(
      `
        INSERT INTO Review (message, rating, client_email, hotel_id)
        VALUES ($1, $2, $3, $4)
        RETURNING review_id, message, rating, client_email, hotel_id
      `,
      [message || null, rating, clientId, hotelId]
    );

    return sendSuccess(res, 201, "Review submitted successfully", result.rows[0]);
  } catch (error) {
    return handleDatabaseError(res, error, "Failed to submit review");
  }
});

// GET /api/reviews?clientId=<email>  — returns all reviews left by a specific client
router.get("/", async (req, res) => {
  try {
    const clientId = getClientEmail(req.query.clientId || req.query.clientEmail);
    if (!clientId) {
      return sendError(res, 400, "clientId is required");
    }

    const result = await pool.query(
      `
        SELECT r.review_id, r.rating, r.message, r.hotel_id, h.hotel_name
        FROM Review r
        LEFT JOIN Hotel h ON h.hotel_id = r.hotel_id
        WHERE r.client_email = $1
        ORDER BY r.review_id DESC
      `,
      [clientId]
    );

    return sendSuccess(res, 200, "Reviews fetched successfully", result.rows);
  } catch (error) {
    return handleDatabaseError(res, error, "Failed to fetch reviews");
  }
});

module.exports = router;
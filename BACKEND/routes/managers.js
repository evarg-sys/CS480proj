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

module.exports = router;
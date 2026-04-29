const express = require("express");

const pool = require("../db/pool");
const { createAddress, handleDatabaseError, sendError, sendSuccess } = require("./utils");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT h.hotel_id,
             h.name,
             h.manager_ssn,
             a.street_name,
             a.street_number,
             a.city
      FROM Hotel h
      LEFT JOIN Address a ON a.address_id = h.address_id
      ORDER BY h.hotel_id ASC
    `);

    return sendSuccess(res, 200, "Hotels retrieved", result.rows);
  } catch (error) {
    return handleDatabaseError(res, error, "Failed to fetch hotels");
  }
});

router.post("/", async (req, res) => {
  const client = await pool.connect();

  try {
    const { name, managerSsn, streetName, streetNumber, city } = req.body;

    if (!name || !streetName || !streetNumber || !city) {
      return sendError(res, 400, "name, streetName, streetNumber, and city are required");
    }

    await client.query("BEGIN");

    const addressId = await createAddress(client, streetName, streetNumber, city);
    const result = await client.query(
      `
        INSERT INTO Hotel (name, manager_ssn, address_id)
        VALUES ($1, $2, $3)
        RETURNING hotel_id, name, manager_ssn, address_id
      `,
      [name, managerSsn || null, addressId]
    );

    await client.query("COMMIT");
    return sendSuccess(res, 201, "Hotel added successfully", result.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK");
    return handleDatabaseError(res, error, "Failed to add hotel");
  } finally {
    client.release();
  }
});

router.put("/:hotelId", async (req, res) => {
  const client = await pool.connect();

  try {
    const { hotelId } = req.params;
    const { name, managerSsn, streetName, streetNumber, city } = req.body;

    await client.query("BEGIN");

    const currentHotel = await client.query(
      `
        SELECT h.hotel_id,
               h.name,
               h.manager_ssn,
               h.address_id,
               a.street_name,
               a.street_number,
               a.city
        FROM Hotel h
        LEFT JOIN Address a ON a.address_id = h.address_id
        WHERE h.hotel_id = $1
      `,
      [hotelId]
    );

    if (currentHotel.rows.length === 0) {
      await client.query("ROLLBACK");
      return sendError(res, 404, "Hotel not found");
    }

    const existing = currentHotel.rows[0];
    const mergedStreetName = streetName || existing.street_name;
    const mergedStreetNumber = streetNumber || existing.street_number;
    const mergedCity = city || existing.city;

    let addressId = existing.address_id;
    if (streetName || streetNumber || city) {
      if (!mergedStreetName || !mergedStreetNumber || !mergedCity) {
        await client.query("ROLLBACK");
        return sendError(res, 400, "Hotel address updates require street name, street number, and city");
      }

      addressId = await createAddress(client, mergedStreetName, mergedStreetNumber, mergedCity);
    }

    const result = await client.query(
      `
        UPDATE Hotel
        SET name = COALESCE($1, name),
            manager_ssn = COALESCE($2, manager_ssn),
            address_id = $3
        WHERE hotel_id = $4
        RETURNING hotel_id, name, manager_ssn, address_id
      `,
      [name || null, managerSsn || null, addressId, hotelId]
    );

    await client.query("COMMIT");
    return sendSuccess(res, 200, "Hotel updated successfully", result.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK");
    return handleDatabaseError(res, error, "Failed to update hotel");
  } finally {
    client.release();
  }
});

router.delete("/:hotelId", async (req, res) => {
  try {
    const { hotelId } = req.params;

    const result = await pool.query(
      `
        DELETE FROM Hotel
        WHERE hotel_id = $1
        RETURNING hotel_id
      `,
      [hotelId]
    );

    if (result.rows.length === 0) {
      return sendError(res, 404, "Hotel not found");
    }

    return sendSuccess(res, 200, "Hotel deleted successfully", { hotelId: result.rows[0].hotel_id });
  } catch (error) {
    return handleDatabaseError(res, error, "Failed to delete hotel");
  }
});

module.exports = router;
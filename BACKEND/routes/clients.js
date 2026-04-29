const express = require("express");

const pool = require("../db/pool");
const {
  createAddress,
  getClientEmail,
  handleDatabaseError,
  sendError,
  sendSuccess,
} = require("./utils");

const router = express.Router();

const extractAddress = (body, prefix) => {
  if (body[prefix] && typeof body[prefix] === "object") {
    return {
      streetName: body[prefix].streetName || body[prefix].street_name,
      streetNumber: body[prefix].streetNumber || body[prefix].street_number,
      city: body[prefix].city,
    };
  }

  return {
    streetName: body[`${prefix}StreetName`] || body[`${prefix}_street_name`],
    streetNumber: body[`${prefix}StreetNumber`] || body[`${prefix}_street_number`],
    city: body[`${prefix}City`] || body[`${prefix}_city`],
  };
};

router.post("/register", async (req, res) => {
  const client = await pool.connect();

  try {
    const { name, email, cardNumber } = req.body;
    const address = extractAddress(req.body, "address");
    const billingAddress = extractAddress(req.body, "billing");

    if (!name || !email || !cardNumber || !address.streetName || !address.streetNumber || !address.city) {
      return sendError(
        res,
        400,
        "name, email, cardNumber, and a complete address are required"
      );
    }

    await client.query("BEGIN");

    const addressId = await createAddress(
      client,
      address.streetName,
      address.streetNumber,
      address.city
    );

    const createdClient = await client.query(
      `
        INSERT INTO Client (email, name, address_id)
        VALUES ($1, $2, $3)
        RETURNING email, name, address_id
      `,
      [email, name, addressId]
    );

    const billingAddressId = await createAddress(
      client,
      billingAddress.streetName || address.streetName,
      billingAddress.streetNumber || address.streetNumber,
      billingAddress.city || address.city
    );

    await client.query(
      `
        INSERT INTO CreditCard (card_number, client_email, billing_address_id)
        VALUES ($1, $2, $3)
      `,
      [cardNumber, email, billingAddressId]
    );

    await client.query("COMMIT");

    return sendSuccess(res, 201, "Client registered successfully", {
      clientId: createdClient.rows[0].email,
      ...createdClient.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK");
    return handleDatabaseError(res, error, "Failed to register client");
  } finally {
    client.release();
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return sendError(res, 400, "email is required");
    }

    const result = await pool.query(
      `
        SELECT email, name, address_id
        FROM Client
        WHERE email = $1
      `,
      [email]
    );

    if (result.rows.length === 0) {
      return sendError(res, 401, "Invalid client email");
    }

    return sendSuccess(res, 200, "Client login successful", {
      clientId: result.rows[0].email,
      ...result.rows[0],
    });
  } catch (error) {
    return handleDatabaseError(res, error, "Failed to login client");
  }
});

router.get("/:clientId/bookings", async (req, res) => {
  try {
    const clientId = getClientEmail(req.params.clientId);

    const result = await pool.query(
      `
        SELECT b.booking_id,
               b.client_email,
               b.hotel_id,
               h.name AS hotel_name,
               b.room_number,
               b.start_date,
               b.end_date,
               b.price_per_day,
               ROUND(((b.end_date - b.start_date) * b.price_per_day)::numeric, 2) AS total_price
        FROM Booking b
        JOIN Hotel h ON h.hotel_id = b.hotel_id
        WHERE b.client_email = $1
        ORDER BY b.start_date DESC, b.booking_id DESC
      `,
      [clientId]
    );

    return sendSuccess(res, 200, "Client bookings retrieved", result.rows);
  } catch (error) {
    return handleDatabaseError(res, error, "Failed to fetch client bookings");
  }
});

router.put("/:clientId", async (req, res) => {
  const client = await pool.connect();

  try {
    const clientId = getClientEmail(req.params.clientId);
    const { name, email, cardNumber } = req.body;
    const address = extractAddress(req.body, "address");
    const billingAddress = extractAddress(req.body, "billing");

    if (email && email !== clientId) {
      return sendError(res, 400, "Client email cannot be changed");
    }

    await client.query("BEGIN");

    const existingClient = await client.query(
      `
        SELECT email, name, address_id
        FROM Client
        WHERE email = $1
      `,
      [clientId]
    );

    if (existingClient.rows.length === 0) {
      await client.query("ROLLBACK");
      return sendError(res, 404, "Client not found");
    }

    let nextAddressId = existingClient.rows[0].address_id;
    if (address.streetName || address.streetNumber || address.city) {
      if (!address.streetName || !address.streetNumber || !address.city) {
        await client.query("ROLLBACK");
        return sendError(res, 400, "Address updates require street name, street number, and city");
      }

      nextAddressId = await createAddress(
        client,
        address.streetName,
        address.streetNumber,
        address.city
      );
    }

    const updatedClient = await client.query(
      `
        UPDATE Client
        SET name = COALESCE($1, name),
            address_id = $2
        WHERE email = $3
        RETURNING email, name, address_id
      `,
      [name || null, nextAddressId, clientId]
    );

    if (cardNumber || billingAddress.streetName || billingAddress.streetNumber || billingAddress.city) {
      const currentCard = await client.query(
        `
          SELECT card_number
          FROM CreditCard
          WHERE client_email = $1
          ORDER BY card_number ASC
          LIMIT 1
        `,
        [clientId]
      );

      const billingAddressId = await createAddress(
        client,
        billingAddress.streetName || address.streetName,
        billingAddress.streetNumber || address.streetNumber,
        billingAddress.city || address.city
      );

      if (currentCard.rows.length > 0) {
        await client.query(
          `
            UPDATE CreditCard
            SET card_number = COALESCE($1, card_number),
                billing_address_id = COALESCE($2, billing_address_id)
            WHERE client_email = $3
          `,
          [cardNumber || null, billingAddressId, clientId]
        );
      } else if (cardNumber) {
        await client.query(
          `
            INSERT INTO CreditCard (card_number, client_email, billing_address_id)
            VALUES ($1, $2, $3)
          `,
          [cardNumber, clientId, billingAddressId]
        );
      }
    }

    await client.query("COMMIT");

    return sendSuccess(res, 200, "Client updated successfully", {
      clientId: updatedClient.rows[0].email,
      ...updatedClient.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK");
    return handleDatabaseError(res, error, "Failed to update client");
  } finally {
    client.release();
  }
});

router.delete("/:clientId", async (req, res) => {
  try {
    const clientId = getClientEmail(req.params.clientId);

    const result = await pool.query(
      `
        DELETE FROM Client
        WHERE email = $1
        RETURNING email
      `,
      [clientId]
    );

    if (result.rows.length === 0) {
      return sendError(res, 404, "Client not found");
    }

    return sendSuccess(res, 200, "Client deleted successfully", { clientId });
  } catch (error) {
    return handleDatabaseError(res, error, "Failed to delete client");
  }
});

module.exports = router;
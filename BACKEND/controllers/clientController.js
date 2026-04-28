const pool = require("../db/pool");

const normalizeAddress = (address = {}) => {
  const streetName = address.streetName || address.street_name;
  const streetNumber = address.streetNumber || address.street_number;
  const city = address.city;
  return { streetName, streetNumber, city };
};

const createAddress = async (client, address) => {
  const { streetName, streetNumber, city } = normalizeAddress(address);
  if (!streetName || !streetNumber || !city) {
    return null;
  }

  const result = await client.query(
    `
    INSERT INTO Address (street_name, street_number, city)
    VALUES ($1, $2, $3)
    RETURNING address_id
    `,
    [streetName, streetNumber, city]
  );
  return result.rows[0].address_id;
};

const registerClient = async (req, res) => {
  const client = await pool.connect();
  try {
    const { name, email, address, addresses = [], creditCards = [] } = req.body;

    if (!name || !email) {
      return res.status(400).json({ message: "name and email are required" });
    }

    await client.query("BEGIN");

    const primaryAddress = address || addresses[0] || null;
    const addressId = primaryAddress ? await createAddress(client, primaryAddress) : null;

    const createdClientResult = await client.query(
      `
      INSERT INTO Client (email, name, address_id)
      VALUES ($1, $2, $3)
      RETURNING email, name, address_id
      `,
      [email, name, addressId]
    );

    for (const card of creditCards) {
      const cardNumber = card.cardNumber || card.card_number;
      if (!cardNumber) {
        continue;
      }

      const billingAddress = card.billingAddress || card.billing_address || null;
      const billingAddressId = billingAddress ? await createAddress(client, billingAddress) : null;

      await client.query(
        `
        INSERT INTO CreditCard (card_number, client_email, billing_address_id)
        VALUES ($1, $2, $3)
        `,
        [cardNumber, email, billingAddressId]
      );
    }

    await client.query("COMMIT");
    return res.status(201).json({
      message: "Client registered successfully",
      client: createdClientResult.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK");
    return res.status(500).json({ message: "Failed to register client", error: error.message });
  } finally {
    client.release();
  }
};

const loginClient = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: "email is required" });
    }

    const result = await pool.query("SELECT email, name, address_id FROM Client WHERE email = $1", [email]);

    if (result.rows.length === 0) {
      return res.status(401).json({ message: "Invalid email" });
    }

    return res.json({ message: "Login successful", client: result.rows[0] });
  } catch (error) {
    return res.status(500).json({ message: "Failed to login client", error: error.message });
  }
};

const updateClient = async (req, res) => {
  const client = await pool.connect();
  try {
    const { email } = req.params;
    const { name, address, addresses, creditCards } = req.body;

    await client.query("BEGIN");

    let nextAddressId = null;
    const incomingAddress = address || (Array.isArray(addresses) ? addresses[0] : null);
    if (incomingAddress) {
      nextAddressId = await createAddress(client, incomingAddress);
    }

    const updatedClientResult = await client.query(
      `
      UPDATE Client
      SET name = COALESCE($1, name),
          address_id = COALESCE($2, address_id)
      WHERE email = $3
      RETURNING email, name, address_id
      `,
      [name ?? null, nextAddressId, email]
    );

    if (updatedClientResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Client not found" });
    }

    if (Array.isArray(creditCards)) {
      await client.query("DELETE FROM CreditCard WHERE client_email = $1", [email]);

      for (const card of creditCards) {
        const cardNumber = card.cardNumber || card.card_number;
        if (!cardNumber) {
          continue;
        }

        const billingAddress = card.billingAddress || card.billing_address || null;
        const billingAddressId = billingAddress ? await createAddress(client, billingAddress) : null;

        await client.query(
          `
          INSERT INTO CreditCard (card_number, client_email, billing_address_id)
          VALUES ($1, $2, $3)
          `,
          [cardNumber, email, billingAddressId]
        );
      }
    }

    await client.query("COMMIT");
    return res.json({
      message: "Client updated successfully",
      client: updatedClientResult.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK");
    return res.status(500).json({ message: "Failed to update client", error: error.message });
  } finally {
    client.release();
  }
};

const searchAvailableRooms = async (req, res) => {
  try {
    const { checkIn, checkOut, hotelId, city } = req.query;

    if (!checkIn || !checkOut) {
      return res.status(400).json({ message: "checkIn and checkOut are required" });
    }

    if (new Date(checkIn) >= new Date(checkOut)) {
      return res.status(400).json({ message: "checkOut must be after checkIn" });
    }

    const values = [checkIn, checkOut];
    const filters = [];

    if (hotelId) {
      values.push(hotelId);
      filters.push(`r.hotel_id = $${values.length}`);
    }

    if (city) {
      values.push(city);
      filters.push(`a.city = $${values.length}`);
    }

    const whereClause = filters.length > 0 ? ` AND ${filters.join(" AND ")}` : "";

    const query = `
      SELECT r.hotel_id,
             h.name AS hotel_name,
             a.city,
             r.room_number,
             r.num_windows,
             r.year_of_last_renovation,
             r.acces_type
      FROM Room r
      JOIN Hotel h ON h.hotel_id = r.hotel_id
      LEFT JOIN Address a ON a.address_id = h.address_id
      WHERE NOT EXISTS (
        SELECT 1
        FROM Booking b
        WHERE b.hotel_id = r.hotel_id
          AND b.room_number = r.room_number
          AND b.start_date < $2::date
          AND b.end_date > $1::date
      )
      ${whereClause}
      ORDER BY r.hotel_id ASC, r.room_number ASC
    `;

    const result = await pool.query(query, values);
    return res.json(result.rows);
  } catch (error) {
    return res.status(500).json({ message: "Failed to search rooms", error: error.message });
  }
};

const bookSpecificRoom = async (req, res) => {
  const client = await pool.connect();
  try {
    const { clientEmail, hotelId, roomNumber, checkIn, checkOut, pricePerDay } = req.body;

    if (!clientEmail || !hotelId || roomNumber == null || !checkIn || !checkOut || pricePerDay == null) {
      return res.status(400).json({
        message: "clientEmail, hotelId, roomNumber, checkIn, checkOut, and pricePerDay are required",
      });
    }

    if (new Date(checkIn) >= new Date(checkOut)) {
      return res.status(400).json({ message: "checkOut must be after checkIn" });
    }

    await client.query("BEGIN");

    const roomResult = await client.query(
      `
      SELECT room_number, hotel_id
      FROM Room
      WHERE hotel_id = $1
        AND room_number = $2
      `,
      [hotelId, roomNumber]
    );

    if (roomResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Room not found" });
    }

    const availabilityResult = await client.query(
      `
      SELECT 1
      FROM Booking
      WHERE hotel_id = $1
        AND room_number = $2
        AND start_date < $4::date
        AND end_date > $3::date
      LIMIT 1
      `,
      [hotelId, roomNumber, checkIn, checkOut]
    );

    if (availabilityResult.rows.length > 0) {
      await client.query("ROLLBACK");
      return res.status(409).json({ message: "Room is not available for the selected date range" });
    }

    const bookingResult = await client.query(
      `
      INSERT INTO Booking (
        start_date,
        end_date,
        price_per_day,
        client_email,
        room_number,
        hotel_id
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
      `,
      [checkIn, checkOut, pricePerDay, clientEmail, roomNumber, hotelId]
    );

    await client.query("COMMIT");
    return res.status(201).json({ message: "Room booked successfully", booking: bookingResult.rows[0] });
  } catch (error) {
    await client.query("ROLLBACK");
    return res.status(500).json({ message: "Failed to book room", error: error.message });
  } finally {
    client.release();
  }
};

const autoBookRoom = async (req, res) => {
  const client = await pool.connect();
  try {
    const { clientEmail, hotelId, checkIn, checkOut, pricePerDay } = req.body;

    if (!clientEmail || !hotelId || !checkIn || !checkOut || pricePerDay == null) {
      return res.status(400).json({
        message: "clientEmail, hotelId, checkIn, checkOut, and pricePerDay are required",
      });
    }

    if (new Date(checkIn) >= new Date(checkOut)) {
      return res.status(400).json({ message: "checkOut must be after checkIn" });
    }

    await client.query("BEGIN");

    const roomResult = await client.query(
      `
      SELECT r.room_number, r.hotel_id
      FROM Room r
      WHERE r.hotel_id = $1
        AND NOT EXISTS (
          SELECT 1
          FROM Booking b
          WHERE b.hotel_id = r.hotel_id
            AND b.room_number = r.room_number
            AND b.start_date < $3::date
            AND b.end_date > $2::date
        )
      ORDER BY r.room_number ASC
      LIMIT 1
      `,
      [hotelId, checkIn, checkOut]
    );

    if (roomResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "No available room found in selected hotel" });
    }

    const room = roomResult.rows[0];

    const bookingResult = await client.query(
      `
      INSERT INTO Booking (
        start_date,
        end_date,
        price_per_day,
        client_email,
        room_number,
        hotel_id
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
      `,
      [checkIn, checkOut, pricePerDay, clientEmail, room.room_number, room.hotel_id]
    );

    await client.query("COMMIT");
    return res.status(201).json({
      message: "Auto-booking successful",
      booking: bookingResult.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK");
    return res.status(500).json({ message: "Failed to auto-book room", error: error.message });
  } finally {
    client.release();
  }
};

const viewBookings = async (req, res) => {
  try {
    const { email } = req.params;

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
      ORDER BY b.booking_id DESC
      `,
      [email]
    );

    return res.json(result.rows);
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch bookings", error: error.message });
  }
};

const submitReview = async (req, res) => {
  try {
    const { clientEmail, hotelId, rating, message } = req.body;

    if (!clientEmail || !hotelId || rating == null) {
      return res.status(400).json({ message: "clientEmail, hotelId, and rating are required" });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({ message: "rating must be between 1 and 5" });
    }

    const bookingResult = await pool.query(
      `
      SELECT 1
      FROM Booking
      WHERE client_email = $1
        AND hotel_id = $2
      LIMIT 1
      `,
      [clientEmail, hotelId]
    );

    if (bookingResult.rows.length === 0) {
      return res.status(403).json({
        message: "Client can review a hotel only after booking it",
      });
    }

    const reviewResult = await pool.query(
      `
      INSERT INTO Review (message, rating, client_email, hotel_id)
      VALUES ($1, $2, $3, $4)
      RETURNING *
      `,
      [message || null, rating, clientEmail, hotelId]
    );

    return res.status(201).json({ message: "Review submitted successfully", review: reviewResult.rows[0] });
  } catch (error) {
    return res.status(500).json({ message: "Failed to submit review", error: error.message });
  }
};

module.exports = {
  registerClient,
  loginClient,
  updateClient,
  searchAvailableRooms,
  bookSpecificRoom,
  autoBookRoom,
  viewBookings,
  submitReview,
};

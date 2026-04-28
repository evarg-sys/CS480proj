const pool = require("../db/pool");

const createAddress = async (client, streetName, streetNumber, city) => {
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

const registerManager = async (req, res) => {
  try {
    const { name, ssn, email } = req.body;
    if (!name || !ssn || !email) {
      return res.status(400).json({ message: "name, ssn, and email are required" });
    }

    const result = await pool.query(
      `
      INSERT INTO Manager (ssn, name, email)
      VALUES ($1, $2, $3)
      RETURNING ssn, name, email
      `,
      [ssn, name, email]
    );

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    return res.status(500).json({ message: "Failed to register manager", error: error.message });
  }
};

const loginManager = async (req, res) => {
  try {
    const { ssn } = req.body;
    if (!ssn) {
      return res.status(400).json({ message: "ssn is required" });
    }

    const result = await pool.query("SELECT ssn, name, email FROM Manager WHERE ssn = $1", [ssn]);

    if (result.rows.length === 0) {
      return res.status(401).json({ message: "Invalid SSN" });
    }

    return res.json({ message: "Login successful", manager: result.rows[0] });
  } catch (error) {
    return res.status(500).json({ message: "Failed to login manager", error: error.message });
  }
};

const addHotel = async (req, res) => {
  const client = await pool.connect();
  try {
    const { name, managerSsn, streetName, streetNumber, city } = req.body;

    if (!name || !streetName || !streetNumber || !city) {
      return res.status(400).json({
        message: "name, streetName, streetNumber, and city are required",
      });
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
    return res.status(201).json(result.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK");
    return res.status(500).json({ message: "Failed to add hotel", error: error.message });
  } finally {
    client.release();
  }
};

const updateHotel = async (req, res) => {
  const client = await pool.connect();
  try {
    const { hotelId } = req.params;
    const { name, managerSsn, streetName, streetNumber, city } = req.body;

    const hotelResult = await client.query(
      `
      SELECT h.hotel_id, h.name, h.manager_ssn, h.address_id,
             a.street_name, a.street_number, a.city
      FROM Hotel h
      LEFT JOIN Address a ON a.address_id = h.address_id
      WHERE h.hotel_id = $1
      `,
      [hotelId]
    );

    if (hotelResult.rows.length === 0) {
      return res.status(404).json({ message: "Hotel not found" });
    }

    const current = hotelResult.rows[0];
    const finalName = name ?? current.name;
    const finalManagerSsn = managerSsn ?? current.manager_ssn;
    const nextStreetName = streetName ?? current.street_name;
    const nextStreetNumber = streetNumber ?? current.street_number;
    const nextCity = city ?? current.city;

    await client.query("BEGIN");

    let addressId = current.address_id;
    if (nextStreetName && nextStreetNumber && nextCity) {
      addressId = await createAddress(client, nextStreetName, nextStreetNumber, nextCity);
    }

    const result = await client.query(
      `
      UPDATE Hotel
      SET name = $1,
          manager_ssn = $2,
          address_id = $3
      WHERE hotel_id = $4
      RETURNING hotel_id, name, manager_ssn, address_id
      `,
      [finalName, finalManagerSsn, addressId, hotelId]
    );

    await client.query("COMMIT");
    return res.json(result.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK");
    return res.status(500).json({ message: "Failed to update hotel", error: error.message });
  } finally {
    client.release();
  }
};

const deleteHotel = async (req, res) => {
  try {
    const { hotelId } = req.params;
    const result = await pool.query("DELETE FROM Hotel WHERE hotel_id = $1 RETURNING hotel_id", [hotelId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Hotel not found" });
    }

    return res.json({ message: "Hotel deleted successfully" });
  } catch (error) {
    return res.status(500).json({ message: "Failed to delete hotel", error: error.message });
  }
};

const addRoom = async (req, res) => {
  try {
    const { hotelId, roomNumber, numWindows, yearOfLastRenovation, accesType } = req.body;

    if (!hotelId || roomNumber == null) {
      return res.status(400).json({ message: "hotelId and roomNumber are required" });
    }

    const result = await pool.query(
      `
      INSERT INTO Room (room_number, hotel_id, num_windows, year_of_last_renovation, acces_type)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING room_number, hotel_id, num_windows, year_of_last_renovation, acces_type
      `,
      [roomNumber, hotelId, numWindows ?? null, yearOfLastRenovation ?? null, accesType ?? null]
    );

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    return res.status(500).json({ message: "Failed to add room", error: error.message });
  }
};

const updateRoom = async (req, res) => {
  try {
    const { hotelId, roomNumber } = req.params;
    const { newRoomNumber, numWindows, yearOfLastRenovation, accesType } = req.body;

    const result = await pool.query(
      `
      UPDATE Room
      SET room_number = COALESCE($1, room_number),
          num_windows = COALESCE($2, num_windows),
          year_of_last_renovation = COALESCE($3, year_of_last_renovation),
          acces_type = COALESCE($4, acces_type)
      WHERE hotel_id = $5
        AND room_number = $6
      RETURNING room_number, hotel_id, num_windows, year_of_last_renovation, acces_type
      `,
      [newRoomNumber ?? null, numWindows ?? null, yearOfLastRenovation ?? null, accesType ?? null, hotelId, roomNumber]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Room not found" });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    return res.status(500).json({ message: "Failed to update room", error: error.message });
  }
};

const deleteRoom = async (req, res) => {
  try {
    const { hotelId, roomNumber } = req.params;
    const result = await pool.query(
      "DELETE FROM Room WHERE hotel_id = $1 AND room_number = $2 RETURNING room_number, hotel_id",
      [hotelId, roomNumber]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Room not found" });
    }

    return res.json({ message: "Room deleted successfully" });
  } catch (error) {
    return res.status(500).json({ message: "Failed to delete room", error: error.message });
  }
};

const deleteClient = async (req, res) => {
  try {
    const { clientEmail } = req.params;
    const result = await pool.query("DELETE FROM Client WHERE email = $1 RETURNING email", [clientEmail]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Client not found" });
    }

    return res.json({ message: "Client deleted successfully" });
  } catch (error) {
    return res.status(500).json({ message: "Failed to delete client", error: error.message });
  }
};

const getTopKClients = async (req, res) => {
  try {
    const k = Number.parseInt(req.query.k, 10) || 5;

    const result = await pool.query(
      `
      SELECT c.email, c.name, COUNT(b.booking_id)::int AS booking_count
      FROM Client c
      LEFT JOIN Booking b ON b.client_email = c.email
      GROUP BY c.email, c.name
      ORDER BY booking_count DESC, c.email ASC
      LIMIT $1
      `,
      [k]
    );

    return res.json(result.rows);
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch top clients", error: error.message });
  }
};

const getRoomsWithBookingCounts = async (req, res) => {
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

    return res.json(result.rows);
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch room stats", error: error.message });
  }
};

const getHotelStats = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT h.hotel_id,
             h.name,
             a.city,
             COUNT(DISTINCT b.booking_id)::int AS total_bookings,
             COALESCE(ROUND(AVG(rv.rating)::numeric, 2), 0) AS average_rating
      FROM Hotel h
      LEFT JOIN Address a ON a.address_id = h.address_id
      LEFT JOIN Booking b ON b.hotel_id = h.hotel_id
      LEFT JOIN Review rv ON rv.hotel_id = h.hotel_id
      GROUP BY h.hotel_id, h.name, a.city
      ORDER BY h.hotel_id ASC
    `);

    return res.json(result.rows);
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch hotel stats", error: error.message });
  }
};

const getClientsAddressC1BookedC2 = async (req, res) => {
  try {
    const { c1, c2 } = req.query;
    if (!c1 || !c2) {
      return res.status(400).json({ message: "c1 and c2 are required" });
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

    return res.json(result.rows);
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch cross-city clients", error: error.message });
  }
};

const getProblematicChicagoHotels = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT h.hotel_id,
             h.name,
             COALESCE(ROUND(AVG(rv.rating)::numeric, 2), 0) AS average_rating,
             COUNT(
               DISTINCT CASE
                 WHEN ca.city IS NOT NULL AND ca.city <> 'Chicago' THEN b.client_email
               END
             )::int AS non_chicago_client_count
      FROM Hotel h
      LEFT JOIN Address ha ON ha.address_id = h.address_id
      LEFT JOIN Review rv ON rv.hotel_id = h.hotel_id
      LEFT JOIN Booking b ON b.hotel_id = h.hotel_id
      LEFT JOIN Client c ON c.email = b.client_email
      LEFT JOIN Address ca ON ca.address_id = c.address_id
      WHERE ha.city = 'Chicago'
      GROUP BY h.hotel_id, h.name
      HAVING COALESCE(AVG(rv.rating), 0) < 2
         AND COUNT(
           DISTINCT CASE
             WHEN ca.city IS NOT NULL AND ca.city <> 'Chicago' THEN b.client_email
           END
         ) >= 2
      ORDER BY h.hotel_id ASC
    `);

    return res.json(result.rows);
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch problematic Chicago hotels",
      error: error.message,
    });
  }
};

const getClientSpending = async (req, res) => {
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

    return res.json(result.rows);
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch client spending", error: error.message });
  }
};

module.exports = {
  registerManager,
  loginManager,
  addHotel,
  updateHotel,
  deleteHotel,
  addRoom,
  updateRoom,
  deleteRoom,
  deleteClient,
  getTopKClients,
  getRoomsWithBookingCounts,
  getHotelStats,
  getClientsAddressC1BookedC2,
  getProblematicChicagoHotels,
  getClientSpending,
};

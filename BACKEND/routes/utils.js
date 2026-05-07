const sendSuccess = (res, status, message, data) => {
  const response = { success: true, message };
  if (typeof data !== "undefined") {
    response.data = data;
  }
  return res.status(status).json(response);
};

const sendError = (res, status, message, error) => {
  const response = { success: false, message };
  if (error) {
    response.error = error;
  }
  return res.status(status).json(response);
};

const handleDatabaseError = (res, error, fallbackMessage) => {
  console.error(fallbackMessage, error);

  if (error.code === "23505") {
    return sendError(res, 409, "A record with those unique values already exists", error.detail);
  }

  if (error.code === "23503") {
    return sendError(res, 400, "A referenced record does not exist", error.detail);
  }

  if (error.code === "23514") {
    return sendError(res, 400, "The submitted data violates a database rule", error.detail);
  }

  return sendError(res, 500, fallbackMessage, error.message);
};

const isValidDateRange = (startDate, endDate) => {
  if (!startDate || !endDate) {
    return false;
  }

  const start = new Date(startDate);
  const end = new Date(endDate);
  return Number.isFinite(start.getTime()) && Number.isFinite(end.getTime()) && start < end;
};

const createAddress = async (db, streetName, streetNumber, city) => {
  if (!streetName || !streetNumber || !city) {
    return null;
  }

  const result = await db.query(
    `
      INSERT INTO Address (street_name, street_number, city)
      VALUES ($1, $2, $3)
      RETURNING address_id
    `,
    [streetName, streetNumber, city]
  );

  return result.rows[0].address_id;
};

const getRoomConflict = async (db, hotelId, roomNumber, startDate, endDate) => {
  const result = await db.query(
    `
      SELECT booking_id, client_email, start_date, end_date
      FROM Booking
      WHERE hotel_id = $1
        AND room_number = $2
        AND start_date <= $4::date
        AND end_date >= $3::date
      ORDER BY start_date ASC
      LIMIT 1
    `,
    [hotelId, roomNumber, startDate, endDate]
  );

  return result.rows[0] || null;
};

const getAvailableRoomInHotel = async (db, hotelId, startDate, endDate) => {
  const result = await db.query(
    `
      SELECT r.hotel_id,
             r.room_number,
             r.num_windows,
             r.year_of_last_renovation,
             r.acces_type,
             r.price_per_night
      FROM Room r
      WHERE r.hotel_id = $1
        AND NOT EXISTS (
          SELECT 1
          FROM Booking b
          WHERE b.hotel_id = r.hotel_id
            AND b.room_number = r.room_number
            AND b.start_date <= $3::date
            AND b.end_date >= $2::date
        )
      ORDER BY r.room_number ASC
      LIMIT 1
    `,
    [hotelId, startDate, endDate]
  );

  return result.rows[0] || null;
};

const getAlternativeHotels = async (db, excludedHotelId, startDate, endDate) => {
  const result = await db.query(
    `
      SELECT h.hotel_id,
             h.name,
             a.city,
             COUNT(*)::int AS available_rooms,
             MIN(r.room_number)::int AS first_available_room
      FROM Hotel h
      JOIN Room r ON r.hotel_id = h.hotel_id
      LEFT JOIN Address a ON a.address_id = h.address_id
      WHERE h.hotel_id <> $1
        AND NOT EXISTS (
          SELECT 1
          FROM Booking b
          WHERE b.hotel_id = r.hotel_id
            AND b.room_number = r.room_number
            AND b.start_date <= $3::date
            AND b.end_date >= $2::date
        )
      GROUP BY h.hotel_id, h.name, a.city
      HAVING COUNT(*) > 0
      ORDER BY available_rooms DESC, h.hotel_id ASC
    `,
    [excludedHotelId, startDate, endDate]
  );

  return result.rows;
};

const getClientEmail = (value) => (typeof value === "string" ? value.trim() : "");

module.exports = {
  createAddress,
  getAlternativeHotels,
  getAvailableRoomInHotel,
  getClientEmail,
  getRoomConflict,
  handleDatabaseError,
  isValidDateRange,
  sendError,
  sendSuccess,
};
-- Hotel Management System - ER Diagram Schema

CREATE TABLE Address (
    address_id SERIAL PRIMARY KEY,
    street_name VARCHAR(100) NOT NULL,
    street_number VARCHAR(20) NOT NULL,
    city VARCHAR(100) NOT NULL
);

CREATE TABLE Manager (
    ssn CHAR(9) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL
);

CREATE TABLE Hotel (
    hotel_id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    manager_ssn CHAR(9) REFERENCES Manager(ssn) ON DELETE SET NULL,
    address_id INT REFERENCES Address(address_id) ON DELETE SET NULL
);

CREATE TABLE Room (
    room_number INT NOT NULL,
    hotel_id INT NOT NULL REFERENCES Hotel(hotel_id) ON DELETE CASCADE,
    num_windows INT,
    year_of_last_renovation INT,
    acces_type VARCHAR(50),
    PRIMARY KEY (room_number, hotel_id)
);

CREATE TABLE Client (
    email VARCHAR(150) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    address_id INT REFERENCES Address(address_id) ON DELETE SET NULL
);

CREATE TABLE CreditCard (
    card_number VARCHAR(20) PRIMARY KEY,
    client_email VARCHAR(150) NOT NULL REFERENCES Client(email) ON DELETE CASCADE,
    billing_address_id INT REFERENCES Address(address_id) ON DELETE SET NULL
);

CREATE TABLE Review (
    review_id SERIAL PRIMARY KEY,
    message TEXT,
    rating INT CHECK (rating BETWEEN 1 AND 5),
    client_email VARCHAR(150) NOT NULL REFERENCES Client(email) ON DELETE CASCADE,
    hotel_id INT NOT NULL REFERENCES Hotel(hotel_id) ON DELETE CASCADE
);

CREATE TABLE Booking (
    booking_id SERIAL PRIMARY KEY,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    price_per_day NUMERIC(10, 2) NOT NULL,
    client_email VARCHAR(150) NOT NULL REFERENCES Client(email) ON DELETE CASCADE,
    room_number INT NOT NULL,
    hotel_id INT NOT NULL,
    FOREIGN KEY (room_number, hotel_id) REFERENCES Room(room_number, hotel_id) ON DELETE CASCADE,
    CHECK (end_date > start_date)
);

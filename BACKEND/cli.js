require("dotenv").config();

const readline = require("node:readline/promises");
const { stdin: input, stdout: output } = require("node:process");
const { Pool } = require("pg");

const baseUrl = process.env.CLI_BASE_URL || `http://127.0.0.1:${process.env.PORT || 3000}`;

const rl = readline.createInterface({ input, output });
let dbPool;

const ask = async (question) => (await rl.question(question)).trim();

const formatError = (error) => {
  if (!error) {
    return "Unknown error";
  }

  if (Array.isArray(error.errors) && error.errors.length > 0) {
    const nested = error.errors
      .map((nestedError) => nestedError && nestedError.message)
      .filter(Boolean)
      .join(" | ");
    const summary = error.message || error.name || "AggregateError";
    return `${summary}${nested ? ` | details: ${nested}` : ""}`;
  }

  const message = error.message || String(error);
  const causeMessage = error.cause && error.cause.message ? ` | cause: ${error.cause.message}` : "";
  return `${message}${causeMessage}`;
};

const getDbPool = () => {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set. Add it in your .env file first.");
  }

  if (!dbPool) {
    dbPool = new Pool({ connectionString: process.env.DATABASE_URL });
  }

  return dbPool;
};

const request = async (path, method, body) => {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });

  let data;
  try {
    data = await response.json();
  } catch (_error) {
    data = { message: "Non-JSON response" };
  }

  console.log(`\nStatus: ${response.status}`);
  console.log(JSON.stringify(data, null, 2));
  console.log("");
};

const registerManager = async () => {
  const name = await ask("Manager name: ");
  const ssn = await ask("Manager SSN (9 chars): ");
  const email = await ask("Manager email: ");
  await request("/api/manager/register", "POST", { name, ssn, email });
};

const loginManager = async () => {
  const ssn = await ask("Manager SSN: ");
  await request("/api/manager/login", "POST", { ssn });
};

const registerClient = async () => {
  const name = await ask("Client name: ");
  const email = await ask("Client email: ");

  const streetName = await ask("Client street_name (optional): ");
  const streetNumber = await ask("Client street_number (optional): ");
  const city = await ask("Client city (optional): ");

  const address =
    streetName && streetNumber && city
      ? { streetName, streetNumber, city }
      : null;

  await request("/api/client/register", "POST", { name, email, address, creditCards: [] });
};

const loginClient = async () => {
  const email = await ask("Client email: ");
  await request("/api/client/login", "POST", { email });
};

const addHotel = async () => {
  const name = await ask("Hotel name: ");
  const managerSsn = await ask("Manager SSN for this hotel (optional): ");
  const streetName = await ask("Hotel street_name: ");
  const streetNumber = await ask("Hotel street_number: ");
  const city = await ask("Hotel city: ");

  await request("/api/manager/hotels", "POST", {
    name,
    managerSsn: managerSsn || null,
    streetName,
    streetNumber,
    city,
  });
};

const showDatabaseInfo = async () => {
  const pool = getDbPool();
  const result = await pool.query(`
    SELECT
      current_database() AS database_name,
      current_user AS db_user,
      current_schema() AS schema_name,
      version() AS postgres_version
  `);

  console.log("\nDatabase Info:");
  console.table(result.rows);
  console.log("");
};

const showTables = async () => {
  const pool = getDbPool();
  const result = await pool.query(`
    SELECT table_schema, table_name
    FROM information_schema.tables
    WHERE table_type = 'BASE TABLE'
      AND table_schema NOT IN ('pg_catalog', 'information_schema')
    ORDER BY table_schema, table_name
  `);

  console.log("\nTables:");
  if (result.rows.length === 0) {
    console.log("No tables found.\n");
    return;
  }

  console.table(result.rows);
  console.log("");
};

const showMenu = () => {
  console.log("Choose an action:");
  console.log("1) Register manager");
  console.log("2) Login manager");
  console.log("3) Register client");
  console.log("4) Login client");
  console.log("5) Add hotel");
  console.log("6) Show DB info");
  console.log("7) List tables");
  console.log("0) Exit");
};

const main = async () => {
  console.log(`CLI target: ${baseUrl}`);

  while (true) {
    showMenu();
    const choice = await ask("Enter choice: ");

    try {
      if (choice === "1") {
        await registerManager();
      } else if (choice === "2") {
        await loginManager();
      } else if (choice === "3") {
        await registerClient();
      } else if (choice === "4") {
        await loginClient();
      } else if (choice === "5") {
        await addHotel();
      } else if (choice === "6") {
        await showDatabaseInfo();
      } else if (choice === "7") {
        await showTables();
      } else if (choice === "0") {
        break;
      } else {
        console.log("Invalid choice.\n");
      }
    } catch (error) {
      console.error(`Request failed: ${formatError(error)}`);
      console.error(`CLI target: ${baseUrl}\n`);
    }
  }

  rl.close();
  if (dbPool) {
    await dbPool.end();
  }
};

main();

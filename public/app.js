/* ============================================================
   SECTION NAVIGATION
   ============================================================ */
const SECTION_IDS = ["landingSection", "managerDashboardSection", "clientDashboardSection"];

function showSection(sectionId) {
  SECTION_IDS.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (id === sectionId) {
      el.classList.remove("hidden");
      el.classList.add("visible");
    } else {
      el.classList.remove("visible");
      el.classList.add("hidden");
    }
  });
}

/* ============================================================
   AUTH PAGE — mode / sub-tab switching
   ============================================================ */
function authShowMode(mode) {
  // Toggle portal buttons
  document.getElementById("portalBtnManager").classList.toggle("active", mode === "manager");
  document.getElementById("portalBtnClient").classList.toggle("active", mode === "client");

  // Toggle auth mode panels
  document.getElementById("authManager").classList.toggle("active", mode === "manager");
  document.getElementById("authClient").classList.toggle("active", mode === "client");

  // Clear auth output
  const out = document.getElementById("authOutput");
  if (out) out.innerHTML = "";
}

function authSubTab(mode, sub) {
  const prefix = mode === "manager" ? "mgr" : "cli";
  const loginBtn    = document.getElementById(`${prefix}SubLogin`);
  const registerBtn = document.getElementById(`${prefix}SubRegister`);

  if (loginBtn)    loginBtn.classList.toggle("active",    sub === "login");
  if (registerBtn) registerBtn.classList.toggle("active", sub === "register");

  const loginSuffix    = mode === "manager" ? "authManagerLogin"    : "authClientLogin";
  const registerSuffix = mode === "manager" ? "authManagerRegister" : "authClientRegister";

  const loginEl    = document.getElementById(loginSuffix);
  const registerEl = document.getElementById(registerSuffix);

  if (loginEl)    loginEl.classList.toggle("active",    sub === "login");
  if (registerEl) registerEl.classList.toggle("active", sub === "register");
}

/* ============================================================
   OUTPUT HELPERS
   ============================================================ */
function getValue(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : "";
}

function setValue(id, value = "") {
  const el = document.getElementById(id);
  if (el) el.value = value;
}

function getManagerSSN()  { return localStorage.getItem("managerSSN")  || ""; }
function getClientId()    { return localStorage.getItem("clientId")    || ""; }
function getManagerName() { return localStorage.getItem("managerName") || "Manager"; }
function getClientName()  { return localStorage.getItem("clientName")  || "Guest"; }
function getClientReviewCount(clientId) {
  const key = `clientReviewCount:${clientId}`;
  return Number.parseInt(localStorage.getItem(key) || "0", 10) || 0;
}
function incrementClientReviewCount(clientId) {
  const key = `clientReviewCount:${clientId}`;
  const current = Number.parseInt(localStorage.getItem(key) || "0", 10) || 0;
  localStorage.setItem(key, String(current + 1));
}

function clearOutput() {
  ["mgrOutput", "reportOutput", "cliOutput", "searchOutput",
   "bookOutput", "bookingsOutput", "reviewOutput", "profileOutput",
   "authOutput"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = "";
  });
}

function formatCell(value) {
  if (value === null || typeof value === "undefined") return "";
  if (Array.isArray(value)) return `${value.length} items`;
  if (typeof value === "object") return `<pre style="margin:0;font-size:0.78rem">${JSON.stringify(value, null, 2)}</pre>`;
  return String(value);
}

function createTable(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return "<p style='color:#64618c;font-size:0.88rem'>No rows returned.</p>";
  const cols = Array.from(rows.reduce((s, r) => { Object.keys(r || {}).forEach((k) => s.add(k)); return s; }, new Set()));
  const header = cols.map((c) => `<th>${c}</th>`).join("");
  const body = rows.map((r) => `<tr>${cols.map((c) => `<td>${formatCell(r[c])}</td>`).join("")}</tr>`).join("");
  return `<table class="output-table"><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table>`;
}

function formatColumnLabel(column) {
  return String(column)
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function createReportTable(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return "<p class='report-empty'>No rows returned for this report.</p>";

  const cols = Array.from(rows.reduce((s, r) => {
    Object.keys(r || {}).forEach((k) => s.add(k));
    return s;
  }, new Set()));

  const header = cols.map((c) => `<th>${formatColumnLabel(c)}</th>`).join("");
  const body = rows
    .map((r) => `<tr>${cols.map((c) => `<td>${formatCell(r[c])}</td>`).join("")}</tr>`)
    .join("");

  return `<div class="report-table-wrap"><table class="output-table report-table"><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table></div>`;
}

function renderReportContent(payload, isError = false) {
  const message = payload?.message || (isError ? "Request failed" : "Request completed");
  const data = payload?.data;

  let content = `<div class="report-summary-row"><div class="output-message ${isError ? "error" : ""}">${message}</div>`;
  if (Array.isArray(data)) {
    content += `<span class="report-count-badge">${data.length} rows</span>`;
  }
  content += "</div>";

  if (Array.isArray(data)) {
    content += createReportTable(data);
  } else if (data && typeof data === "object") {
    content += createCard(data);
  } else if (typeof data !== "undefined") {
    content += `<p>${formatCell(data)}</p>`;
  }

  if (payload?.error && typeof payload.error === "string") {
    content += `<pre style="font-size:0.78rem">${payload.error}</pre>`;
  }

  return content;
}

function createCard(data) {
  if (!data || typeof data !== "object") return `<p>${formatCell(data)}</p>`;
  const content = Object.entries(data).map(([k, v]) => `<p style="margin:0.3rem 0"><strong>${k}:</strong> ${formatCell(v)}</p>`).join("");
  return `<div class="output-card">${content}</div>`;
}

function isReportsTabActive() {
  return document.getElementById("mgrTab-reports")?.classList.contains("active");
}

function focusReportOutput() {
  const outputEl = document.getElementById("reportOutput");
  if (!outputEl) return;
  outputEl.scrollIntoView({ behavior: "smooth", block: "start" });
}

// Writes output to the active output element(s)
function renderOutput(payload, isError = false) {
  const message = payload?.message || (isError ? "Request failed" : "Request completed");
  const data = payload?.data;

  let content = `<div class="output-message ${isError ? "error" : ""}">${message}</div>`;

  if (Array.isArray(data)) {
    content += createTable(data);
  } else if (data && typeof data === "object") {
    if (Array.isArray(data.alternatives)) {
      content += createCard({ alternatives_count: data.alternatives.length });
      content += createTable(data.alternatives);
    } else {
      content += createCard(data);
    }
  } else if (typeof data !== "undefined") {
    content += `<p>${formatCell(data)}</p>`;
  }

  if (payload?.error && typeof payload.error === "string") {
    content += `<pre style="font-size:0.78rem">${payload.error}</pre>`;
  }

  // Determine which output elements to write to based on current visible section
  const onLanding  = document.getElementById("landingSection")?.classList.contains("visible");
  const onManager  = document.getElementById("managerDashboardSection")?.classList.contains("visible");
  const onClient   = document.getElementById("clientDashboardSection")?.classList.contains("visible");

  if (onLanding) {
    const el = document.getElementById("authOutput");
    if (el) el.innerHTML = content;
  } else if (onManager) {
    if (isReportsTabActive()) {
      const el = document.getElementById("reportOutput");
      if (el) el.innerHTML = renderReportContent(payload, isError);
    } else {
      const mgrOut = document.getElementById("mgrOutput");
      if (mgrOut) mgrOut.innerHTML = content;
    }
  } else if (onClient) {
    ["cliOutput", "searchOutput", "bookOutput", "bookingsOutput", "reviewOutput", "profileOutput"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = content;
    });
  }
}

async function apiRequest(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });

  let payload;
  try { payload = await response.json(); }
  catch (e) { payload = { success: false, message: "Invalid JSON response", error: e.message }; }

  if (!response.ok) { renderOutput(payload, true);  return payload; }
  renderOutput(payload, false);
  return payload;
}

function ensureManagerSession() {
  const ssn = getManagerSSN();
  if (!ssn) { renderOutput({ message: "Manager login required" }, true); return ""; }
  return ssn;
}

function ensureClientSession() {
  const id = getClientId();
  if (!id) { renderOutput({ message: "Client login required" }, true); return ""; }
  return id;
}

/* ============================================================
   AUTH ACTIONS
   ============================================================ */
async function registerManager(event) {
  event.preventDefault();
  await apiRequest("/api/managers/register", {
    method: "POST",
    body: JSON.stringify({
      name:  getValue("managerRegisterName"),
      ssn:   getValue("managerRegisterSSN"),
      email: getValue("managerRegisterEmail"),
    }),
  });
}

async function loginManager(event) {
  event.preventDefault();
  const payload = await apiRequest("/api/managers/login", {
    method: "POST",
    body: JSON.stringify({ ssn: getValue("managerLoginSSN") }),
  });
  if (!payload.success || !payload.data) return;

  localStorage.setItem("managerSSN",  payload.data.ssn);
  localStorage.setItem("managerName", payload.data.name || "Manager");
  showSection("managerDashboardSection");
  initManagerDashboard();
  loadDashboardOverview();
}

async function registerClient(event) {
  event.preventDefault();
  await apiRequest("/api/clients/register", {
    method: "POST",
    body: JSON.stringify({
      name:                getValue("clientRegisterName"),
      email:               getValue("clientRegisterEmail"),
      cardNumber:          getValue("clientCardNumber"),
      addressStreetName:   getValue("clientAddressStreetName"),
      addressStreetNumber: getValue("clientAddressStreetNumber"),
      addressCity:         getValue("clientAddressCity"),
      billingStreetName:   getValue("billingStreetName"),
      billingStreetNumber: getValue("billingStreetNumber"),
      billingCity:         getValue("billingCity"),
    }),
  });
}

async function loginClient(event) {
  event.preventDefault();
  const payload = await apiRequest("/api/clients/login", {
    method: "POST",
    body: JSON.stringify({ email: getValue("clientLoginEmail") }),
  });
  if (!payload.success || !payload.data) return;

  localStorage.setItem("clientId",   payload.data.clientId);
  localStorage.setItem("clientName", payload.data.name || payload.data.clientId || "Guest");
  showSection("clientDashboardSection");
  initClientDashboard();
  loadClientOverview();
}

function logoutManager() {
  localStorage.removeItem("managerSSN");
  localStorage.removeItem("managerName");
  showSection("landingSection");
  authShowMode("manager");
}

function logoutClient() {
  localStorage.removeItem("clientId");
  localStorage.removeItem("clientName");
  showSection("landingSection");
  authShowMode("client");
}

/* ============================================================
   MANAGER DASHBOARD
   ============================================================ */
let _chartRooms  = null;
let _chartHotels = null;

function initManagerDashboard() {
  const nameEl = document.getElementById("mgrName");
  if (nameEl) nameEl.textContent = getManagerName();

  const dateEl = document.getElementById("mgrDate");
  if (dateEl) dateEl.textContent = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  // Reset to overview tab
  mgrShowTab("overview");
}

function mgrShowTab(tabName) {
  document.querySelectorAll(".mgr-nav-btn").forEach((btn) => btn.classList.remove("active"));
  const clicked = [...document.querySelectorAll(".mgr-nav-btn")].find(
    (b) => b.getAttribute("onclick") === `mgrShowTab('${tabName}')`
  );
  if (clicked) clicked.classList.add("active");

  document.querySelectorAll("#managerDashboardSection .mgr-tab").forEach((t) => t.classList.remove("active"));
  const target = document.getElementById(`mgrTab-${tabName}`);
  if (target) target.classList.add("active");

  if (tabName === "my-hotels") {
    loadMyHotelsView();
  }
}

function createMyHotelsMarkup(hotels) {
  if (!hotels.length) {
    return "<p class='mgr-empty-state'>No hotels are currently assigned to your manager account.</p>";
  }

  return hotels.map((hotel) => {
    const hotelRooms = Array.isArray(hotel.rooms) ? hotel.rooms : [];

    const roomsMarkup = hotelRooms.length
      ? `<div class="mgr-room-grid">${hotelRooms.map((room) => `
          <article class="mgr-room-item">
            <h4>Room ${room.room_number ?? "-"}</h4>
            <p><strong>Status:</strong> <span class="booking-pill ${room.booking_status === "available" ? "available" : "booked"}">${room.booking_status ?? "available"}</span></p>
            <p><strong>Booked By:</strong> ${room.booked_by ?? "-"}</p>
            <p><strong>Booking Dates:</strong> ${room.booking_start_date ? `${room.booking_start_date} to ${room.booking_end_date}` : "-"}</p>
            <p><strong>Windows:</strong> ${room.num_windows ?? "-"}</p>
            <p><strong>Renovated:</strong> ${room.year_of_last_renovation ?? "-"}</p>
            <p><strong>Access:</strong> ${room.acces_type ?? "-"}</p>
            <p><strong>Nightly Price:</strong> $${room.price_per_night ?? "-"}</p>
          </article>
        `).join("")}</div>`
      : "<p class='mgr-empty-state'>No rooms added for this hotel yet.</p>";

    return `
      <section class="mgr-hotel-card">
        <div class="mgr-hotel-card-head">
          <h3>${hotel.name ?? `Hotel ${hotel.hotel_id}`}</h3>
          <span class="mgr-hotel-chip">Hotel ID: ${hotel.hotel_id}</span>
        </div>
        <p class="mgr-hotel-address">${hotel.street_number ?? ""} ${hotel.street_name ?? ""}, ${hotel.city ?? ""}</p>
        ${roomsMarkup}
      </section>
    `;
  }).join("");
}

async function loadMyHotelsView() {
  const managerSSN = ensureManagerSession();
  if (!managerSSN) return;

  const listEl = document.getElementById("mgrMyHotelsList");
  if (!listEl) return;

  listEl.innerHTML = "<p class='mgr-empty-state'>Loading your hotels...</p>";

  try {
    const response = await fetch(`/api/managers/${encodeURIComponent(managerSSN)}/hotels-with-rooms`);
    const payload = await response.json();

    if (!response.ok || !payload?.success) {
      throw new Error(payload?.message || "Request failed");
    }

    const hotels = Array.isArray(payload?.data) ? payload.data : [];
    listEl.innerHTML = createMyHotelsMarkup(hotels);
  } catch (error) {
    listEl.innerHTML = "<p class='mgr-empty-state'>Failed to load your hotels right now.</p>";
    renderOutput({ message: "Failed to load My Hotels", error: error.message }, true);
  }
}

async function loadDashboardOverview() {
  if (!ensureManagerSession()) return;

  const [statsPayload, roomPayload, topPayload, spendPayload] = await Promise.all([
    fetch("/api/reports/hotel-stats").then((r) => r.json()).catch(() => null),
    fetch("/api/reports/room-bookings").then((r) => r.json()).catch(() => null),
    fetch("/api/reports/top-clients?k=5").then((r) => r.json()).catch(() => null),
    fetch("/api/reports/client-spending").then((r) => r.json()).catch(() => null),
  ]);

  const stats       = Array.isArray(statsPayload?.data) ? statsPayload.data : [];
  const topClients  = Array.isArray(topPayload?.data)   ? topPayload.data   : [];
  const spendRows   = Array.isArray(spendPayload?.data) ? spendPayload.data : [];

  const totalHotels   = stats.length;
  const totalRooms    = stats.reduce((s, h) => s + (Number(h.total_rooms)    || 0), 0);
  const totalBookings = stats.reduce((s, h) => s + (Number(h.total_bookings) || 0), 0);
  const topCount      = topClients.length > 0 ? (topClients[0].booking_count ?? topClients[0].bookings ?? "—") : "—";

  document.getElementById("statHotels").textContent    = totalHotels   || "—";
  document.getElementById("statRooms").textContent     = totalRooms    || "—";
  document.getElementById("statBookings").textContent  = totalBookings || "—";
  document.getElementById("statTopClient").textContent = topCount;

  // Room bookings chart
  const roomRows   = Array.isArray(roomPayload?.data) ? roomPayload.data.slice(0, 12) : [];
  const roomLabels = roomRows.map((r) => `H${r.hotel_id ?? ""}R${r.room_number ?? ""}`);
  const roomValues = roomRows.map((r) => Number(r.booking_count ?? r.bookings ?? 0));

  const ctxRoom = document.getElementById("chartRoomBookings");
  if (ctxRoom) {
    if (_chartRooms) _chartRooms.destroy();
    _chartRooms = new Chart(ctxRoom, {
      type: "bar",
      data: {
        labels: roomLabels,
        datasets: [{ label: "Bookings", data: roomValues, backgroundColor: "rgba(108,92,231,0.75)", borderRadius: 6 }],
      },
      options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } },
    });
  }

  // Hotel stats chart
  const hotelLabels   = stats.map((h) => h.hotel_name ?? `Hotel ${h.hotel_id}`);
  const hotelBookings = stats.map((h) => Number(h.total_bookings) || 0);
  const hotelRooms    = stats.map((h) => Number(h.total_rooms)    || 0);

  const ctxHotel = document.getElementById("chartHotelStats");
  if (ctxHotel) {
    if (_chartHotels) _chartHotels.destroy();
    _chartHotels = new Chart(ctxHotel, {
      type: "bar",
      data: {
        labels: hotelLabels,
        datasets: [
          { label: "Rooms",    data: hotelRooms,    backgroundColor: "rgba(5,150,105,0.75)",  borderRadius: 6 },
          { label: "Bookings", data: hotelBookings, backgroundColor: "rgba(217,119,6,0.75)", borderRadius: 6 },
        ],
      },
      options: { responsive: true, plugins: { legend: { position: "top" } }, scales: { y: { beginAtZero: true } } },
    });
  }

  const topEl = document.getElementById("mgrTopClientsTable");
  if (topEl) topEl.innerHTML = createTable(topClients.length ? topClients : [{ info: "No data yet" }]);

  const spendEl = document.getElementById("mgrSpendingTable");
  if (spendEl) spendEl.innerHTML = createTable(spendRows.length ? spendRows.slice(0, 8) : [{ info: "No data yet" }]);
}

/* MANAGER CRUD */
async function addHotel(event) {
  event.preventDefault();
  const managerSSN = ensureManagerSession();
  if (!managerSSN) return;
  await apiRequest("/api/hotels", {
    method: "POST",
    body: JSON.stringify({
      name:         getValue("addHotelName"),
      managerSsn:   getValue("addHotelManagerSSN") || managerSSN,
      streetName:   getValue("addHotelStreetName"),
      streetNumber: getValue("addHotelStreetNumber"),
      city:         getValue("addHotelCity"),
    }),
  });

  if (document.getElementById("mgrTab-my-hotels")?.classList.contains("active")) {
    loadMyHotelsView();
  }
}

async function updateHotel(event) {
  event.preventDefault();
  if (!ensureManagerSession()) return;
  await apiRequest(`/api/hotels/${getValue("updateHotelId")}`, {
    method: "PUT",
    body: JSON.stringify({
      name:         getValue("updateHotelName")      || undefined,
      managerSsn:   getValue("updateHotelManagerSSN") || undefined,
      streetName:   getValue("updateHotelStreetName") || undefined,
      streetNumber: getValue("updateHotelStreetNumber") || undefined,
      city:         getValue("updateHotelCity")      || undefined,
    }),
  });

  if (document.getElementById("mgrTab-my-hotels")?.classList.contains("active")) {
    loadMyHotelsView();
  }
}

async function deleteHotel(event) {
  event.preventDefault();
  if (!ensureManagerSession()) return;
  await apiRequest(`/api/hotels/${getValue("deleteHotelId")}`, { method: "DELETE" });

  if (document.getElementById("mgrTab-my-hotels")?.classList.contains("active")) {
    loadMyHotelsView();
  }
}

async function addRoom(event) {
  event.preventDefault();
  if (!ensureManagerSession()) return;
  await apiRequest("/api/rooms", {
    method: "POST",
    body: JSON.stringify({
      hotelId:              Number(getValue("addRoomHotelId")),
      roomNumber:           Number(getValue("addRoomNumber")),
      numWindows:           getValue("addRoomWindows")     ? Number(getValue("addRoomWindows"))     : undefined,
      yearOfLastRenovation: getValue("addRoomRenovation")  ? Number(getValue("addRoomRenovation"))  : undefined,
      accesType:            getValue("addRoomAccessType")  || undefined,
      pricePerNight:        getValue("addRoomPricePerNight") ? Number(getValue("addRoomPricePerNight")) : undefined,
    }),
  });

  if (document.getElementById("mgrTab-my-hotels")?.classList.contains("active")) {
    loadMyHotelsView();
  }
}

async function updateRoom(event) {
  event.preventDefault();
  if (!ensureManagerSession()) return;
  await apiRequest(`/api/rooms/${getValue("updateRoomHotelId")}/${getValue("updateRoomNumber")}`, {
    method: "PUT",
    body: JSON.stringify({
      newRoomNumber:        getValue("updateRoomNewNumber")  ? Number(getValue("updateRoomNewNumber"))  : undefined,
      numWindows:           getValue("updateRoomWindows")    ? Number(getValue("updateRoomWindows"))    : undefined,
      yearOfLastRenovation: getValue("updateRoomRenovation") ? Number(getValue("updateRoomRenovation")) : undefined,
      accesType:            getValue("updateRoomAccessType") || undefined,
      pricePerNight:        getValue("updateRoomPricePerNight") ? Number(getValue("updateRoomPricePerNight")) : undefined,
    }),
  });

  if (document.getElementById("mgrTab-my-hotels")?.classList.contains("active")) {
    loadMyHotelsView();
  }
}

async function deleteRoom(event) {
  event.preventDefault();
  if (!ensureManagerSession()) return;
  await apiRequest(`/api/rooms/${getValue("deleteRoomHotelId")}/${getValue("deleteRoomNumber")}`, { method: "DELETE" });

  if (document.getElementById("mgrTab-my-hotels")?.classList.contains("active")) {
    loadMyHotelsView();
  }
}

async function deleteClient(event) {
  event.preventDefault();
  if (!ensureManagerSession()) return;
  await apiRequest(`/api/clients/${encodeURIComponent(getValue("deleteClientId"))}`, { method: "DELETE" });
}

/* REPORTS */
async function runTopClientsReport() {
  if (!ensureManagerSession()) return;
  await apiRequest(`/api/reports/top-clients?k=${encodeURIComponent(getValue("topClientsK") || "5")}`);
  focusReportOutput();
}
async function runRoomBookingsReport()  { if (!ensureManagerSession()) return; await apiRequest("/api/reports/room-bookings"); focusReportOutput(); }
async function runHotelStatsReport()    { if (!ensureManagerSession()) return; await apiRequest("/api/reports/hotel-stats"); focusReportOutput(); }
async function runProblemHotelsReport() { if (!ensureManagerSession()) return; await apiRequest("/api/reports/problem-hotels"); focusReportOutput(); }
async function runClientSpendingReport(){ if (!ensureManagerSession()) return; await apiRequest("/api/reports/client-spending"); focusReportOutput(); }

async function runClientsByCitiesReport() {
  if (!ensureManagerSession()) return;
  const c1 = getValue("clientsCity1");
  const c2 = getValue("clientsCity2");
  await apiRequest(`/api/reports/clients-by-cities?c1=${encodeURIComponent(c1)}&c2=${encodeURIComponent(c2)}`);
  focusReportOutput();
}

/* ============================================================
   CLIENT DASHBOARD
   ============================================================ */
function initClientDashboard() {
  const nameEl = document.getElementById("cliName");
  if (nameEl) nameEl.textContent = getClientName();

  const dateEl = document.getElementById("cliDate");
  if (dateEl) dateEl.textContent = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  cliShowTab("overview");
}

function cliShowTab(tabName) {
  document.querySelectorAll(".cli-nav-btn").forEach((btn) => btn.classList.remove("active"));
  const clicked = [...document.querySelectorAll(".cli-nav-btn")].find(
    (b) => b.getAttribute("onclick") === `cliShowTab('${tabName}')`
  );
  if (clicked) clicked.classList.add("active");

  document.querySelectorAll("#clientDashboardSection .mgr-tab").forEach((t) => t.classList.remove("active"));
  const target = document.getElementById(`cliTab-${tabName}`);
  if (target) target.classList.add("active");

  if (tabName === "review") loadMyReviews();
}

async function loadClientOverview() {
  const clientId = ensureClientSession();
  if (!clientId) return;

  // Fetch bookings and hotel stats in parallel
  const [bookingsPayload, hotelsPayload, spendPayload] = await Promise.all([
    fetch(`/api/clients/${encodeURIComponent(clientId)}/bookings`).then((r) => r.json()).catch(() => null),
    fetch("/api/reports/hotel-stats").then((r) => r.json()).catch(() => null),
    fetch("/api/reports/client-spending").then((r) => r.json()).catch(() => null),
  ]);

  const bookings   = Array.isArray(bookingsPayload?.data) ? bookingsPayload.data : [];
  const hotelStats = Array.isArray(hotelsPayload?.data)   ? hotelsPayload.data   : [];
  const spending   = Array.isArray(spendPayload?.data)    ? spendPayload.data    : [];

  document.getElementById("cliStatBookings").textContent = bookings.length || "0";
  document.getElementById("cliStatHotels").textContent   = hotelStats.length || "—";

  // Find this client's total spend
  const mySpend = spending.find((r) => String(r.client_id) === String(clientId) || String(r.email) === String(clientId));
  document.getElementById("cliStatSpent").textContent = mySpend
    ? `$${Number(mySpend.total_spending ?? mySpend.total_spent ?? mySpend.total ?? 0).toFixed(0)}`
    : "$0";

  document.getElementById("cliStatReviews").textContent = String(getClientReviewCount(clientId));

  // Preview table
  const previewEl = document.getElementById("cliBookingsPreview");
  if (previewEl) {
    previewEl.innerHTML = bookings.length
      ? createTable(bookings.slice(0, 5))
      : "<p style='color:#64618c;font-size:0.9rem'>No bookings yet.</p>";
  }
}

/* CLIENT ACTIONS */
async function searchAvailableRooms(event) {
  event.preventDefault();
  if (!ensureClientSession()) return;
  const params = new URLSearchParams({ start: getValue("searchStartDate"), end: getValue("searchEndDate") });
  const hotelIdRaw = getValue("searchHotelId");
  const maxPriceRaw = getValue("searchMaxPrice");
  const hotelId = Number(hotelIdRaw);
  const maxPrice = Number(maxPriceRaw);
  if (hotelIdRaw && Number.isInteger(hotelId) && hotelId > 0) {
    params.set("hotelId", String(hotelId));
  }
  if (maxPriceRaw && Number.isFinite(maxPrice) && maxPrice > 0) {
    params.set("maxPrice", String(maxPrice));
  }
  await apiRequest(`/api/rooms/available?${params.toString()}`);
}

async function bookRoom(event) {
  event.preventDefault();
  const clientId = ensureClientSession();
  if (!clientId) return;
  await apiRequest("/api/bookings", {
    method: "POST",
    body: JSON.stringify({
      clientId,
      hotelId:     Number(getValue("bookHotelId")),
      roomNumber:  Number(getValue("bookRoomNumber")),
      startDate:   getValue("bookStartDate"),
      endDate:     getValue("bookEndDate"),
    }),
  });
}

async function autoBookRoom(event) {
  event.preventDefault();
  const clientId = ensureClientSession();
  if (!clientId) return;
  await apiRequest("/api/bookings/auto", {
    method: "POST",
    body: JSON.stringify({
      clientId,
      hotelId:     Number(getValue("autoBookHotelId")),
      startDate:   getValue("autoBookStartDate"),
      endDate:     getValue("autoBookEndDate"),
    }),
  });
}

async function viewMyBookings() {
  const clientId = ensureClientSession();
  if (!clientId) return;
  const payload = await apiRequest(`/api/clients/${encodeURIComponent(clientId)}/bookings`);
  const outputEl = document.getElementById("bookingsOutput");
  const rows = Array.isArray(payload?.data) ? payload.data : [];

  if (!outputEl) return;
  if (!rows.length) {
    outputEl.innerHTML = "<p style='color:#64618c;font-size:0.9rem'>No bookings yet.</p>";
    return;
  }

  outputEl.innerHTML = rows.map((row) => `
    <article class="mgr-room-item" style="margin-bottom:0.75rem;">
      <h4>Booking #${row.booking_id}</h4>
      <p><strong>Hotel:</strong> ${row.hotel_name ?? row.hotel_id} | <strong>Room:</strong> ${row.room_number}</p>
      <p><strong>Dates:</strong> ${row.start_date} to ${row.end_date}</p>
      <p><strong>Booked By:</strong> ${row.client_email}</p>
      <button type="button" class="cli-action-btn" onclick="cancelBooking(${row.booking_id})">Cancel Booking</button>
    </article>
  `).join("");
}

async function cancelBooking(bookingId) {
  const clientId = ensureClientSession();
  if (!clientId) return;

  await apiRequest(`/api/bookings/${bookingId}`, {
    method: "DELETE",
    body: JSON.stringify({ clientId }),
  });

  viewMyBookings();
}

async function submitReview(event) {
  event.preventDefault();
  const clientId = ensureClientSession();
  if (!clientId) return;
  const payload = await apiRequest("/api/reviews", {
    method: "POST",
    body: JSON.stringify({
      clientId,
      hotelId: Number(getValue("reviewHotelId")),
      rating:  Number(getValue("reviewRating")),
      message: getValue("reviewMessage"),
    }),
  });

  if (payload?.success) {
    loadMyReviews();
    loadClientOverview();
  }
}

async function loadMyReviews() {
  const clientId = ensureClientSession();
  if (!clientId) return;

  const payload = await fetch(`/api/reviews?clientId=${encodeURIComponent(clientId)}`)
    .then((r) => r.json())
    .catch(() => null);

  const reviews = Array.isArray(payload?.data) ? payload.data : [];

  // Update stat badge with real DB count
  const statEl = document.getElementById("cliStatReviews");
  if (statEl) statEl.textContent = String(reviews.length);

  const countEl = document.getElementById("myReviewsCount");
  if (countEl) countEl.textContent = String(reviews.length);

  // Sync localStorage count
  const key = `clientReviewCount:${clientId}`;
  localStorage.setItem(key, String(reviews.length));

  const listEl = document.getElementById("myReviewsList");
  if (!listEl) return;

  if (reviews.length === 0) {
    listEl.innerHTML = "<p style='color:var(--mgr-muted);font-size:0.9rem'>You haven't left any reviews yet.</p>";
    return;
  }

  listEl.innerHTML = createTable(
    reviews.map((r) => ({
      "Review ID":  r.review_id,
      "Hotel":      r.hotel_name ? `${r.hotel_name} (#${r.hotel_id})` : `#${r.hotel_id}`,
      "Rating":     `${r.rating} / 5`,
      "Message":    r.message || "—",
    }))
  );
}

async function updateClientProfile() {
  const clientId = ensureClientSession();
  if (!clientId) return;
  await apiRequest(`/api/clients/${encodeURIComponent(clientId)}`, {
    method: "PUT",
    body: JSON.stringify({
      name:                getValue("updateClientName")          || undefined,
      cardNumber:          getValue("updateClientCardNumber")    || undefined,
      addressStreetName:   getValue("updateClientStreetName")    || undefined,
      addressStreetNumber: getValue("updateClientStreetNumber")  || undefined,
      addressCity:         getValue("updateClientCity")          || undefined,
      billingStreetName:   getValue("updateBillingStreetName")   || undefined,
      billingStreetNumber: getValue("updateBillingStreetNumber") || undefined,
      billingCity:         getValue("updateBillingCity")         || undefined,
    }),
  });
}

// Keep alias for HTML onsubmit
function updateClient(event) {
  if (event) event.preventDefault();
  return updateClientProfile();
}

/* ============================================================
   BOOT — decide starting section
   ============================================================ */
(function boot() {
  const managerSSN = getManagerSSN();
  const clientId   = getClientId();

  if (managerSSN) {
    showSection("managerDashboardSection");
    initManagerDashboard();
    loadDashboardOverview();
  } else if (clientId) {
    showSection("clientDashboardSection");
    initClientDashboard();
    loadClientOverview();
  } else {
    showSection("landingSection");
    authShowMode("manager");
  }
})();

/* ============================================================
   GLOBAL EXPORTS
   ============================================================ */
window.showSection           = showSection;
window.authShowMode          = authShowMode;
window.authSubTab            = authSubTab;
window.clearOutput           = clearOutput;
window.registerManager       = registerManager;
window.loginManager          = loginManager;
window.logoutManager         = logoutManager;
window.registerClient        = registerClient;
window.loginClient           = loginClient;
window.logoutClient          = logoutClient;
window.mgrShowTab            = mgrShowTab;
window.loadDashboardOverview = loadDashboardOverview;
window.loadMyHotelsView      = loadMyHotelsView;
window.addHotel              = addHotel;
window.updateHotel           = updateHotel;
window.deleteHotel           = deleteHotel;
window.addRoom               = addRoom;
window.updateRoom            = updateRoom;
window.deleteRoom            = deleteRoom;
window.deleteClient          = deleteClient;
window.runTopClientsReport       = runTopClientsReport;
window.runRoomBookingsReport     = runRoomBookingsReport;
window.runHotelStatsReport       = runHotelStatsReport;
window.runClientsByCitiesReport  = runClientsByCitiesReport;
window.runProblemHotelsReport    = runProblemHotelsReport;
window.runClientSpendingReport   = runClientSpendingReport;
window.cliShowTab            = cliShowTab;
window.loadClientOverview    = loadClientOverview;
window.searchAvailableRooms  = searchAvailableRooms;
window.bookRoom              = bookRoom;
window.autoBookRoom          = autoBookRoom;
window.viewMyBookings        = viewMyBookings;
window.cancelBooking         = cancelBooking;
window.submitReview          = submitReview;
window.loadMyReviews         = loadMyReviews;
window.updateClient          = updateClient;
window.updateClientProfile   = updateClientProfile;

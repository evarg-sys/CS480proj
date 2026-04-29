// =======================
// CLIENT FUNCTIONS
// =======================

function searchRooms() {
    const start = document.getElementById("start").value;
    const end = document.getElementById("end").value;
  
    fetch(`http://localhost:3000/rooms?start=${start}&end=${end}`)
      .then(res => res.json())
      .then(data => {
        const results = document.getElementById("results");
  
        if (!data || data.length === 0) {
          results.innerHTML = "<p>No rooms available</p>";
          return;
        }
  
        results.innerHTML = data.map(room => `
          <div class="card">
            <p>${room.hotel_name}</p>
            <p>Room ${room.room_number}</p>
            <button onclick="bookRoom(${room.room_id})">Book</button>
          </div>
        `).join("");
      })
      .catch(err => {
        console.error(err);
        alert("Error fetching rooms");
      });
}
  
function bookRoom(roomId) {
    fetch("http://localhost:3000/book", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({
        client_id: 1,
        room_id: roomId,
        start_date: "2026-05-01",
        end_date: "2026-05-05"
      })
    })
    .then(res => res.text())
    .then(msg => alert(msg))
    .catch(err => console.log(err));
}
  
  
  // =======================
  // NAVIGATION
  // =======================
  
function toggleMenu() {
    const menu = document.getElementById("dropdown");
    menu.classList.toggle("hidden");
}
  
  function goManager() {
    window.location.href = "manager.html";
  }
  
  function goClient() {
    window.location.href = "client.html";
  }
  
  
  // =======================
  // MANAGER AUTH (TEMP)
  // =======================
  
  function registerManager() {
    const name = document.getElementById("name").value;
    const ssn = document.getElementById("ssn").value.trim();
    const email = document.getElementById("email").value;
  
    fetch("http://localhost:3000/api/manager/registerManager", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ name, ssn, email })
    })
    .then(res => res.json())
    .then(data => {
      console.log("Registered:", data);
      alert("Manager registered successfully!");
      window.location.href = "managerDashboard.html";
    })
    .catch(err => {
      console.log(err);
      alert("Registration failed");
    });
  }
  
  function loginManager() {
    const ssn = document.getElementById("loginSsn").value.trim();
  
    fetch("http://localhost:3000/api/manager/loginManager", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ ssn })
    })
    .then(res => res.json())
    .then(data => {
      console.log("LOGIN RESPONSE:", data);
  
      if (data.manager) {
        alert("Login successful");
        window.location.href = "managerDashboard.html";
      } else {
        alert("Invalid SSN");
      }
    })
    .catch(err => {
      console.log("Error:", err);
      alert("Login failed");
    });
  }
  
  // =======================
  // MANAGER DASHBOARD ACTIONS
  // =======================
  
  function addHotel() {
    const name = document.getElementById("hotelName").value;
    const streetName = document.getElementById("streetName").value;
    const streetNumber = document.getElementById("streetNumber").value;
    const city = document.getElementById("hotelCity").value;
  
    fetch("http://localhost:3000/api/manager/addHotel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        streetName,
        streetNumber,
        city
      })
    })
    .then(res => res.json())
    .then(data => {
      console.log("Hotel added:", data);
      alert("Hotel added successfully");
    })
    .catch(err => console.log(err));
  }
  
  function addRoom() {
    const hotelId = document.getElementById("roomHotelId").value;
    const roomNumber = document.getElementById("roomNumber").value;
    const numWindows = document.getElementById("numWindows").value;
    const yearOfLastRenovation = document.getElementById("year").value;
    const accesType = document.getElementById("accessType").value;
  
    fetch("http://localhost:3000/api/manager/addRoom", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hotelId,
        roomNumber,
        numWindows,
        yearOfLastRenovation,
        accesType
      })
    })
    .then(res => res.json())
    .then(data => {
      console.log("Room added:", data);
      alert("Room added successfully");
    })
    .catch(err => console.log(err));
  }
  
  function deleteRoom() {
    const hotelId = document.getElementById("deleteHotelId").value;
    const roomNumber = document.getElementById("deleteRoomId").value;
  
    fetch(`http://localhost:3000/api/manager/deleteRoom/${hotelId}/${roomNumber}`, {
      method: "DELETE"
    })
    .then(res => res.json())
    .then(data => {
      console.log(data);
      alert("Room deleted");
    })
    .catch(err => console.log(err));
  }

  function updateHotel() {
  const hotelId = document.getElementById("updateHotelId").value;
  const name = document.getElementById("updateHotelName").value;

  fetch(`http://localhost:3000/api/manager/updateHotel/${hotelId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name })
  })
  .then(res => res.json())
  .then(data => {
    console.log(data);
    alert("Hotel updated");
  })
  .catch(err => console.log(err));
  }
    
  function deleteHotel() {
    const id = document.getElementById("deleteHotelId").value;

    fetch(`http://localhost:3000/api/manager/deleteHotel/${id}`, {
      method: "DELETE"
    })
    .then(res => res.json())
    .then(data => {
      console.log(data);
      alert("Hotel deleted");
    })
    .catch(err => console.log(err));
  }
    
  function updateRoom() {
    const hotelId = document.getElementById("updateHotelId").value;
    const roomNumber = document.getElementById("updateRoomId").value;
    const numWindows = document.getElementById("newWindows").value;

    fetch(`http://localhost:3000/api/manager/updateRoom/${hotelId}/${roomNumber}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        numWindows
      })
    })
    .then(res => res.json())
    .then(data => {
      console.log(data);
      alert("Room updated");
    })
    .catch(err => console.log(err));
  }



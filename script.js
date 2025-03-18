// Define API URL for all requests
const API_URL = "http://localhost:3000/api";

// Custom marker icon for welfare homes
// Update the homeIcon definition
const homeIcon = L.icon({
  iconUrl:
    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
  iconSize: [30, 45],
  iconAnchor: [15, 45],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

// Initialize the map
let map = L.map("welfare-map").setView([20.5937, 78.9629], 5); // Centered on India
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "© OpenStreetMap contributors",
  maxZoom: 18,
  minZoom: 2,
}).addTo(map);

// Nominatim geocoding service URL
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";

// Force map to refresh after loading
setTimeout(() => {
  map.invalidateSize();
}, 100);

// Create marker cluster group
let markers = L.markerClusterGroup();

// Fetch and display welfare homes
async function initializeMap() {
  try {
    const response = await fetch(`${API_URL}/homes`);
    const homes = await response.json();

    homes.forEach((home) => {
      // Validate coordinates before creating marker
      if (home.lat && home.lng && !isNaN(home.lat) && !isNaN(home.lng)) {
        const marker = L.marker([home.lat, home.lng], { icon: homeIcon });

        // Create a rich popup content
        const popupContent = `
          <div class="home-popup">
            <h3>${home.name || "Unnamed Home"}</h3>
            ${
              home.location
                ? `<p><i class="fas fa-map-marker-alt"></i> ${home.location}</p>`
                : ""
            }
            ${
              home.contact
                ? `<p><i class="fas fa-phone"></i> ${home.contact}</p>`
                : ""
            }
            ${
              home.description
                ? `<p><i class="fas fa-info-circle"></i> ${home.description}</p>`
                : ""
            }
            <a href="homes.html" class="popup-link">View 🏠</a>
          </div>
        `;

        marker.bindPopup(popupContent);
        markers.addLayer(marker);
      } else {
        console.warn(`Home "${home.name}" has invalid coordinates:`, {
          lat: home.lat,
          lng: home.lng,
        });
      }
    });

    map.addLayer(markers);

    // If we have valid markers, fit the map bounds
    if (markers.getLayers().length > 0) {
      const bounds = markers.getBounds();
      map.fitBounds(bounds, { padding: [50, 50] });
    } else {
      // If no valid markers, show a message on the map
      L.popup()
        .setLatLng(map.getCenter())
        .setContent("No welfare homes with valid locations found.")
        .openOn(map);
    }
  } catch (error) {
    console.error("Failed to load welfare homes:", error);
    // Show error message on the map
    L.popup()
      .setLatLng(map.getCenter())
      .setContent("Failed to load welfare homes. Please try again later.")
      .openOn(map);
  }
}

// Search location using Nominatim
async function searchLocation(query) {
  try {
    const params = new URLSearchParams({
      format: "json",
      q: query,
      limit: 1,
    });

    const response = await fetch(`${NOMINATIM_URL}?${params}`);
    const data = await response.json();

    if (data.length > 0) {
      const { lat, lon } = data[0];
      map.setView([lat, lon], 13);
    } else {
      alert("Location not found. Please try a different search term.");
    }
  } catch (error) {
    console.error("Error searching location:", error);
    alert("Error searching location. Please try again.");
  }
}

// Get current location
function getCurrentLocation(callback) {
  if ("geolocation" in navigator) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        callback(latitude, longitude);
      },
      (error) => {
        console.error("Error getting location:", error);
        alert(
          "Unable to get your location. Please check your browser settings."
        );
      }
    );
  } else {
    alert("Geolocation is not supported by your browser.");
  }
}

// Reverse geocode coordinates to address
async function reverseGeocode(lat, lon) {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`
    );
    const data = await response.json();
    return data.display_name;
  } catch (error) {
    console.error("Error reverse geocoding:", error);
    return null;
  }
}

// Event Listeners
document.getElementById("map-search-btn").addEventListener("click", () => {
  const searchQuery = document.getElementById("map-search").value.trim();
  if (searchQuery) {
    searchLocation(searchQuery);
  }
});

document.getElementById("map-search").addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    const searchQuery = e.target.value.trim();
    if (searchQuery) {
      searchLocation(searchQuery);
    }
  }
});

document.getElementById("nearby-btn").addEventListener("click", () => {
  getCurrentLocation((lat, lon) => {
    map.setView([lat, lon], 13);
  });
});

document.getElementById("auto-location-btn").addEventListener("click", () => {
  getCurrentLocation(async (lat, lon) => {
    const address = await reverseGeocode(lat, lon);
    if (address) {
      document.getElementById("location").value = address;
    }
  });
});

// Verify worker ID
async function verifyWorkerId(workerId) {
  try {
    const response = await fetch(`${API_URL}/social-workers/${workerId}`);
    return response.ok;
  } catch (error) {
    console.error("Error verifying worker ID:", error);
    return false;
  }
}

// Handle report form submission
document.getElementById("report-form").addEventListener("submit", async (e) => {
  e.preventDefault();

  const workerId = document.getElementById("workerId").value;

  // Verify worker ID first
  const isValidWorker = await verifyWorkerId(workerId);
  if (!isValidWorker) {
    alert("Invalid Social Worker ID. Please enter a valid ID.");
    return;
  }

  // Get form data
  const formData = new FormData();
  formData.append("workerId", document.getElementById("workerId").value);
  formData.append("personName", document.getElementById("personName").value);
  formData.append("age", document.getElementById("age").value);
  formData.append("location", document.getElementById("location").value);
  formData.append("description", document.getElementById("description").value);
  formData.append("image", document.getElementById("image").files[0]);

  try {
    const response = await fetch(`${API_URL}/reports`, {
      method: "POST",
      body: formData,
    });

    if (response.ok) {
      alert("Report submitted successfully!");
      e.target.reset();
    } else {
      throw new Error("Failed to submit report");
    }
  } catch (error) {
    alert("Error submitting report: " + error.message);
  }
});

// Mobile Navigation
const navToggle = document.querySelector(".nav-toggle");
const navMenu = document.querySelector(".nav-links");

navToggle.addEventListener("click", () => {
  navToggle.classList.toggle("active");
  navMenu.classList.toggle("active");
  document.body.classList.toggle("nav-open");
});

// Close mobile menu when clicking on a link
document.querySelectorAll(".nav-links a").forEach((link) => {
  link.addEventListener("click", () => {
    navToggle.classList.remove("active");
    navMenu.classList.remove("active");
    document.body.classList.remove("nav-open");
  });
});

// Initialize map when page loads
initializeMap();

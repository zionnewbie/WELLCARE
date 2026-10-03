class AddHome {
  constructor() {
    this.form = document.getElementById("addHomeForm");
    this.map = null;
    this.marker = null;
    this.fetchLocationBtn = document.getElementById("fetchLocationBtn");

    // Check admin authentication
    this.checkAuth();

    this.initializeMap();
    this.initializeEventListeners();
  }

  checkAuth() {
    const token = localStorage.getItem("adminToken");
    if (!token) {
      this.showMessage("Please login as admin to add homes", "error");
      setTimeout(() => {
        window.location.href = "admin.html";
      }, 2000);
      return;
    }
  }

  initializeMap() {
    // Initialize map with default center
    this.map = L.map("map").setView([13.0827, 80.2707], 12);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "© OpenStreetMap contributors",
    }).addTo(this.map);

    // Add click event to map
    this.map.on("click", (e) => {
      const { lat, lng } = e.latlng;
      this.updateMarker(lat, lng);
      this.updateCoordinateInputs(lat, lng);
    });
  }

  initializeEventListeners() {
    // Form submission
    this.form.addEventListener("submit", (e) => this.handleSubmit(e));

    // Update map when coordinates are manually entered
    document
      .getElementById("latitude")
      .addEventListener("change", () => this.updateMapFromInputs());
    document
      .getElementById("longitude")
      .addEventListener("change", () => this.updateMapFromInputs());

    // Add fetch location button handler
    this.fetchLocationBtn.addEventListener("click", () => this.fetchLocation());
  }

  updateMarker(lat, lng) {
    // Remove existing marker
    if (this.marker) {
      this.map.removeLayer(this.marker);
    }

    // Add new marker
    this.marker = L.marker([lat, lng]).addTo(this.map);
    this.map.setView([lat, lng], 15);
  }

  updateCoordinateInputs(lat, lng) {
    document.getElementById("latitude").value = lat.toFixed(6);
    document.getElementById("longitude").value = lng.toFixed(6);
  }

  updateMapFromInputs() {
    const lat = parseFloat(document.getElementById("latitude").value);
    const lng = parseFloat(document.getElementById("longitude").value);

    if (!isNaN(lat) && !isNaN(lng)) {
      this.updateMarker(lat, lng);
    }
  }

  async handleSubmit(e) {
    e.preventDefault();

    const formData = new FormData(this.form);
    const homeData = {
      name: formData.get("name"),
      location: formData.get("location"),
      lat: parseFloat(formData.get("latitude")),
      lng: parseFloat(formData.get("longitude")),
      description: formData.get("description"),
      contact: formData.get("contact"),
    };

    try {
      const response = await fetch("http://localhost:3000/api/homes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("adminToken")}`,
        },
        body: JSON.stringify(homeData),
      });

      if (!response.ok) {
        throw new Error("Failed to add home");
      }

      this.showMessage("Welfare home added successfully!", "success");
      setTimeout(() => {
        window.location.href = "homes.html";
      }, 2000);
    } catch (error) {
      console.error("Error adding home:", error);
      this.showMessage("Failed to add home. Please try again.", "error");
    }
  }

  async fetchLocation() {
    try {
      this.fetchLocationBtn.disabled = true;
      this.fetchLocationBtn.innerHTML =
        '<i class="fas fa-spinner fa-spin"></i> Fetching...';

      // Get current position using browser's geolocation API
      const position = await this.getCurrentPosition();
      const { latitude, longitude } = position.coords;

      // Update map and form with the coordinates
      this.updateMarker(latitude, longitude);
      this.updateCoordinateInputs(latitude, longitude);

      // Get address using reverse geocoding
      const address = await this.reverseGeocode(latitude, longitude);
      document.getElementById("location").value = address;

      this.showMessage("Location fetched successfully!", "success");
    } catch (error) {
      console.error("Error fetching location:", error);
      this.showMessage(error.message || "Failed to fetch location", "error");
    } finally {
      this.fetchLocationBtn.disabled = false;
      this.fetchLocationBtn.innerHTML =
        '<i class="fas fa-map-marker-alt"></i> Auto-fetch';
    }
  }

  getCurrentPosition() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation is not supported by your browser"));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        resolve,
        (error) => {
          let errorMessage = "Failed to get your location";
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = "Please allow location access to use this feature";
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = "Location information is unavailable";
              break;
            case error.TIMEOUT:
              errorMessage = "Location request timed out";
              break;
          }
          reject(new Error(errorMessage));
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        }
      );
    });
  }

  async reverseGeocode(latitude, longitude) {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`
      );

      if (!response.ok) {
        throw new Error("Failed to get address");
      }

      const data = await response.json();
      return data.display_name || "Address not found";
    } catch (error) {
      console.error("Reverse geocoding error:", error);
      throw new Error("Failed to get address from coordinates");
    }
  }

  showMessage(message, type) {
    const messageDiv = document.createElement("div");
    messageDiv.className = `message ${type}-message`;
    messageDiv.innerHTML = `
      <i class="fas ${
        type === "success" ? "fa-check-circle" : "fa-exclamation-circle"
      }"></i>
      <span>${message}</span>
    `;
    document.body.appendChild(messageDiv);
    setTimeout(() => messageDiv.remove(), 5000);
  }
}

// Initialize the add home functionality
const addHome = new AddHome();

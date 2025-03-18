class EditHome {
  constructor() {
    this.form = document.getElementById("editHomeForm");
    this.map = null;
    this.marker = null;
    this.homeId = new URLSearchParams(window.location.search).get("id");
    this.verifiedStatus = document.getElementById("verifiedStatus");
    this.verifiedCheckbox = document.getElementById("verified");

    // Check admin authentication
    this.checkAuth();

    if (!this.homeId) {
      this.showMessage("Invalid home ID", "error");
      setTimeout(() => {
        window.location.href = "admin-homes.html";
      }, 2000);
      return;
    }

    this.initializeMap();
    this.initializeEventListeners();
    this.loadHomeData();
  }

  checkAuth() {
    const token = localStorage.getItem("adminToken");
    if (!token) {
      this.showMessage("Please login as admin", "error");
      setTimeout(() => {
        window.location.href = "admin.html";
      }, 2000);
      return;
    }
  }

  initializeEventListeners() {
    this.form.addEventListener("submit", (e) => this.handleSubmit(e));

    // Update map when coordinates are manually entered
    document
      .getElementById("latitude")
      .addEventListener("change", () => this.updateMapFromInputs());
    document
      .getElementById("longitude")
      .addEventListener("change", () => this.updateMapFromInputs());

    // Add fetch location button handler
    document
      .getElementById("fetchLocationBtn")
      .addEventListener("click", () => this.fetchLocation());

    // Add verified checkbox handler
    this.verifiedCheckbox.addEventListener("change", () =>
      this.updateVerifiedStatus()
    );
  }

  initializeMap() {
    this.map = L.map("map").setView([20.5937, 78.9629], 5); // Center on India
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "© OpenStreetMap contributors",
    }).addTo(this.map);

    // Add click event to map
    this.map.on("click", async (e) => {
      const { lat, lng } = e.latlng;
      this.updateMarker(lat, lng);
      this.updateCoordinateInputs(lat, lng);

      // Show loading state in marker popup
      if (this.marker) {
        this.marker.bindPopup("Loading address...").openPopup();
      }

      try {
        // Get address using reverse geocoding
        const address = await this.reverseGeocode(lat, lng);
        document.getElementById("location").value = address;

        // Update popup with coordinates and address
        if (this.marker) {
          this.marker
            .bindPopup(
              `<b>Selected Location</b><br>` +
                `Lat: ${lat.toFixed(6)}<br>` +
                `Lng: ${lng.toFixed(6)}<br>` +
                `<small>${address}</small>`
            )
            .openPopup();
        }
      } catch (error) {
        console.error("Error getting address:", error);
        if (this.marker) {
          this.marker
            .bindPopup(
              `<b>Selected Location</b><br>` +
                `Lat: ${lat.toFixed(6)}<br>` +
                `Lng: ${lng.toFixed(6)}<br>` +
                `<small>Could not fetch address</small>`
            )
            .openPopup();
        }
      }
    });
  }

  async loadHomeData() {
    try {
      const response = await fetch(
        `http://localhost:3000/api/homes/${this.homeId}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("adminToken")}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to load home data");
      }

      const home = await response.json();
      this.populateForm(home);
      this.updateMarker(home.lat, home.lng);
      this.showMessage("Home data loaded successfully", "success");
    } catch (error) {
      console.error("Error loading home:", error);
      this.showMessage(error.message || "Failed to load home data", "error");
    }
  }

  populateForm(home) {
    document.getElementById("name").value = home.name || "";
    document.getElementById("location").value = home.location || "";
    document.getElementById("latitude").value = home.lat || "";
    document.getElementById("longitude").value = home.lng || "";
    document.getElementById("description").value = home.description || "";
    document.getElementById("contact").value = home.contact || "";
    this.verifiedCheckbox.checked = home.verified || false;
    document.getElementById("status").value = home.status || "active";

    // Update verified status display
    this.updateVerifiedStatus();
  }

  updateMarker(lat, lng) {
    // Remove existing marker
    if (this.marker) {
      this.map.removeLayer(this.marker);
    }

    // Add new marker
    this.marker = L.marker([lat, lng], {
      draggable: true, // Make marker draggable
    }).addTo(this.map);

    // Handle marker drag events
    this.marker.on("dragend", async (e) => {
      const position = e.target.getLatLng();
      this.updateCoordinateInputs(position.lat, position.lng);

      try {
        const address = await this.reverseGeocode(position.lat, position.lng);
        document.getElementById("location").value = address;

        this.marker
          .bindPopup(
            `<b>Selected Location</b><br>` +
              `Lat: ${position.lat.toFixed(6)}<br>` +
              `Lng: ${position.lng.toFixed(6)}<br>` +
              `<small>${address}</small>`
          )
          .openPopup();
      } catch (error) {
        console.error("Error getting address:", error);
      }
    });

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

  async fetchLocation() {
    try {
      const fetchBtn = document.getElementById("fetchLocationBtn");
      fetchBtn.disabled = true;
      fetchBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Fetching...';

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
      const fetchBtn = document.getElementById("fetchLocationBtn");
      fetchBtn.disabled = false;
      fetchBtn.innerHTML = '<i class="fas fa-map-marker-alt"></i> Auto-fetch';
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
      verified: this.verifiedCheckbox.checked,
      status: formData.get("status"),
    };

    try {
      const response = await fetch(
        `http://localhost:3000/api/homes/${this.homeId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("adminToken")}`,
          },
          body: JSON.stringify(homeData),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to update home");
      }

      this.showMessage("Welfare home updated successfully!", "success");

      // Store the updated data in localStorage to refresh dashboard stats
      localStorage.setItem("homeUpdated", "true");

      setTimeout(() => {
        window.location.href = "admin-homes.html";
      }, 2000);
    } catch (error) {
      console.error("Error updating home:", error);
      this.showMessage(error.message || "Failed to update home", "error");
    }
  }

  showMessage(message, type) {
    const messageDiv = document.createElement("div");
    messageDiv.className = `message ${type}-message`;
    messageDiv.innerHTML = `
      <i class="fas ${
        type === "success"
          ? "fa-check-circle"
          : type === "info"
          ? "fa-info-circle"
          : type === "warning"
          ? "fa-exclamation-triangle"
          : "fa-exclamation-circle"
      }"></i>
      <span>${message}</span>
    `;
    document.body.appendChild(messageDiv);
    setTimeout(() => messageDiv.remove(), 5000);
  }

  updateVerifiedStatus() {
    const isVerified = this.verifiedCheckbox.checked;
    this.verifiedStatus.className = `verified-status ${
      isVerified ? "is-verified" : "not-verified"
    }`;
    this.verifiedStatus.innerHTML = isVerified
      ? '<i class="fas fa-check-circle"></i><span>Verified</span>'
      : '<i class="fas fa-info-circle"></i><span>Not verified</span>';
  }
}

// Initialize the edit home functionality
const editHome = new EditHome();

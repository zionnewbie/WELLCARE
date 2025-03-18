class HomesDirectory {
  constructor() {
    this.searchInput = document.getElementById("searchInput");
    this.sortSelect = document.getElementById("sortSelect");
    this.homesGrid = document.getElementById("homesGrid");
    this.loadingIndicator = document.getElementById("loadingIndicator");
    this.map = null;
    this.markers = [];
    this.homes = [];
    this.isLoading = false;

    this.initializeEventListeners();
    this.initializeMap();
    this.loadHomes();
  }

  initializeEventListeners() {
    this.searchInput.addEventListener("input", () => this.filterHomes());
    this.sortSelect.addEventListener("change", () => this.filterHomes());

    // Add debounced search
    let searchTimeout;
    this.searchInput.addEventListener("input", () => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => this.filterHomes(), 300);
    });
  }

  initializeMap() {
    // Initialize OpenStreetMap with a default center (you can set your city's coordinates)
    this.map = L.map("map").setView([13.0827, 80.2707], 12); // Example: Chennai coordinates
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "© OpenStreetMap contributors",
    }).addTo(this.map);
  }

  async loadHomes() {
    if (this.isLoading) return;

    try {
      this.isLoading = true;
      this.showLoading(true);
      const response = await fetch("http://localhost:3000/api/homes");

      if (!response.ok) {
        throw new Error(`Failed to load homes: ${response.statusText}`);
      }

      this.homes = await response.json();

      if (this.homes && this.homes.length > 0) {
        this.filterHomes();
        this.updateMap();
        this.showSuccess("Homes loaded successfully");
      } else {
        this.showMessage("No welfare homes found in the directory", "info");
      }
    } catch (error) {
      console.error("Error loading homes:", error);
      this.showError("Failed to load homes directory. Please try again later.");
    } finally {
      this.isLoading = false;
      this.showLoading(false);
    }
  }

  updateMap() {
    // Clear existing markers
    this.markers.forEach((marker) => this.map.removeLayer(marker));
    this.markers = [];

    if (!this.homes || this.homes.length === 0) return;

    // Create bounds to fit all markers
    const bounds = L.latLngBounds();

    // Add markers for each home
    this.homes.forEach((home) => {
      try {
        const marker = L.marker([parseFloat(home.lat), parseFloat(home.lng)])
          .bindPopup(
            `
                        <div class="popup-content">
                            <h3>${home.name}</h3>
                            <p>${home.location}</p>
                        </div>
                    `
          )
          .addTo(this.map);

        this.markers.push(marker);
        bounds.extend([home.lat, home.lng]);
      } catch (error) {
        console.error(`Error adding marker for home: ${home.name}`, error);
      }
    });

    // Fit map to show all markers if there are any
    if (this.markers.length > 0) {
      this.map.fitBounds(bounds, { padding: [50, 50] });
    }
  }

  filterHomes() {
    const searchTerm = this.searchInput.value.toLowerCase();
    const sortBy = this.sortSelect.value;

    let filtered = this.homes.filter((home) => {
      // Check if home and its properties exist
      if (!home || !home.name) return false;
      return home.name.toLowerCase().includes(searchTerm);
    });

    filtered.sort((a, b) => {
      if (sortBy === "name") {
        return (a.name || "").localeCompare(b.name || "");
      } else {
        return (a.location || "").localeCompare(b.location || "");
      }
    });

    this.displayHomes(filtered);
  }

  createHomeCard(home) {
    const card = document.createElement("div");
    card.className = "home-card";
    card.innerHTML = `
            <div class="home-image">
                <i class="fas fa-building"></i>
            </div>
            <div class="home-content">
                <h2>${home.name || "Unnamed Home"}</h2>
                <p><i class="fas fa-map-marker-alt"></i> ${
                  home.location || "Location not specified"
                }</p>
                <div class="home-actions">
                    ${
                      home.lat && home.lng
                        ? `
                        <button class="view-map" onclick="homesDirectory.centerMapOn(${home.lat}, ${home.lng})">
                            <i class="fas fa-map"></i> View on Map
                        </button>
                        <button class="get-directions" onclick="homesDirectory.getDirections(${home.lat}, ${home.lng})">
                            <i class="fas fa-directions"></i> Get Directions
                        </button>
                    `
                        : `
                        <p class="no-location">Location coordinates not available</p>
                    `
                    }
                </div>
            </div>
        `;
    return card;
  }

  displayHomes(homes) {
    this.homesGrid.innerHTML = "";

    if (homes.length === 0) {
      this.homesGrid.innerHTML = '<div class="no-homes">No homes found</div>';
      return;
    }

    homes.forEach((home) => {
      const card = this.createHomeCard(home);
      this.homesGrid.appendChild(card);
    });
  }

  centerMapOn(lat, lng) {
    this.map.setView([lat, lng], 15);
  }

  getDirections(lat, lng) {
    window.open(
      `https://www.openstreetmap.org/directions?from=&to=${lat},${lng}`
    );
  }

  showLoading(show) {
    this.loadingIndicator.classList.toggle("hidden", !show);
  }

  showMessage(message, type = "error") {
    const messageDiv = document.createElement("div");
    messageDiv.className = `message ${type}-message`;
    messageDiv.innerHTML = `
      <i class="fas ${this.getMessageIcon(type)}"></i>
      <span>${message}</span>
    `;
    this.homesGrid.insertBefore(messageDiv, this.homesGrid.firstChild);
    setTimeout(() => messageDiv.remove(), 5000);
  }

  getMessageIcon(type) {
    switch (type) {
      case "success":
        return "fa-check-circle";
      case "info":
        return "fa-info-circle";
      case "error":
      default:
        return "fa-exclamation-circle";
    }
  }

  showError(message) {
    this.showMessage(message, "error");
  }

  showSuccess(message) {
    this.showMessage(message, "success");
  }
}

// Initialize the homes directory
const homesDirectory = new HomesDirectory();

// Mobile Navigation
const navToggle = document.querySelector(".nav-toggle");
const navMenu = document.querySelector("nav ul");

navToggle.addEventListener("click", () => {
  navToggle.classList.toggle("active");
  navMenu.classList.toggle("active");
  document.body.classList.toggle("nav-open");
});

// Close mobile menu when clicking outside
document.addEventListener("click", (e) => {
  if (!e.target.closest("nav") && navMenu.classList.contains("active")) {
    navToggle.classList.remove("active");
    navMenu.classList.remove("active");
    document.body.classList.remove("nav-open");
  }
});

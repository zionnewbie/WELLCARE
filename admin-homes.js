class AdminHomes {
  constructor() {
    this.searchInput = document.getElementById("searchHomes");
    this.sortSelect = document.getElementById("sortHomes");
    this.homesGrid = document.getElementById("homesGrid");
    this.homesTable = document
      .getElementById("homesTable")
      .querySelector("tbody");
    this.map = null;
    this.markerCluster = null;
    this.homes = [];
    this.currentView = "grid";

    // Check admin authentication
    this.checkAuth();

    this.initializeEventListeners();
    this.initializeMap();

    // Check if we need to refresh data due to recent update
    if (localStorage.getItem("homeUpdated")) {
      localStorage.removeItem("homeUpdated");
      this.loadHomes();
    } else {
      this.loadHomes();
    }
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
    // Search and sort
    this.searchInput.addEventListener("input", () => this.filterAndSortHomes());
    this.sortSelect.addEventListener("change", () => this.filterAndSortHomes());

    // View toggles
    document.querySelectorAll(".view-toggle").forEach((button) => {
      button.addEventListener("click", (e) => {
        const view = e.currentTarget.dataset.view;
        this.switchView(view);
      });
    });

    // Action buttons
    document
      .getElementById("refreshBtn")
      .addEventListener("click", () => this.loadHomes());
    document
      .getElementById("logoutBtn")
      .addEventListener("click", () => this.handleLogout());
    document
      .getElementById("exportBtn")
      .addEventListener("click", () => this.exportData());
    document
      .getElementById("bulkActionBtn")
      .addEventListener("click", () => this.showBulkActions());
  }

  switchView(view) {
    // Update active view
    this.currentView = view;

    // Update button states
    document.querySelectorAll(".view-toggle").forEach((button) => {
      button.classList.toggle("active", button.dataset.view === view);
    });

    // Update visible section
    document.querySelectorAll(".view-section").forEach((section) => {
      section.classList.toggle("active", section.id === `${view}View`);
    });

    // Refresh map if switching to map view
    if (view === "map") {
      setTimeout(() => {
        this.map.invalidateSize();
        if (this.markerCluster.getLayers().length > 0) {
          this.map.fitBounds(this.markerCluster.getBounds());
        }
      }, 100);
    }
  }

  initializeMap() {
    this.map = L.map("map").setView([20.5937, 78.9629], 5); // Center on India
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "© OpenStreetMap contributors",
    }).addTo(this.map);

    // Initialize marker cluster group
    this.markerCluster = L.markerClusterGroup();
    this.map.addLayer(this.markerCluster);
  }

  async loadHomes() {
    try {
      const response = await fetch("http://localhost:3000/api/homes", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("adminToken")}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("Failed to load homes");
      }

      this.homes = await response.json();

      if (!Array.isArray(this.homes)) {
        throw new Error("Invalid homes data received");
      }

      this.updateStats();
      this.filterAndSortHomes();
      this.updateMap();
      this.showMessage("Homes loaded successfully", "success");
    } catch (error) {
      console.error("Error loading homes:", error);
      this.showMessage(error.message || "Failed to load homes", "error");
    }
  }

  updateStats() {
    document.getElementById("totalHomes").textContent = this.homes.length;

    const cities = new Set(
      this.homes
        .filter((home) => home.location)
        .map((home) => {
          const location = home.location.split(",");
          return location[location.length - 1].trim();
        })
    );
    document.getElementById("citiesCovered").textContent = cities.size;

    const activeContacts = this.homes.filter((home) => home.contact).length;
    document.getElementById("activeContacts").textContent = activeContacts;

    const verifiedHomes = this.homes.filter((home) => home.verified).length;
    document.getElementById("verifiedHomes").textContent = verifiedHomes;
  }

  filterAndSortHomes() {
    const searchTerm = this.searchInput.value.toLowerCase();
    const sortBy = this.sortSelect.value;

    let filtered = this.homes.filter(
      (home) =>
        home.name?.toLowerCase().includes(searchTerm) ||
        home.location?.toLowerCase().includes(searchTerm)
    );

    // Sort homes
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "name":
          return (a.name || "").localeCompare(b.name || "");
        case "location":
          return (a.location || "").localeCompare(b.location || "");
        case "recent":
          return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
        default:
          return 0;
      }
    });

    this.displayHomes(filtered);
  }

  displayHomes(homes) {
    // Update grid view
    this.homesGrid.innerHTML =
      homes.length === 0
        ? '<div class="no-homes">No homes found</div>'
        : homes.map((home) => this.createHomeCard(home)).join("");

    // Update table view
    this.homesTable.innerHTML =
      homes.length === 0
        ? '<tr><td colspan="5" class="no-homes">No homes found</td></tr>'
        : homes.map((home) => this.createTableRow(home)).join("");
  }

  createHomeCard(home) {
    return `
      <div class="home-card ${home.verified ? "verified" : ""}">
        <div class="home-header">
          <h3>
            ${home.name || "Unnamed Home"}
            ${
              home.verified
                ? '<i class="fas fa-check-circle verified-icon" title="Verified"></i>'
                : ""
            }
          </h3>
          <div class="home-actions">
            <button onclick="adminHomes.editHome('${
              home._id
            }')" class="edit-btn" title="Edit">
              <i class="fas fa-edit"></i>
            </button>
            <button onclick="adminHomes.deleteHome('${
              home._id
            }')" class="delete-btn" title="Delete">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>
        <div class="home-content">
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
          <div class="coordinates">
            <small>Lat: ${home.lat || "N/A"}, Lng: ${home.lng || "N/A"}</small>
          </div>
        </div>
      </div>
    `;
  }

  createTableRow(home) {
    return `
      <tr>
        <td>
          ${home.name || "Unnamed Home"}
          ${
            home.verified
              ? '<i class="fas fa-check-circle verified-icon" title="Verified"></i>'
              : ""
          }
        </td>
        <td>${home.location || "N/A"}</td>
        <td>${home.contact || "N/A"}</td>
        <td>
          <span class="status-badge ${home.status?.toLowerCase() || "active"}">
            ${home.status || "Active"}
          </span>
        </td>
        <td>
          <div class="table-actions">
            <button onclick="adminHomes.editHome('${
              home._id
            }')" class="edit-btn" title="Edit">
              <i class="fas fa-edit"></i>
            </button>
            <button onclick="adminHomes.deleteHome('${
              home._id
            }')" class="delete-btn" title="Delete">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }

  updateMap() {
    this.markerCluster.clearLayers();

    if (!this.homes.length) {
      this.showMessage("No homes found", "info");
      return;
    }

    const bounds = L.latLngBounds();
    const homeIcon = L.icon({
      iconUrl:
        "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png",
      shadowUrl:
        "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41],
    });

    this.homes.forEach((home) => {
      if (home.lat && home.lng && !isNaN(home.lat) && !isNaN(home.lng)) {
        const marker = L.marker([home.lat, home.lng], { icon: homeIcon })
          .bindPopup(`
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
              <button onclick="adminHomes.editHome('${
                home._id
              }')" class="popup-btn">
                Edit Details
              </button>
            </div>
          `);

        this.markerCluster.addLayer(marker);
        bounds.extend([home.lat, home.lng]);
      }
    });

    if (this.markerCluster.getLayers().length > 0) {
      this.map.fitBounds(bounds, { padding: [50, 50] });
    } else {
      this.showMessage("No homes with valid coordinates found", "warning");
    }
  }

  async exportData() {
    try {
      const csv = this.convertToCSV(this.homes);
      const blob = new Blob([csv], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `welfare-homes-${
        new Date().toISOString().split("T")[0]
      }.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      this.showMessage("Data exported successfully", "success");
    } catch (error) {
      console.error("Export error:", error);
      this.showMessage("Failed to export data", "error");
    }
  }

  convertToCSV(data) {
    const headers = [
      "Name",
      "Location",
      "Contact",
      "Description",
      "Latitude",
      "Longitude",
      "Status",
      "Verified",
    ];
    const rows = data.map((home) => [
      home.name || "",
      home.location || "",
      home.contact || "",
      home.description || "",
      home.lat || "",
      home.lng || "",
      home.status || "Active",
      home.verified ? "Yes" : "No",
    ]);
    return [headers, ...rows].map((row) => row.join(",")).join("\n");
  }

  showBulkActions() {
    // Implement bulk actions menu
    this.showMessage("Bulk actions coming soon", "info");
  }

  async editHome(id) {
    if (!id) {
      this.showMessage("Invalid home ID", "error");
      return;
    }
    window.location.href = `edit-home.html?id=${id}`;
  }

  async deleteHome(id) {
    if (!id) {
      this.showMessage("Invalid home ID", "error");
      return;
    }

    if (!confirm("Are you sure you want to delete this home?")) return;

    try {
      const response = await fetch(`http://localhost:3000/api/homes/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("adminToken")}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("Failed to delete home");
      }

      this.showMessage("Home deleted successfully", "success");
      await this.loadHomes();
    } catch (error) {
      console.error("Error deleting home:", error);
      this.showMessage(error.message || "Failed to delete home", "error");
    }
  }

  handleLogout() {
    localStorage.removeItem("adminToken");
    window.location.href = "admin.html";
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
}

// Initialize the admin homes dashboard
const adminHomes = new AdminHomes();

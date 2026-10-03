// Constants and configurations
const API_BASE_URL = "http://localhost:3000/api";
const MAP_CONFIG = {
  minZoom: 2,
  maxZoom: 18,
  defaultView: [0, 0],
  defaultZoom: 2,
};

class SocialWorkerPortal {
  constructor() {
    this.checkAuthentication();
    this.state = {
      currentLocation: null,
      markers: [],
      markerClusterGroup: null,
      reportUpdateInterval: null,
      workerId: localStorage.getItem("socialWorkerId"),
      dashboardStats: {
        totalReports: 0,
        activeReports: 0,
        resolvedReports: 0,
        lastUpdate: null,
      },
      lastReportUpdate: null,
      realtimeUpdateInterval: null,
    };

    this.map = null;
    this.initializeElements();
    this.initializeMap();
    this.setupEventListeners();
    this.initializeGeolocation();
    this.startPeriodicUpdates();
  }

  initializeElements() {
    this.elements = {
      reportForm: document.getElementById("reportForm"),
      reportList: document.getElementById("reportList"),
      statusFilter: document.getElementById("statusFilter"),
      searchReports: document.getElementById("searchReports"),
      autoLocationBtn: document.getElementById("auto-location-btn"),
      foundLocation: document.getElementById("foundLocation"),
      activeReportsCount: document.getElementById("activeReports"),
      resolvedCasesCount: document.getElementById("resolvedCases"),
      mapSearch: document.getElementById("map-search"),
      nearbyBtn: document.getElementById("nearby-btn"),
      workerId: document.getElementById("workerId"),
      logoutBtn: document.querySelector(".logout-btn"),
    };

    if (this.state.workerId) {
      this.elements.workerId.value = this.state.workerId;
      this.elements.workerId.disabled = true;
    }
  }

  initializeMap() {
    this.map = L.map("map", {
      ...MAP_CONFIG,
      zoomControl: true,
    }).setView(MAP_CONFIG.defaultView, MAP_CONFIG.defaultZoom);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
      detectRetina: true,
    }).addTo(this.map);

    this.state.markerClusterGroup = L.markerClusterGroup({
      maxClusterRadius: 50,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: true,
      zoomToBoundsOnClick: true,
    });

    this.map.addLayer(this.state.markerClusterGroup);
  }

  setupEventListeners() {
    this.elements.reportForm.addEventListener(
      "submit",
      this.handleFormSubmit.bind(this)
    );
    this.elements.autoLocationBtn.addEventListener(
      "click",
      this.handleAutoLocation.bind(this)
    );
    this.elements.statusFilter.addEventListener(
      "change",
      this.filterReports.bind(this)
    );
    this.elements.searchReports.addEventListener(
      "input",
      this.debounce(this.filterReports.bind(this), 300)
    );
    this.elements.nearbyBtn.addEventListener(
      "click",
      this.showNearbyHomes.bind(this)
    );
    this.elements.mapSearch.addEventListener(
      "input",
      this.debounce(this.handleMapSearch.bind(this), 500)
    );
    this.elements.logoutBtn.addEventListener(
      "click",
      this.handleLogout.bind(this)
    );

    // Add real-time form validation
    this.elements.workerId.addEventListener(
      "input",
      this.validateWorkerId.bind(this)
    );
    document
      .getElementById("name")
      .addEventListener("input", this.validateName.bind(this));
    document
      .getElementById("age")
      .addEventListener("input", this.validateAge.bind(this));
    document
      .getElementById("description")
      .addEventListener("input", this.validateDescription.bind(this));
  }

  async initializeGeolocation() {
    if (!navigator.geolocation) {
      this.showNotification(
        "Geolocation is not supported by your browser",
        "error"
      );
      return;
    }

    try {
      const position = await this.getCurrentPosition();
      this.state.currentLocation = [
        position.coords.latitude,
        position.coords.longitude,
      ];
      this.map.setView(this.state.currentLocation, 13);

      const userMarker = L.marker(this.state.currentLocation, {
        icon: L.divIcon({
          className: "current-location-marker",
          html: '<div class="pulse"></div>',
        }),
      }).addTo(this.map);

      userMarker.bindPopup("Your current location").openPopup();
    } catch (error) {
      console.error("Geolocation error:", error);
      this.showNotification(
        "Could not get your location. Please try again or enter manually.",
        "error"
      );
    }
  }

  getCurrentPosition() {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0,
      });
    });
  }

  async handleAutoLocation() {
    try {
      const position = await this.getCurrentPosition();
      const { latitude, longitude } = position.coords;
      this.state.currentLocation = [latitude, longitude];

      const locationDetails = await this.reverseGeocode(latitude, longitude);
      this.elements.foundLocation.value =
        locationDetails.display_name || `${latitude}, ${longitude}`;

      this.map.setView([latitude, longitude], 15);
      L.marker([latitude, longitude])
        .addTo(this.map)
        .bindPopup("Current Location")
        .openPopup();

      this.showNotification("Location updated successfully", "success");
    } catch (error) {
      console.error("Location error:", error);
      this.showNotification(
        "Failed to get location. Please try again or enter manually.",
        "error"
      );
    }
  }

  async reverseGeocode(latitude, longitude) {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`
    );
    if (!response.ok) throw new Error("Failed to fetch location details");
    return response.json();
  }

  validateForm() {
    return (
      this.validateWorkerId() &&
      this.validateName() &&
      this.validateAge() &&
      this.validateLocation() &&
      this.validateDescription()
    );
  }

  validateWorkerId() {
    const workerId = this.elements.workerId.value;
    const isValid = /^[A-Za-z0-9]+$/.test(workerId);
    this.updateFieldValidation(
      this.elements.workerId,
      isValid,
      "Invalid Worker ID format"
    );
    return isValid;
  }

  validateName() {
    const nameInput = document.getElementById("name");
    const isValid = nameInput.value.trim().length >= 2;
    this.updateFieldValidation(
      nameInput,
      isValid,
      "Name must be at least 2 characters"
    );
    return isValid;
  }

  validateAge() {
    const ageInput = document.getElementById("age");
    const age = parseInt(ageInput.value);
    const isValid = !isNaN(age) && age >= 0 && age <= 120;
    this.updateFieldValidation(
      ageInput,
      isValid,
      "Age must be between 0 and 120"
    );
    return isValid;
  }

  validateLocation() {
    const locationInput = this.elements.foundLocation;
    const isValid = locationInput.value.trim().length > 0;
    this.updateFieldValidation(locationInput, isValid, "Location is required");
    return isValid;
  }

  validateDescription() {
    const descInput = document.getElementById("description");
    const isValid = descInput.value.trim().length >= 10;
    this.updateFieldValidation(
      descInput,
      isValid,
      "Description must be at least 10 characters"
    );
    return isValid;
  }

  updateFieldValidation(element, isValid, errorMessage) {
    element.classList.toggle("invalid", !isValid);
    element.classList.toggle("valid", isValid);

    let feedbackElement = element.nextElementSibling;
    if (
      !feedbackElement ||
      !feedbackElement.classList.contains("validation-feedback")
    ) {
      feedbackElement = document.createElement("div");
      feedbackElement.className = "validation-feedback";
      element.parentNode.insertBefore(feedbackElement, element.nextSibling);
    }

    feedbackElement.textContent = isValid ? "" : errorMessage;
    feedbackElement.className = `validation-feedback ${
      isValid ? "valid" : "invalid"
    }`;
  }

  checkAuthentication() {
    const token = localStorage.getItem("socialWorkerToken");
    const workerId = localStorage.getItem("socialWorkerId");
    if (!token || !workerId) {
      window.location.href = "social-worker-login.html";
    }
  }

  handleLogout() {
    localStorage.removeItem("socialWorkerToken");
    localStorage.removeItem("socialWorkerId");
    clearInterval(this.state.reportUpdateInterval);
    clearInterval(this.state.realtimeUpdateInterval);
    window.location.href = "social-worker-login.html";
  }

  async handleFormSubmit(event) {
    event.preventDefault();
    if (!this.validateForm()) return;

    const submitButton = event.target.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.innerHTML =
      '<i class="fas fa-spinner fa-spin"></i> Submitting...';

    try {
      const formData = new FormData(event.target);
      const response = await fetch(`${API_BASE_URL}/reports`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`);

      const result = await response.json();
      this.addReportToList(result);
      this.updateDashboardStats();
      event.target.reset();

      const coords = result.location
        .split(",")
        .map((coord) => parseFloat(coord.trim()));
      if (coords.length === 2 && !isNaN(coords[0]) && !isNaN(coords[1])) {
        this.addMarkerToMap(coords[0], coords[1], result.personName);
      }

      this.showNotification("Report submitted successfully!", "success");
    } catch (error) {
      console.error("Submission error:", error);
      this.showNotification(
        "Failed to submit report. Please try again.",
        "error"
      );
    } finally {
      submitButton.disabled = false;
      submitButton.innerHTML =
        '<i class="fas fa-paper-plane"></i> Submit Report';
    }
  }

  addMarkerToMap(lat, lng, title) {
    const marker = L.marker([lat, lng]);
    marker.bindPopup(`<b>${title}</b><br>Reported Location`);
    this.state.markerClusterGroup.addLayer(marker);
    this.state.markers.push(marker);
  }

  async updateDashboardStats() {
    try {
      const response = await fetch(`${API_BASE_URL}/stats`);
      if (!response.ok) throw new Error("Failed to fetch stats");

      const stats = await response.json();
      this.elements.activeReportsCount.textContent = stats.activeReports;
      this.elements.resolvedCasesCount.textContent = stats.resolvedCases;
      this.state.dashboardStats = { ...stats, lastUpdate: new Date() };
    } catch (error) {
      console.error("Stats update error:", error);
    }
  }

  startPeriodicUpdates() {
    this.updateDashboardStats();
    this.state.reportUpdateInterval = setInterval(() => {
      this.updateDashboardStats();
    }, 300000); // Update every 5 minutes

    // Add real-time report updates
    this.updateReports();
    this.state.realtimeUpdateInterval = setInterval(() => {
      this.updateReports();
    }, 30000); // Update reports every 30 seconds
  }

  filterReports() {
    // Trigger an immediate report update when filters change
    this.updateReports();
  }

  renderReportList(reports) {
    this.elements.reportList.innerHTML = "";
    reports.forEach((report) => {
      const reportElement = this.createReportElement(report);
      this.elements.reportList.appendChild(reportElement);
    });
  }

  createReportElement(report) {
    const li = document.createElement("li");
    li.className = `report-item ${report.status}`;
    li.innerHTML = `
            <div class="report-header">
                <h3>${report.personName}</h3>
                <span class="status-badge ${report.status}">${
      report.status
    }</span>
            </div>
            <div class="report-details">
                <p><i class="fas fa-map-marker-alt"></i> ${report.location}</p>
                <p><i class="fas fa-clock"></i> ${new Date(
                  report.timestamp
                ).toLocaleString()}</p>
            </div>
            <p class="report-description">${report.description}</p>
        `;
    return li;
  }

  async handleMapSearch() {
    const query = this.elements.mapSearch.value;
    if (!query.trim()) return;

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
          query
        )}&format=json&limit=1`
      );
      if (!response.ok) throw new Error("Search failed");

      const results = await response.json();
      if (results.length > 0) {
        const { lat, lon } = results[0];
        this.map.setView([lat, lon], 13);
      }
    } catch (error) {
      console.error("Search error:", error);
      this.showNotification("Location search failed", "error");
    }
  }

  async showNearbyHomes() {
    if (!this.state.currentLocation) {
      this.showNotification("Please enable location services first", "error");
      return;
    }

    try {
      const [lat, lng] = this.state.currentLocation;
      const response = await fetch(
        `${API_BASE_URL}/homes/nearby?lat=${lat}&lng=${lng}&radius=10`
      );
      if (!response.ok) throw new Error("Failed to fetch nearby homes");

      const homes = await response.json();
      this.displayNearbyHomes(homes);
      this.drawSearchRadius(lat, lng, 10);
    } catch (error) {
      console.error("Nearby homes error:", error);
      this.showNotification("Failed to fetch nearby homes", "error");
    }
  }

  displayNearbyHomes(homes) {
    this.state.markerClusterGroup.clearLayers();
    homes.forEach((home) => {
      const marker = L.marker([home.latitude, home.longitude], {
        icon: L.divIcon({
          className: "home-marker",
          html: '<i class="fas fa-home"></i>',
          iconSize: [30, 30],
        }),
      });
      marker.bindPopup(
        `
        <div class="home-popup">
          <h3>${home.name}</h3>
          <p><i class="fas fa-map-marker-alt"></i> ${home.address}</p>
          <p><i class="fas fa-users"></i> Capacity: ${home.capacity}</p>
          <p><i class="fas fa-phone"></i> <a href="tel:${home.phone}">${home.phone}</a></p>
          <button class="contact-home" onclick="window.location.href='mailto:${home.email}'">
            <i class="fas fa-envelope"></i> Contact Home
          </button>
        </div>
      `,
        { className: "home-popup" }
      );
      this.state.markerClusterGroup.addLayer(marker);
    });
  }

  showNotification(message, type = "info") {
    const notification = document.createElement("div");
    notification.className = `notification ${type}`;
    notification.textContent = message;

    document.body.appendChild(notification);
    setTimeout(() => {
      notification.classList.add("fade-out");
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func.apply(this, args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  drawSearchRadius(lat, lng, radius) {
    // Remove existing radius circle if any
    if (this.radiusCircle) {
      this.map.removeLayer(this.radiusCircle);
    }

    // Draw new radius circle
    this.radiusCircle = L.circle([lat, lng], {
      radius: radius * 1000, // Convert km to meters
      color: "#3388ff",
      fillColor: "#3388ff",
      fillOpacity: 0.1,
      weight: 1,
    }).addTo(this.map);

    // Fit map bounds to include the circle
    this.map.fitBounds(this.radiusCircle.getBounds());
  }

  async updateReports() {
    if (!this.state.workerId) return;

    try {
      const status = this.elements.statusFilter.value;
      const searchQuery = this.elements.searchReports.value.toLowerCase();

      const response = await fetch(
        `${API_BASE_URL}/reports/worker/${this.state.workerId}?status=${status}&search=${searchQuery}`
      );
      if (!response.ok) throw new Error("Failed to fetch reports");

      const reports = await response.json();
      const reportsHash = JSON.stringify({ reports, status, searchQuery });

      if (this.state.lastReportUpdate !== reportsHash) {
        this.state.lastReportUpdate = reportsHash;
        this.renderReportList(reports);
        this.updateMapMarkers(reports);
        this.updateDashboardStats();
      }
    } catch (error) {
      console.error("Report update error:", error);
      this.showNotification("Failed to update reports", "error");
    }
  }

  updateMapMarkers(reports) {
    // Clear existing report markers
    this.state.markers.forEach((marker) => this.map.removeLayer(marker));
    this.state.markers = [];

    // Add new markers for reports
    reports.forEach((report) => {
      if (report.location) {
        const [lat, lng] = report.location
          .split(",")
          .map((coord) => parseFloat(coord.trim()));
        if (!isNaN(lat) && !isNaN(lng)) {
          const marker = L.marker([lat, lng], {
            icon: L.divIcon({
              className: `report-marker ${report.status}`,
              html: '<i class="fas fa-user"></i>',
              iconSize: [25, 25],
            }),
          });
          marker.bindPopup(this.createReportPopup(report));
          marker.addTo(this.map);
          this.state.markers.push(marker);
        }
      }
    });
  }

  createReportPopup(report) {
    return `
      <div class="report-popup">
        <h3>${report.personName}</h3>
        <p class="status ${report.status}">${report.status}</p>
        <p><i class="fas fa-map-marker-alt"></i> ${report.location}</p>
        <p><i class="fas fa-clock"></i> ${new Date(
          report.timestamp
        ).toLocaleString()}</p>
        <p><i class="fas fa-file-alt"></i> ${report.description}</p>
        ${
          report.image
            ? `<img src="${report.image}" alt="Report image" class="report-image">`
            : ""
        }
      </div>
    `;
  }

  handleLogout() {
    // Clear intervals
    if (this.state.reportUpdateInterval) {
      clearInterval(this.state.reportUpdateInterval);
    }
    if (this.state.realtimeUpdateInterval) {
      clearInterval(this.state.realtimeUpdateInterval);
    }

    // Remove event listeners
    this.elements.reportForm.removeEventListener(
      "submit",
      this.handleFormSubmit.bind(this)
    );
    this.elements.autoLocationBtn.removeEventListener(
      "click",
      this.handleAutoLocation.bind(this)
    );
    this.elements.statusFilter.removeEventListener(
      "change",
      this.filterReports.bind(this)
    );
    this.elements.searchReports.removeEventListener(
      "input",
      this.debounce(this.filterReports.bind(this), 300)
    );
    this.elements.nearbyBtn.removeEventListener(
      "click",
      this.showNearbyHomes.bind(this)
    );
    this.elements.mapSearch.removeEventListener(
      "input",
      this.debounce(this.handleMapSearch.bind(this), 500)
    );
    this.elements.logoutBtn.removeEventListener(
      "click",
      this.handleLogout.bind(this)
    );

    // Clear map and markers
    if (this.map) {
      this.state.markers.forEach((marker) => this.map.removeLayer(marker));
      this.state.markerClusterGroup.clearLayers();
      this.map.remove();
    }

    // Clear all storage
    localStorage.removeItem("socialWorkerToken");
    localStorage.removeItem("socialWorkerId");
    sessionStorage.clear();

    // Reset state
    this.state = {
      currentLocation: null,
      markers: [],
      markerClusterGroup: null,
      reportUpdateInterval: null,
      workerId: null,
      dashboardStats: {
        totalReports: 0,
        activeReports: 0,
        resolvedReports: 0,
        lastUpdate: null,
      },
      lastReportUpdate: null,
      realtimeUpdateInterval: null,
    };

    // Show notification and redirect
    this.showNotification("Logged out successfully", "success");
    setTimeout(() => {
      window.location.href = "social-worker-login.html";
    }, 1000);
  }
}

// Initialize the application when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  new SocialWorkerPortal();
});

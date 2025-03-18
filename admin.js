const API_URL = "http://localhost:3000/api";

const ADMIN_CREDENTIALS = {
  username: "radio",
  password: "qwerty@123",
};

class AdminDashboard {
  constructor() {
    this.loginSection = document.getElementById("loginSection");
    this.dashboardSection = document.getElementById("dashboardSection");
    this.loginForm = document.getElementById("loginForm");
    this.logoutBtn = document.getElementById("logoutBtn");
    this.refreshBtn = document.getElementById("refreshBtn");
    this.searchInput = document.getElementById("searchReports");
    this.filterStatus = document.getElementById("filterStatus");
    this.reportsContainer = document.getElementById("reportsContainer");
    this.allReports = [];

    this.initializeEventListeners();
    this.checkAuth();
  }

  initializeEventListeners() {
    this.loginForm.addEventListener("submit", this.handleLogin.bind(this));
    this.logoutBtn.addEventListener("click", this.handleLogout.bind(this));
    this.refreshBtn.addEventListener("click", () => this.loadReports());
    this.searchInput.addEventListener("input", () => this.filterReports());
    this.filterStatus.addEventListener("change", () => this.filterReports());
  }

  checkAuth() {
    const token = localStorage.getItem("adminToken");
    if (token) {
      this.showDashboard();
      this.loadReports();
    }
  }

  async handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;

    // First check against hardcoded credentials
    if (
      username === ADMIN_CREDENTIALS.username &&
      password === ADMIN_CREDENTIALS.password
    ) {
      // Generate a simple token for hardcoded admin
      const token = btoa(`${username}:${new Date().getTime()}`);
      localStorage.setItem("adminToken", token);
      this.showDashboard();
      await this.loadReports();
      return;
    }

    // If hardcoded login fails, try database credentials
    try {
      const response = await fetch(`${API_URL}/admin/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      if (response.ok) {
        const data = await response.json();
        localStorage.setItem("adminToken", data.token);
        this.showDashboard();
        await this.loadReports();
      } else {
        const error = await response.json();
        this.showError(error.error || "Invalid credentials");
      }
    } catch (error) {
      console.error("Login error:", error);
      this.showError("Login failed. Please try again.");
    }
  }

  handleLogout() {
    localStorage.removeItem("adminToken");
    this.showLogin();
  }

  showDashboard() {
    this.loginSection.classList.add("hidden");
    this.dashboardSection.classList.remove("hidden");
    this.logoutBtn.classList.remove("hidden");
  }

  showLogin() {
    this.dashboardSection.classList.add("hidden");
    this.loginSection.classList.remove("hidden");
    this.logoutBtn.classList.add("hidden");
  }

  showError(message) {
    const errorDiv = document.createElement("div");
    errorDiv.className = "error-message";
    errorDiv.textContent = message;
    this.loginForm.insertBefore(errorDiv, this.loginForm.firstChild);
    setTimeout(() => errorDiv.remove(), 3000);
  }

  async loadReports() {
    try {
      const loadingIndicator = document.createElement("div");
      loadingIndicator.className = "loading";
      loadingIndicator.innerHTML =
        '<i class="fas fa-spinner fa-spin"></i> Loading reports...';
      this.reportsContainer.appendChild(loadingIndicator);

      const response = await fetch(`${API_URL}/reports`);
      if (!response.ok) throw new Error("Failed to load reports");

      this.allReports = await response.json();
      this.updateStats();
      this.filterReports();
    } catch (error) {
      console.error("Error loading reports:", error);
      this.showError("Failed to load reports");
    } finally {
      const loadingIndicator = this.reportsContainer.querySelector(".loading");
      if (loadingIndicator) loadingIndicator.remove();
    }
  }

  updateStats() {
    document.getElementById("totalReports").textContent =
      this.allReports.length;
    document.getElementById("pendingReports").textContent =
      this.allReports.filter((r) => r.status === "pending").length;
    document.getElementById("resolvedReports").textContent =
      this.allReports.filter((r) => r.status === "resolved").length;
  }

  filterReports() {
    let filtered = [...this.allReports];
    const searchTerm = this.searchInput.value.toLowerCase();
    const status = this.filterStatus.value;

    if (searchTerm) {
      filtered = filtered.filter(
        (report) =>
          report.personName?.toLowerCase().includes(searchTerm) ||
          report.location.toLowerCase().includes(searchTerm) ||
          report.workerId.toLowerCase().includes(searchTerm)
      );
    }

    if (status !== "all") {
      filtered = filtered.filter((report) => report.status === status);
    }

    filtered.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    this.displayReports(filtered);
  }

  displayReports(reports) {
    this.reportsContainer.innerHTML = "";

    if (reports.length === 0) {
      this.reportsContainer.innerHTML =
        '<div class="no-reports">No reports found</div>';
      return;
    }

    reports.forEach((report) => {
      const card = this.createReportCard(report);
      this.reportsContainer.appendChild(card);
    });
  }

  createReportCard(report) {
    const card = document.createElement("div");
    card.className = "report-card";
    card.innerHTML = `
            <div class="report-header">
                <h3>Case #${report.id}</h3>
                <span class="status ${report.status}">${report.status}</span>
            </div>
            <div class="report-content">
                <p><strong>Worker ID:</strong> ${report.workerId}</p>
                <p><strong>Name:</strong> ${report.personName || "Unknown"}</p>
                <p><strong>Location:</strong> ${report.location}</p>
                <p><strong>Description:</strong> ${report.description}</p>
                ${
                  report.imageUrl
                    ? `
                    <div class="report-image">
                        <img src="${report.imageUrl}" alt="Report image">
                    </div>
                `
                    : ""
                }
                <p class="report-timestamp">
                    <small>Reported: ${new Date(
                      report.timestamp
                    ).toLocaleString()}</small>
                </p>
            </div>
            <div class="report-actions">
                ${
                  report.status === "pending"
                    ? `
                    <button onclick="adminDashboard.handleCase(${report.id})" class="action-btn resolve-btn">
                        <i class="fas fa-check"></i> Resolve Case
                    </button>
                `
                    : `
                    <button disabled class="action-btn resolved">
                        <i class="fas fa-check-circle"></i> Resolved
                    </button>
                `
                }
                <button onclick="adminDashboard.deleteReport(${
                  report.id
                })" class="action-btn delete-btn">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </div>
        `;
    return card;
  }

  async handleCase(reportId) {
    try {
      // Validate reportId
      const id = parseInt(reportId);
      if (isNaN(id) || id <= 0) {
        throw new Error("Invalid report ID");
      }

      const token = localStorage.getItem("adminToken");
      if (!token) {
        this.showLogin();
        throw new Error("Not authenticated");
      }

      const response = await fetch(`${API_URL}/reports/${id}/resolve`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to resolve case");
      }

      await this.loadReports();
      // Show success message
      this.showSuccess("Case resolved successfully");
    } catch (error) {
      console.error("Error resolving case:", error);
      this.showError(error.message || "Failed to resolve case");
    }
  }
  async deleteReport(reportId) {
    if (!confirm("Are you sure you want to delete this report?")) return;

    try {
      const response = await fetch(`${API_URL}/reports/${reportId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("adminToken")}`,
        },
      });

      if (response.ok) {
        await this.loadReports();
      } else {
        throw new Error("Failed to delete report");
      }
    } catch (error) {
      console.error("Error deleting report:", error);
      this.showError("Failed to delete report");
    }
  }
}

// Initialize the dashboard
const adminDashboard = new AdminDashboard();

// Mobile Navigation
const navToggle = document.querySelector(".nav-toggle");
const navMenu = document.querySelector(".nav-links");

navToggle.addEventListener("click", () => {
  navToggle.classList.toggle("active");
  navMenu.classList.toggle("active");
  document.body.classList.toggle("nav-open");
});

// Close mobile menu when clicking on a link or button
document.querySelectorAll(".nav-links a, .nav-links button").forEach((item) => {
  item.addEventListener("click", () => {
    navToggle.classList.remove("active");
    navMenu.classList.remove("active");
    document.body.classList.remove("nav-open");
  });
});

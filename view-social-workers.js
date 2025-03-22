const API_URL = "http://localhost:3000/api";

class SocialWorkersView {
  constructor() {
    this.table = document.getElementById("socialWorkersTable");
    this.tableBody = document.getElementById("socialWorkersTableBody");
    this.searchInput = document.getElementById("searchInput");
    this.notification = document.getElementById("notification");

    this.checkAuth();
    this.setupEventListeners();
    this.loadSocialWorkers();
  }

  async checkAuth() {
    const token = localStorage.getItem("adminToken");
    if (!token) {
      this.showNotification(
        "Please login as admin to view social workers",
        "error"
      );
      await new Promise((resolve) => setTimeout(resolve, 2000));
      window.location.href = "admin.html";
    }
  }

  setupEventListeners() {
    this.searchInput.addEventListener("input", this.handleSearch.bind(this));
  }

  async loadSocialWorkers() {
    try {
      const token = localStorage.getItem("adminToken");
      if (!token) {
        this.showNotification("Please login again to continue", "error");
        await new Promise((resolve) => setTimeout(resolve, 1500));
        window.location.href = "admin.html";
        return;
      }

      const response = await fetch(`${API_URL}/social-workers`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (response.status === 401) {
        localStorage.removeItem("adminToken");
        this.showNotification("Session expired. Please login again", "error");
        await new Promise((resolve) => setTimeout(resolve, 1500));
        window.location.href = "admin.html";
        return;
      }

      if (!response.ok) {
        throw new Error("Failed to fetch social workers");
      }

      const socialWorkers = await response.json();
      this.renderSocialWorkers(socialWorkers);
    } catch (error) {
      console.error("Error loading social workers:", error);
      this.showNotification(
        "Failed to load social workers. Please try again",
        "error"
      );
      await new Promise((resolve) => setTimeout(resolve, 3000));
      this.loadSocialWorkers();
    }
  }

  renderSocialWorkers(socialWorkers) {
    this.tableBody.innerHTML = "";

    socialWorkers.forEach((worker) => {
      const row = document.createElement("tr");
      row.setAttribute("data-worker-id", worker.workerId);
      const lastActive = new Date(
        worker.lastActive || Date.now()
      ).toLocaleString();
      const status = worker.isActive ? "Active" : "Inactive";

      row.innerHTML = `
        <td>${this.escapeHtml(worker.workerId)}</td>
        <td>${this.escapeHtml(worker.name)}</td>
        <td>${this.escapeHtml(worker.email)}</td>
        <td>${lastActive}</td>
        <td>
          <button class="action-btn view-btn" data-id="${worker.workerId}">
            <i class="fas fa-eye"></i>
          </button>
          <button class="action-btn reset-btn" data-id="${worker.workerId}">
            <i class="fas fa-key"></i>
          </button>
          <button class="action-btn ${
            worker.isActive ? "deactivate" : "activate"
          }-btn" data-id="${worker.workerId}">
            <i class="fas fa-${
              worker.isActive ? "user-slash" : "user-check"
            }"></i>
          </button>
        </td>
      `;

      this.addRowEventListeners(row, worker);
      this.tableBody.appendChild(row);
    });
  }

  addRowEventListeners(row, worker) {
    const viewBtn = row.querySelector(".view-btn");
    const resetBtn = row.querySelector(".reset-btn");
    const toggleBtn = row.querySelector(".activate-btn, .deactivate-btn");

    viewBtn.addEventListener("click", () => this.viewSocialWorker(worker));
    resetBtn.addEventListener("click", () =>
      this.resetPassword(worker.workerId)
    );
    toggleBtn.addEventListener("click", () => this.toggleStatus(worker));
  }

  async viewSocialWorker(worker) {
    const details = `
      Worker ID: ${this.escapeHtml(worker.workerId)}
      Name: ${this.escapeHtml(worker.name)}
      Email: ${this.escapeHtml(worker.email)}
      Status: ${worker.isActive ? "Active" : "Inactive"}
      Last Active: ${new Date(worker.lastActive || Date.now()).toLocaleString()}
    `;
    alert(details);
  }

  async resetPassword(workerId) {
    if (
      !confirm("Are you sure you want to reset this social worker's password?")
    ) {
      return;
    }

    try {
      const response = await fetch(
        `${API_URL}/social-worker/${workerId}/reset-password`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("adminToken")}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to reset password");
      }

      const { temporaryPassword } = await response.json();
      alert(
        `Temporary password: ${temporaryPassword}\nPlease share this with the social worker securely.`
      );
    } catch (error) {
      console.error("Error resetting password:", error);
      this.showNotification("Failed to reset password", "error");
    }
  }

  async toggleStatus(worker) {
    const action = worker.isActive ? "deactivate" : "activate";
    if (
      !confirm(
        `Are you sure you want to ${action} this social worker's account?`
      )
    ) {
      return;
    }

    try {
      const response = await fetch(
        `${API_URL}/social-worker/${worker.workerId}/toggle-status`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("adminToken")}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to ${action} account`);
      }

      // Get the updated status from the server response
      const updatedWorker = await response.json();
      worker.isActive = updatedWorker.isActive;

      // Update the UI immediately
      const row = this.tableBody.querySelector(
        `tr[data-worker-id="${worker.workerId}"]`
      );
      if (row) {
        const statusCell = row.querySelector("td:nth-child(4)");
        const status = updatedWorker.isActive ? "Active" : "Inactive";
        statusCell.innerHTML = `<span class="status-badge ${status.toLowerCase()}">${status}</span>`;

        // Update the toggle button
        const toggleBtn = row.querySelector(".activate-btn, .deactivate-btn");
        toggleBtn.className = `action-btn ${
          updatedWorker.isActive ? "deactivate" : "activate"
        }-btn`;
        toggleBtn.innerHTML = `<i class="fas fa-${
          updatedWorker.isActive ? "user-slash" : "user-check"
        }"></i>`;
      }
      if (row) {
        const statusCell = row.querySelector("td:nth-child(4)");
        const status = worker.isActive ? "Active" : "Inactive";
        statusCell.innerHTML = `<span class="status-badge ${status.toLowerCase()}">${status}</span>`;

        // Update the toggle button
        const toggleBtn = row.querySelector(".activate-btn, .deactivate-btn");
        toggleBtn.className = `action-btn ${
          worker.isActive ? "deactivate" : "activate"
        }-btn`;
        toggleBtn.innerHTML = `<i class="fas fa-${
          worker.isActive ? "user-slash" : "user-check"
        }"></i>`;
      }

      this.showNotification(
        `Social worker account ${action}d successfully`,
        "success"
      );
    } catch (error) {
      console.error(`Error ${action}ing account:`, error);
      this.showNotification(`Failed to ${action} account`, "error");
      // Refresh the list to ensure consistency
      await this.loadSocialWorkers();
    }
  }

  handleSearch(event) {
    const searchTerm = event.target.value.toLowerCase();
    const rows = this.tableBody.getElementsByTagName("tr");

    Array.from(rows).forEach((row) => {
      const text = row.textContent.toLowerCase();
      row.style.display = text.includes(searchTerm) ? "" : "none";
    });
  }

  showNotification(message, type = "info") {
    this.notification.textContent = message;
    this.notification.className = `notification ${type}`;
    this.notification.style.display = "block";

    setTimeout(() => {
      this.notification.style.display = "none";
    }, 3000);
  }

  escapeHtml(unsafe) {
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  new SocialWorkersView();
});

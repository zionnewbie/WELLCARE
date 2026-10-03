const API_URL = "http://localhost:3000/api";

class AdminViewer {
  constructor() {
    this.refreshBtn = document.getElementById("refreshBtn");
    this.adminTableBody = document.getElementById("adminTableBody");
    this.editModal = document.getElementById("editAdminModal");
    this.editForm = document.getElementById("editAdminForm");
    this.closeModalBtn = document.querySelector(".close");
    this.cancelEditBtn = document.getElementById("cancelEdit");
    this.currentEditId = null;
    this.initializeEventListeners();
    this.loadAdmins();
  }

  initializeEventListeners() {
    this.refreshBtn.addEventListener("click", () => this.loadAdmins());
    this.closeModalBtn.addEventListener("click", () => this.closeModal());
    this.cancelEditBtn.addEventListener("click", () => this.closeModal());
    this.editForm.addEventListener("submit", (e) => this.handleEditSubmit(e));
    window.addEventListener("click", (e) => {
      if (e.target === this.editModal) this.closeModal();
    });
  }

  openModal(admin) {
    this.currentEditId = admin._id;
    document.getElementById("editUsername").value = admin.username;
    document.getElementById("editEmail").value = admin.email;
    document.getElementById("editPassword").value = "";
    this.editModal.style.display = "block";
  }

  closeModal() {
    this.editModal.style.display = "none";
    this.currentEditId = null;
    this.editForm.reset();
  }

  async handleEditSubmit(e) {
    e.preventDefault();
    const formData = new FormData(this.editForm);
    const data = {
      username: formData.get("username"),
      email: formData.get("email"),
    };
    if (formData.get("password")) {
      data.password = formData.get("password");
    }

    try {
      const response = await fetch(`${API_URL}/admins/${this.currentEditId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) throw new Error("Failed to update admin");
      this.closeModal();
      this.loadAdmins();
    } catch (error) {
      console.error("Error updating admin:", error);
      alert("Failed to update admin credentials");
    }
  }

  async deleteAdmin(adminId) {
    if (!confirm("Are you sure you want to delete this admin?")) return;

    try {
      const response = await fetch(`${API_URL}/admins/${adminId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) throw new Error("Failed to delete admin");
      this.loadAdmins();
    } catch (error) {
      console.error("Error deleting admin:", error);
      alert("Failed to delete admin");
    }
  }

  async loadAdmins() {
    try {
      // Show loading state
      this.adminTableBody.innerHTML = `
                <tr>
                    <td colspan="4" class="loading">
                        <i class="fas fa-spinner fa-spin"></i> Loading admin data...
                    </td>
                </tr>
            `;

      // Fetch admin data from the API
      const response = await fetch(`${API_URL}/admins`, {
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("Failed to load admin data");
      }

      const admins = await response.json();
      this.displayAdmins(admins);
    } catch (error) {
      console.error("Error loading admins:", error);
      this.adminTableBody.innerHTML = `
                <tr>
                    <td colspan="4" class="error-message">
                        <i class="fas fa-exclamation-circle"></i> 
                        Failed to load admin data. Please try again.
                    </td>
                </tr>
            `;
    }
  }

  displayAdmins(admins) {
    if (!admins || admins.length === 0) {
      this.adminTableBody.innerHTML = `
                <tr>
                    <td colspan="4" class="loading">
                        No admin credentials found.
                    </td>
                </tr>
            `;
      return;
    }

    this.adminTableBody.innerHTML = admins
      .map(
        (admin) => `
                <tr>
                    <td>${admin.username || "N/A"}</td>
                    <td>${admin.email || "N/A"}</td>
                    <td>${admin.source || "Database"}</td>
                    <td>${new Date(
                      admin.updatedAt || admin.createdAt
                    ).toLocaleString()}</td>
                    <td class="action-buttons">
                        <button class="btn primary-btn" onclick="adminViewer.openModal(${JSON.stringify(
                          admin
                        ).replace(/"/g, "'")})">
                            <i class="fas fa-edit"></i> Edit
                        </button>
                        <button class="btn danger-btn" onclick="adminViewer.deleteAdmin('${
                          admin._id
                        }')">
                            <i class="fas fa-trash-alt"></i> Delete
                        </button>
                    </td>
                </tr>
            `
      )
      .join("");
  }
}

// Initialize the admin viewer when the page loads
const adminViewer = new AdminViewer();

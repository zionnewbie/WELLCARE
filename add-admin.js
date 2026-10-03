class AddAdmin {
  constructor() {
    this.form = document.getElementById("addAdminForm");
    this.initializeEventListeners();
  }

  initializeEventListeners() {
    this.form.addEventListener("submit", (e) => this.handleSubmit(e));
    document
      .getElementById("password")
      .addEventListener("input", () => this.validatePassword());
    document
      .getElementById("confirmPassword")
      .addEventListener("input", () => this.validatePassword());
  }

  validatePassword() {
    const password = document.getElementById("password").value;
    const confirmPassword = document.getElementById("confirmPassword").value;
    const submitBtn = this.form.querySelector(".submit-btn");

    if (confirmPassword && password !== confirmPassword) {
      document
        .getElementById("confirmPassword")
        .setCustomValidity("Passwords do not match");
      submitBtn.disabled = true;
    } else {
      document.getElementById("confirmPassword").setCustomValidity("");
      submitBtn.disabled = false;
    }
  }

  async handleSubmit(e) {
    e.preventDefault();

    const formData = new FormData(this.form);
    const adminData = {
      username: formData.get("username"),
      email: formData.get("email"),
      password: formData.get("password"),
      token: localStorage.getItem("adminToken"),
    };

    try {
      const response = await fetch("http://localhost:3000/api/admin/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("adminToken")}`,
        },
        body: JSON.stringify(adminData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to register admin");
      }

      this.showMessage("Admin registered successfully!", "success");
      setTimeout(() => {
        window.location.href = "view-admins.html";
      }, 2000);
    } catch (error) {
      console.error("Error registering admin:", error);
      this.showMessage(error.message || "Failed to register admin", "error");
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

// Initialize the add admin functionality
const addAdmin = new AddAdmin();

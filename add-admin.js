const API_URL = "http://localhost:3000/api";

class AdminRegistration {
  constructor() {
    this.form = document.getElementById("addAdminForm");
    this.initializeEventListeners();
    this.checkAuth();
    this.isSubmitting = false;
  }

  initializeEventListeners() {
    this.form.addEventListener("submit", this.handleSubmit.bind(this));
  }

  async checkAuth() {
    const token = localStorage.getItem("adminToken");
    if (!token) {
      this.showMessage("Please login as admin to add new admins", "error");
      await new Promise(resolve => setTimeout(resolve, 2000));
      window.location.href = "admin.html";
    }
  }

  async handleSubmit(e) {
    e.preventDefault();
    if (this.isSubmitting || !this.validateForm()) return;

    const submitButton = this.form.querySelector('button[type="submit"]');
    this.toggleSubmitState(true, submitButton);

    try {
      await this.registerAdmin();
      this.handleSuccessfulRegistration();
    } catch (error) {
      this.handleRegistrationError(error);
    } finally {
      this.toggleSubmitState(false, submitButton);
    }
  }

  async registerAdmin() {
    const formData = this.getFormData();
    const response = await fetch(`${API_URL}/admin/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("adminToken")}`,
      },
      body: JSON.stringify(formData),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Failed to register admin");
    }
    return data;
  }

  getFormData() {
    return {
      username: document.getElementById("username").value.trim(),
      email: document.getElementById("email").value.trim(),
      password: document.getElementById("password").value
    };
  }

  toggleSubmitState(isSubmitting, button) {
    this.isSubmitting = isSubmitting;
    button.disabled = isSubmitting;
  }

  async handleSuccessfulRegistration() {
    this.showMessage("Admin registered successfully", "success");
    this.form.reset();
    await new Promise(resolve => setTimeout(resolve, 2000));
    window.location.href = "view-admins.html";
  }

  handleRegistrationError(error) {
    console.error("Registration error:", error);
    this.showMessage(error.message || "Failed to register admin", "error");
  }

  validateForm() {
    const fields = this.getFormFields();
    
    if (this.hasEmptyFields(fields)) {
      this.showMessage("All fields are required", "error");
      return false;
    }

    if (!this.isValidUsername(fields.username)) {
      this.showMessage("Username can only contain letters and numbers", "error");
      return false;
    }

    if (!this.isValidEmail(fields.email)) {
      this.showMessage("Please enter a valid email address", "error");
      return false;
    }

    if (!this.isValidPassword(fields.password)) {
      this.showMessage("Password must be at least 6 characters long", "error");
      return false;
    }

    if (!this.doPasswordsMatch(fields.password, fields.confirmPassword)) {
      this.showMessage("Passwords do not match", "error");
      return false;
    }

    return true;
  }

  getFormFields() {
    return {
      username: document.getElementById("username").value,
      email: document.getElementById("email").value,
      password: document.getElementById("password").value,
      confirmPassword: document.getElementById("confirmPassword").value
    };
  }

  hasEmptyFields(fields) {
    return Object.values(fields).some(value => !value);
  }

  isValidUsername(username) {
    return /^[A-Za-z0-9]+$/.test(username);
  }

  isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  isValidPassword(password) {
    return password.length >= 6;
  }

  doPasswordsMatch(password, confirmPassword) {
    return password === confirmPassword;
  }

  showMessage(message, type) {
    const notification = document.createElement("div");
    notification.className = `notification ${type}`;
    notification.textContent = message;

    document.body.appendChild(notification);
    setTimeout(() => {
      notification.classList.add("fade-out");
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  new AdminRegistration();
});

const API_URL = "http://localhost:3000/api";

// Function to check if user is already logged in
function checkLoggedIn() {
  const token = localStorage.getItem("socialWorkerToken");
  const workerId = localStorage.getItem("socialWorkerId");
  if (token && workerId) {
    window.location.href = "social-worker.html";
  }
}

class SocialWorkerLogin {
  constructor() {
    this.form = document.getElementById("loginForm");
    this.notification = document.getElementById("notification");
    this.isSubmitting = false;
    this.initializeEventListeners();
  }

  initializeEventListeners() {
    this.form.addEventListener("submit", this.handleSubmit.bind(this));
  }

  async handleSubmit(e) {
    e.preventDefault();
    if (this.isSubmitting || !this.validateForm()) return;

    const submitButton = this.form.querySelector('button[type="submit"]');
    this.toggleSubmitState(true, submitButton);

    try {
      await this.login();
      this.handleSuccessfulLogin();
    } catch (error) {
      this.handleLoginError(error);
    } finally {
      this.toggleSubmitState(false, submitButton);
    }
  }

  validateForm() {
    const fields = this.getFormFields();

    if (this.hasEmptyFields(fields)) {
      this.showNotification("Please fill in all fields", "error");
      return false;
    }

    if (!this.isValidWorkerId(fields.workerId)) {
      this.showNotification(
        "Worker ID can only contain letters and numbers",
        "error"
      );
      return false;
    }

    return true;
  }

  getFormFields() {
    return {
      workerId: document.getElementById("workerId").value.trim(),
      password: document.getElementById("password").value,
    };
  }

  hasEmptyFields(fields) {
    return Object.values(fields).some((value) => !value);
  }

  isValidWorkerId(workerId) {
    return /^[A-Za-z0-9]+$/.test(workerId);
  }

  async login() {
    const formData = this.getFormFields();
    const response = await fetch(`${API_URL}/social-worker/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(formData),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Invalid credentials");
    }
    return data;
  }

  async handleSuccessfulLogin() {
    const { token, workerId } = await this.login();
    localStorage.setItem("socialWorkerToken", token);
    localStorage.setItem("socialWorkerId", workerId);

    this.showNotification("Login successful! Redirecting...", "success");

    await new Promise((resolve) => setTimeout(resolve, 1500));
    window.location.href = "social-worker.html";
  }

  handleLoginError(error) {
    console.error("Login error:", error);
    this.showNotification(
      error.message || "Login failed. Please try again.",
      "error"
    );
  }

  toggleSubmitState(isSubmitting, button) {
    this.isSubmitting = isSubmitting;
    button.disabled = isSubmitting;
    button.innerHTML = isSubmitting
      ? '<i class="fas fa-spinner fa-spin"></i> Logging in...'
      : '<i class="fas fa-sign-in-alt"></i> Login';
  }

  showNotification(message, type = "info") {
    this.notification.textContent = message;
    this.notification.className = `notification ${type}`;
    this.notification.style.display = "block";

    setTimeout(() => {
      this.notification.style.display = "none";
    }, 3000);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  checkLoggedIn();
  new SocialWorkerLogin();
});

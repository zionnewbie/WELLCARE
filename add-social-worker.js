class AddSocialWorker {
  constructor() {
    // Ensure all elements exist before initializing
    const elements = [
      "addSocialWorkerForm",
      "workerId",
      "name",
      "email",
      "password",
      "togglePassword",
      "notification",
    ];

    // Check if all required elements exist
    for (const id of elements) {
      const element = document.getElementById(id);
      if (!element) {
        console.error(`Element with id '${id}' not found`);
        return;
      }
    }

    this.form = document.getElementById("addSocialWorkerForm");
    this.workerId = document.getElementById("workerId");
    this.name = document.getElementById("name");
    this.email = document.getElementById("email");
    this.password = document.getElementById("password");
    this.togglePassword = document.getElementById("togglePassword");
    this.notification = document.getElementById("notification");

    this.initializeEventListeners();
  }

  initializeEventListeners() {
    if (this.form && this.togglePassword) {
      this.form.addEventListener("submit", (e) => this.handleSubmit(e));
      this.togglePassword.addEventListener("click", () =>
        this.togglePasswordVisibility()
      );
    }
  }

  togglePasswordVisibility() {
    if (!this.password || !this.togglePassword) return;

    const type =
      this.password.getAttribute("type") === "password" ? "text" : "password";
    this.password.setAttribute("type", type);
    this.togglePassword.classList.toggle("fa-eye");
    this.togglePassword.classList.toggle("fa-eye-slash");
  }

  showNotification(message, type) {
    if (!this.notification) return;

    this.notification.textContent = message;
    this.notification.className = `notification ${type}`;

    if (type === "success") {
      setTimeout(() => {
        this.notification.style.opacity = "0";
        setTimeout(() => {
          this.notification.className = "notification";
          this.notification.style.opacity = "1";
        }, 300);
      }, 3000);
    } else {
      setTimeout(() => {
        this.notification.className = "notification";
      }, 5000);
    }
  }

  validateForm() {
    const fields = {
      workerId: {
        value: this.workerId?.value || "",
        label: "Worker ID",
        pattern: /^[A-Za-z0-9]+$/,
        minLength: 3,
      },
      name: {
        value: this.name?.value || "",
        label: "Name",
        minLength: 2,
      },
      email: {
        value: this.email?.value || "",
        label: "Email",
        pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      },
      password: {
        value: this.password?.value || "",
        label: "Password",
        minLength: 6,
      },
    };

    for (const [key, field] of Object.entries(fields)) {
      const value = field.value.trim();

      if (!value) {
        this.showNotification(`${field.label} is required`, "error");
        return false;
      }

      if (field.minLength && value.length < field.minLength) {
        this.showNotification(
          `${field.label} must be at least ${field.minLength} characters`,
          "error"
        );
        return false;
      }

      if (field.pattern && !field.pattern.test(value)) {
        this.showNotification(`Invalid ${field.label} format`, "error");
        return false;
      }
    }

    return true;
  }

  async handleSubmit(e) {
    e.preventDefault();

    if (!this.validateForm()) {
      return;
    }

    const data = {
      workerId: this.workerId.value.trim(),
      name: this.name.value.trim(),
      email: this.email.value.trim(),
      password: this.password.value,
    };

    try {
      const response = await fetch("http://localhost:3000/api/social-workers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(data),
      });

      let responseData;
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        responseData = await response.json();
      } else {
        throw new Error("Server response was not JSON");
      }

      if (response.ok) {
        // Verify the data was actually saved
        const verifyResponse = await fetch(
          `/api/social-workers/${responseData.workerId}`
        );
        if (!verifyResponse.ok) {
          throw new Error("Failed to verify data submission");
        }

        this.showNotification("Social worker added successfully", "success");
        this.form.reset();
        // Redirect to social workers list after successful addition
        window.location.href = "/social-workers";
      } else {
        this.showNotification(
          responseData.message || "Failed to add social worker",
          "error"
        );
      }
    } catch (error) {
      console.error("Error:", error);
      this.showNotification(
        "An error occurred while adding social worker",
        "error"
      );
    }
  }
}

// Initialize the form handler when DOM is fully loaded
document.addEventListener("DOMContentLoaded", () => {
  new AddSocialWorker();
});

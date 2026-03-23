const forgotForm = document.getElementById("forgot");
const helper = forgotForm.querySelector("[data-message]");
const backButton = forgotForm.querySelector("[data-back]");

const API_BASE = window.API_BASE || "";

const checkSession = () => {
  fetch(`${API_BASE}/api/me`, { credentials: "include" })
    .then((res) => {
      if (!res.ok) throw new Error("Not logged in");
      window.location.replace("/dashboard.html");
    })
    .catch(() => {});
};

const showMessage = (message, isError = false) => {
  helper.textContent = message;
  helper.classList.toggle("error", isError);
};

const setFieldError = (field, message) => {
  const el = forgotForm.querySelector(`[data-error-for='${field}']`);
  if (el) el.textContent = message || "";
};

const clearFieldErrors = () => {
  forgotForm.querySelectorAll("[data-error-for]").forEach((el) => (el.textContent = ""));
};

const isValidEmail = (value) => /\S+@\S+\.\S+/.test(value);

forgotForm.addEventListener("submit", (event) => {
  event.preventDefault();
  clearFieldErrors();
  const email = forgotForm.email.value.trim();

  if (!isValidEmail(email)) {
    setFieldError("email", "Please enter a valid email address.");
    return;
  }

  showMessage("Sending reset link...");

  fetch(`${API_BASE}/api/password/forgot`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email }),
  })
    .then(async (res) => {
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Request failed.");
      }
      return res.json();
    })
    .then((data) => {
      if (data.resetUrl) {
        showMessage(`Reset link: ${data.resetUrl}`);
      } else {
        showMessage("If the email exists, a reset link has been sent.");
      }
    })
    .catch((error) => {
      showMessage(error.message || "Reset request failed.", true);
    });
});

backButton.addEventListener("click", () => {
  window.location.href = "/";
});

checkSession();
window.addEventListener("pageshow", (event) => {
  if (event.persisted) checkSession();
});

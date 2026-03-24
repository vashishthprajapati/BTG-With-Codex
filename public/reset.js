const resetForm = document.getElementById("reset");
const helper = resetForm.querySelector("[data-message]");

const showMessage = (message, isError = false) => {
  helper.textContent = message;
  helper.classList.toggle("error", isError);
};

const setFieldError = (field, message) => {
  const el = resetForm.querySelector(`[data-error-for='${field}']`);
  if (el) el.textContent = message || "";
};

const clearFieldErrors = () => {
  resetForm.querySelectorAll("[data-error-for]").forEach((el) => (el.textContent = ""));
};

const params = new URLSearchParams(window.location.search);
const token = params.get("token");
const submitButton = resetForm.querySelector(".primary");

if (!token) {
  showMessage("Missing reset token.", true);
  if (submitButton) submitButton.disabled = true;
}

const API_BASE = window.API_BASE || "";
const checkSession = () => {
  fetch(`${API_BASE}/api/me`, { credentials: "include" })
    .then((res) => {
      if (!res.ok) throw new Error("Not logged in");
      window.location.replace("/dashboard.html");
    })
    .catch(() => {});
};

resetForm.addEventListener("submit", (event) => {
  event.preventDefault();
  clearFieldErrors();
  if (!token) {
    showMessage("Missing reset token.", true);
    return;
  }
  const password = resetForm.password.value.trim();
  const confirm = resetForm.confirm.value.trim();

  if (password.length < 8) {
    setFieldError("password", "Password must be at least 8 characters.");
    return;
  }
  if (password !== confirm) {
    setFieldError("confirm", "Passwords do not match.");
    return;
  }

  showMessage("Resetting password...");

  const base = window.API_BASE || "";
  fetch(`${base}/api/password/reset`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ token, password }),
  })
    .then(async (res) => {
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Reset failed.");
      }
      return res.json();
    })
    .then(() => {
      showMessage("Password reset successfully. You can log in now.");
      resetForm.reset();
      setTimeout(() => (window.location.href = "/"), 1200);
    })
    .catch((error) => {
      showMessage(error.message || "Reset failed.", true);
    });
});

checkSession();
window.addEventListener("pageshow", (event) => {
  if (event.persisted) checkSession();
});

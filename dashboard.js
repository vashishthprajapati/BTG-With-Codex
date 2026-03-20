const nameEl = document.querySelector("[data-name]");
const emailEl = document.querySelector("[data-email]");
const avatarEl = document.querySelector("[data-avatar]");
const logoutButton = document.querySelector("[data-logout]");
const messageEl = document.querySelector("[data-message]");
const lastLoginEl = document.querySelector("[data-last-login]");
const statusText = document.querySelector("[data-status]");
const resetButton = document.querySelector("[data-reset]");
const editButton = document.querySelector("[data-edit-profile]");

const API_BASE = window.API_BASE || "";

const showMessage = (text, isError = false) => {
  messageEl.textContent = text;
  messageEl.classList.toggle("error", isError);
};

const loadProfile = () => {
  fetch(`${API_BASE}/api/me`, { credentials: "include" })
    .then(async (res) => {
      if (!res.ok) throw new Error("Not signed in");
      const data = await res.json();
      const user = data.user || {};
      nameEl.textContent = user.name || "User";
      emailEl.textContent = user.email || "";
      const initials = (user.name || "BTG").slice(0, 2).toUpperCase();
      avatarEl.textContent = initials;
      if (statusText) statusText.textContent = "Active";
      if (lastLoginEl) lastLoginEl.textContent = new Date().toLocaleString();
    })
    .catch(() => {
      showMessage("Please log in again.", true);
      setTimeout(() => (window.location.replace("/")), 1200);
    });
};

logoutButton.addEventListener("click", () => {
  fetch(`${API_BASE}/api/logout`, {
    method: "POST",
    credentials: "include",
  })
    .then(() => {
      window.location.replace("/");
    })
    .catch(() => {
      showMessage("Logout failed.", true);
    });
});

resetButton.addEventListener("click", () => {
  window.location.href = "/forgot.html";
});

editButton.addEventListener("click", () => {
  showMessage("Profile editing will be available soon.");
});

loadProfile();

window.addEventListener("pageshow", (event) => {
  if (event.persisted) {
    loadProfile();
  }
});

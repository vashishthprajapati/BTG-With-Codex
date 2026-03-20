const switchButtons = document.querySelectorAll(".switch-btn");
const forms = document.querySelectorAll(".auth-form");
const statusEl = document.querySelector("[data-status]");
const toastEl = document.querySelector("[data-toast]");

const showForm = (targetId) => {
  forms.forEach((form) => {
    form.classList.toggle("is-active", form.id === targetId);
  });

  switchButtons.forEach((btn) => {
    const isActive = btn.dataset.target === targetId;
    btn.classList.toggle("is-active", isActive);
    btn.setAttribute("aria-selected", isActive ? "true" : "false");
  });
};

switchButtons.forEach((btn) => {
  btn.addEventListener("click", () => showForm(btn.dataset.target));
});

const showMessage = (form, message, isError = false) => {
  const helper = form.querySelector("[data-message]");
  helper.textContent = message;
  helper.classList.toggle("error", isError);
};

const setFieldError = (form, fieldName, message) => {
  const el = form.querySelector(`[data-error-for='${fieldName}']`);
  if (el) el.textContent = message || "";
};

const clearFieldErrors = (form) => {
  form.querySelectorAll("[data-error-for]").forEach((el) => (el.textContent = ""));
};

const showToast = (message) => {
  if (!toastEl) return;
  toastEl.textContent = message;
  toastEl.classList.add("show");
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => toastEl.classList.remove("show"), 2200);
};

const isValidEmail = (value) => /\S+@\S+\.\S+/.test(value);

const API_BASE = window.API_BASE || "";
const API = {
  login: `${API_BASE}/api/login`,
  signup: `${API_BASE}/api/signup`,
  oauthGoogle: `${API_BASE}/api/auth/google`,
  oauthGithub: `${API_BASE}/api/auth/github`,
  forgot: `${API_BASE}/api/password/forgot`,
  verifyOtp: `${API_BASE}/api/verify-otp`,
};

const postJson = async (url, payload) => {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    const message = data && (data.error || data.message) ? (data.error || data.message) : "Request failed";
    throw new Error(message);
  }
  return response.json().catch(() => ({}));
};

const loginForm = document.getElementById("login");
const signupForm = document.getElementById("signup");
const forgotButton = document.querySelector("[data-forgot]");

const setButtonState = (form, isLoading) => {
  const btn = form.querySelector(".primary");
  if (!btn) return;
  if (!btn.dataset.label) btn.dataset.label = btn.textContent;
  btn.disabled = isLoading;
  btn.textContent = isLoading ? "Please wait..." : btn.dataset.label;
};

const setStatus = (state, text) => {
  if (!statusEl) return;
  statusEl.classList.remove("online");
  if (state) statusEl.classList.add(state);
  const label = statusEl.querySelector(".status-text");
  if (label) label.textContent = text;
};


const checkSession = () => {
  fetch(`${API_BASE}/api/me`, { credentials: "include" })
    .then(async (res) => {
      if (!res.ok) throw new Error("Not logged in");
      const data = await res.json();
      setStatus("online", `Signed in as ${data.user?.name || data.user?.email}`);
      window.location.replace("/dashboard.html");
    })
    .catch(() => {
      if (statusEl) statusEl.style.display = "none";
    });
};

loginForm.addEventListener("submit", (event) => {
  event.preventDefault();
  clearFieldErrors(loginForm);
  const email = loginForm.email.value.trim();
  const password = loginForm.password.value.trim();

  if (!isValidEmail(email)) {
    setFieldError(loginForm, "email", "Please enter a valid email address.");
    return;
  }

  if (!password) {
    setFieldError(loginForm, "password", "Please enter a valid password.");
    return;
  }

  showMessage(loginForm, "Signing you in...", false);
  setButtonState(loginForm, true);
  postJson(API.login, { email, password })
    .then(() => {
      showMessage(loginForm, "Login successful. Redirecting...", false);
      loginForm.reset();
      showToast("Welcome back!");
      checkSession();
      window.location.replace("/dashboard.html");
    })
    .catch((error) => {
      showMessage(loginForm, error.message || "Login failed.", true);
    })
    .finally(() => setButtonState(loginForm, false));
});

signupForm.addEventListener("submit", (event) => {
  event.preventDefault();
  clearFieldErrors(signupForm);
  const name = signupForm.name.value.trim();
  const email = signupForm.email.value.trim();
  const password = signupForm.password.value.trim();

  if (name.length < 2) {
    setFieldError(signupForm, "name", "Please enter your full name.");
    return;
  }

  if (!isValidEmail(email)) {
    setFieldError(signupForm, "email", "Please enter a valid email address.");
    return;
  }

  if (password.length < 8) {
    setFieldError(signupForm, "password", "Password must be at least 8 characters.");
    return;
  }

  showMessage(signupForm, "Sending OTP to your email...", false);
  setButtonState(signupForm, true);
  postJson(API.signup, { name, email, password })
    .then(() => {
      sessionStorage.setItem("btg_signup", JSON.stringify({ name, email, password }));
      window.location.href = `/verify.html?email=${encodeURIComponent(email)}`;
    })
    .catch((error) => {
      showMessage(signupForm, error.message || "Signup failed.", true);
    })
    .finally(() => setButtonState(signupForm, false));
});

forgotButton.addEventListener("click", () => {
  window.location.href = "/forgot.html";
});

const socialButtons = document.querySelectorAll(".social");

socialButtons.forEach((button) => {
  button.addEventListener("click", () => {
    if (button.classList.contains("google")) {
      window.location.href = API.oauthGoogle;
      return;
    }
    if (button.classList.contains("github")) {
      window.location.href = API.oauthGithub;
    }
  });
});

checkSession();
window.addEventListener("pageshow", (event) => {
  if (event.persisted) {
    checkSession();
  }
});

const params = new URLSearchParams(window.location.search);
if (params.get("mode") === "signup") {
  showForm("signup");
}
const saved = sessionStorage.getItem("btg_signup");
if (saved) {
  try {
    const data = JSON.parse(saved);
    if (data?.name && signupForm.name) signupForm.name.value = data.name;
    if (data?.email && signupForm.email) signupForm.email.value = data.email;
    if (data?.password && signupForm.password) signupForm.password.value = data.password;
  } catch {}
}
const emailFromSession = sessionStorage.getItem("btg_signup_email");
const emailFromQuery = params.get("email");
if (signupForm?.email) {
  if (emailFromQuery) signupForm.email.value = emailFromQuery;
  else if (emailFromSession) signupForm.email.value = emailFromSession;
}
if (emailFromSession || emailFromQuery) {
  sessionStorage.removeItem("btg_signup_email");
}

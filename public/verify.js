const verifyForm = document.getElementById("verify");
const helper = verifyForm.querySelector("[data-message]");
const resendButton = verifyForm.querySelector("[data-resend]");
const timerLine = verifyForm.querySelector("[data-timer]");
const otpBoxes = Array.from(document.querySelectorAll(".otp-box"));
const otpHidden = verifyForm.querySelector("input[name='otp']");
const emailHidden = verifyForm.querySelector("input[name='email']");
const emailText = document.querySelector("[data-email]");
const editButton = document.querySelector("[data-edit]");

const API_BASE = window.API_BASE || "";
const API = {
  verifyOtp: `${API_BASE}/api/verify-otp`,
  resend: `${API_BASE}/api/otp/resend`,
};

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
  const el = verifyForm.querySelector(`[data-error-for='${field}']`);
  if (el) el.textContent = message || "";
};

const clearFieldErrors = () => {
  verifyForm.querySelectorAll("[data-error-for]").forEach((el) => (el.textContent = ""));
};

const startCooldown = (seconds) => {
  let remaining = seconds;
  resendButton.disabled = true;
  resendButton.classList.remove("enabled");
  resendButton.textContent = "Resend code";
  timerLine.textContent = `You can resend in ${remaining}s`;

  const interval = setInterval(() => {
    remaining -= 1;
    if (remaining <= 0) {
      clearInterval(interval);
      resendButton.disabled = false;
      resendButton.classList.add("enabled");
      timerLine.textContent = "";
      return;
    }
    timerLine.textContent = `You can resend in ${remaining}s`;
  }, 1000);
};

const params = new URLSearchParams(window.location.search);
const emailParam = params.get("email");
if (emailParam) {
  emailHidden.value = emailParam;
  if (emailText) emailText.textContent = emailParam;
}

const syncOtp = () => {
  const value = otpBoxes.map((box) => box.value).join("");
  otpHidden.value = value;
  return value;
};

otpBoxes.forEach((box, index) => {
  box.addEventListener("input", (event) => {
    const val = event.target.value.replace(/\D/g, "");
    event.target.value = val;
    if (val && index < otpBoxes.length - 1) {
      otpBoxes[index + 1].focus();
      otpBoxes[index + 1].select();
    }
    syncOtp();
  });

  box.addEventListener("keydown", (event) => {
    if (event.key === "Backspace" && !event.target.value && index > 0) {
      otpBoxes[index - 1].focus();
      otpBoxes[index - 1].select();
    }
  });

  box.addEventListener("paste", (event) => {
    event.preventDefault();
    const pasted = (event.clipboardData || window.clipboardData).getData("text");
    const digits = pasted.replace(/\D/g, "").slice(0, 6).split("");
    digits.forEach((digit, i) => {
      if (otpBoxes[i]) otpBoxes[i].value = digit;
    });
    const lastIndex = Math.min(digits.length, otpBoxes.length) - 1;
    if (lastIndex >= 0) {
      otpBoxes[lastIndex].focus();
    }
    syncOtp();
  });
});

requestAnimationFrame(() => startCooldown(60));

checkSession();
window.addEventListener("pageshow", (event) => {
  if (event.persisted) checkSession();
});

verifyForm.addEventListener("submit", (event) => {
  event.preventDefault();
  clearFieldErrors();
  const email = emailHidden.value.trim();
  const otp = syncOtp().trim();

  if (!email) {
    setFieldError("email", "Email is required.");
    return;
  }
  if (!/^\d{6}$/.test(otp)) {
    setFieldError("otp", "Enter the 6-digit OTP.");
    return;
  }

  showMessage("Verifying code...");

  fetch(API.verifyOtp, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, otp }),
  })
    .then(async (res) => {
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Verification failed.");
      }
      return res.json();
    })
    .then(() => {
      showMessage("Verified! Redirecting to login...");
      sessionStorage.removeItem("btg_signup");
      sessionStorage.removeItem("btg_signup_email");
      setTimeout(() => (window.location.href = "/"), 1200);
    })
    .catch((error) => {
      showMessage(error.message || "Verification failed.", true);
    });
});

resendButton.addEventListener("click", () => {
  const email = emailHidden.value.trim();
  if (!email) {
    showMessage("Enter your email first.", true);
    return;
  }

  showMessage("Resending code...");

  fetch(API.resend, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email }),
  })
    .then(async (res) => {
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Resend failed.");
      }
      return res.json();
    })
    .then(() => {
      showMessage("OTP sent again. Check your email.");
      startCooldown(60);
    })
    .catch((error) => {
      showMessage(error.message || "Resend failed.", true);
    });
});

editButton.addEventListener("click", () => {
  const email = emailHidden.value;
  sessionStorage.setItem("btg_signup_email", email);
  window.location.href = `/?mode=signup&email=${encodeURIComponent(email)}`;
});

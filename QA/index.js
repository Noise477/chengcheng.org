const API_BASE_URL = "https://api.chengcheng.org";

const homeUserStatus = document.getElementById("homeUserStatus");
const homeAdminStatus = document.getElementById("homeAdminStatus");

const openHomeUserLoginBtn = document.getElementById("openHomeUserLoginBtn");
const openHomeAdminLoginBtn = document.getElementById("openHomeAdminLoginBtn");

const homeUserLoginDialog = document.getElementById("homeUserLoginDialog");
const homeAdminLoginDialog = document.getElementById("homeAdminLoginDialog");

const closeHomeUserLoginBtn = document.getElementById("closeHomeUserLoginBtn");
const closeHomeAdminLoginBtn = document.getElementById("closeHomeAdminLoginBtn");

const homeUserLoginForm = document.getElementById("homeUserLoginForm");
const homeAdminLoginForm = document.getElementById("homeAdminLoginForm");

const homeUserLoginMessage = document.getElementById("homeUserLoginMessage");
const homeAdminLoginMessage = document.getElementById("homeAdminLoginMessage");

const clearHomeUserBtn = document.getElementById("clearHomeUserBtn");
const clearHomeAdminBtn = document.getElementById("clearHomeAdminBtn");

const homeAdminPanel = document.getElementById("homeAdminPanel");
const homeRegisterUserForm = document.getElementById("homeRegisterUserForm");
const registerUserMessage = document.getElementById("registerUserMessage");
const clearRegisterUserBtn = document.getElementById("clearRegisterUserBtn");

document.addEventListener("DOMContentLoaded", init);

function init() {
  updateHomeLoginStatus();

  openHomeUserLoginBtn.addEventListener("click", () => homeUserLoginDialog.showModal());
  openHomeAdminLoginBtn.addEventListener("click", () => homeAdminLoginDialog.showModal());

  closeHomeUserLoginBtn.addEventListener("click", () => homeUserLoginDialog.close());
  closeHomeAdminLoginBtn.addEventListener("click", () => homeAdminLoginDialog.close());

  homeUserLoginForm.addEventListener("submit", handleHomeUserLogin);
  homeAdminLoginForm.addEventListener("submit", handleHomeAdminLogin);

  clearHomeUserBtn.addEventListener("click", clearHomeUserAuth);
  clearHomeAdminBtn.addEventListener("click", clearHomeAdminAuth);

  homeRegisterUserForm.addEventListener("submit", handleRegisterUser);
  clearRegisterUserBtn.addEventListener("click", clearRegisterUserForm);

  loadSavedLoginInputs();
}

async function handleHomeUserLogin(event) {
  event.preventDefault();

  const username = valueOf("homeUserUsername");
  const password = valueOf("homeUserPassword");

  if (!username || !password) {
    showMessage(homeUserLoginMessage, "Please enter username and password.", "error");
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/webapi/Login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        userName: username,
        password: password
      })
    });

    if (!response.ok) {
      clearHomeUserSavedAuth();
      showMessage(homeUserLoginMessage, "Invalid username or password.", "error");
      return;
    }

    sessionStorage.setItem("qa_user_username", username);
    sessionStorage.setItem("qa_user_password", password);

    updateHomeLoginStatus();
    showMessage(homeUserLoginMessage, "User signed in successfully.", "ok");
    homeUserLoginDialog.close();
  } catch {
    showMessage(homeUserLoginMessage, "Cannot connect to backend.", "error");
  }
}

async function handleHomeAdminLogin(event) {
  event.preventDefault();

  const username = valueOf("homeAdminUsername");
  const password = valueOf("homeAdminPassword");

  if (!username || !password) {
    showMessage(homeAdminLoginMessage, "Please enter admin username and password.", "error");
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/webapi/AdminLogin`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        userName: username,
        password: password
      })
    });

    if (!response.ok) {
      clearHomeAdminSavedAuth();
      showMessage(homeAdminLoginMessage, "Invalid admin username or password.", "error");
      return;
    }

    sessionStorage.setItem("qa_admin_username", username);
    sessionStorage.setItem("qa_admin_password", password);

    updateHomeLoginStatus();
    showMessage(homeAdminLoginMessage, "Admin signed in successfully.", "ok");
    homeAdminLoginDialog.close();
  } catch {
    showMessage(homeAdminLoginMessage, "Cannot connect to backend.", "error");
  }
}

async function handleRegisterUser(event) {
  event.preventDefault();

  const adminUsername = sessionStorage.getItem("qa_admin_username");
  const adminPassword = sessionStorage.getItem("qa_admin_password");

  if (!adminUsername || !adminPassword) {
    showMessage(registerUserMessage, "Please sign in as admin first.", "error");
    return;
  }

  const payload = {
    userName: valueOf("registerUserName"),
    password: valueOf("registerPassword"),
    email: valueOf("registerEmail"),
    lbP_Name: valueOf("registerLbpName"),
    lbP_Number: valueOf("registerLbpNumber"),
    lbP_Class: getSelectedRegisterLbpClasses().join(";")
  };

  const validation = validateRegisterUser(payload);

  if (!validation.ok) {
    showMessage(registerUserMessage, validation.message, "error");
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/webapi/RegisterUser`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${btoa(`${adminUsername}:${adminPassword}`)}`
      },
      body: JSON.stringify(payload)
    });

    const text = await response.text();

    if (response.status === 409) {
      showMessage(registerUserMessage, "Username already exists.", "error");
      return;
    }

    if (response.status === 401 || response.status === 403) {
      showMessage(registerUserMessage, "Admin permission required.", "error");
      return;
    }

    if (!response.ok) {
      showMessage(registerUserMessage, text || "User registration failed.", "error");
      return;
    }

    showMessage(registerUserMessage, text || "User registered successfully.", "ok");
    clearRegisterUserForm(false);
  } catch {
    showMessage(registerUserMessage, "Cannot connect to backend register endpoint.", "error");
  }
}

function getSelectedRegisterLbpClasses() {
  return Array.from(document.querySelectorAll("input[name='registerLbpClass']:checked"))
    .map((input) => input.value.trim())
    .filter((value) => value.length > 0);
}

function validateRegisterUser(payload) {
  if (!payload.userName) {
    return { ok: false, message: "Username is required." };
  }

  if (!payload.password) {
    return { ok: false, message: "Password is required." };
  }

  if (!payload.email) {
    return { ok: false, message: "Email is required." };
  }

  if (!payload.lbP_Name) {
    return { ok: false, message: "LBP name is required." };
  }

  if (!payload.lbP_Number) {
    return { ok: false, message: "LBP number is required." };
  }

  if (!/^\d{4,10}$/.test(payload.lbP_Number)) {
    return { ok: false, message: "LBP number should contain 4 to 10 digits only." };
  }

  if (!payload.lbP_Class) {
    return { ok: false, message: "LBP licence class is required." };
  }

  return { ok: true, message: "" };
}

function updateHomeLoginStatus() {
  const userUsername = sessionStorage.getItem("qa_user_username");
  const adminUsername = sessionStorage.getItem("qa_admin_username");

  if (userUsername) {
    homeUserStatus.textContent = `User: ${userUsername}`;
    homeUserStatus.classList.add("signed-in");
    openHomeUserLoginBtn.textContent = "Switch user";
  } else {
    homeUserStatus.textContent = "User: not signed in";
    homeUserStatus.classList.remove("signed-in");
    openHomeUserLoginBtn.textContent = "User sign in";
  }

  if (adminUsername) {
    homeAdminStatus.textContent = `Admin: ${adminUsername}`;
    homeAdminStatus.classList.add("signed-in");
    openHomeAdminLoginBtn.textContent = "Switch admin";
    homeAdminPanel.classList.remove("hidden");
  } else {
    homeAdminStatus.textContent = "Admin: not signed in";
    homeAdminStatus.classList.remove("signed-in");
    openHomeAdminLoginBtn.textContent = "Admin sign in";
    homeAdminPanel.classList.add("hidden");
  }
}

function loadSavedLoginInputs() {
  setValue("homeUserUsername", sessionStorage.getItem("qa_user_username") || "");
  setValue("homeUserPassword", sessionStorage.getItem("qa_user_password") || "");

  setValue("homeAdminUsername", sessionStorage.getItem("qa_admin_username") || "");
  setValue("homeAdminPassword", sessionStorage.getItem("qa_admin_password") || "");
}

function clearHomeUserAuth() {
  clearHomeUserSavedAuth();
  setValue("homeUserUsername", "");
  setValue("homeUserPassword", "");
  showMessage(homeUserLoginMessage, "Cleared user sign-in details.", "ok");
}

function clearHomeUserSavedAuth() {
  sessionStorage.removeItem("qa_user_username");
  sessionStorage.removeItem("qa_user_password");
  updateHomeLoginStatus();
}

function clearHomeAdminAuth() {
  clearHomeAdminSavedAuth();
  setValue("homeAdminUsername", "");
  setValue("homeAdminPassword", "");
  showMessage(homeAdminLoginMessage, "Cleared admin sign-in details.", "ok");
}

function clearHomeAdminSavedAuth() {
  sessionStorage.removeItem("qa_admin_username");
  sessionStorage.removeItem("qa_admin_password");
  updateHomeLoginStatus();
}

function clearRegisterUserForm(showClearMessage = true) {
  setValue("registerUserName", "");
  setValue("registerPassword", "");
  setValue("registerEmail", "");
  setValue("registerLbpName", "");
  setValue("registerLbpNumber", "");

  document.querySelectorAll("input[name='registerLbpClass']").forEach((input) => {
    input.checked = false;
  });

  if (showClearMessage) {
    showMessage(registerUserMessage, "Register form cleared.", "ok");
  }
}

function valueOf(id) {
  const element = document.getElementById(id);
  return element ? element.value.trim() : "";
}

function setValue(id, value) {
  const element = document.getElementById(id);

  if (element) {
    element.value = value;
  }
}

function showMessage(element, text, type) {
  if (!element) {
    return;
  }

  element.textContent = text;
  element.className = `message ${type}`;
}
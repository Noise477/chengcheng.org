const API_BASE_URL = "https://api.chengcheng.org";

let currentCrawlerJobId = null;
let crawlerPollTimer = null;
let currentCrawlerPayload = null;
let crawlerTimeSlots = [];

const adminStatus = document.getElementById("adminStatus");
const adminLoginDialog = document.getElementById("adminLoginDialog");
const openAdminLoginBtn = document.getElementById("openAdminLoginBtn");
const closeAdminLoginBtn = document.getElementById("closeAdminLoginBtn");

const adminLoginForm = document.getElementById("adminLoginForm");
const adminLoginMessage = document.getElementById("adminLoginMessage");
const clearAdminBtn = document.getElementById("clearAdminBtn");

const adminRequiredCard = document.getElementById("adminRequiredCard");
const crawlerPanel = document.getElementById("crawlerPanel");
const crawlerLogCard = document.getElementById("crawlerLogCard");

const crawlerForm = document.getElementById("crawlerForm");
const crawlerMessage = document.getElementById("crawlerMessage");
const crawlerLog = document.getElementById("crawlerLog");
const crawlerStatusSummary = document.getElementById("crawlerStatusSummary");
const crawlerTimeline = document.getElementById("crawlerTimeline");
const stopCrawlerBtn = document.getElementById("stopCrawlerBtn");

const addTimeSlotBtn = document.getElementById("addTimeSlotBtn");
const selectedTimeSlots = document.getElementById("selectedTimeSlots");

const crawlerSettingsDetails = document.getElementById("crawlerSettingsDetails");
const crawlerSettingsForm = document.getElementById("crawlerSettingsForm");
const crawlerSettingsMessage = document.getElementById("crawlerSettingsMessage");
const councilPasswordSavedMessage = document.getElementById("councilPasswordSavedMessage");

document.addEventListener("DOMContentLoaded", init);

function init() {
  loadSavedAdminAuth();
  setDefaultDate();

  openAdminLoginBtn.addEventListener("click", () => adminLoginDialog.showModal());
  closeAdminLoginBtn.addEventListener("click", () => adminLoginDialog.close());

  adminLoginForm.addEventListener("submit", handleAdminLogin);
  clearAdminBtn.addEventListener("click", clearAdminAuth);

  crawlerForm.addEventListener("submit", handleStartCrawler);
  crawlerSettingsForm.addEventListener("submit", handleSaveCrawlerSettings);
  stopCrawlerBtn.addEventListener("click", handleStopCrawler);
  addTimeSlotBtn.addEventListener("click", addTimeSlot);
}

async function handleAdminLogin(event) {
  event.preventDefault();

  const username = valueOf("adminUsername");
  const password = valueOf("adminPassword");

  if (!username || !password) {
    showMessage(adminLoginMessage, "Please enter admin username and password.", "error");
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
      clearAdminSavedAuth();
      showMessage(adminLoginMessage, "Invalid admin username or password.", "error");
      return;
    }

    sessionStorage.setItem("qa_admin_username", username);
    sessionStorage.setItem("qa_admin_password", password);

    updateAdminStatus();
    showMessage(adminLoginMessage, "Admin signed in successfully.", "ok");
    adminLoginDialog.close();

    await loadAdminCrawlerSettings();
    await loadActiveCrawlerJob();
  } catch {
    showMessage(adminLoginMessage, "Cannot connect to backend. Check dotnet run and CORS.", "error");
  }
}

async function loadAdminCrawlerSettings() {
  const adminUsername = sessionStorage.getItem("qa_admin_username");
  const adminPassword = sessionStorage.getItem("qa_admin_password");

  if (!adminUsername || !adminPassword) {
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/webapi/AdminCrawlerSettings`, {
      method: "GET",
      headers: {
        "Authorization": `Basic ${btoa(`${adminUsername}:${adminPassword}`)}`
      }
    });

    if (response.status === 404) {
      showMessage(crawlerSettingsMessage, "Admin crawler settings endpoint has not been added yet.", "error");
      return;
    }

    if (response.status === 401 || response.status === 403) {
      showMessage(crawlerSettingsMessage, "Admin permission required.", "error");
      return;
    }

    if (!response.ok) {
      showMessage(crawlerSettingsMessage, "Could not load admin crawler settings.", "error");
      return;
    }

    const settings = await response.json();

    setValue("settingsCouncilUsername", settings.councilUsername || "");
    setValue("settingsCouncilPassword", "");

    setValue("settingsContactName", settings.contactName || "");
    setValue("settingsContactMobile", settings.contactMobile || "");
    setValue("settingsContactEmail", settings.contactEmail || "");
    setValue("settingsContactNotes", settings.contactNotes || "");

    if (hasSavedCrawlerSettings(settings)) {
        crawlerSettingsDetails.open = false;
    } else {
        crawlerSettingsDetails.open = true;
    }

    if (settings.councilPasswordSaved) {
      councilPasswordSavedMessage.textContent = "A council password is already saved. Leave the password field blank to keep it unchanged.";
      councilPasswordSavedMessage.classList.remove("hidden");
    } else {
      councilPasswordSavedMessage.textContent = "No council password is currently saved.";
      councilPasswordSavedMessage.classList.remove("hidden");
    }

    setContactOverridePlaceholders(settings);
  } catch {
    showMessage(crawlerSettingsMessage, "Could not connect to backend to load settings.", "error");
  }
}

async function handleSaveCrawlerSettings(event) {
  event.preventDefault();

  const adminUsername = sessionStorage.getItem("qa_admin_username");
  const adminPassword = sessionStorage.getItem("qa_admin_password");

  if (!adminUsername || !adminPassword) {
    showMessage(crawlerSettingsMessage, "Please sign in as admin first.", "error");
    return;
  }

  const payload = {
    councilUsername: valueOf("settingsCouncilUsername"),
    councilPassword: valueOf("settingsCouncilPassword"),
    contactName: valueOf("settingsContactName"),
    contactMobile: valueOf("settingsContactMobile"),
    contactEmail: valueOf("settingsContactEmail"),
    contactNotes: valueOf("settingsContactNotes")
  };

  try {
    const response = await fetch(`${API_BASE_URL}/webapi/AdminCrawlerSettings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${btoa(`${adminUsername}:${adminPassword}`)}`
      },
      body: JSON.stringify(payload)
    });

    const text = await response.text();

    if (response.status === 401 || response.status === 403) {
      showMessage(crawlerSettingsMessage, "Admin permission required.", "error");
      return;
    }

    if (!response.ok) {
      showMessage(crawlerSettingsMessage, text || "Could not save crawler settings.", "error");
      return;
    }

    showMessage(crawlerSettingsMessage, text || "Crawler settings saved.", "ok");

    setValue("settingsCouncilPassword", "");
    await loadAdminCrawlerSettings();

    crawlerSettingsDetails.open = false;
  } catch {
    showMessage(crawlerSettingsMessage, "Could not connect to backend to save settings.", "error");
  }
}

function setContactOverridePlaceholders(settings) {
  const contactName = document.getElementById("contactName");
  const contactMobile = document.getElementById("contactMobile");
  const contactEmail = document.getElementById("contactEmail");
  const contactNotes = document.getElementById("contactNotes");

  if (contactName) {
    contactName.placeholder = settings.contactName
      ? `Default: ${settings.contactName}`
      : "Default from admin profile";
  }

  if (contactMobile) {
    contactMobile.placeholder = settings.contactMobile
      ? `Default: ${settings.contactMobile}`
      : "Default from admin profile";
  }

  if (contactEmail) {
    contactEmail.placeholder = settings.contactEmail
      ? `Default: ${settings.contactEmail}`
      : "Default from admin profile";
  }

  if (contactNotes) {
    contactNotes.placeholder = settings.contactNotes
      ? `Default: ${settings.contactNotes}`
      : "Optional notes";
  }
}

function hasSavedCrawlerSettings(settings) {
  return Boolean(
    settings.councilUsername ||
    settings.councilPasswordSaved ||
    settings.contactName ||
    settings.contactMobile ||
    settings.contactEmail ||
    settings.contactNotes
  );
}

async function handleStartCrawler(event) {
  event.preventDefault();

  const adminUsername = sessionStorage.getItem("qa_admin_username");
  const adminPassword = sessionStorage.getItem("qa_admin_password");

  if (!adminUsername || !adminPassword) {
    showMessage(crawlerMessage, "Please sign in as admin first.", "error");
    return;
  }

  const activeJobFound = await loadActiveCrawlerJob({ silentWhenNone: true });

  if (activeJobFound) {
    showMessage(crawlerMessage, "A crawler job is already running for this admin account. The existing job is shown below.", "ok");
    return;
  }

  if (crawlerTimeSlots.length === 0) {
    showMessage(crawlerMessage, "Please add at least one preferred time slot.", "error");
    return;
  }

  const payload = buildCrawlerPayload();

  currentCrawlerPayload = payload;

  crawlerLogCard.classList.remove("hidden");
  crawlerLog.textContent = JSON.stringify(payload, null, 2);

  try {
    const response = await fetch(`${API_BASE_URL}/webapi/CrawlerJobs/Start`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${btoa(`${adminUsername}:${adminPassword}`)}`
      },
      body: JSON.stringify(payload)
    });

    const text = await response.text();

    if (response.status === 404) {
      showMessage(crawlerMessage, "Crawler start endpoint has not been added yet.", "error");
      return;
    }

    if (response.status === 401 || response.status === 403) {
      showMessage(crawlerMessage, "Admin permission required.", "error");
      return;
    }

    if (!response.ok) {
      showMessage(crawlerMessage, `Crawler failed to start (${response.status}): ${text}`, "error");
      return;
    }

    let result;

    try {
      result = JSON.parse(text);
    } catch {
      showMessage(crawlerMessage, text || "Crawler started, but response was not JSON.", "ok");
      return;
    }

    currentCrawlerJobId = result.job_id || result.jobId || result.id;

    if (currentCrawlerJobId) {
        localStorage.setItem("qa_current_crawler_job_id", currentCrawlerJobId);
    }

    if (!currentCrawlerJobId) {
      crawlerLog.textContent = JSON.stringify(result, null, 2);
      showMessage(crawlerMessage, "Crawler started, but no job_id was returned.", "error");
      return;
    }

    showMessage(crawlerMessage, `Crawler started. Job ID: ${currentCrawlerJobId}`, "ok");
    crawlerLog.textContent = JSON.stringify(result, null, 2);

    startCrawlerPolling(currentCrawlerJobId);
  } catch {
    showMessage(crawlerMessage, "Cannot connect to backend crawler endpoint.", "error");
  }
}

async function handleStopCrawler() {
  const adminUsername = sessionStorage.getItem("qa_admin_username");
  const adminPassword = sessionStorage.getItem("qa_admin_password");

  if (!adminUsername || !adminPassword) {
    showMessage(crawlerMessage, "Please sign in as admin first.", "error");
    return;
  }

  if (!currentCrawlerJobId) {
    showMessage(crawlerMessage, "No crawler job is currently running.", "error");
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/webapi/CrawlerJobs/${encodeURIComponent(currentCrawlerJobId)}/Stop`, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${btoa(`${adminUsername}:${adminPassword}`)}`
      }
    });

    const text = await response.text();

    if (response.status === 401 || response.status === 403) {
      showMessage(crawlerMessage, "Admin permission required.", "error");
      return;
    }

    if (!response.ok) {
      showMessage(crawlerMessage, `Could not stop crawler (${response.status}): ${text}`, "error");
      return;
    }

    showMessage(crawlerMessage, "Stop request sent. Waiting for crawler to stop...", "ok");

    renderCrawlerJob({
      job_id: currentCrawlerJobId,
      status: "stopping",
      logs: ["[SYSTEM] stop requested"],
      result: null
    });

    startCrawlerPolling(currentCrawlerJobId);
  } catch {
    showMessage(crawlerMessage, "Cannot connect to backend stop endpoint.", "error");
  }
}

function startCrawlerPolling(jobId) {
  stopCrawlerPolling();

  pollCrawlerJob(jobId);

  crawlerPollTimer = window.setInterval(() => {
    pollCrawlerJob(jobId);
  }, 2000);
}

function stopCrawlerPolling() {
  if (crawlerPollTimer) {
    window.clearInterval(crawlerPollTimer);
    crawlerPollTimer = null;
  }
}

async function pollCrawlerJob(jobId) {
  const adminUsername = sessionStorage.getItem("qa_admin_username");
  const adminPassword = sessionStorage.getItem("qa_admin_password");

  if (!adminUsername || !adminPassword) {
    stopCrawlerPolling();
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/webapi/CrawlerJobs/${encodeURIComponent(jobId)}`, {
      method: "GET",
      headers: {
        "Authorization": `Basic ${btoa(`${adminUsername}:${adminPassword}`)}`
      }
    });

    const text = await response.text();

    if (!response.ok) {
      crawlerLogCard.classList.remove("hidden");
      crawlerLog.textContent = `Polling failed (${response.status}): ${text}`;
      return;
    }

    let data;

    try {
      data = JSON.parse(text);
    } catch {
      crawlerLogCard.classList.remove("hidden");
      crawlerLog.textContent = text;
      return;
    }

    renderCrawlerJob(data);

    const status = String(data.status || data.state || "").toLowerCase();

    if (
        status === "done" ||
        status === "finished" ||
        status === "completed" ||
        status === "success" ||
        status === "failed" ||
        status === "error" ||
        status === "stopped" ||
        status === "cancelled"
    ) {
        stopCrawlerPolling();
        currentCrawlerJobId = null;
        localStorage.removeItem("qa_current_crawler_job_id");

        showMessage(
            crawlerMessage,
            `Crawler job finished with status: ${status}`,
            status === "failed" || status === "error" ? "error" : "ok"
        );
    }
  } catch {
    crawlerLogCard.classList.remove("hidden");
    crawlerLog.textContent = "Could not poll crawler job.";
  }
}

function renderCrawlerJob(data) {
  crawlerLogCard.classList.remove("hidden");

  const status = String(data.status || data.state || "unknown").toLowerCase();
  const logs = normalizeCrawlerLogs(data.logs || data.log || []);
  const result = data.result || data.output || null;

  renderCrawlerStatus(status, result, data.job_id || data.jobId || currentCrawlerJobId);
  renderCrawlerTimeline(logs, result);

  crawlerLog.textContent = JSON.stringify(data, null, 2);
}

function renderCrawlerStatus(status, result, jobId) {
  crawlerStatusSummary.innerHTML = "";

  const card = document.createElement("div");
  card.className = "crawler-status-card";

  const pill = document.createElement("div");
  pill.className = `crawler-status-pill ${getCrawlerStatusClass(status)}`;
  pill.textContent = getCrawlerStatusLabel(status);

  const title = document.createElement("h3");
  title.textContent = getCrawlerStatusTitle(status, result);

  const description = document.createElement("p");
  description.textContent = getCrawlerStatusDescription(status, result, jobId);

  card.appendChild(pill);
  card.appendChild(title);
  card.appendChild(description);

  crawlerStatusSummary.appendChild(card);
}

function renderCrawlerTimeline(logs, result) {
  crawlerTimeline.innerHTML = "";

  const liveStatus = getCrawlerLiveStatus(logs, result);

  crawlerTimeline.appendChild(
    createTimelineItem(
      liveStatus.kind,
      liveStatus.title,
      liveStatus.description
    )
  );
}

function getCrawlerLiveStatus(logs, result) {
  if (result) {
    return parseCrawlerResult(result);
  }

  const latestLog = getLatestUsefulCrawlerLog(logs);

  if (!latestLog) {
    return {
      kind: "running",
      title: "Crawler is preparing",
      description: "Waiting for the crawler to return progress information."
    };
  }

  const lower = latestLog.toLowerCase();

  if (
    lower.includes("no_slot") ||
    lower.includes("no slot") ||
    lower.includes("no available") ||
    lower.includes("no availability")
  ) {
    return {
      kind: "running",
      title: "Checking available time slots",
      description: buildLastAttemptDescription(
        "No available slot in selected preferred windows."
      )
    };
  }

  if (lower.includes("login") || lower.includes("sign in") || lower.includes("signed in")) {
    return {
      kind: "running",
      title: "Signing in to council account",
      description: "The crawler is using the saved council account details."
    };
  }

  if (lower.includes("bco") || lower.includes("search")) {
    return {
      kind: "running",
      title: "Searching consent record",
      description: cleanCrawlerLogText(latestLog)
    };
  }

  if (lower.includes("slot") || lower.includes("window") || lower.includes("date") || lower.includes("time")) {
    return {
      kind: "running",
      title: "Checking available time slots",
      description: buildLastAttemptDescription(cleanCrawlerLogText(latestLog))
    };
  }

  if (lower.includes("safe mode")) {
    return {
      kind: "warning",
      title: "Safe mode is enabled",
      description: "The crawler will not submit a final booking action."
    };
  }

  if (lower.includes("error") || lower.includes("exception") || lower.includes("failed")) {
    return {
      kind: "error",
      title: "Crawler error",
      description: cleanCrawlerLogText(latestLog)
    };
  }

  return {
    kind: "running",
    title: "Crawler is running",
    description: cleanCrawlerLogText(latestLog)
  };
}

function getLatestUsefulCrawlerLog(logs) {
  if (!Array.isArray(logs) || logs.length === 0) {
    return "";
  }

  for (let i = logs.length - 1; i >= 0; i--) {
    const line = String(logs[i]).trim();

    if (line.length > 0) {
      return line;
    }
  }

  return "";
}

function buildLastAttemptDescription(reason) {
  const lastAttempt = formatCurrentDateTime();

  return `Last attempt: ${lastAttempt}. \nReason: ${reason}`;
}

function formatCurrentDateTime() {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hour = String(now.getHours()).padStart(2, "0");
  const minute = String(now.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day} ${hour}:${minute}`;
}

function createTimelineItem(kind, title, description) {
  const item = document.createElement("div");
  item.className = `crawler-timeline-item ${kind}`;

  const icon = document.createElement("div");
  icon.className = "crawler-timeline-icon";
  icon.textContent = getTimelineIcon(kind);

  const content = document.createElement("div");
  content.className = "crawler-timeline-content";

  const titleElement = document.createElement("strong");
  titleElement.textContent = title;

  const descriptionElement = document.createElement("span");
  descriptionElement.textContent = description;

  content.appendChild(titleElement);
  content.appendChild(descriptionElement);

  item.appendChild(icon);
  item.appendChild(content);

  return item;
}

function normalizeCrawlerLogs(logs) {
  if (Array.isArray(logs)) {
    return logs.map((line) => String(line)).filter((line) => line.trim().length > 0);
  }

  if (typeof logs === "string" && logs.trim().length > 0) {
    return logs.split("\n").filter((line) => line.trim().length > 0);
  }

  return [];
}

function parseCrawlerResult(result) {
  if (result.ok === true) {
    return {
      kind: "success",
      title: "Crawler finished",
      description: summarizeCrawlerResult(result)
    };
  }

  if (result.ok === false) {
    const reason = String(result.reason || result.error || "").toLowerCase();

    if (
      reason.includes("no_slot") ||
      reason.includes("no slot") ||
      reason.includes("no available")
    ) {
      return {
        kind: "running",
        title: "Checking available time slots",
        description: buildLastAttemptDescription(
          "No available slot in selected preferred windows."
        )
      };
    }

    return {
      kind: "error",
      title: "Crawler failed",
      description: result.error || result.reason || "The crawler finished with an error."
    };
  }

  return {
    kind: "success",
    title: "Crawler result returned",
    description: summarizeCrawlerResult(result)
  };
}

function summarizeCrawlerResult(result) {
  if (!result) {
    return "No result returned.";
  }

  if (result.reason === "stopped_by_user") {
    return "The crawler was stopped by the user.";
  }

  if (result.safe_mode || result.safeMode) {
    return "Safe mode was enabled, so no final booking action was submitted.";
  }

  if (result.message) {
    return String(result.message);
  }

  if (result.reason) {
    return `Result reason: ${result.reason}`;
  }

  if (result.ok === true) {
    return "The crawler completed successfully.";
  }

  return "The crawler returned a result. Open Technical details for the raw response.";
}

function cleanCrawlerLogText(text) {
  return String(text)
    .replace(/^\[[^\]]+\]\s*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getCrawlerStatusClass(status) {
  if (status === "finished" || status === "done" || status === "completed" || status === "success") {
    return "crawler-status-finished";
  }

  if (status === "failed" || status === "error") {
    return "crawler-status-failed";
  }

  if (status === "stopped" || status === "cancelled") {
    return "crawler-status-stopped";
  }

  return "crawler-status-running";
}

function getCrawlerStatusLabel(status) {
  if (status === "stopping") {
    return "Stopping";
  }

  if (status === "finished" || status === "done" || status === "completed" || status === "success") {
    return "Finished";
  }

  if (status === "failed" || status === "error") {
    return "Failed";
  }

  if (status === "stopped" || status === "cancelled") {
    return "Stopped";
  }

  return "Running";
}

function getCrawlerStatusTitle(status, result) {
  if (status === "stopping") {
    return "The crawler is stopping.";
  }
  if (status === "failed" || status === "error") {
    return "The crawler could not complete the request.";
  }

  if (status === "stopped" || status === "cancelled") {
    return "The crawler was stopped.";
  }

  if (status === "finished" || status === "done" || status === "completed" || status === "success") {
    if (result && result.safe_mode) {
      return "The crawler finished in safe mode.";
    }

    return "The crawler finished.";
  }

  return "The crawler is currently running.";
}

function getCrawlerStatusDescription(status, result, jobId) {
  const idText = jobId ? `Job ID: ${jobId}. ` : "";

  if (status === "failed" || status === "error") {
    const errorText = result && (result.error || result.reason)
      ? `${result.error || result.reason}`
      : "Check the technical details for the raw error.";

    return `${idText}${errorText}`;
  }

  if (status === "finished" || status === "done" || status === "completed" || status === "success") {
    return `${idText}${summarizeCrawlerResult(result)}`;
  }

  if (status === "stopping") {
    return `${idText}Stop request has been sent. Waiting for the crawler to exit safely.`;
  }

  if (status === "stopped" || status === "cancelled") {
    return `${idText}The stop request has been processed.`;
  }

  return `${idText}Progress will update automatically.`;
}

function getTimelineIcon(kind) {
  if (kind === "success") {
    return "✓";
  }

  if (kind === "error") {
    return "!";
  }

  if (kind === "warning") {
    return "!";
  }

  return "…";
}

function buildCrawlerPayload() {
  return {
    bco: valueOf("crawlerBco"),
    inspectionValue: valueOf("crawlerInspectionType"),

    preferredSlots: crawlerTimeSlots.map((slot) => ({
      preferredDate: slot.date,
      preferredWindow: slot.window
    })),

    contactOverride: {
      name: valueOf("contactName"),
      mobile: valueOf("contactMobile"),
      email: valueOf("contactEmail"),
      notes: valueOf("contactNotes")
    },

    safeMode: checked("safeMode"),
    debugEnabled: checked("debugEnabled")
  };
}

function addTimeSlot() {
  const date = valueOf("preferredDate");
  const windowValue = valueOf("preferredWindow");

  if (!date) {
    showMessage(crawlerMessage, "Please choose a preferred date.", "error");
    return;
  }

  const duplicate = crawlerTimeSlots.some((slot) =>
    slot.date === date && slot.window === windowValue
  );

  if (duplicate) {
    showMessage(crawlerMessage, "This time slot has already been added.", "error");
    return;
  }

  crawlerTimeSlots.push({
    date: date,
    window: windowValue
  });

  renderTimeSlots();
  showMessage(crawlerMessage, "Time slot added.", "ok");
}

function renderTimeSlots() {
  selectedTimeSlots.innerHTML = "";

  crawlerTimeSlots.forEach((slot, index) => {
    const chip = document.createElement("div");
    chip.className = "time-slot-chip";

    chip.innerHTML = `
      <span>${formatTimeSlotLabel(slot)}</span>
      <button type="button" class="time-slot-remove" aria-label="Remove time slot">×</button>
    `;

    chip.querySelector(".time-slot-remove").addEventListener("click", () => {
      crawlerTimeSlots.splice(index, 1);
      renderTimeSlots();
    });

    selectedTimeSlots.appendChild(chip);
  });
}

function formatTimeSlotLabel(slot) {
  const windowLabels = {
    morning: "Morning",
    afternoon: "Afternoon",
    full_day: "Full day"
  };

  return `${slot.date} · ${windowLabels[slot.window] || slot.window}`;
}

async function loadSavedAdminAuth() {
  const adminUsername = sessionStorage.getItem("qa_admin_username");
  const adminPassword = sessionStorage.getItem("qa_admin_password");

  if (adminUsername) {
    setValue("adminUsername", adminUsername);
  }

  if (adminPassword) {
    setValue("adminPassword", adminPassword);
  }

  updateAdminStatus();

  if (adminUsername && adminPassword) {
    await loadAdminCrawlerSettings();
    await loadActiveCrawlerJob();
  }
}

async function loadActiveCrawlerJob(options = {}) {
  const silentWhenNone = Boolean(options.silentWhenNone);

  const adminUsername = sessionStorage.getItem("qa_admin_username");
  const adminPassword = sessionStorage.getItem("qa_admin_password");

  if (!adminUsername || !adminPassword) {
    return false;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/webapi/CrawlerJobs/Active`, {
      method: "GET",
      headers: {
        "Authorization": `Basic ${btoa(`${adminUsername}:${adminPassword}`)}`
      }
    });

    const text = await response.text();

    if (response.status === 404) {
      if (!silentWhenNone) {
        showMessage(crawlerMessage, "Active crawler endpoint has not been added yet.", "error");
      }
      return false;
    }

    if (response.status === 401 || response.status === 403) {
      if (!silentWhenNone) {
        showMessage(crawlerMessage, "Admin permission required.", "error");
      }
      return false;
    }

    if (!response.ok) {
      if (!silentWhenNone) {
        showMessage(crawlerMessage, `Could not check active crawler (${response.status}): ${text}`, "error");
      }
      return false;
    }

    let data;

    try {
      data = JSON.parse(text);
    } catch {
      if (!silentWhenNone) {
        showMessage(crawlerMessage, "Active crawler response was not JSON.", "error");
      }
      return false;
    }

    const job = data.job || null;

    if (!data.has_active_job || !job) {
      currentCrawlerJobId = null;
      localStorage.removeItem("qa_current_crawler_job_id");
      return false;
    }

    currentCrawlerJobId = job.job_id || job.jobId || job.id;

    if (!currentCrawlerJobId) {
      return false;
    }

    localStorage.setItem("qa_current_crawler_job_id", currentCrawlerJobId);

    renderCrawlerJob(job);
    startCrawlerPolling(currentCrawlerJobId);

    if (!silentWhenNone) {
      showMessage(crawlerMessage, "An active crawler job was found for this admin account.", "ok");
    }

    return true;
  } catch {
    if (!silentWhenNone) {
      showMessage(crawlerMessage, "Could not connect to backend to check active crawler.", "error");
    }
    return false;
  }
}

function clearAdminAuth() {
  clearAdminSavedAuth();
  setValue("adminUsername", "");
  setValue("adminPassword", "");
  showMessage(adminLoginMessage, "Cleared admin sign-in details.", "ok");
}

function clearAdminSavedAuth() {
  sessionStorage.removeItem("qa_admin_username");
  sessionStorage.removeItem("qa_admin_password");
  updateAdminStatus();
}

function updateAdminStatus() {
  const adminUsername = sessionStorage.getItem("qa_admin_username");

  if (adminUsername) {
    adminStatus.textContent = `Admin: ${adminUsername}`;
    adminStatus.classList.add("signed-in");
    openAdminLoginBtn.textContent = "Switch admin";
    adminRequiredCard.classList.add("hidden");
    crawlerPanel.classList.remove("hidden");
  } else {
    adminStatus.textContent = "Admin: not signed in";
    adminStatus.classList.remove("signed-in");
    openAdminLoginBtn.textContent = "Admin sign in";
    adminRequiredCard.classList.remove("hidden");
    crawlerPanel.classList.add("hidden");
    crawlerLogCard.classList.add("hidden");
  }
}

function setDefaultDate() {
  const input = document.getElementById("preferredDate");

  if (!input) {
    return;
  }

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  input.value = tomorrow.toISOString().slice(0, 10);
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

function checked(id) {
  const element = document.getElementById(id);
  return element ? element.checked : false;
}

function showMessage(element, text, type) {
  if (!element) {
    return;
  }

  element.textContent = text;
  element.className = `message ${type}`;
}


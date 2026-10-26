const API_BASE_URL = "http://localhost:5237";

const crawlerJobs = new Map();
let crawlerPollTimer = null;
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
const crawlerJobsContainer = document.getElementById("crawlerJobsContainer");

const addTimeSlotBtn = document.getElementById("addTimeSlotBtn");
const selectedTimeSlots = document.getElementById("selectedTimeSlots");

const crawlerSettingsDetails = document.getElementById("crawlerSettingsDetails");
const crawlerSettingsForm = document.getElementById("crawlerSettingsForm");
const crawlerSettingsMessage = document.getElementById("crawlerSettingsMessage");
const councilPasswordSavedMessage = document.getElementById("councilPasswordSavedMessage");

document.addEventListener("DOMContentLoaded", init);

function init() {
  localStorage.removeItem("qa_current_crawler_job_id");
  loadSavedAdminAuth();
  setDefaultDate();

  openAdminLoginBtn.addEventListener("click", () => adminLoginDialog.showModal());
  closeAdminLoginBtn.addEventListener("click", () => adminLoginDialog.close());

  adminLoginForm.addEventListener("submit", handleAdminLogin);
  clearAdminBtn.addEventListener("click", clearAdminAuth);

  crawlerForm.addEventListener("submit", handleStartCrawler);
  crawlerSettingsForm.addEventListener("submit", handleSaveCrawlerSettings);
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

    stopCrawlerPolling();
    crawlerJobs.clear();
    renderCrawlerJobs();
    updateAdminStatus();
    showMessage(adminLoginMessage, "Admin signed in successfully.", "ok");
    adminLoginDialog.close();

    await loadAdminCrawlerSettings();
    await loadActiveCrawlerJobs();
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

  if (crawlerTimeSlots.length === 0) {
    showMessage(crawlerMessage, "Please add at least one preferred time slot.", "error");
    return;
  }

  const payload = buildCrawlerPayload();

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

    if (response.status === 401 || response.status === 403) {
      showMessage(crawlerMessage, "Admin permission required.", "error");
      return;
    }

    if (!response.ok) {
      let detail = text;
      try {
        const parsed = JSON.parse(text);
        detail = parsed.detail || parsed.message || text;
      } catch {
        // Keep plain-text response.
      }

      showMessage(crawlerMessage, `Crawler failed to start (${response.status}): ${detail}`, "error");
      return;
    }

    let result;
    try {
      result = JSON.parse(text);
    } catch {
      showMessage(crawlerMessage, text || "Crawler started, but response was not JSON.", "ok");
      return;
    }

    const jobId = result.job_id || result.jobId || result.id;

    if (!jobId) {
      showMessage(crawlerMessage, "Crawler started, but no job_id was returned.", "error");
      return;
    }

    crawlerJobs.set(jobId, {
      ...result,
      job_id: jobId,
      bco: result.bco || payload.bco,
      inspection_value: result.inspection_value || payload.inspectionValue,
      preferred_slots: payload.preferredSlots || []
    });

    renderCrawlerJobs();
    ensureCrawlerPolling();

    const activeCount = [...crawlerJobs.values()].filter((job) => !isTerminalCrawlerStatus(job.status)).length;
    showMessage(crawlerMessage, `Crawler started for ${payload.bco}. ${activeCount} crawler(s) currently active.`, "ok");
  } catch {
    showMessage(crawlerMessage, "Cannot connect to backend crawler endpoint.", "error");
  }
}

async function handleStopCrawler(jobId) {
  const adminUsername = sessionStorage.getItem("qa_admin_username");
  const adminPassword = sessionStorage.getItem("qa_admin_password");

  if (!adminUsername || !adminPassword) {
    showMessage(crawlerMessage, "Please sign in as admin first.", "error");
    return;
  }

  if (!jobId) {
    return;
  }

  const current = crawlerJobs.get(jobId);
  if (current && isTerminalCrawlerStatus(current.status)) {
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/webapi/CrawlerJobs/${encodeURIComponent(jobId)}/Stop`, {
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

    crawlerJobs.set(jobId, {
      ...(current || { job_id: jobId }),
      status: "stopping",
      stop_requested: true
    });

    renderCrawlerJobs();
    ensureCrawlerPolling();
    showMessage(crawlerMessage, `Stop request sent for ${current?.bco || jobId}.`, "ok");
  } catch {
    showMessage(crawlerMessage, "Cannot connect to backend stop endpoint.", "error");
  }
}

function ensureCrawlerPolling() {
  if (crawlerPollTimer) {
    return;
  }

  pollCrawlerJobs();
  crawlerPollTimer = window.setInterval(pollCrawlerJobs, 2000);
}

function stopCrawlerPolling() {
  if (crawlerPollTimer) {
    window.clearInterval(crawlerPollTimer);
    crawlerPollTimer = null;
  }
}

async function pollCrawlerJobs() {
  const activeJobIds = [...crawlerJobs.entries()]
    .filter(([, job]) => !isTerminalCrawlerStatus(job.status))
    .map(([jobId]) => jobId);

  if (activeJobIds.length === 0) {
    stopCrawlerPolling();
    renderCrawlerJobs();
    return;
  }

  await Promise.all(activeJobIds.map((jobId) => pollCrawlerJob(jobId)));
  renderCrawlerJobs();

  const stillActive = [...crawlerJobs.values()].some((job) => !isTerminalCrawlerStatus(job.status));
  if (!stillActive) {
    stopCrawlerPolling();
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
      const existing = crawlerJobs.get(jobId) || { job_id: jobId };

      if (response.status === 404) {
        crawlerJobs.set(jobId, {
          ...existing,
          status: "failed",
          result: {
            ok: false,
            reason: "job_not_found",
            error: "This crawler job is no longer available. The crawler service may have restarted."
          },
          poll_error: null
        });
      } else {
        crawlerJobs.set(jobId, {
          ...existing,
          poll_error: `Polling failed (${response.status}): ${text}`
        });
      }
      return;
    }

    const data = JSON.parse(text);
    const existing = crawlerJobs.get(jobId) || {};

    crawlerJobs.set(jobId, {
      ...existing,
      ...data,
      job_id: data.job_id || data.jobId || jobId,
      preferred_slots: existing.preferred_slots || []
    });
  } catch {
    const existing = crawlerJobs.get(jobId) || { job_id: jobId };
    crawlerJobs.set(jobId, {
      ...existing,
      poll_error: "Could not poll crawler job."
    });
  }
}

function isTerminalCrawlerStatus(status) {
  const value = String(status || "").toLowerCase();
  return ["done", "finished", "completed", "success", "failed", "error", "stopped", "cancelled"].includes(value);
}

function renderCrawlerJobs() {
  if (!crawlerJobsContainer) {
    return;
  }

  crawlerJobsContainer.innerHTML = "";

  const jobs = [...crawlerJobs.values()].sort((a, b) => {
    const aTime = String(a.created_at || "");
    const bTime = String(b.created_at || "");
    return bTime.localeCompare(aTime);
  });

  if (jobs.length === 0) {
    crawlerLogCard.classList.add("hidden");
    return;
  }

  crawlerLogCard.classList.remove("hidden");

  jobs.forEach((job) => {
    crawlerJobsContainer.appendChild(createCrawlerJobCard(job));
  });
}

function createCrawlerJobCard(job) {
  const jobId = job.job_id || job.jobId || job.id || "";
  const status = String(job.status || "unknown").toLowerCase();
  const logs = normalizeCrawlerLogs(job.logs || job.log || []);
  const result = job.result || job.output || null;
  const liveStatus = getCrawlerLiveStatus(logs, result, status, job.poll_error);

  const card = document.createElement("div");
  card.className = "crawler-status-card";
  card.dataset.jobId = jobId;

  const pill = document.createElement("div");
  pill.className = `crawler-status-pill ${getCrawlerStatusClass(status)}`;
  pill.textContent = getCrawlerStatusLabel(status);
  card.appendChild(pill);

  const title = document.createElement("h3");
  const bco = job.bco || "Crawler job";
  const inspection = job.inspection_value || job.inspectionValue || "";
  title.textContent = inspection ? `${bco} · ${getInspectionTypeLabel(inspection)}` : bco;
  card.appendChild(title);

  const meta = document.createElement("p");
  meta.className = "hint";
  const windows = formatJobWindows(job);
  meta.textContent = windows ? `Preferred: ${windows}` : `Job ID: ${jobId}`;
  card.appendChild(meta);

  const timeline = document.createElement("div");
  timeline.className = "crawler-timeline";
  timeline.appendChild(createTimelineItem(liveStatus.kind, liveStatus.title, liveStatus.description));
  card.appendChild(timeline);

  if (!isTerminalCrawlerStatus(status)) {
    const buttonRow = document.createElement("div");
    buttonRow.className = "button-row";

    const stopButton = document.createElement("button");
    stopButton.type = "button";
    stopButton.className = "secondary";
    stopButton.textContent = status === "stopping" ? "Stopping…" : "Stop crawler";
    stopButton.disabled = status === "stopping";
    stopButton.addEventListener("click", () => handleStopCrawler(jobId));

    buttonRow.appendChild(stopButton);
    card.appendChild(buttonRow);
  }

  const details = document.createElement("details");
  details.className = "crawler-details raw-log-details";

  const summary = document.createElement("summary");
  summary.textContent = "Technical details";

  const pre = document.createElement("pre");
  pre.className = "json-preview";
  pre.textContent = JSON.stringify(job, null, 2);

  details.appendChild(summary);
  details.appendChild(pre);
  card.appendChild(details);

  return card;
}

function getCrawlerLiveStatus(logs, result, status, pollError) {
  if (pollError) {
    return {
      kind: "warning",
      title: "Progress update delayed",
      description: pollError
    };
  }

  if (result) {
    return parseCrawlerResult(result, status);
  }

  if (status === "stopping") {
    return {
      kind: "warning",
      title: "Crawler is stopping",
      description: "Stop request sent. The current browser operation will exit safely."
    };
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

  if (lower.includes("start stagger")) {
    return {
      kind: "running",
      title: "Crawler is queued to start",
      description: cleanCrawlerLogText(latestLog)
    };
  }

  if (lower.includes("no_slot") || lower.includes("no slot") || lower.includes("no available") || lower.includes("no availability")) {
    return {
      kind: "running",
      title: "Checking available time slots",
      description: buildLastAttemptDescription("No available slot in selected preferred windows.")
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

function normalizeCrawlerLogs(logs) {
  if (Array.isArray(logs)) {
    return logs.map((line) => String(line)).filter((line) => line.trim().length > 0);
  }

  if (typeof logs === "string" && logs.trim().length > 0) {
    return logs.split("\n").filter((line) => line.trim().length > 0);
  }

  return [];
}

function getLatestUsefulCrawlerLog(logs) {
  for (let i = logs.length - 1; i >= 0; i--) {
    const line = String(logs[i]).trim();
    if (line.length > 0) {
      return line;
    }
  }
  return "";
}

function parseCrawlerResult(result, status) {
  if (result.reason === "stopped_by_user" || status === "stopped") {
    return {
      kind: "warning",
      title: "Crawler stopped",
      description: "The crawler was stopped by the user."
    };
  }

  if (result.ok === true) {
    return {
      kind: "success",
      title: result.reason === "FINAL_SUBMITTED" ? "Booking submitted" : "Crawler finished",
      description: summarizeCrawlerResult(result)
    };
  }

  if (result.ok === false) {
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

  if (result.reason === "FINAL_SUBMITTED") {
    const ref = result.booking_reference || result.bookingReference;
    return ref ? `Booking submitted. Reference: ${ref}.` : "Booking submitted successfully.";
  }

  if (result.reason === "SAFE_MODE_STOPPED_ON_SUMMARY") {
    return "Safe mode reached the booking summary without submitting the final booking.";
  }

  if (result.reason === "stopped_by_user") {
    return "The crawler was stopped by the user.";
  }

  if (result.message) {
    return String(result.message);
  }

  if (result.reason) {
    return `Result reason: ${result.reason}`;
  }

  return result.ok === true ? "The crawler completed successfully." : "The crawler returned a result.";
}

function getCrawlerStatusClass(status) {
  if (["finished", "done", "completed", "success"].includes(status)) {
    return "crawler-status-finished";
  }
  if (["failed", "error"].includes(status)) {
    return "crawler-status-failed";
  }
  if (["stopped", "cancelled"].includes(status)) {
    return "crawler-status-stopped";
  }
  return "crawler-status-running";
}

function getCrawlerStatusLabel(status) {
  if (status === "stopping") return "Stopping";
  if (["finished", "done", "completed", "success"].includes(status)) return "Finished";
  if (["failed", "error"].includes(status)) return "Failed";
  if (["stopped", "cancelled"].includes(status)) return "Stopped";
  return "Running";
}

function createTimelineItem(kind, title, description) {
  const item = document.createElement("div");
  item.className = `crawler-timeline-item ${kind}`;

  const icon = document.createElement("div");
  icon.className = "crawler-timeline-icon";
  icon.textContent = kind === "success" ? "✓" : kind === "error" || kind === "warning" ? "!" : "…";

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

function buildLastAttemptDescription(reason) {
  return `Last attempt: ${formatCurrentDateTime()}. \nReason: ${reason}`;
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

function cleanCrawlerLogText(text) {
  return String(text).replace(/^\[[^\]]+\]\s*/g, "").replace(/\s+/g, " ").trim();
}

function getInspectionTypeLabel(value) {
  const labels = {
    IME: "Site meeting (IME)",
    ICL: "Cladding (ICL)",
    IFG: "Framing (IFG)",
    IPB: "Preline building (IPB)",
    ISF: "Concrete floor slab (ISF)",
    IFO: "Foundations / footings (IFO)",
    IF1: "Final inspection - residential (IF1)",
    IF2: "Final inspection - commercial (IF2)",
    ICB: "Concrete block (ICB)",
    ITK: "Waterproofing membrane (ITK)",
    ICA: "Cavity wrap (ICA)",
    IPP: "Plumbing (IPP)",
    IPL: "Postline (IPL)",
    IDT: "Drainage (IDT)",
    CPU: "Certificate of public use (CPU)",
    PCO: "Pre-construction commercial (PCO)"
  };
  return labels[value] || value;
}

function formatJobWindows(job) {
  if (Array.isArray(job.preferred_slots) && job.preferred_slots.length > 0) {
    return job.preferred_slots.map(formatTimeSlotLabel).join(", ");
  }

  if (Array.isArray(job.prefer_windows) && job.prefer_windows.length > 0) {
    return job.prefer_windows.map(formatRawPreferWindow).join(", ");
  }

  return "";
}

function formatRawPreferWindow(raw) {
  const match = String(raw || "").match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})T(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})$/);
  if (!match) {
    return String(raw || "");
  }

  const [, y, m, d, sh, sm, , , , eh, em] = match;
  return `${y}-${m}-${d} ${sh}:${sm}-${eh}:${em}`;
}

function buildCrawlerPayload() {
  return {
    bco: valueOf("crawlerBco"),
    inspectionValue: valueOf("crawlerInspectionType"),

    preferredSlots: crawlerTimeSlots.map((slot) => ({
      preferredDate: slot.date,
      preferredWindow: slot.window
    })),

    readyEarlier: checked("readyEarlier"),

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
    await loadActiveCrawlerJobs();
  }
}

async function loadActiveCrawlerJobs(options = {}) {
  const silentWhenNone = Boolean(options.silentWhenNone);
  const adminUsername = sessionStorage.getItem("qa_admin_username");
  const adminPassword = sessionStorage.getItem("qa_admin_password");

  if (!adminUsername || !adminPassword) {
    return 0;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/webapi/CrawlerJobs/Active`, {
      method: "GET",
      headers: {
        "Authorization": `Basic ${btoa(`${adminUsername}:${adminPassword}`)}`
      }
    });

    const text = await response.text();

    if (response.status === 401 || response.status === 403) {
      if (!silentWhenNone) {
        showMessage(crawlerMessage, "Admin permission required.", "error");
      }
      return 0;
    }

    if (!response.ok) {
      if (!silentWhenNone) {
        showMessage(crawlerMessage, `Could not check active crawlers (${response.status}): ${text}`, "error");
      }
      return 0;
    }

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      if (!silentWhenNone) {
        showMessage(crawlerMessage, "Active crawler response was not JSON.", "error");
      }
      return 0;
    }

    const activeJobs = Array.isArray(data.jobs)
      ? data.jobs
      : (data.job ? [data.job] : []);

    activeJobs.forEach((job) => {
      const jobId = job.job_id || job.jobId || job.id;
      if (!jobId) {
        return;
      }

      const existing = crawlerJobs.get(jobId) || {};
      crawlerJobs.set(jobId, {
        ...existing,
        ...job,
        job_id: jobId
      });
    });

    renderCrawlerJobs();

    if (activeJobs.length > 0) {
      ensureCrawlerPolling();
      if (!silentWhenNone) {
        showMessage(crawlerMessage, `${activeJobs.length} active crawler job(s) restored.`, "ok");
      }
    }

    return activeJobs.length;
  } catch {
    if (!silentWhenNone) {
      showMessage(crawlerMessage, "Could not connect to backend to check active crawlers.", "error");
    }
    return 0;
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
  stopCrawlerPolling();
  crawlerJobs.clear();
  renderCrawlerJobs();
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


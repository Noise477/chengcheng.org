const API_BASE_URL = "https://api.chengcheng.org";

let selectedPhotos = [];

const inspectionTypes = [
  { code: "PCO", label: "Pre-construction meeting" },
  { code: "IME", label: "Site meeting" },
  { code: "IFO", label: "Foundations / siting / piles / footings" },
  { code: "ICB", label: "Concrete block / reinforced concrete" },
  { code: "ISF", label: "Concrete floor slab" },
  { code: "IFG", label: "Framing" },
  { code: "ICA", label: "Wrap and cavity" },
  { code: "ICL", label: "Cladding" },
  { code: "IPB", label: "Preline building" },
  { code: "IPP", label: "Preline / under-slab plumbing" },
  { code: "IPL", label: "Post line" },
  { code: "ITK", label: "Waterproofing / membrane / tanking" },
  { code: "IDT", label: "Drainage" },
  { code: "ARE", label: "Audit residential" },
  { code: "ACO", label: "Audit commercial" },
  { code: "IF1", label: "Final inspection - residential" },
  { code: "IF2", label: "Final inspection - commercial" },
  { code: "SWP", label: "Pool fencing" },
  { code: "CPU", label: "Certificate for Public Use" }
];

const documentTypes = [
  "Approved plans",
  "Site-specific report",
  "Geotech report",
  "Fire report",
  "Producer Statement PS1",
  "Producer Statement PS3",
  "Producer Statement PS4",
  "Record of Building Work",
  "Certificate of Design Work",
  "As-built drainage plan",
  "Membrane manufacturer warranty",
  "Flood test evidence",
  "QA photos",
  "Engineer site observation",
  "Other"
];

const userStatus = document.getElementById("userStatus");
const adminStatus = document.getElementById("adminStatus");

const userLoginDialog = document.getElementById("userLoginDialog");
const adminLoginDialog = document.getElementById("adminLoginDialog");

const openUserLoginBtn = document.getElementById("openUserLoginBtn");
const openAdminLoginBtn = document.getElementById("openAdminLoginBtn");
const closeUserLoginBtn = document.getElementById("closeUserLoginBtn");
const closeAdminLoginBtn = document.getElementById("closeAdminLoginBtn");

const userLoginForm = document.getElementById("userLoginForm");
const adminLoginForm = document.getElementById("adminLoginForm");
const reportForm = document.getElementById("reportForm");

const userLoginMessage = document.getElementById("userLoginMessage");
const adminLoginMessage = document.getElementById("adminLoginMessage");
const uploadMessage = document.getElementById("uploadMessage");

const reportKind = document.getElementById("reportKind");
const reportTypeHint = document.getElementById("reportTypeHint");
const inspectionWarning = document.getElementById("inspectionWarning");
const jsonPreview = document.getElementById("jsonPreview");

const checklistContainer = document.getElementById("checklistContainer");
const documentsContainer = document.getElementById("documentsContainer");
const minorVariationContainer = document.getElementById("minorVariationContainer");

const reportTypeHints = {
  Full: "Full report includes the complete inspection form, checklist items, documents, variations, and photos.",
  Daily: "Daily report only requires BCO number, inspection date/time, optional address, and photos with descriptions.",
  EmailRecord: "Email retention stores the same basic evidence as a daily report, plus Email to and Title. Actual sending can be added later."
};

document.addEventListener("DOMContentLoaded", init);

function init() {
  populateInspectionTypeOptions();
  populateNextInspectionOptions();
  setDefaultDateTime();
  loadSavedAuth();

  addChecklistRow("", "", "");
  addDocumentRow("", "", "", "");
  addMinorVariationRow("", "Pending", "");

  openUserLoginBtn.addEventListener("click", () => userLoginDialog.showModal());
  openAdminLoginBtn.addEventListener("click", () => adminLoginDialog.showModal());
  closeUserLoginBtn.addEventListener("click", () => userLoginDialog.close());
  closeAdminLoginBtn.addEventListener("click", () => adminLoginDialog.close());

  userLoginForm.addEventListener("submit", handleUserLogin);
  adminLoginForm.addEventListener("submit", handleAdminLogin);
  reportForm.addEventListener("submit", handleUpload);

  document.getElementById("clearUserBtn").addEventListener("click", clearUserAuth);
  document.getElementById("clearAdminBtn").addEventListener("click", clearAdminAuth);
  document.getElementById("fillReportSampleBtn").addEventListener("click", fillReportSample);
  document.getElementById("previewJsonBtn").addEventListener("click", previewJson);

  document.getElementById("addChecklistBtn").addEventListener("click", () => addChecklistRow());
  document.getElementById("addDocumentBtn").addEventListener("click", () => addDocumentRow());
  document.getElementById("addMinorVariationBtn").addEventListener("click", () => addMinorVariationRow());

  document.getElementById("addSelectedPhotosBtn").addEventListener("click", addSelectedPhotos);
  document.getElementById("clearPhotosBtn").addEventListener("click", clearSelectedPhotos);

  reportKind.addEventListener("change", updateReportModeUI);
  document.getElementById("scope").addEventListener("change", updateInspectionWarning);
  document.getElementById("inspectionOutcome").addEventListener("change", updateInspectionWarning);
  document.getElementById("siteSafety").addEventListener("change", updateSiteSafetyWarning);

  updateReportModeUI();
  updateInspectionWarning();
  updateSiteSafetyWarning();
}

async function handleUserLogin(event) {
  event.preventDefault();

  const username = valueOf("userUsername");
  const password = valueOf("userPassword");

  if (!username || !password) {
    showMessage(userLoginMessage, "Please enter username and password.", "error");
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
      clearUserSavedAuth();
      showMessage(userLoginMessage, "Invalid user username or password.", "error");
      return;
    }

    sessionStorage.setItem("qa_user_username", username);
    sessionStorage.setItem("qa_user_password", password);

    updateAuthStatus();
    showMessage(userLoginMessage, "User signed in successfully.", "ok");
    userLoginDialog.close();
  } catch {
    showMessage(userLoginMessage, "Cannot connect to backend. Check dotnet run and CORS.", "error");
  }
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

    updateAuthStatus();
    showMessage(adminLoginMessage, "Admin signed in successfully.", "ok");
    adminLoginDialog.close();
  } catch {
    showMessage(adminLoginMessage, "Cannot connect to backend. Check dotnet run and CORS.", "error");
  }
}

async function handleUpload(event) {
  event.preventDefault();

  const username = sessionStorage.getItem("qa_user_username");
  const password = sessionStorage.getItem("qa_user_password");

  if (!username || !password) {
    showMessage(uploadMessage, "Please sign in as user before uploading.", "error");
    return;
  }

  const validation = validateReport();

  if (!validation.ok) {
    showMessage(uploadMessage, validation.message, "error");
    return;
  }

  const reportData = buildReportData();

  const formData = new FormData();
  formData.append("reportJson", JSON.stringify(reportData));

  const descriptions = selectedPhotos.map((item) => item.description || "");
  formData.append("photoDescriptionsJson", JSON.stringify(descriptions));

  selectedPhotos.forEach((item) => {
    formData.append("photos", item.file, item.file.name);
  });

  try {
    const response = await fetch(`${API_BASE_URL}/webapi/UploadReportWithPhotos`, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${btoa(`${username}:${password}`)}`
      },
      body: formData
    });

    const text = await response.text();

    if (response.status === 401 || response.status === 403) {
      showMessage(uploadMessage, "Upload rejected: invalid user sign-in or insufficient permission.", "error");
      return;
    }

    if (!response.ok) {
      showMessage(uploadMessage, `Upload failed (${response.status}): ${text}`, "error");
      return;
    }

    showMessage(uploadMessage, text || "Report uploaded successfully.", "ok");
    clearSelectedPhotos(false);
  } catch {
    showMessage(uploadMessage, "Cannot connect to backend. Check CORS and backend URL.", "error");
  }
}

function buildReportData() {
  const kind = valueOf("reportKind");
  const isFull = kind === "Full";
  const isEmailRecord = kind === "EmailRecord";

  return {
    reportKind: kind,
    emailTo: isEmailRecord ? valueOf("emailTo") : "",
    emailTitle: isEmailRecord ? valueOf("emailTitle") : "",

    inspectionTypeCode: isFull ? valueOf("inspectionTypeCode") : kind,
    inspectionDate: toIsoDateTime(valueOf("inspectionDate")),
    bcoNumber: valueOf("bcoNumber"),
    inspectionAddress: valueOf("inspectionAddress"),

    scope: isFull ? valueOf("scope") : "N/A",
    partialDescription: isFull ? valueOf("partialDescription") : "",
    siteSafety: isFull ? valueOf("siteSafety") : "N/A",

    consentDocumentsOnSite: isFull ? boolOf("consentDocumentsOnSite") : false,
    previousInspectionHistoryChecked: isFull ? boolOf("previousInspectionHistoryChecked") : false,
    involvesRestrictedBuildingWork: isFull ? boolOf("involvesRestrictedBuildingWork") : false,

    inspectionSummary: isFull ? valueOf("inspectionSummary") : "",
    additionalComments: isFull ? valueOf("additionalComments") : "",
    itemsResolvedFromHistory: isFull ? valueOf("itemsResolvedFromHistory") : "",
    itemsToBeResolved: isFull ? valueOf("itemsToBeResolved") : "",

    inspectionOutcome: isFull ? valueOf("inspectionOutcome") : "N/A",
    workCompletedInAccordanceWithPlans: isFull ? boolOf("workCompletedInAccordanceWithPlans") : false,

    personOnSiteName: isFull ? valueOf("personOnSiteName") : "",
    recipientEmail: isFull ? valueOf("recipientEmail") : "",

    inspectorName: isFull ? valueOf("inspectorName") : "",
    inspectorEmail: isFull ? valueOf("inspectorEmail") : "",
    inspectorPhoneNumber: isFull ? valueOf("inspectorPhoneNumber") : "",

    inspectionDurationMinutes: isFull ? numberOrNull("inspectionDurationMinutes") : null,
    nextInspectionRequired: isFull ? valueOf("nextInspectionRequired") : "",

    checklistItems: isFull ? getChecklistItems() : [],
    requiredDocuments: isFull ? getRequiredDocuments() : [],
    minorVariations: isFull ? getMinorVariations() : [],
    photos: []
  };
}

function validateReport() {
  const kind = valueOf("reportKind");
  const required = [
    ["reportKind", "Report type is required."],
    ["inspectionDate", "Inspection date is required."],
    ["bcoNumber", "BCO number is required."]
  ];

  if (kind === "Full") {
    required.push(["inspectionTypeCode", "Inspection type is required."]);
    required.push(["inspectionSummary", "Inspection summary is required for a full report."]);
  }

  if (kind === "EmailRecord") {
    required.push(["emailTo", "Email to is required for Email retention."]);
    required.push(["emailTitle", "Title is required for Email retention."]);
  }

  for (const [id, message] of required) {
    if (!valueOf(id)) {
      return { ok: false, message };
    }
  }

  if (!/^BCO\d{8}$/.test(valueOf("bcoNumber"))) {
    return { ok: false, message: "BCO number should look like BCO10381810." };
  }

  if (kind === "EmailRecord" && !isLikelyEmail(valueOf("emailTo"))) {
    return { ok: false, message: "Email to should be a valid email address." };
  }

  if ((kind === "Daily" || kind === "EmailRecord") && selectedPhotos.length === 0) {
    return { ok: false, message: "Please add at least one photo for this report type." };
  }

  const inspectionDate = new Date(valueOf("inspectionDate"));

  if (inspectionDate > new Date()) {
    return { ok: false, message: "Inspection date cannot be in the future." };
  }

  if (kind === "Full") {
    const duration = numberOrNull("inspectionDurationMinutes");

    if (duration !== null && (duration < 0 || duration > 480)) {
      return { ok: false, message: "Inspection duration should be between 0 and 480 minutes." };
    }

    if (valueOf("scope") === "Partial" && !valueOf("partialDescription")) {
      return { ok: false, message: "Partial description is required when scope is Partial." };
    }

    if (valueOf("inspectionOutcome") === "Partial Pass" && !valueOf("itemsToBeResolved")) {
      return { ok: false, message: "Items to be resolved is required for Partial Pass." };
    }

    if (valueOf("inspectionOutcome") === "Fail" && !valueOf("itemsToBeResolved")) {
      return { ok: false, message: "Items to be resolved is required for Fail." };
    }
  }

  return { ok: true, message: "" };
}

function updateReportModeUI() {
  const kind = valueOf("reportKind");
  const isFull = kind === "Full";
  const isEmailRecord = kind === "EmailRecord";

  document.querySelectorAll(".full-report-only").forEach((element) => {
    element.classList.toggle("hidden", !isFull);
  });

  document.querySelectorAll(".email-record-only").forEach((element) => {
    element.classList.toggle("hidden", !isEmailRecord);
  });

  reportTypeHint.textContent = reportTypeHints[kind] || "Select a report type.";
  updateInspectionWarning();
}

function updateInspectionWarning() {
  if (valueOf("reportKind") !== "Full") {
    inspectionWarning.classList.add("hidden");
    inspectionWarning.textContent = "";
    return;
  }

  const warnings = [];

  if (valueOf("scope") === "Partial") {
    warnings.push("Partial scope should include a clear partial description.");
  }

  if (valueOf("inspectionOutcome") === "Partial Pass") {
    warnings.push("Partial Pass should state what remains unresolved.");
  }

  if (valueOf("inspectionOutcome") === "Fail") {
    warnings.push("Fail should include items to be resolved.");
  }

  if (warnings.length === 0) {
    inspectionWarning.classList.add("hidden");
    inspectionWarning.textContent = "";
    return;
  }

  inspectionWarning.textContent = warnings.join(" ");
  inspectionWarning.classList.remove("hidden");
}

function updateSiteSafetyWarning() {
  updateInspectionWarning();
}

function populateInspectionTypeOptions() {
  const select = document.getElementById("inspectionTypeCode");
  select.innerHTML = "";

  inspectionTypes.forEach((type) => {
    const option = document.createElement("option");
    option.value = type.code;
    option.textContent = `${type.label} (${type.code})`;
    select.appendChild(option);
  });
}

function populateNextInspectionOptions() {
  const select = document.getElementById("nextInspectionRequired");
  select.innerHTML = "";

  inspectionTypes.forEach((type) => {
    const option = document.createElement("option");
    option.value = type.label;
    option.textContent = `${type.label} (${type.code})`;
    select.appendChild(option);
  });
}

function addChecklistRow(itemName = "", result = "Pass", comment = "") {
  const row = document.createElement("div");
  row.className = "row-4";

  row.innerHTML = `
    <input class="checklist-item-name" type="text" placeholder="Item name" value="${escapeHtml(itemName)}" />
    <select class="checklist-result">
      <option value="Pass">Pass</option>
      <option value="Fail">Fail</option>
      <option value="N/A">N/A</option>
      <option value="Not inspected">Not inspected</option>
    </select>
    <input class="checklist-comment" type="text" placeholder="Comment" value="${escapeHtml(comment)}" />
    <button type="button" class="remove-btn">Remove</button>
  `;

  row.querySelector(".checklist-result").value = result;
  row.querySelector(".remove-btn").addEventListener("click", () => row.remove());

  checklistContainer.appendChild(row);
}

function addDocumentRow(documentName = "Producer Statement PS3", status = "Required", dueStage = "CCC", comment = "") {
  const row = document.createElement("div");
  row.className = "row-5";

  const options = documentTypes
    .map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`)
    .join("");

  row.innerHTML = `
    <select class="document-name">${options}</select>
    <select class="document-status">
      <option value="Received">Received</option>
      <option value="Required">Required</option>
      <option value="To be provided at CCC">To be provided at CCC</option>
      <option value="Not applicable">Not applicable</option>
    </select>
    <select class="document-due-stage">
      <option value="Inspection">Inspection</option>
      <option value="CCC">CCC</option>
      <option value="Before next inspection">Before next inspection</option>
      <option value="N/A">N/A</option>
    </select>
    <input class="document-comment" type="text" placeholder="Comment" value="${escapeHtml(comment)}" />
    <button type="button" class="remove-btn">Remove</button>
  `;

  row.querySelector(".document-name").value = documentName;
  row.querySelector(".document-status").value = status;
  row.querySelector(".document-due-stage").value = dueStage;
  row.querySelector(".remove-btn").addEventListener("click", () => row.remove());

  documentsContainer.appendChild(row);
}

function addMinorVariationRow(description = "", outcome = "Pending", comment = "") {
  const row = document.createElement("div");
  row.className = "row-4";

  row.innerHTML = `
    <input class="mv-description" type="text" placeholder="Description" value="${escapeHtml(description)}" />
    <select class="mv-outcome">
      <option value="Approved">Approved</option>
      <option value="Rejected">Rejected</option>
      <option value="Pending">Pending</option>
      <option value="N/A">N/A</option>
    </select>
    <input class="mv-comment" type="text" placeholder="Outcome reason / comment" value="${escapeHtml(comment)}" />
    <button type="button" class="remove-btn">Remove</button>
  `;

  row.querySelector(".mv-outcome").value = outcome;
  row.querySelector(".remove-btn").addEventListener("click", () => row.remove());

  minorVariationContainer.appendChild(row);
}

function getChecklistItems() {
  return Array.from(document.querySelectorAll("#checklistContainer .row-4"))
    .map((row) => ({
      itemName: row.querySelector(".checklist-item-name").value.trim(),
      result: row.querySelector(".checklist-result").value,
      comment: row.querySelector(".checklist-comment").value.trim()
    }))
    .filter((item) => item.itemName.length > 0);
}

function getRequiredDocuments() {
  return Array.from(document.querySelectorAll("#documentsContainer .row-5"))
    .map((row) => {
      const name = row.querySelector(".document-name").value;
      const status = row.querySelector(".document-status").value;
      const dueStage = row.querySelector(".document-due-stage").value;
      const comment = row.querySelector(".document-comment").value.trim();

      return {
        documentName: name,
        comment: `[${status}; due: ${dueStage}] ${comment}`.trim()
      };
    })
    .filter((doc) => doc.documentName.length > 0);
}

function getMinorVariations() {
  return Array.from(document.querySelectorAll("#minorVariationContainer .row-4"))
    .map((row) => ({
      description: row.querySelector(".mv-description").value.trim(),
      outcome: row.querySelector(".mv-outcome").value,
      outcomeReasonOrComment: row.querySelector(".mv-comment").value.trim()
    }))
    .filter((mv) => mv.description.length > 0);
}

function addSelectedPhotos() {
  const input = document.getElementById("photoFiles");
  const message = document.getElementById("photoMessage");

  if (!input || !input.files || input.files.length === 0) {
    showMessage(message, "Please select at least one photo.", "error");
    return;
  }

  const maxSize = 5 * 1024 * 1024;
  const allowedExtensions = [".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"];

  for (const file of input.files) {
    const lowerName = file.name.toLowerCase();
    const isAllowed = allowedExtensions.some((ext) => lowerName.endsWith(ext));

    if (!isAllowed) {
      showMessage(message, `File type not allowed: ${file.name}`, "error");
      continue;
    }

    if (file.size > maxSize) {
      showMessage(message, `File too large: ${file.name}. Max 5 MB.`, "error");
      continue;
    }

    selectedPhotos.push({
      file: file,
      description: "",
      previewUrl: URL.createObjectURL(file)
    });
  }

  input.value = "";
  renderSelectedPhotos();

  showMessage(message, "Photo(s) added. They will be uploaded when the report is submitted.", "ok");
}

function renderSelectedPhotos() {
  const container = document.getElementById("selectedPhotosList");

  if (!container) {
    return;
  }

  container.innerHTML = "";

  selectedPhotos.forEach((item, index) => {
    const wrapper = document.createElement("div");
    wrapper.className = "selected-photo-row";

    const lowerName = item.file.name.toLowerCase();

    const canPreview =
      lowerName.endsWith(".jpg") ||
      lowerName.endsWith(".jpeg") ||
      lowerName.endsWith(".png") ||
      lowerName.endsWith(".webp");

    const previewHtml = canPreview
      ? `<img class="selected-photo-thumb" src="${item.previewUrl}" alt="Selected photo preview">`
      : `<div class="selected-photo-thumb no-preview">No preview</div>`;

    wrapper.innerHTML = `
      <div class="selected-photo-left">
        ${previewHtml}
      </div>

      <div class="selected-photo-description-panel">
        <div class="selected-photo-row-header">
          <strong>${escapeHtml(item.file.name)}</strong>
          <button type="button" class="selected-photo-remove" aria-label="Remove photo">×</button>
        </div>

        <label>
          Description
          <textarea class="selected-photo-description" rows="4" placeholder="Describe what this photo shows">${escapeHtml(item.description)}</textarea>
        </label>
      </div>
    `;

    const descriptionInput = wrapper.querySelector(".selected-photo-description");

    descriptionInput.addEventListener("input", () => {
      selectedPhotos[index].description = descriptionInput.value.trim();
    });

    wrapper.querySelector(".selected-photo-remove").addEventListener("click", () => {
      URL.revokeObjectURL(selectedPhotos[index].previewUrl);
      selectedPhotos.splice(index, 1);
      renderSelectedPhotos();
    });

    container.appendChild(wrapper);
  });
}

function clearSelectedPhotos(showClearMessage = true) {
  selectedPhotos.forEach((item) => {
    URL.revokeObjectURL(item.previewUrl);
  });

  selectedPhotos = [];

  const input = document.getElementById("photoFiles");

  if (input) {
    input.value = "";
  }

  const list = document.getElementById("selectedPhotosList");

  if (list) {
    list.innerHTML = "";
  }

  if (showClearMessage) {
    showMessage(document.getElementById("photoMessage"), "Cleared selected photos.", "ok");
  }
}

function previewJson() {
  const data = buildReportData();

  data.photos = selectedPhotos.map((item) => ({
    description: item.description,
    fileName: item.file.name,
    contentType: item.file.type,
    sizeBytes: item.file.size
  }));

  jsonPreview.textContent = JSON.stringify(data, null, 2);
  jsonPreview.classList.remove("hidden");
}

function fillReportSample() {
  const kind = valueOf("reportKind");

  setValue("bcoNumber", "BCO10381810");
  setValue("inspectionAddress", "7 Montmere Avenue Te Atatu Peninsula");

  if (kind === "EmailRecord") {
    setValue("emailTo", "recipient@example.com");
    setValue("emailTitle", "Inspection photo record for BCO10381810");
  }

  if (kind !== "Full") {
    showMessage(uploadMessage, "Sample basic report details filled. Add photos before uploading.", "ok");
    return;
  }

  setValue("inspectionTypeCode", "ICL");
  setValue("scope", "Partial");
  setValue("inspectionOutcome", "Partial Pass");
  setValue("partialDescription", "Ground floor check only");
  setValue("siteSafety", "Safe");
  setValue("inspectionDurationMinutes", "20");

  setValue("consentDocumentsOnSite", "true");
  setValue("previousInspectionHistoryChecked", "true");
  setValue("involvesRestrictedBuildingWork", "true");
  setValue("workCompletedInAccordanceWithPlans", "true");

  setValue("inspectionSummary", "Partial ICL inspection for ground floor cladding.");
  setValue("additionalComments", "Sighted approved plans and cladding layout. Fixings and clearances checked.");
  setValue("itemsResolvedFromHistory", "N/A");
  setValue("itemsToBeResolved", "Roof still to be inspected. Upper floor cladding still to inspect.");
  setValue("nextInspectionRequired", "Cladding");

  setValue("personOnSiteName", "Sophia Wang");
  setValue("recipientEmail", "test@example.com");
  setValue("inspectorName", "Lorenzo Roebeck");
  setValue("inspectorEmail", "inspector@example.com");
  setValue("inspectorPhoneNumber", "0273227608");

  checklistContainer.innerHTML = "";
  documentsContainer.innerHTML = "";
  minorVariationContainer.innerHTML = "";
  clearSelectedPhotos(false);

  addChecklistRow("Weather board or sheet cladding layout as per plan", "Pass", "Cement fibre sheet");
  addChecklistRow("Cladding scope", "Pass", "Ground floor");
  addChecklistRow("Cladding fixings", "Pass", "");

  addDocumentRow("Producer Statement PS3", "To be provided at CCC", "CCC", "Internal roof gutters.");
  addDocumentRow("Membrane manufacturer warranty", "To be provided at CCC", "CCC", "Internal roof gutters.");

  addMinorVariationRow(
    "Storm tank under driveway change of product from Aquacomb to APD.",
    "Rejected",
    "Council Development Engineer confirmation required."
  );

  updateInspectionWarning();
  showMessage(uploadMessage, "Sample full report filled.", "ok");
}

function loadSavedAuth() {
  const userUsername = sessionStorage.getItem("qa_user_username");
  const userPassword = sessionStorage.getItem("qa_user_password");
  const adminUsername = sessionStorage.getItem("qa_admin_username");
  const adminPassword = sessionStorage.getItem("qa_admin_password");

  if (userUsername) {
    setValue("userUsername", userUsername);
  }

  if (userPassword) {
    setValue("userPassword", userPassword);
  }

  if (adminUsername) {
    setValue("adminUsername", adminUsername);
  }

  if (adminPassword) {
    setValue("adminPassword", adminPassword);
  }

  updateAuthStatus();
}

function clearUserAuth() {
  clearUserSavedAuth();
  setValue("userUsername", "");
  setValue("userPassword", "");
  showMessage(userLoginMessage, "Cleared user sign-in details.", "ok");
}

function clearAdminAuth() {
  clearAdminSavedAuth();
  setValue("adminUsername", "");
  setValue("adminPassword", "");
  showMessage(adminLoginMessage, "Cleared admin sign-in details.", "ok");
}

function clearUserSavedAuth() {
  sessionStorage.removeItem("qa_user_username");
  sessionStorage.removeItem("qa_user_password");
  updateAuthStatus();
}

function clearAdminSavedAuth() {
  sessionStorage.removeItem("qa_admin_username");
  sessionStorage.removeItem("qa_admin_password");
  updateAuthStatus();
}

function updateAuthStatus() {
  const userUsername = sessionStorage.getItem("qa_user_username");
  const adminUsername = sessionStorage.getItem("qa_admin_username");

  if (userUsername) {
    userStatus.textContent = `User: ${userUsername}`;
    userStatus.classList.add("signed-in");
    openUserLoginBtn.textContent = "Switch user";
  } else {
    userStatus.textContent = "User: not signed in";
    userStatus.classList.remove("signed-in");
    openUserLoginBtn.textContent = "User sign in";
  }

  if (adminUsername) {
    adminStatus.textContent = `Admin: ${adminUsername}`;
    adminStatus.classList.add("signed-in");
    openAdminLoginBtn.textContent = "Switch admin";
  } else {
    adminStatus.textContent = "Admin: not signed in";
    adminStatus.classList.remove("signed-in");
    openAdminLoginBtn.textContent = "Admin sign in";
  }
}

function setDefaultDateTime() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  document.getElementById("inspectionDate").value = now.toISOString().slice(0, 16);
}

function toIsoDateTime(value) {
  if (!value) {
    return new Date().toISOString();
  }

  return new Date(value).toISOString();
}

function isLikelyEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
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

function boolOf(id) {
  return valueOf(id) === "true";
}

function numberOrNull(id) {
  const value = valueOf(id);
  return value === "" ? null : Number(value);
}

function showMessage(element, text, type) {
  if (!element) {
    return;
  }

  element.textContent = text;
  element.className = `message ${type}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

const API_BASE_URL = "https://api.chengcheng.org";

const userStatus = document.getElementById("userStatus");
const adminStatus = document.getElementById("adminStatus");

const openUserLoginBtn = document.getElementById("openUserLoginBtn");
const openAdminLoginBtn = document.getElementById("openAdminLoginBtn");

const userLoginDialog = document.getElementById("userLoginDialog");
const adminLoginDialog = document.getElementById("adminLoginDialog");

const closeUserLoginBtn = document.getElementById("closeUserLoginBtn");
const closeAdminLoginBtn = document.getElementById("closeAdminLoginBtn");

const userLoginForm = document.getElementById("userLoginForm");
const adminLoginForm = document.getElementById("adminLoginForm");

const userLoginMessage = document.getElementById("userLoginMessage");
const adminLoginMessage = document.getElementById("adminLoginMessage");

const clearUserBtn = document.getElementById("clearUserBtn");
const clearAdminBtn = document.getElementById("clearAdminBtn");

const searchAccountType = document.getElementById("searchAccountType");
const reportSearchForm = document.getElementById("reportSearchForm");
const clearSearchBtn = document.getElementById("clearSearchBtn");
const searchMessage = document.getElementById("searchMessage");

const searchResultsCard = document.getElementById("searchResultsCard");
const reportResults = document.getElementById("reportResults");

const reportDetailsCard = document.getElementById("reportDetailsCard");
const reportDetails = document.getElementById("reportDetails");
const closeDetailsBtn = document.getElementById("closeDetailsBtn");
const downloadPdfBtn = document.getElementById("downloadPdfBtn");
const sendEmailBtn = document.getElementById("sendEmailBtn");

let currentReportForPdf = null;

const photoModal = document.getElementById("photoModal");
const photoModalImage = document.getElementById("photoModalImage");
const photoModalDescription = document.getElementById("photoModalDescription");
const closePhotoModalBtn = document.getElementById("closePhotoModalBtn");

document.addEventListener("DOMContentLoaded", init);

function init() {
  loadSavedAuth();
  updateSearchAccountDefault();

  openUserLoginBtn.addEventListener("click", () => userLoginDialog.showModal());
  openAdminLoginBtn.addEventListener("click", () => adminLoginDialog.showModal());

  closeUserLoginBtn.addEventListener("click", () => userLoginDialog.close());
  closeAdminLoginBtn.addEventListener("click", () => adminLoginDialog.close());

  userLoginForm.addEventListener("submit", handleUserLogin);
  adminLoginForm.addEventListener("submit", handleAdminLogin);

  clearUserBtn.addEventListener("click", clearUserAuth);
  clearAdminBtn.addEventListener("click", clearAdminAuth);

  reportSearchForm.addEventListener("submit", handleSearchReports);
  clearSearchBtn.addEventListener("click", clearSearchFilters);
  closeDetailsBtn.addEventListener("click", () => {
    reportDetailsCard.classList.add("hidden");
    downloadPdfBtn.classList.add("hidden");
    sendEmailBtn.classList.add("hidden");
  });
  downloadPdfBtn.addEventListener("click", downloadCurrentReportPdf);
  sendEmailBtn.addEventListener("click", sendCurrentReportEmail);

  closePhotoModalBtn.addEventListener("click", closePhotoModal);
  photoModal.addEventListener("click", (event) => {
    if (event.target === photoModal) {
      closePhotoModal();
    }
  });
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && photoModal.open) {
      closePhotoModal();
    }
  });
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
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userName: username, password: password })
    });

    if (!response.ok) {
      clearUserSavedAuth();
      showMessage(userLoginMessage, "Invalid user username or password.", "error");
      return;
    }

    sessionStorage.setItem("qa_user_username", username);
    sessionStorage.setItem("qa_user_password", password);

    updateAuthStatus();
    updateSearchAccountDefault();

    showMessage(userLoginMessage, "User signed in successfully.", "ok");
    userLoginDialog.close();
  } catch {
    showMessage(userLoginMessage, "Cannot connect to backend.", "error");
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
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userName: username, password: password })
    });

    if (!response.ok) {
      clearAdminSavedAuth();
      showMessage(adminLoginMessage, "Invalid admin username or password.", "error");
      return;
    }

    sessionStorage.setItem("qa_admin_username", username);
    sessionStorage.setItem("qa_admin_password", password);

    updateAuthStatus();
    updateSearchAccountDefault();

    showMessage(adminLoginMessage, "Admin signed in successfully.", "ok");
    adminLoginDialog.close();
  } catch {
    showMessage(adminLoginMessage, "Cannot connect to backend.", "error");
  }
}

async function handleSearchReports(event) {
  event.preventDefault();

  const auth = getSelectedSearchAuth();

  if (!auth) {
    showMessage(searchMessage, "Please sign in with the selected account type before searching.", "error");
    return;
  }

  const params = new URLSearchParams();

  appendParam(params, "reportKind", valueOf("searchReportKind"));
  appendParam(params, "bco", valueOf("searchBco"));
  appendParam(params, "inspectionType", valueOf("searchInspectionType"));
  appendParam(params, "fromDate", valueOf("searchFromDate"));
  appendParam(params, "toDate", valueOf("searchToDate"));
  appendParam(params, "address", valueOf("searchAddress"));

  try {
    const response = await fetch(`${API_BASE_URL}/webapi/Reports?${params.toString()}`, {
      method: "GET",
      headers: {
        "Authorization": `Basic ${btoa(`${auth.username}:${auth.password}`)}`
      }
    });

    const text = await response.text();

    if (response.status === 401 || response.status === 403) {
      showMessage(searchMessage, "Sign-in expired or permission denied.", "error");
      return;
    }

    if (!response.ok) {
      showMessage(searchMessage, `Search failed (${response.status}): ${text}`, "error");
      return;
    }

    const reports = JSON.parse(text);

    renderReportResults(reports);
    showMessage(searchMessage, `${reports.length} report(s) found.`, "ok");
  } catch {
    showMessage(searchMessage, "Cannot connect to backend search endpoint.", "error");
  }
}

function renderReportResults(reports) {
  searchResultsCard.classList.remove("hidden");
  reportResults.innerHTML = "";

  if (!Array.isArray(reports) || reports.length === 0) {
    reportResults.innerHTML = `<p class="hint">No reports found.</p>`;
    return;
  }

  reports.forEach((report) => {
    const card = document.createElement("div");
    card.className = "report-result-card";

    card.innerHTML = `
      <div>
        <strong>${escapeHtml(report.bcoNumber || "No BCO")}</strong>
        <span>${escapeHtml(reportKindLabel(report.reportKind))}</span>
        <span>${escapeHtml(report.inspectionTypeCode || "")}</span>
      </div>

      <div class="report-result-meta">
        <span>${formatDateTime(report.inspectionDate)}</span>
        <span>${escapeHtml(report.inspectionOutcome || "No outcome")}</span>
        <span>${report.photoCount || 0} photo(s)</span>
      </div>

      <div class="report-result-address">
        ${escapeHtml(report.inspectionAddress || "No address recorded")}
      </div>

      <div class="button-row">
        <button type="button" class="secondary view-details-btn">View details</button>
      </div>
    `;

    card.querySelector(".view-details-btn").addEventListener("click", () => {
      loadReportDetails(report.id);
    });

    reportResults.appendChild(card);
  });
}

async function loadReportDetails(id) {
  const auth = getSelectedSearchAuth();

  if (!auth) {
    showMessage(searchMessage, "Please sign in before viewing details.", "error");
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/webapi/Reports/${encodeURIComponent(id)}`, {
      method: "GET",
      headers: {
        "Authorization": `Basic ${btoa(`${auth.username}:${auth.password}`)}`
      }
    });

    const text = await response.text();

    if (!response.ok) {
      showMessage(searchMessage, `Could not load details (${response.status}): ${text}`, "error");
      return;
    }

    const report = JSON.parse(text);
    currentReportForPdf = report;
    renderReportDetails(report);
  } catch {
    showMessage(searchMessage, "Cannot connect to backend details endpoint.", "error");
  }
}

function renderReportDetails(report) {
  reportDetailsCard.classList.remove("hidden");
  downloadPdfBtn.classList.remove("hidden");
  sendEmailBtn.classList.remove("hidden");

  const isFull = normalizeReportKind(report.reportKind) === "Full";
  const isEmailRecord = normalizeReportKind(report.reportKind) === "EmailRecord";

  reportDetails.innerHTML = `
    <div class="report-detail-grid">
      ${detailItem("Report type", reportKindLabel(report.reportKind))}
      ${detailItem("BCO number", report.bcoNumber)}
      ${detailItem("Inspection type", report.inspectionTypeCode)}
      ${detailItem("Inspection date", formatDateTime(report.inspectionDate))}
      ${detailItem("Address", report.inspectionAddress || "No address recorded", true)}
      ${detailItem("Email status", emailStatusText(report), true)}
      ${isEmailRecord ? detailItem("Email to", report.emailTo, true) : ""}
      ${isEmailRecord ? detailItem("Title", report.emailTitle, true) : ""}
      ${detailItem("LBP name", report.lbP_Name || report.lBP_Name || "N/A")}
      ${detailItem("Uploaded by", report.userName || "N/A")}
    </div>

    <details class="detail-foldout">
      <summary>Other LBP information</summary>
      <div class="report-detail-grid detail-foldout-grid">
        ${detailItem("LBP number", report.lbP_Number || report.lBP_Number || "N/A")}
        ${detailItem("LBP classes", report.lbP_Class || report.lBP_Class || "N/A", true)}
      </div>
    </details>

    ${isFull ? renderFullReportDetails(report) : ""}
    ${renderPhotos(report.photos || [])}
  `;

  reportDetailsCard.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderFullReportDetails(report) {
  return `
    <h3>Full report details</h3>
    <div class="report-detail-grid">
      ${detailItem("Outcome", report.inspectionOutcome)}
      ${detailItem("Scope", report.scope)}
      ${detailItem("Site safety", report.siteSafety)}
      ${detailItem("Inspection summary", report.inspectionSummary, true)}
      ${detailItem("Additional comments", report.additionalComments, true)}
      ${detailItem("Items resolved from history", report.itemsResolvedFromHistory, true)}
      ${detailItem("Items to be resolved", report.itemsToBeResolved, true)}
      ${detailItem("Person on site", report.personOnSiteName)}
      ${detailItem("Recipient email", report.recipientEmail)}
      ${detailItem("Inspector", report.inspectorName)}
      ${detailItem("Inspector email", report.inspectorEmail)}
      ${detailItem("Inspector phone", report.inspectorPhoneNumber)}
      ${detailItem("Duration", report.inspectionDurationMinutes ? `${report.inspectionDurationMinutes} minutes` : "")}
      ${detailItem("Next inspection required", report.nextInspectionRequired)}
    </div>

    ${renderChecklist(report.checklistItems || [])}
    ${renderRequiredDocuments(report.requiredDocuments || [])}
    ${renderMinorVariations(report.minorVariations || [])}
  `;
}

function detailItem(label, value, wide = false) {
  return `
    <div class="detail-item ${wide ? "wide-detail" : ""}">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value || "N/A")}</strong>
    </div>
  `;
}

function renderChecklist(items) {
  if (!items.length) {
    return "";
  }

  return `
    <h3>Checklist items</h3>
    <div class="detail-list">
      ${items.map(item => `
        <div class="detail-list-row">
          <strong>${escapeHtml(item.itemName)}</strong>
          <span>${escapeHtml(item.result)}</span>
          <p>${escapeHtml(item.comment || "")}</p>
        </div>
      `).join("")}
    </div>
  `;
}

function renderRequiredDocuments(items) {
  if (!items.length) {
    return "";
  }

  return `
    <h3>Required documents</h3>
    <div class="detail-list">
      ${items.map(item => `
        <div class="detail-list-row">
          <strong>${escapeHtml(item.documentName)}</strong>
          <p>${escapeHtml(item.comment || "")}</p>
        </div>
      `).join("")}
    </div>
  `;
}

function renderMinorVariations(items) {
  if (!items.length) {
    return "";
  }

  return `
    <h3>Minor variations</h3>
    <div class="detail-list">
      ${items.map(item => `
        <div class="detail-list-row">
          <strong>${escapeHtml(item.description)}</strong>
          <span>${escapeHtml(item.outcome || "")}</span>
          <p>${escapeHtml(item.outcomeReasonOrComment || "")}</p>
        </div>
      `).join("")}
    </div>
  `;
}

function renderPhotos(photos) {
  if (!photos.length) {
    return "";
  }

  return `
    <h3>Photos</h3>
    <div class="report-photo-grid report-photo-grid-large">
      ${photos.map(photo => {
        const description = photo.description || photo.caption || photo.fileName || "";
        const imageUrl = `${API_BASE_URL}/${photo.filePath}`;

        return `
          <figure class="report-photo-card clickable-photo" data-image-url="${escapeAttribute(imageUrl)}" data-description="${escapeAttribute(description)}">
            <img src="${escapeAttribute(imageUrl)}" alt="${escapeAttribute(description || "Inspection photo")}" />
            <figcaption>${escapeHtml(description)}</figcaption>
          </figure>
        `;
      }).join("")}
    </div>
  `;
}

document.addEventListener("click", (event) => {
  const photoCard = event.target.closest(".clickable-photo");

  if (!photoCard) {
    return;
  }

  openPhotoModal(photoCard.dataset.imageUrl, photoCard.dataset.description || "");
});

function openPhotoModal(imageUrl, description) {
  photoModalImage.src = imageUrl;
  photoModalDescription.textContent = description || "No description";
  photoModal.showModal();
}

function closePhotoModal() {
  photoModal.close();
  photoModalImage.src = "";
  photoModalDescription.textContent = "";
}



async function sendCurrentReportEmail() {
  if (!currentReportForPdf) {
    showMessage(searchMessage, "Please open a report before sending email.", "error");
    return;
  }

  const auth = getSelectedSearchAuth();

  if (!auth) {
    showMessage(searchMessage, "Please sign in before sending email.", "error");
    return;
  }

  const defaultTo = currentReportForPdf.emailTo || "";
  const emailTo = window.prompt("Email to", defaultTo);

  if (emailTo === null) {
    return;
  }

  if (!emailTo.trim()) {
    showMessage(searchMessage, "Email to is required.", "error");
    return;
  }

  const defaultTitle = currentReportForPdf.emailTitle || `${currentReportForPdf.bcoNumber || "Report"} - ${reportKindLabel(currentReportForPdf.reportKind)}`;
  const emailTitle = window.prompt("Email title", defaultTitle);

  if (emailTitle === null) {
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/webapi/Reports/${encodeURIComponent(currentReportForPdf.id)}/SendEmail`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${btoa(`${auth.username}:${auth.password}`)}`
      },
      body: JSON.stringify({
        emailTo: emailTo.trim(),
        emailTitle: emailTitle.trim()
      })
    });

    const text = await response.text();

    if (!response.ok) {
      showMessage(searchMessage, text || "Email could not be sent.", "error");
      return;
    }

    showMessage(searchMessage, text || "Email sent successfully.", "ok");
    await loadReportDetails(currentReportForPdf.id);
  } catch {
    showMessage(searchMessage, "Cannot connect to backend send-email endpoint.", "error");
  }
}

function emailStatusText(report) {
  const status = report.emailStatus || "NotRequired";
  const sentAt = report.emailSentAt ? formatDateTime(report.emailSentAt) : "";
  const error = report.emailError || "";

  if (status === "Sent") {
    return sentAt ? `Sent at ${sentAt}` : "Sent";
  }

  if (status === "Failed") {
    return error ? `Failed: ${error}` : "Failed";
  }

  if (status === "NotRequired") {
    return "Not required";
  }

  return status;
}

function downloadCurrentReportPdf() {
  if (!currentReportForPdf) {
    showMessage(searchMessage, "Please open a report before downloading PDF.", "error");
    return;
  }

  const printWindow = window.open("", "_blank");

  if (!printWindow) {
    showMessage(searchMessage, "Popup blocked. Please allow popups and try again.", "error");
    return;
  }

  printWindow.document.open();
  printWindow.document.write(buildReportPdfHtml(currentReportForPdf));
  printWindow.document.close();
  printWindow.focus();
}

function buildReportPdfHtml(report) {
  const kind = normalizeReportKind(report.reportKind);
  const isFull = kind === "Full";
  const isEmailRecord = kind === "EmailRecord";
  const titleText = buildPdfTitle(report);

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(titleText)}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 28px;
      color: #111827;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 12px;
      line-height: 1.45;
    }
    h1 {
      margin: 0 0 4px;
      font-size: 22px;
    }
    h2 {
      margin: 22px 0 8px;
      padding-bottom: 5px;
      border-bottom: 1px solid #d1d5db;
      font-size: 15px;
    }
    h3 {
      margin: 14px 0 6px;
      font-size: 13px;
    }
    p { margin: 0 0 6px; }
    .muted { color: #6b7280; }
    .header {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      border-bottom: 2px solid #111827;
      padding-bottom: 12px;
      margin-bottom: 16px;
    }
    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 7px 14px;
      margin-bottom: 8px;
    }
    .row { break-inside: avoid; }
    .label {
      color: #6b7280;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.02em;
    }
    .value {
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }
    .wide { grid-column: 1 / -1; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 6px 0 10px;
      break-inside: avoid;
    }
    th, td {
      border: 1px solid #d1d5db;
      padding: 6px;
      vertical-align: top;
      text-align: left;
    }
    th { background: #f3f4f6; }
    .photo {
      display: grid;
      grid-template-columns: 170px 1fr;
      gap: 12px;
      margin: 10px 0;
      padding: 8px;
      border: 1px solid #d1d5db;
      border-radius: 8px;
      break-inside: avoid;
    }
    .photo img {
      width: 170px;
      max-height: 170px;
      object-fit: contain;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
    }
    .photo-description { white-space: pre-wrap; }
    @media print {
      body { padding: 18mm; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <button class="no-print" onclick="window.print()" style="margin-bottom: 16px; padding: 8px 12px; font-weight: 700;">Print / Save as PDF</button>

  <div class="header">
    <div>
      <h1>${escapeHtml(titleText)}</h1>
      <p class="muted">Generated from QA Report System</p>
    </div>
  </div>

  <h2>Report summary</h2>
  <div class="grid">
    ${pdfRow("BCO number", report.bcoNumber)}
    ${pdfRow("Inspection type", report.inspectionTypeCode)}
    ${pdfRow("Inspection date", formatDateTime(report.inspectionDate))}
    ${pdfRow("Address", report.inspectionAddress || "No address recorded", true)}
    ${isEmailRecord ? pdfRow("Email to", report.emailTo, true) : ""}
    ${isEmailRecord ? pdfRow("Title", report.emailTitle, true) : ""}
    ${pdfRow("LBP name", report.lbP_Name || report.lBP_Name || "N/A")}
    ${pdfRow("Uploaded by", report.userName || "N/A")}
    ${pdfRow("LBP number", report.lbP_Number || report.lBP_Number || "N/A")}
    ${pdfRow("LBP classes", report.lbP_Class || report.lBP_Class || "N/A", true)}
  </div>

  ${isFull ? buildFullReportPdfHtml(report) : ""}
  ${buildPhotosPdfHtml(report.photos || [])}

  <script>
    (function () {
      let printed = false;
      function printWhenReady() {
        if (printed) return;
        printed = true;
        const images = Array.from(document.images);
        let remaining = images.length;
        function done() {
          remaining -= 1;
          if (remaining <= 0) {
            setTimeout(function () { window.print(); }, 150);
          }
        }
        if (remaining === 0) {
          setTimeout(function () { window.print(); }, 150);
          return;
        }
        images.forEach(function (img) {
          if (img.complete) {
            done();
          } else {
            img.onload = done;
            img.onerror = done;
          }
        });
        setTimeout(function () {
          if (remaining > 0) window.print();
        }, 2500);
      }
      window.addEventListener("load", printWhenReady);
      setTimeout(printWhenReady, 500);
    })();
  </script>
</body>
</html>`;
}

function buildFullReportPdfHtml(report) {
  return `
  <h2>Full report details</h2>
  <div class="grid">
    ${pdfRow("Outcome", report.inspectionOutcome)}
    ${pdfRow("Scope", report.scope)}
    ${pdfRow("Site safety", report.siteSafety)}
    ${pdfRow("Inspection summary", report.inspectionSummary, true)}
    ${pdfRow("Additional comments", report.additionalComments, true)}
    ${pdfRow("Items resolved from history", report.itemsResolvedFromHistory, true)}
    ${pdfRow("Items to be resolved", report.itemsToBeResolved, true)}
    ${pdfRow("Person on site", report.personOnSiteName)}
    ${pdfRow("Recipient email", report.recipientEmail)}
    ${pdfRow("Inspector", report.inspectorName)}
    ${pdfRow("Inspector email", report.inspectorEmail)}
    ${pdfRow("Inspector phone", report.inspectorPhoneNumber)}
    ${pdfRow("Duration", report.inspectionDurationMinutes ? `${report.inspectionDurationMinutes} minutes` : "")}
    ${pdfRow("Next inspection required", report.nextInspectionRequired)}
  </div>

  ${buildTablePdfHtml("Checklist items", ["Item", "Result", "Comment"], report.checklistItems || [], (item) => [item.itemName, item.result, item.comment])}
  ${buildTablePdfHtml("Required documents", ["Document", "Comment"], report.requiredDocuments || [], (item) => [item.documentName, item.comment])}
  ${buildTablePdfHtml("Minor variations", ["Description", "Outcome", "Comment"], report.minorVariations || [], (item) => [item.description, item.outcome, item.outcomeReasonOrComment])}
  `;
}

function buildTablePdfHtml(title, headers, rows, mapRow) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return "";
  }

  return `
    <h3>${escapeHtml(title)}</h3>
    <table>
      <thead>
        <tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr>
      </thead>
      <tbody>
        ${rows.map((row) => `<tr>${mapRow(row).map((cell) => `<td>${escapeHtml(cell || "")}</td>`).join("")}</tr>`).join("")}
      </tbody>
    </table>
  `;
}

function buildPhotosPdfHtml(photos) {
  if (!Array.isArray(photos) || photos.length === 0) {
    return "";
  }

  return `
    <h2>Photos</h2>
    ${photos.map((photo, index) => {
      const description = photo.description || photo.caption || photo.fileName || "";
      const imageUrl = getPhotoUrl(photo);
      return `
        <div class="photo">
          <img src="${escapeAttribute(imageUrl)}" alt="Photo ${index + 1}" />
          <div>
            <div class="label">Description</div>
            <div class="photo-description">${escapeHtml(description || "No description")}</div>
          </div>
        </div>
      `;
    }).join("")}
  `;
}

function pdfRow(label, value, wide = false) {
  return `
    <div class="row ${wide ? "wide" : ""}">
      <div class="label">${escapeHtml(label)}</div>
      <div class="value">${escapeHtml(value || "N/A")}</div>
    </div>
  `;
}

function buildPdfTitle(report) {
  const bco = String(report.bcoNumber || "Report").trim() || "Report";
  const kind = reportKindLabel(report.reportKind).replace(/\s+/g, " ").trim();
  const date = formatDateForFileName(report.inspectionDate);

  return `${bco} - ${kind}${date ? ` - ${date}` : ""}`;
}

function formatDateForFileName(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getPhotoUrl(photo) {
  const rawPath = String(photo.filePath || "").trim();

  if (/^https?:\/\//i.test(rawPath)) {
    return rawPath;
  }

  return `${API_BASE_URL}/${rawPath.replace(/^\/+/, "")}`;
}

function clearSearchFilters() {
  setValue("searchReportKind", "");
  setValue("searchBco", "");
  setValue("searchInspectionType", "");
  setValue("searchFromDate", "");
  setValue("searchToDate", "");
  setValue("searchAddress", "");

  reportResults.innerHTML = "";
  currentReportForPdf = null;
  reportDetails.innerHTML = "";
  searchResultsCard.classList.add("hidden");
  reportDetailsCard.classList.add("hidden");
  downloadPdfBtn.classList.add("hidden");
  sendEmailBtn.classList.add("hidden");
  showMessage(searchMessage, "Filters cleared.", "ok");
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

function updateSearchAccountDefault() {
  const hasUser = Boolean(sessionStorage.getItem("qa_user_username"));
  const hasAdmin = Boolean(sessionStorage.getItem("qa_admin_username"));

  if (hasAdmin) {
    searchAccountType.value = "admin";
    return;
  }

  if (hasUser) {
    searchAccountType.value = "user";
    return;
  }

  searchAccountType.value = "user";
}

function getSelectedSearchAuth() {
  const type = valueOf("searchAccountType");

  if (type === "admin") {
    const username = sessionStorage.getItem("qa_admin_username");
    const password = sessionStorage.getItem("qa_admin_password");

    if (!username || !password) {
      return null;
    }

    return { username, password, type };
  }

  const username = sessionStorage.getItem("qa_user_username");
  const password = sessionStorage.getItem("qa_user_password");

  if (!username || !password) {
    return null;
  }

  return { username, password, type: "user" };
}

function clearUserAuth() {
  clearUserSavedAuth();
  setValue("userUsername", "");
  setValue("userPassword", "");
  updateSearchAccountDefault();
  showMessage(userLoginMessage, "Cleared user sign-in details.", "ok");
}

function clearUserSavedAuth() {
  sessionStorage.removeItem("qa_user_username");
  sessionStorage.removeItem("qa_user_password");
  updateAuthStatus();
}

function clearAdminAuth() {
  clearAdminSavedAuth();
  setValue("adminUsername", "");
  setValue("adminPassword", "");
  updateSearchAccountDefault();
  showMessage(adminLoginMessage, "Cleared admin sign-in details.", "ok");
}

function clearAdminSavedAuth() {
  sessionStorage.removeItem("qa_admin_username");
  sessionStorage.removeItem("qa_admin_password");
  updateAuthStatus();
}

function appendParam(params, key, value) {
  if (value && value.trim().length > 0) {
    params.append(key, value.trim());
  }
}

function reportKindLabel(value) {
  const kind = normalizeReportKind(value);
  const labels = {
    Full: "Full report",
    Daily: "Daily report",
    EmailRecord: "Email retention"
  };

  return labels[kind] || "Full report";
}

function normalizeReportKind(value) {
  const raw = String(value || "Full");

  if (raw.toLowerCase() === "daily") {
    return "Daily";
  }

  if (raw.toLowerCase() === "emailrecord" || raw.toLowerCase() === "email_record") {
    return "EmailRecord";
  }

  return "Full";
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

function formatDateTime(value) {
  if (!value) {
    return "N/A";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("'", "&#39;");
}

// app_map_audit.js
// Full-screen restroom map + button-triggered audit panel
// Blue = Open, Red = Closed, Gray = Unknown

document.addEventListener("DOMContentLoaded", () => {
  const APPS_SCRIPT_URL =
    "https://script.google.com/macros/s/AKfycbxlUzoIYNrVice9e4imFyxny7N8EknWVB13wby8fJKpsl4RkYD_W_PHZ5BhC1XLXiaOow/exec";

  const SPREADSHEET_ID =
    "1jb6Oi_8Ldmj9tJdjuBsDJDJ0jRNhPSN3-CUaCLrPyR0";

  const RESTROOMS_SHEET = "restrooms_editable";

  const RESTROOMS_CSV_URL =
    `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(RESTROOMS_SHEET)}`;

  const $ = (id) => document.getElementById(id);

  const auditPanel = $("auditPanel");
  const panelBackdrop = $("panelBackdrop");
  const startAuditBtn = $("startAuditBtn");
  const closeAuditBtn = $("closeAuditBtn");

  const form = $("surveyForm");
  const submitBtn = $("submitBtn");
  const statusEl = $("status");
  const modeIndicator = $("modeIndicator");

  const placeIdEl = $("place_id");
  const actionEl = $("action");

  const auditDatetimeEl = $("audit_datetime");
  const restroomNameEl = $("restroom_name");
  const researcherNameEl = $("researcher_name");
  const addressEl = $("address");
  const latEl = $("latitude");
  const lngEl = $("longitude");

  const openWhenVisitedEl = $("open_when_visited");
  const hoursEl = $("advertised_hours");
  const accessMethodEl = $("access_method");
  const findabilityEl = $("findability");

  const genderNeutralEl = $("gender_neutral");
  const menstrualProductsEl = $("menstrual_products");
  const showersEl = $("showers_available");
  const waterRefillEl = $("water_refill_nearby");
  const signageEl = $("visible_signage");
  const camerasEl = $("security_cameras");
  const adaEl = $("ada_accessible");

  const accessBarriersEl = $("access_barriers");
  const impressionsEl = $("overall_impressions");
  const outsideEl = $("outside_context");
  const notesEl = $("notes");
  const auditPhotoEl = $("audit_photo");
  const useLocationBtn = $("useLocationBtn");


  function valueOf(value) {
    return String(value ?? "").trim();
  }

  function hasValue(value) {
    return valueOf(value) !== "";
  }

  function preparePhoto(file) {
    if (!file) {
      return Promise.resolve({
        photo_name: "",
        photo_type: "",
        photo_data: "",
      });
    }

    if (!file.type.startsWith("image/")) {
      return Promise.reject(
        new Error("Please choose an image file.")
      );
    }

    if (file.size > 12 * 1024 * 1024) {
      return Promise.reject(
        new Error("Please choose an image smaller than 12 MB.")
      );
    }

    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onerror = () => {
        reject(
          new Error("The selected image could not be read.")
        );
      };

      reader.onload = () => {
        const image = new Image();

        image.onerror = () => {
          reject(
            new Error(
              "The selected image could not be processed."
            )
          );
        };

        image.onload = () => {
          const maxDimension = 1600;

          const scale = Math.min(
            1,
            maxDimension /
              Math.max(image.width, image.height)
          );

          const canvas =
            document.createElement("canvas");

          canvas.width = Math.max(
            1,
            Math.round(image.width * scale)
          );

          canvas.height = Math.max(
            1,
            Math.round(image.height * scale)
          );

          const context =
            canvas.getContext("2d");

          context.drawImage(
            image,
            0,
            0,
            canvas.width,
            canvas.height
          );

          resolve({
            photo_name: file.name,
            photo_type: "image/jpeg",
            photo_data: canvas.toDataURL(
              "image/jpeg",
              0.78
            ),
          });
        };

        image.src = reader.result;
      };

      reader.readAsDataURL(file);
    });
  }

  function esc(value) {
    return String(value ?? "").replace(
      /[&<>"']/g,
      (char) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        }[char])
    );
  }

  function isYes(value) {
    return [
      "1",
      "1.0",
      "true",
      "yes",
      "y",
      "open",
    ].includes(
      valueOf(value).toLowerCase()
    );
  }

  function isNo(value) {
    return [
      "0",
      "0.0",
      "false",
      "no",
      "n",
      "closed",
      "permanently closed",
    ].includes(
      valueOf(value).toLowerCase()
    );
  }

  function yesNo(value) {
    if (!hasValue(value)) return "";

    if (isYes(value)) return "Yes";
    if (isNo(value)) return "No";

    return valueOf(value);
  }

  function normalizeYesNo(value) {
    if (!hasValue(value)) return "";

    if (isYes(value)) return "Yes";
    if (isNo(value)) return "No";

    return valueOf(value);
  }

  function formatDate(value) {
    const raw = valueOf(value);

    if (!raw) return "";

    const date = new Date(raw);

    if (Number.isNaN(date.getTime())) {
      return raw;
    }

    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  function isMobile() {
    return window.matchMedia(
      "(max-width: 900px)"
    ).matches;
  }


  const map = L.map("map").setView(
    [32.7157, -117.1611],
    11
  );

  L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
      maxZoom: 19,
      attribution:
        "&copy; OpenStreetMap contributors",
    }
  ).addTo(map);

  const restroomMarkers =
    L.layerGroup().addTo(map);

  let draftMarker = null;
  let restroomRows = [];


  function openAuditPanel() {
    auditPanel.classList.add("open");

    auditPanel.setAttribute(
      "aria-hidden",
      "false"
    );

    if (isMobile()) {
      panelBackdrop.hidden = false;
    }

    setTimeout(() => {
      map.invalidateSize();
    }, 220);
  }

  function closeAuditPanel() {
    auditPanel.classList.remove("open");

    auditPanel.setAttribute(
      "aria-hidden",
      "true"
    );

    panelBackdrop.hidden = true;

    setTimeout(() => {
      map.invalidateSize();
    }, 220);
  }

  function setMode(mode) {
    if (actionEl) {
      actionEl.value = mode;
    }

    if (mode === "update") {
      modeIndicator.textContent =
        "Suggest a change to this restroom";
    } else {
      modeIndicator.textContent =
        "Suggest a new restroom location";
    }
  }

  function clearDraftMarker() {
    if (!draftMarker) return;

    map.removeLayer(draftMarker);
    draftMarker = null;
  }

  function setDraftMarker(lat, lng) {
    clearDraftMarker();

    draftMarker = L.marker(
      [lat, lng],
      {
        keyboard: false,
        zIndexOffset: 2000,
      }
    ).addTo(map);

    draftMarker
      .bindPopup("New restroom location")
      .openPopup();
  }

  function resetForNewAudit() {
    form.reset();

    if (placeIdEl) {
      placeIdEl.value = "";
    }

    if (actionEl) {
      actionEl.value = "new";
    }

    setMode("new");

    statusEl.textContent = "";

    clearDraftMarker();
  }

  startAuditBtn.addEventListener(
    "click",
    () => {
      resetForNewAudit();
      openAuditPanel();
    }
  );

  closeAuditBtn.addEventListener(
    "click",
    closeAuditPanel
  );

  panelBackdrop.addEventListener(
    "click",
    closeAuditPanel
  );

  document.addEventListener(
    "keydown",
    (event) => {
      if (
        event.key === "Escape" &&
        auditPanel.classList.contains("open")
      ) {
        closeAuditPanel();
      }
    }
  );


  function getRestroomStatus(row) {
    const rawStatus =
      hasValue(row.open_when_visited)
        ? row.open_when_visited
        : row.restroom_open_status;

    if (isYes(rawStatus)) {
      return "open";
    }

    if (isNo(rawStatus)) {
      return "closed";
    }

    return "unknown";
  }

  function getStatusLabel(row) {
    const status =
      getRestroomStatus(row);

    if (status === "open") {
      return "Open";
    }

    if (status === "closed") {
      return "Closed";
    }

    return "Unknown";
  }

  function getStatusColor(row) {
    const status =
      getRestroomStatus(row);

    if (status === "open") {
      return "#2563eb";
    }

    if (status === "closed") {
      return "#dc2626";
    }

    return "#808080";
  }

  function popupHtml(row) {
    const name =
      valueOf(row.restroom_name) ||
      valueOf(row.name) ||
      "Public Restroom";

    const address =
      valueOf(row.address);

    const status =
      getStatusLabel(row);

    const hours =
      valueOf(row.advertised_hours);

    const operatedBy =
      valueOf(row.operated_by);

    const accessMethod =
      valueOf(row.access_method);

    const findability =
      valueOf(row.findability);

    const ada =
      yesNo(row.ada_accessible);

    const genderNeutral =
      yesNo(row.gender_neutral);

    const menstrualProducts =
      yesNo(row.menstrual_products);

    const showers =
      yesNo(
        row.showers_available ||
        row.showers
      );

    const water =
      yesNo(row.water_refill_nearby);

    const signage =
      yesNo(row.visible_signage);

    const cameras =
      yesNo(row.security_cameras);

    const babyChanging =
      yesNo(row.baby_changing);

    const assessmentDate =
      formatDate(
        row.audit_datetime ||
        row.restroom_assessment_date ||
        row.timestamp
      );

    function rowHtml(label, value) {
      if (!hasValue(value)) {
        return "";
      }

      return `
        <div class="popupRow">
          <strong>${esc(label)}:</strong>
          ${esc(value)}
        </div>
      `;
    }

    const googleMapsUrl =
      hasValue(row.latitude) &&
      hasValue(row.longitude)
        ? `https://www.google.com/maps?q=${encodeURIComponent(
            row.latitude
          )},${encodeURIComponent(
            row.longitude
          )}`
        : "";

    return `
      <div class="restroomPopup">
        <div class="popupTitle">
          ${esc(name)}
        </div>

        ${
          address
            ? `
              <div class="popupAddress">
                ${esc(address)}
              </div>
            `
            : ""
        }

        <div class="popupStatus popupStatus-${getRestroomStatus(row)}">
          ${esc(status)}
        </div>

        ${
          hours
            ? `
              <div class="popupHours">
                <strong>Hours:</strong>
                ${esc(hours)}
              </div>
            `
            : ""
        }

        ${
          assessmentDate
            ? `
              <div class="popupDate">
                Last assessed:
                ${esc(assessmentDate)}
              </div>
            `
            : ""
        }

        <div class="popupDetails">
          ${rowHtml("Operated by", operatedBy)}
          ${rowHtml("Access method", accessMethod)}
          ${rowHtml("Findability", findability)}
          ${rowHtml("ADA accessible", ada)}
          ${rowHtml("Gender-neutral", genderNeutral)}
          ${rowHtml("Menstrual products", menstrualProducts)}
          ${rowHtml("Showers", showers)}
          ${rowHtml("Water refill nearby", water)}
          ${rowHtml("Visible signage", signage)}
          ${rowHtml("Security cameras", cameras)}
          ${rowHtml("Baby changing", babyChanging)}
        </div>

        <div class="popupActions">
          ${
            googleMapsUrl
              ? `
                <a
                  class="popupActionLink"
                  href="${googleMapsUrl}"
                  target="_blank"
                  rel="noopener"
                >
                  Google Maps
                </a>
              `
              : ""
          }

          <button
            type="button"
            class="popupAuditBtn"
            data-audit-update
          >
            Suggest a change
          </button>
        </div>
      </div>
    `;
  }

  function drawMarkers(rows) {
    restroomMarkers.clearLayers();

    const bounds = [];

    rows.forEach((row) => {
      const lat =
        parseFloat(row.latitude);

      const lng =
        parseFloat(row.longitude);

      if (
        Number.isNaN(lat) ||
        Number.isNaN(lng)
      ) {
        return;
      }

      const marker =
        L.circleMarker(
          [lat, lng],
          {
            radius: 7,
            color: "#ffffff",
            weight: 2,
            fillColor:
              getStatusColor(row),
            fillOpacity: 0.92,
          }
        );

      marker.bindPopup(
        popupHtml(row),
        {
          maxWidth: 380,
        }
      );

      marker.on(
        "popupopen",
        (event) => {
          const popupRoot =
            event.popup.getElement();

          if (!popupRoot) return;

          const button =
            popupRoot.querySelector(
              "[data-audit-update]"
            );

          if (!button) return;

          button.onclick = () => {
            clearDraftMarker();

            fillForm(
              row,
              "update"
            );

            map.closePopup();
            openAuditPanel();
          };
        }
      );

      marker.addTo(
        restroomMarkers
      );

      bounds.push(
        [lat, lng]
      );
    });

    if (bounds
        });


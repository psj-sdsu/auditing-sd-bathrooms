// app_map_audit.js
// Full-screen restroom map + button-triggered audit panel
// Blue = Open, Red = Closed, Gray = Unknown

document.addEventListener("DOMContentLoaded", () => {
  /* =========================================================
     CONFIG
     ========================================================= */

  const APPS_SCRIPT_URL =
    "https://script.google.com/macros/s/AKfycbxlUzoIYNrVice9e4imFyxny7N8EknWVB13wby8fJKpsl4RkYD_W_PHZ5BhC1XLXiaOow/exec";

  const SPREADSHEET_ID =
    "1jb6Oi_8Ldmj9tJdjuBsDJDJ0jRNhPSN3-CUaCLrPyR0";

  const RESTROOMS_SHEET = "restrooms_editable";

  const RESTROOMS_CSV_URL =
    `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(RESTROOMS_SHEET)}`;


  /* =========================================================
     DOM
     ========================================================= */

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
  const useLocationBtn = $("useLocationBtn");


  /* =========================================================
     HELPERS
     ========================================================= */

  function valueOf(value) {
    return String(value ?? "").trim();
  }

  function hasValue(value) {
    return valueOf(value) !== "";
  }

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[char]));
  }

  function isYes(value) {
    return [
      "1",
      "1.0",
      "true",
      "yes",
      "y",
      "open",
    ].includes(valueOf(value).toLowerCase());
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
    ].includes(valueOf(value).toLowerCase());
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
    return window.matchMedia("(max-width: 900px)").matches;
  }


  /* =========================================================
     MAP
     ========================================================= */

  const map = L.map("map").setView(
    [32.7157, -117.1611],
    11
  );

  L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors",
    }
  ).addTo(map);

  const restroomMarkers =
    L.layerGroup().addTo(map);

  let draftMarker = null;
  let restroomRows = [];


  /* =========================================================
     PANEL
     ========================================================= */

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


  /* =========================================================
     STATUS + MARKERS
     ========================================================= */

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

          ${rowHtml(
            "Operated by",
            operatedBy
          )}

          ${rowHtml(
            "Access method",
            accessMethod
          )}

          ${rowHtml(
            "Findability",
            findability
          )}

          ${rowHtml(
            "ADA accessible",
            ada
          )}

          ${rowHtml(
            "Gender-neutral",
            genderNeutral
          )}

          ${rowHtml(
            "Menstrual products",
            menstrualProducts
          )}

          ${rowHtml(
            "Showers",
            showers
          )}

          ${rowHtml(
            "Water refill nearby",
            water
          )}

          ${rowHtml(
            "Visible signage",
            signage
          )}

          ${rowHtml(
            "Security cameras",
            cameras
          )}

          ${rowHtml(
            "Baby changing",
            babyChanging
          )}

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

    if (bounds.length > 0) {
      map.fitBounds(
        bounds,
        {
          padding: [35, 35],
        }
      );
    }
  }


  /* =========================================================
     FORM PREFILL
     ========================================================= */

  function fillForm(
    row,
    mode
  ) {
    form.reset();

    if (placeIdEl) {
      placeIdEl.value =
        row.globalid ||
        row.place_id ||
        "";
    }

    setMode(mode);

    if (restroomNameEl) {
      restroomNameEl.value =
        row.restroom_name ||
        row.name ||
        "";
    }

    if (researcherNameEl) {
      researcherNameEl.value = "";
    }

    if (addressEl) {
      addressEl.value =
        row.address || "";
    }

    if (latEl) {
      latEl.value =
        row.latitude || "";
    }

    if (lngEl) {
      lngEl.value =
        row.longitude || "";
    }

    if (openWhenVisitedEl) {
      openWhenVisitedEl.value =
        row.open_when_visited ||
        row.restroom_open_status ||
        "";
    }

    if (hoursEl) {
      hoursEl.value =
        row.advertised_hours ||
        "";
    }

    if (accessMethodEl) {
      accessMethodEl.value =
        row.access_method ||
        "";
    }

    if (findabilityEl) {
      findabilityEl.value =
        row.findability ||
        "";
    }

    if (genderNeutralEl) {
      genderNeutralEl.value =
        normalizeYesNo(
          row.gender_neutral
        );
    }

    if (menstrualProductsEl) {
      menstrualProductsEl.value =
        normalizeYesNo(
          row.menstrual_products
        );
    }

    if (showersEl) {
      showersEl.value =
        normalizeYesNo(
          row.showers_available ||
          row.showers
        );
    }

    if (waterRefillEl) {
      waterRefillEl.value =
        normalizeYesNo(
          row.water_refill_nearby
        );
    }

    if (signageEl) {
      signageEl.value =
        normalizeYesNo(
          row.visible_signage
        );
    }

    if (camerasEl) {
      camerasEl.value =
        normalizeYesNo(
          row.security_cameras
        );
    }

    if (adaEl) {
      adaEl.value =
        normalizeYesNo(
          row.ada_accessible
        );
    }

    if (accessBarriersEl) {
      accessBarriersEl.value =
        row.access_barriers ||
        "";
    }

    if (impressionsEl) {
      impressionsEl.value =
        row.overall_impressions ||
        "";
    }

    if (outsideEl) {
      outsideEl.value =
        row.outside_context ||
        "";
    }

    /*
      Keep the new submission's notes blank.

      This avoids copying existing team-curated notes
      into the auditor's new submission.
    */
    if (notesEl) {
      notesEl.value = "";
    }

    /*
      New audit should use the current auditor's
      own date/time, not the previous assessment date.
    */
    if (auditDatetimeEl) {
      auditDatetimeEl.value = "";
    }

    statusEl.textContent = "";
  }


  /* =========================================================
     MAP CLICK FOR NEW RESTROOM
     ========================================================= */

  map.on(
    "click",
    (event) => {
      /*
        Map clicks only create a new draft location
        if the audit panel is open and the user is
        currently creating a new restroom.
      */

      if (
        !auditPanel.classList.contains(
          "open"
        )
      ) {
        return;
      }

      if (
        valueOf(
          actionEl.value
        ).toLowerCase() !== "new"
      ) {
        return;
      }

      const lat =
        event.latlng.lat;

      const lng =
        event.latlng.lng;

      if (latEl) {
        latEl.value =
          lat.toFixed(6);
      }

      if (lngEl) {
        lngEl.value =
          lng.toFixed(6);
      }

      setDraftMarker(
        lat,
        lng
      );
    }
  );


  /* =========================================================
     GPS
     ========================================================= */

  if (
    useLocationBtn &&
    "geolocation" in navigator
  ) {
    useLocationBtn.addEventListener(
      "click",
      () => {
        useLocationBtn.disabled =
          true;

        useLocationBtn.textContent =
          "Locating…";

        navigator.geolocation
          .getCurrentPosition(

            (position) => {
              const lat =
                position.coords.latitude;

              const lng =
                position.coords.longitude;

              map.setView(
                [lat, lng],
                17
              );

              if (latEl) {
                latEl.value =
                  lat.toFixed(6);
              }

              if (lngEl) {
                lngEl.value =
                  lng.toFixed(6);
              }

              if (
                valueOf(
                  actionEl.value
                ).toLowerCase() === "new"
              ) {
                setDraftMarker(
                  lat,
                  lng
                );
              }

              useLocationBtn.disabled =
                false;

              useLocationBtn.textContent =
                "Use my location";
            },

            (error) => {
              console.warn(
                "Geolocation error:",
                error
              );

              alert(
                "Unable to access your location. You can click the map instead."
              );

              useLocationBtn.disabled =
                false;

              useLocationBtn.textContent =
                "Use my location";
            },

            {
              enableHighAccuracy: true,
              timeout: 10000,
              maximumAge: 0,
            }
          );
      }
    );

  } else if (useLocationBtn) {
    useLocationBtn.disabled =
      true;

    useLocationBtn.textContent =
      "Location not available";
  }


  /* =========================================================
     SUBMIT
     ========================================================= */

  form.addEventListener(
    "submit",
    async (event) => {
      event.preventDefault();

      if (
        !form.reportValidity()
      ) {
        const invalid =
          form.querySelector(
            ":invalid"
          );

        if (invalid) {
          const details =
            invalid.closest(
              "details"
            );

          if (details) {
            details.open = true;
          }

          invalid.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });

          invalid.focus({
            preventScroll: true,
          });
        }

        return;
      }

      submitBtn.disabled =
        true;

      submitBtn.textContent =
        "Submitting…";

      statusEl.textContent =
        "";

      const payload = {

        place_id:
          placeIdEl
            ? placeIdEl.value
            : "",

        action:
          actionEl
            ? actionEl.value
            : "new",

        audit_datetime:
          auditDatetimeEl
            ? auditDatetimeEl.value
            : "",

        restroom_name:
          restroomNameEl
            ? restroomNameEl.value
            : "",

        researcher_name:
          researcherNameEl
            ? researcherNameEl.value
            : "",

        address:
          addressEl
            ? addressEl.value
            : "",

        latitude:
          latEl
            ? latEl.value
            : "",

        longitude:
          lngEl
            ? lngEl.value
            : "",

        open_when_visited:
          openWhenVisitedEl
            ? openWhenVisitedEl.value
            : "",

        advertised_hours:
          hoursEl
            ? hoursEl.value
            : "",

        access_method:
          accessMethodEl
            ? accessMethodEl.value
            : "",

        findability:
          findabilityEl
            ? findabilityEl.value
            : "",

        gender_neutral:
          genderNeutralEl
            ? genderNeutralEl.value
            : "",

        menstrual_products:
          menstrualProductsEl
            ? menstrualProductsEl.value
            : "",

        showers_available:
          showersEl
            ? showersEl.value
            : "",

        water_refill_nearby:
          waterRefillEl
            ? waterRefillEl.value
            : "",

        visible_signage:
          signageEl
            ? signageEl.value
            : "",

        security_cameras:
          camerasEl
            ? camerasEl.value
            : "",

        ada_accessible:
          adaEl
            ? adaEl.value
            : "",

        access_barriers:
          accessBarriersEl
            ? accessBarriersEl.value
            : "",

        overall_impressions:
          impressionsEl
            ? impressionsEl.value
            : "",

        outside_context:
          outsideEl
            ? outsideEl.value
            : "",

        notes:
          notesEl
            ? notesEl.value
            : "",
      };

      try {
        const response =
          await fetch(
            APPS_SCRIPT_URL,
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "text/plain;charset=utf-8",
              },

              body:
                JSON.stringify(
                  payload
                ),
            }
          );

        if (!response.ok) {
          throw new Error(
            `Submission failed. HTTP ${response.status}`
          );
        }

        let result = null;

        try {
          result =
            await response.json();
        } catch (_) {}

        if (
          result &&
          result.success === false
        ) {
          throw new Error(
            result.error ||
            "Submission rejected."
          );
        }

        statusEl.textContent =
          "Submitted ✓ Your audit is awaiting review.";

        clearDraftMarker();

        /*
          Keep the success message visible briefly,
          then reset and close the audit panel.
        */
        setTimeout(
          () => {
            resetForNewAudit();

            closeAuditPanel();
          },
          1200
        );

      } catch (error) {
        console.error(
          "Submission failed:",
          error
        );

        statusEl.textContent =
          "Submit failed. Please check your connection and try again.";

      } finally {
        submitBtn.disabled =
          false;

        submitBtn.textContent =
          "Submit suggestion";
      }
    }
  );


  /* =========================================================
     LEGEND
     ========================================================= */

  const legend =
    L.control({
      position: "bottomright",
    });

  legend.onAdd =
    function () {
      const div =
        L.DomUtil.create(
          "div",
          "mapLegend"
        );

      div.innerHTML = `
        <div class="legendTitle">
          Restroom Status
        </div>

        <div class="legendItem">
          <span
            class="legendDot"
            style="background:#2563eb;"
          ></span>
          Open
        </div>

        <div class="legendItem">
          <span
            class="legendDot"
            style="background:#dc2626;"
          ></span>
          Closed
        </div>

        <div class="legendItem">
          <span
            class="legendDot"
            style="background:#808080;"
          ></span>
          Unknown
        </div>
      `;

      L.DomEvent
        .disableClickPropagation(
          div
        );

      return div;
    };

  legend.addTo(map);


  /* =========================================================
     GOOGLE SHEET LOADING
     ========================================================= */

  async function loadCsv(url) {
    const separator =
      url.includes("?")
        ? "&"
        : "?";

    const freshUrl =
      `${url}${separator}_=${Date.now()}`;

    const response =
      await fetch(
        freshUrl,
        {
          cache: "no-store",
        }
      );

    if (!response.ok) {
      throw new Error(
        `Could not load restroom data. HTTP ${response.status}`
      );
    }

    const text =
      await response.text();

    const parsed =
      Papa.parse(
        text,
        {
          header: true,
          skipEmptyLines: true,
        }
      );

    if (
      parsed.errors.length
    ) {
      console.warn(
        "CSV parsing warnings:",
        parsed.errors
      );
    }

    return parsed.data;
  }

  async function initializeMap() {
    try {
      restroomRows =
        await loadCsv(
          RESTROOMS_CSV_URL
        );

      drawMarkers(
        restroomRows
      );

      setTimeout(
        () => {
          map.invalidateSize();
        },
        200
      );

    } catch (error) {
      console.error(
        "Failed to load restrooms_editable from Google Sheets:",
        error
      );
    }
  }


  /* =========================================================
     START
     ========================================================= */

  initializeMap();

  window.addEventListener(
    "resize",
    () => {
      setTimeout(
        () => {
          map.invalidateSize();
        },
        100
      );
    }
  );
});

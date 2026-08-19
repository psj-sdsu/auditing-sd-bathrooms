// app.js
document.addEventListener("DOMContentLoaded", () => {

  /* =========================================================
     CONFIG
     ========================================================= */

  const APPS_SCRIPT_URL =
    "https://script.google.com/macros/s/AKfycbxlUzoIYNrVice9e4imFyxny7N8EknWVB13wby8fJKpsl4RkYD_W_PHZ5BhC1XLXiaOow/exec";

  const SPREADSHEET_ID =
    "1jb6Oi_8Ldmj9tJdjuBsDJDJ0jRNhPSN3-CUaCLrPyR0";

  const RESTROOMS_SHEET =
    "restrooms_editable";

  const RESTROOMS_CSV_URL =
    `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(RESTROOMS_SHEET)}`;


  /* =========================================================
     BASELINE CATEGORY LABELS
     ========================================================= */

  const CATEGORY_LABELS = {
    "2": "Beach / Coastal",
    "3": "Library"

    // Add more when you confirm them:
    // "1": "Park / Outdoor",
    // "4": "Recreation center",
    // "5": "Transit / Transportation",
    // "6": "Commercial"
  };


  /* =========================================================
     HELPERS
     ========================================================= */

  const $ = (id) =>
    document.getElementById(id);


  const esc = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      }[c])
    );


  const isMobile = () =>
    window
      .matchMedia("(max-width: 900px)")
      .matches;


  function fmtDate(s) {
    const value =
      String(s ?? "").trim();

    if (!value) return "";

    const date =
      new Date(value);

    if (isNaN(date.getTime())) {
      return value;
    }

    return date.toLocaleString(
      undefined,
      {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
      }
    );
  }


  /* =========================================================
     REQUIRED ELEMENTS
     ========================================================= */

  const panel =
    $("panel");

  const form =
    $("surveyForm");

  const submitBtn =
    $("submitBtn");

  const statusEl =
    $("status");


  if (
    !panel ||
    !form ||
    !submitBtn ||
    !statusEl
  ) {
    console.error(
      "Missing required elements (#panel, #surveyForm, #submitBtn, #status)."
    );

    return;
  }


  /* =========================================================
     FORM ELEMENTS
     ========================================================= */

  const placeIdEl =
    $("place_id");

  const actionEl =
    $("action");

  const auditDatetimeEl =
    $("audit_datetime");

  const restroomNameEl =
    $("restroom_name");

  const researcherNameEl =
    $("researcher_name");

  const addressEl =
    $("address");

  const latEl =
    $("latitude");

  const lngEl =
    $("longitude");

  const openWhenVisitedEl =
    $("open_when_visited");

  const hoursEl =
    $("advertised_hours");

  const accessMethodEl =
    $("access_method");

  const findabilityEl =
    $("findability");

  const genderNeutralEl =
    $("gender_neutral");

  const menstrualProductsEl =
    $("menstrual_products");

  const showersEl =
    $("showers_available");

  const waterRefillEl =
    $("water_refill_nearby");

  const signageEl =
    $("visible_signage");

  const camerasEl =
    $("security_cameras");

  const adaEl =
    $("ada_accessible");

  const accessBarriersEl =
    $("access_barriers");

  const impressionsEl =
    $("overall_impressions");

  const outsideEl =
    $("outside_context");

  const notesEl =
    $("notes");


  /* =========================================================
     MAP INITIALIZATION
     ========================================================= */

  let leafletMap;

  try {

    leafletMap =
      L.map("map")
        .setView(
          [32.7157, -117.1611],
          12
        );

  } catch (error) {

    console.error(
      "Leaflet failed to initialize.",
      error
    );

    return;
  }


  window.leafletMap =
    leafletMap;


  L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
      maxZoom: 19,
      attribution:
        "&copy; OpenStreetMap contributors"
    }
  ).addTo(leafletMap);


  const leafletMarkers =
    L.layerGroup()
      .addTo(leafletMap);


  function safeInvalidate() {
    try {
      leafletMap.invalidateSize();
    } catch (_) {}
  }


  window.addEventListener(
    "load",
    () =>
      setTimeout(
        safeInvalidate,
        250
      )
  );


  window.addEventListener(
    "resize",
    () =>
      setTimeout(
        safeInvalidate,
        120
      )
  );


  /* =========================================================
     TEMPORARY DRAFT MARKER
     ========================================================= */

  let draftMarker = null;


  function setDraftMarker(
    lat,
    lng
  ) {

    if (draftMarker) {
      leafletMap.removeLayer(
        draftMarker
      );

      draftMarker = null;
    }


    draftMarker =
      L.marker(
        [lat, lng],
        {
          keyboard: false
        }
      )
        .addTo(leafletMap);


    draftMarker
      .bindPopup(
        "New restroom location"
      )
      .openPopup();
  }


  function clearDraftMarker() {

    if (!draftMarker) return;

    leafletMap.removeLayer(
      draftMarker
    );

    draftMarker = null;
  }


  /* =========================================================
     PANEL CONTROL
     ========================================================= */

  function openPanel() {

    if (isMobile()) {
      panel.classList.add(
        "open"
      );
    }

    setTimeout(
      safeInvalidate,
      250
    );
  }


  function togglePanel() {

    if (!isMobile()) return;

    panel.classList.toggle(
      "open"
    );

    setTimeout(
      safeInvalidate,
      250
    );
  }


  $("drawerHeader")
    ?.addEventListener(
      "click",
      togglePanel
    );


  /* =========================================================
     MODE INDICATOR
     ========================================================= */

  function setMode(mode) {

    const indicator =
      $("modeIndicator");

    if (!indicator) return;


    indicator.className =
      mode === "update"
        ? "mode update"
        : "mode new";


    indicator.hidden =
      false;


    indicator.textContent =
      mode === "update"
        ? "Suggest a change to this restroom"
        : "Suggest a new restroom location";
  }


  /* =========================================================
     GOOGLE SHEET CSV LOADING
     ========================================================= */

  async function loadCsv(url) {

    /*
      Cache-buster helps make newly approved
      records appear after refreshing.
    */

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
          cache: "no-store"
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
          skipEmptyLines: true
        }
      );


    if (
      parsed.errors &&
      parsed.errors.length
    ) {

      console.warn(
        "CSV parsing warnings:",
        parsed.errors
      );
    }


    return parsed.data;
  }


  /* =========================================================
     POPUP CONTENT
     ========================================================= */

  function popupHtml(r) {

    const val = (x) =>
      String(x ?? "").trim();


    const has = (x) =>
      !!val(x);


    const normCode = (x) =>
      val(x).replace(
        /\.0$/,
        ""
      );


    const isOneish = (x) =>
      [
        "1",
        "1.0",
        "true",
        "yes"
      ].includes(
        val(x).toLowerCase()
      );


    const isZeroish = (x) =>
      [
        "0",
        "0.0",
        "false",
        "no"
      ].includes(
        val(x).toLowerCase()
      );


    const yn = (x) => {

      if (!has(x)) {
        return "";
      }

      if (isOneish(x)) {
        return "Yes";
      }

      if (isZeroish(x)) {
        return "No";
      }

      return val(x);
    };


    const name =
      val(
        r.restroom_name ||
        r.name ||
        "Restroom"
      );


    const address =
      val(r.address);


    const openStatus =
      yn(
        r.open_when_visited ||
        r.restroom_open_status
      );


    const hours =
      val(
        r.advertised_hours
      );


    const ada =
      yn(
        r.ada_accessible
      );


    const genderNeutral =
      yn(
        r.gender_neutral
      );


    const menstrual =
      yn(
        r.menstrual_products
      );


    const showers =
      yn(
        r.showers_available ||
        r.showers
      );


    const assessedOn =
      has(
        r.restroom_assessment_date
      )
        ? fmtDate(
            r.restroom_assessment_date
          )
        : "";


    const facilityTypes = [];


    if (
      isOneish(
        r.public_buildings
      )
    ) {
      facilityTypes.push(
        "Public building"
      );
    }


    if (
      isOneish(
        r.outdoor_facilities
      )
    ) {
      facilityTypes.push(
        "Outdoor facility"
      );
    }


    if (
      isOneish(
        r.government_facilities
      )
    ) {
      facilityTypes.push(
        "Government facility"
      );
    }


    if (
      isOneish(
        r.commercial
      )
    ) {
      facilityTypes.push(
        "Commercial"
      );
    }


    if (
      isOneish(
        r.transportation_mts
      )
    ) {
      facilityTypes.push(
        "Transportation / MTS"
      );
    }


    if (
      isOneish(
        r.other
      )
    ) {
      facilityTypes.push(
        "Other"
      );
    }


    const categoryCode =
      normCode(
        r.category
      );


    const categoryLabel =
      CATEGORY_LABELS[
        categoryCode
      ] || "";


    const chip = (
      label,
      value
    ) => {

      const v =
        val(value);

      if (!v) return "";


      return `
        <span class="chip">
          <span class="chipLabel">
            ${esc(label)}
          </span>

          <span class="chipValue">
            ${esc(v)}
          </span>
        </span>
      `;
    };


    const row = (
      label,
      value
    ) => {

      const v =
        val(value);

      if (!v) return "";


      return `
        <div class="kv">
          <div class="k">
            ${esc(label)}
          </div>

          <div class="v">
            ${esc(v)}
          </div>
        </div>
      `;
    };


    const accessSection = [
      row(
        "Access method",
        r.access_method
      ),

      row(
        "Findability",
        r.findability
      )
    ].join("");


    const amenitiesSection = [
      row(
        "Water refill nearby",
        yn(
          r.water_refill_nearby
        )
      ),

      row(
        "Visible signage",
        yn(
          r.visible_signage
        )
      ),

      row(
        "Security cameras",
        yn(
          r.security_cameras
        )
      ),

      row(
        "Baby changing",
        yn(
          r.baby_changing
        )
      )
    ].join("");


    const baselineSection = [
      row(
        "Operated by",
        r.operated_by
      ),

      row(
        "Facility type",
        facilityTypes.join(", ")
      ),

      row(
        "Category",
        categoryLabel
      )
    ].join("");


    const observationsSection = [
      row(
        "Access barriers",
        r.access_barriers
      ),

      row(
        "Overall impressions",
        r.overall_impressions
      ),

      row(
        "Outside context",
        r.outside_context
      ),

      row(
        "Notes",
        r.notes
      )
    ].join("");


    const hasDetails =
      !!accessSection ||
      !!amenitiesSection ||
      !!baselineSection ||
      !!observationsSection;


    const googleMapsUrl =
      has(r.latitude) &&
      has(r.longitude)
        ? `https://www.google.com/maps?q=${encodeURIComponent(
            r.latitude
          )},${encodeURIComponent(
            r.longitude
          )}`
        : "";


    return `
      <div class="popup">

        <div class="popupTitle">
          ${esc(name)}
        </div>

        ${
          address
            ? `
              <div class="popupAddr">
                ${esc(address)}
              </div>
            `
            : ""
        }

        ${
          assessedOn
            ? `
              <div class="popupMeta">
                Last assessed:
                ${esc(assessedOn)}
              </div>
            `
            : ""
        }

        ${
          hours
            ? `
              <div class="hoursLine">
                <span class="hoursLabel">
                  Hours
                </span>

                ${esc(hours)}
              </div>
            `
            : ""
        }

        <div class="chipRow">

          ${chip(
            "Open",
            openStatus
          )}

          ${chip(
            "ADA",
            ada
          )}

          ${chip(
            "Gender-neutral",
            genderNeutral
          )}

          ${chip(
            "Menstrual",
            menstrual
          )}

          ${chip(
            "Showers",
            showers
          )}

        </div>

        ${
          hasDetails
            ? `
              <details class="popupDetails">

                <summary>
                  More details
                </summary>

                ${
                  accessSection
                    ? `
                      <div class="section">

                        <div class="sectionTitle">
                          Access & finding it
                        </div>

                        ${accessSection}

                      </div>
                    `
                    : ""
                }

                ${
                  amenitiesSection
                    ? `
                      <div class="section">

                        <div class="sectionTitle">
                          Amenities & safety
                        </div>

                        ${amenitiesSection}

                      </div>
                    `
                    : ""
                }

                ${
                  baselineSection
                    ? `
                      <div class="section">

                        <div class="sectionTitle">
                          About
                        </div>

                        ${baselineSection}

                      </div>
                    `
                    : ""
                }

                ${
                  observationsSection
                    ? `
                      <div class="section">

                        <div class="sectionTitle">
                          Field observations
                        </div>

                        ${observationsSection}

                      </div>
                    `
                    : ""
                }

              </details>
            `
            : ""
        }

        <div class="popupActions">

          ${
            googleMapsUrl
              ? `
                <a
                  class="popupLink"
                  href="${googleMapsUrl}"
                  target="_blank"
                  rel="noopener"
                >
                  Open in Google Maps
                </a>
              `
              : ""
          }

          <button
            class="popupBtn"
            data-update
            type="button"
          >
            Suggest a change
          </button>

        </div>

      </div>
    `;
  }


  /* =========================================================
     DRAW MAP MARKERS
     ========================================================= */

  function drawMarkers(rows) {

    leafletMarkers.clearLayers();


    rows.forEach((r) => {

      const lat =
        Number(r.latitude);

      const lng =
        Number(r.longitude);


      if (
        !Number.isFinite(lat) ||
        !Number.isFinite(lng)
      ) {
        return;
      }


      const marker =
        L.marker(
          [lat, lng]
        )
          .addTo(
            leafletMarkers
          );


      marker.bindPopup(
        popupHtml(r),
        {
          maxWidth: 360
        }
      );


      marker.on(
        "popupopen",
        (e) => {

          const root =
            e.popup.getElement();

          if (!root) return;


          const button =
            root.querySelector(
              "[data-update]"
            );

          if (!button) return;


          button.onclick = () => {

            clearDraftMarker();

            fillForm(
              r,
              "update"
            );

            openPanel();
          };
        }
      );
    });
  }


  /* =========================================================
     FILL AUDIT FORM
     ========================================================= */

  function fillForm(
    r,
    mode
  ) {

    if (placeIdEl) {

      placeIdEl.value =
        r.globalid ||
        r.place_id ||
        "";
    }


    if (actionEl) {
      actionEl.value =
        mode;
    }


    setMode(mode);


    if (auditDatetimeEl) {

      /*
        For a new audit, don't automatically reuse
        the previous assessment date.
      */

      auditDatetimeEl.value =
        mode === "new"
          ? ""
          : "";
    }


    if (restroomNameEl) {

      restroomNameEl.value =
        r.restroom_name ||
        r.name ||
        "";
    }


    if (researcherNameEl) {

      /*
        Do not populate previous researcher's name
        when someone suggests a new update.
      */

      researcherNameEl.value =
        "";
    }


    if (addressEl) {
      addressEl.value =
        r.address || "";
    }


    if (latEl) {
      latEl.value =
        r.latitude || "";
    }


    if (lngEl) {
      lngEl.value =
        r.longitude || "";
    }


    if (openWhenVisitedEl) {

      openWhenVisitedEl.value =
        r.open_when_visited ||
        r.restroom_open_status ||
        "";
    }


    if (hoursEl) {

      hoursEl.value =
        r.advertised_hours ||
        "";
    }


    if (accessMethodEl) {

      accessMethodEl.value =
        r.access_method ||
        "";
    }


    if (findabilityEl) {

      findabilityEl.value =
        r.findability ||
        "";
    }


    if (genderNeutralEl) {

      genderNeutralEl.value =
        normalizeYesNo(
          r.gender_neutral
        );
    }


    if (menstrualProductsEl) {

      menstrualProductsEl.value =
        normalizeYesNo(
          r.menstrual_products
        );
    }


    if (showersEl) {

      showersEl.value =
        normalizeYesNo(
          r.showers_available ||
          r.showers
        );
    }


    if (waterRefillEl) {

      waterRefillEl.value =
        normalizeYesNo(
          r.water_refill_nearby
        );
    }


    if (signageEl) {

      signageEl.value =
        normalizeYesNo(
          r.visible_signage
        );
    }


    if (camerasEl) {

      camerasEl.value =
        normalizeYesNo(
          r.security_cameras
        );
    }


    if (adaEl) {

      adaEl.value =
        normalizeYesNo(
          r.ada_accessible
        );
    }


    if (accessBarriersEl) {

      accessBarriersEl.value =
        r.access_barriers ||
        "";
    }


    if (impressionsEl) {

      impressionsEl.value =
        r.overall_impressions ||
        "";
    }


    if (outsideEl) {

      outsideEl.value =
        r.outside_context ||
        "";
    }


    if (notesEl) {

      notesEl.value =
        r.notes ||
        "";
    }
  }


  function normalizeYesNo(value) {

    const v =
      String(
        value ?? ""
      )
        .trim()
        .toLowerCase();


    if (
      [
        "yes",
        "true",
        "1",
        "1.0"
      ].includes(v)
    ) {
      return "Yes";
    }


    if (
      [
        "no",
        "false",
        "0",
        "0.0"
      ].includes(v)
    ) {
      return "No";
    }


    return String(
      value ?? ""
    ).trim();
  }


  /* =========================================================
     MAP CLICK -> NEW RESTROOM
     ========================================================= */

  leafletMap.on(
    "click",
    (e) => {

      const lat =
        e.latlng.lat;

      const lng =
        e.latlng.lng;


      /*
        Reset the form first so clicking the map
        after editing an existing restroom does
        not carry old values into the new submission.
      */

      form.reset();


      setDraftMarker(
        lat,
        lng
      );


      fillForm(
        {
          latitude: lat.toFixed(6),
          longitude: lng.toFixed(6)
        },
        "new"
      );


      openPanel();
    }
  );


  /* =========================================================
     NEW RESTROOM BUTTON
     ========================================================= */

  const newRestroomBtn =
    $("newRestroomBtn");


  if (newRestroomBtn) {

    newRestroomBtn.addEventListener(
      "click",
      () => {

        clearDraftMarker();

        form.reset();


        if (placeIdEl) {
          placeIdEl.value = "";
        }


        if (actionEl) {
          actionEl.value = "new";
        }


        setMode("new");

        openPanel();


        setTimeout(
          () =>
            restroomNameEl
              ?.focus(),
          200
        );
      }
    );
  }


  /* =========================================================
     GPS BUTTON
     ========================================================= */

  const useLocationBtn =
    $("useLocationBtn");


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


              leafletMap.setView(
                [lat, lng],
                17
              );


              setDraftMarker(
                lat,
                lng
              );


              if (latEl) {

                latEl.value =
                  lat.toFixed(6);
              }


              if (lngEl) {

                lngEl.value =
                  lng.toFixed(6);
              }


              openPanel();


              useLocationBtn.textContent =
                "Use my location";

              useLocationBtn.disabled =
                false;
            },


            (error) => {

              console.warn(
                "Geolocation error:",
                error
              );


              alert(
                "Unable to access your location. You can tap the map instead."
              );


              useLocationBtn.textContent =
                "Use my location";

              useLocationBtn.disabled =
                false;
            },


            {
              enableHighAccuracy: true,
              timeout: 10000,
              maximumAge: 0
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
     FORM SUBMISSION
     ========================================================= */

  form.addEventListener(
    "submit",
    async (e) => {

      e.preventDefault();


      if (!form.reportValidity()) {

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
            block: "center"
          });


          invalid.focus({
            preventScroll: true
          });
        }


        return;
      }


      submitBtn.textContent =
        "Submitting…";

      submitBtn.disabled =
        true;

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
            : ""
      };


      try {

        /*
          We intentionally use text/plain here.
          This works well with Google Apps Script
          web apps and avoids unnecessary CORS
          preflight complications.
        */

        const response =
          await fetch(
            APPS_SCRIPT_URL,
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "text/plain;charset=utf-8"
              },

              body:
                JSON.stringify(
                  payload
                )
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

        } catch (_) {

          /*
            If Apps Script returns a non-JSON
            response for some reason, reaching
            this point still means the HTTP
            request completed.
          */
        }


        if (
          result &&
          result.success === false
        ) {

          throw new Error(
            result.error ||
            "Submission was rejected by the server."
          );
        }


        statusEl.textContent =
          "Submitted ✓ Your audit is awaiting review.";


        submitBtn.textContent =
          "Submit suggestion";

        submitBtn.disabled =
          false;


        form.reset();


        if (placeIdEl) {
          placeIdEl.value = "";
        }


        if (actionEl) {
          actionEl.value = "new";
        }


        setMode("new");


        panel.scrollTop =
          0;


        clearDraftMarker();


        if (isMobile()) {

          panel.classList.add(
            "open"
          );
        }


        setTimeout(
          safeInvalidate,
          250
        );


      } catch (error) {

        console.error(
          "Submission failed:",
          error
        );


        statusEl.textContent =
          "Submit failed. Please check your connection and try again.";


        submitBtn.textContent =
          "Submit suggestion";

        submitBtn.disabled =
          false;
      }
    }
  );


  /* =========================================================
     LOAD APPROVED MASTER RESTROOM DATA
     ========================================================= */

  async function loadRestrooms() {

    try {

      statusEl.textContent =
        "";


      const restrooms =
        await loadCsv(
          RESTROOMS_CSV_URL
        );


      console.log(
        `Loaded ${restrooms.length} restrooms from Google Sheets.`
      );


      drawMarkers(
        restrooms
      );


      setTimeout(
        safeInvalidate,
        200
      );


      if (isMobile()) {

        panel.classList.add(
          "open"
        );


        setTimeout(
          safeInvalidate,
          250
        );
      }


    } catch (error) {

      console.error(
        "Failed to load restrooms_editable from Google Sheets:",
        error
      );


      statusEl.textContent =
        "Unable to load restroom data. Please refresh and try again.";
    }
  }


  /* =========================================================
     INITIALIZE
     ========================================================= */

  loadRestrooms();

});

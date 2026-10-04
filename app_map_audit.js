document.addEventListener("DOMContentLoaded", () => {
  const APPS_SCRIPT_URL =
    "https://script.google.com/macros/s/AKfycbxlUzoIYNrVice9e4imFyxny7N8EknWVB13wby8fJKpsl4RkYD_W_PHZ5BhC1XLXiaOow/exec";

  const SPREADSHEET_ID =
    "1jb6Oi_8Ldmj9tJdjuBsDJDJ0jRNhPSN3-CUaCLrPyR0";

  const RESTROOMS_SHEET = "restrooms_editable";

  const RESTROOMS_CSV_URL =
    `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(RESTROOMS_SHEET)}`;

  const $ = (id) => document.getElementById(id);

  const map = L.map("map").setView(
    [32.7157, -117.1611],
    11
  );

  L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors"
    }
  ).addTo(map);

  const markers = L.layerGroup().addTo(map);

  const panel = $("auditPanel");
  const backdrop = $("panelBackdrop");
  const form = $("surveyForm");
  const submitBtn = $("submitBtn");
  const statusEl = $("status");
  const modeIndicator = $("modeIndicator");

  const placeIdEl = $("place_id");
  const actionEl = $("action");
  const photoEl = $("audit_photo");

  let draftMarker = null;

  function value(id) {
    const element = $(id);
    return element ? element.value.trim() : "";
  }

  function setValue(id, value) {
    const element = $(id);
    if (element) element.value = value || "";
  }

  function isYes(value) {
    return [
      "yes",
      "true",
      "1",
      "1.0",
      "open"
    ].includes(
      String(value || "").trim().toLowerCase()
    );
  }

  function isNo(value) {
    return [
      "no",
      "false",
      "0",
      "0.0",
      "closed",
      "permanently closed"
    ].includes(
      String(value || "").trim().toLowerCase()
    );
  }

  function yesNo(value) {
    if (!value) return "";
    if (isYes(value)) return "Yes";
    if (isNo(value)) return "No";
    return value;
  }

  function escapeHtml(value) {
    return String(value || "").replace(
      /[&<>"']/g,
      (character) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      }[character])
    );
  }

  function statusFor(row) {
    const status =
      row.open_when_visited ||
      row.restroom_open_status ||
      "";

    if (isYes(status)) return "open";
    if (isNo(status)) return "closed";

    return "unknown";
  }

  function statusLabel(row) {
    const status = statusFor(row);

    if (status === "open") return "Open";
    if (status === "closed") return "Closed";

    return "Unknown";
  }

  function statusColor(row) {
    const status = statusFor(row);

    if (status === "open") return "#2563eb";
    if (status === "closed") return "#dc2626";

    return "#808080";
  }

  function openPanel() {
    panel.classList.add("open");
    panel.setAttribute("aria-hidden", "false");
    backdrop.hidden = false;
    setTimeout(() => map.invalidateSize(), 250);
  }

  function closePanel() {
    panel.classList.remove("open");
    panel.setAttribute("aria-hidden", "true");
    backdrop.hidden = true;
    setTimeout(() => map.invalidateSize(), 250);
  }

  function clearDraftMarker() {
    if (draftMarker) {
      map.removeLayer(draftMarker);
      draftMarker = null;
    }
  }

  function setDraftMarker(lat, lng) {
    clearDraftMarker();

    draftMarker = L.marker([lat, lng])
      .addTo(map)
      .bindPopup("New restroom location")
      .openPopup();
  }

  function setMode(mode) {
    actionEl.value = mode;

    modeIndicator.textContent =
      mode === "update"
        ? "Suggest a change to this restroom"
        : "Suggest a new restroom location";
  }

  function resetForm() {
    form.reset();
    placeIdEl.value = "";
    actionEl.value = "new";
    setMode("new");
    statusEl.textContent = "";
    clearDraftMarker();
  }

  function fillForm(row) {
    form.reset();

    placeIdEl.value =
      row.globalid ||
      row.place_id ||
      "";

    actionEl.value = "update";
    setMode("update");

    setValue(
      "restroom_name",
      row.restroom_name || row.name
    );

    setValue("address", row.address);
    setValue("latitude", row.latitude);
    setValue("longitude", row.longitude);
    setValue(
      "open_when_visited",
      row.open_when_visited ||
      row.restroom_open_status
    );

    setValue(
      "advertised_hours",
      row.advertised_hours
    );

    setValue(
      "access_method",
      row.access_method
    );

    setValue(
      "findability",
      row.findability
    );

    setValue(
      "gender_neutral",
      yesNo(row.gender_neutral)
    );

    setValue(
      "menstrual_products",
      yesNo(row.menstrual_products)
    );

    setValue(
      "showers_available",
      yesNo(row.showers_available || row.showers)
    );

    setValue(
      "water_refill_nearby",
      yesNo(row.water_refill_nearby)
    );

    setValue(
      "visible_signage",
      yesNo(row.visible_signage)
    );

    setValue(
      "security_cameras",
      yesNo(row.security_cameras)
    );

    setValue(
      "ada_accessible",
      yesNo(row.ada_accessible)
    );

    setValue(
      "access_barriers",
      row.access_barriers
    );

    setValue(
      "overall_impressions",
      row.overall_impressions
    );

    setValue(
      "outside_context",
      row.outside_context
    );

    setValue("notes", "");
    setValue("audit_datetime", "");
    statusEl.textContent = "";
  }

  function preparePhoto(file) {
    if (!file) {
      return Promise.resolve({
        photo_name: "",
        photo_type: "",
        photo_data: ""
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
            new Error("The selected image could not be processed.")
          );
        };

        image.onload = () => {
          const maximum = 1600;
          const scale = Math.min(
            1,
            maximum /
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
            )
          });
        };

        image.src = reader.result;
      };

      reader.readAsDataURL(file);
    });
  }

  function popupHtml(row) {
    const name =
      row.name ||
      row.restroom_name ||
      "Public Restroom";

    const address =
      row.address || "";

    const hours =
      row.advertised_hours || "";

    const googleMapsUrl =
      row.latitude &&
      row.longitude
        ? `https://www.google.com/maps?q=${encodeURIComponent(
            row.latitude
          )},${encodeURIComponent(
            row.longitude
          )}`
        : "";

    return `
      <div class="restroomPopup">
        <div class="popupTitle">
          ${escapeHtml(name)}
        </div>

        ${
          address
            ? `
              <div class="popupAddress">
                ${escapeHtml(address)}
              </div>
            `
            : ""
        }

        <div class="popupStatus popupStatus-${statusFor(row)}">
          ${statusLabel(row)}
        </div>

        ${
          hours
            ? `
              <div class="popupHours">
                <strong>Hours:</strong>
                ${escapeHtml(hours)}
              </div>
            `
            : ""
        }

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
    markers.clearLayers();

    const bounds = [];

    rows.forEach((row) => {
      const latitude =
        parseFloat(row.latitude);

      const longitude =
        parseFloat(row.longitude);

      if (
        Number.isNaN(latitude) ||
        Number.isNaN(longitude)
      ) {
        return;
      }

      const marker =
        L.circleMarker(
          [latitude, longitude],
          {
            radius: 7,
            color: "#ffffff",
            weight: 2,
            fillColor: statusColor(row),
            fillOpacity: 0.92
          }
        );

      marker.bindPopup(
        popupHtml(row),
        {
          maxWidth: 380
        }
      );

      marker.on(
        "popupopen",
        (event) => {
          const button =
            event.popup
              .getElement()
              ?.querySelector(
                "[data-audit-update]"
              );

          if (!button) return;

          button.onclick = () => {
            map.closePopup();
            fillForm(row);
            openPanel();
          };
        }
      );

      marker.addTo(markers);
      bounds.push([latitude, longitude]);
    });

    if (bounds.length) {
      map.fitBounds(
        bounds,
        {
          padding: [35, 35]
        }
      );
    }
  }

  async function loadRestrooms() {
    const response =
      await fetch(
        `${RESTROOMS_CSV_URL}&_=${Date.now()}`,
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

    drawMarkers(parsed.data);
  }

  $("startAuditBtn").addEventListener(
    "click",
    () => {
      resetForm();
      openPanel();
    }
  );

  $("closeAuditBtn").addEventListener(
    "click",
    closePanel
  );

  backdrop.addEventListener(
    "click",
    closePanel
  );

  map.on(
    "click",
    (event) => {
      if (
        !panel.classList.contains("open") ||
        actionEl.value !== "new"
      ) {
        return;
      }

      const latitude =
        event.latlng.lat;

      const longitude =
        event.latlng.lng;

      setValue(
        "latitude",
        latitude.toFixed(6)
      );

      setValue(
        "longitude",
        longitude.toFixed(6)
      );

      setDraftMarker(
        latitude,
        longitude
      );
    }
  );

  $("useLocationBtn").addEventListener(
    "click",
    () => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const latitude =
            position.coords.latitude;

          const longitude =
            position.coords.longitude;

          map.setView(
            [latitude, longitude],
            17
          );

          setValue(
            "latitude",
            latitude.toFixed(6)
          );

          setValue(
            "longitude",
            longitude.toFixed(6)
          );

          if (actionEl.value === "new") {
            setDraftMarker(
              latitude,
              longitude
            );
          }
        },
        () => {
          alert(
            "Unable to access your location. You can click the map instead."
          );
        }
      );
    }
  );

  form.addEventListener(
    "submit",
    async (event) => {
      event.preventDefault();

      if (!form.reportValidity()) {
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = "Submitting…";
      statusEl.textContent = "";

      let photo;

      try {
        photo = await preparePhoto(
          photoEl.files[0]
        );
      } catch (error) {
        statusEl.textContent =
          error.message;

        submitBtn.disabled = false;
        submitBtn.textContent =
          "Submit suggestion";

        return;
      }

      const payload = {
        record_type: "restroom",
        place_id: value("place_id"),
        action: value("action"),
        audit_datetime: value("audit_datetime"),
        restroom_name: value("restroom_name"),
        researcher_name: value("researcher_name"),
        address: value("address"),
        latitude: value("latitude"),
        longitude: value("longitude"),
        open_when_visited: value("open_when_visited"),
        advertised_hours: value("advertised_hours"),
        access_method: value("access_method"),
        findability: value("findability"),
        gender_neutral: value("gender_neutral"),
        menstrual_products: value("menstrual_products"),
        showers_available: value("showers_available"),
        water_refill_nearby: value("water_refill_nearby"),
        visible_signage: value("visible_signage"),
        security_cameras: value("security_cameras"),
        ada_accessible: value("ada_accessible"),
        access_barriers: value("access_barriers"),
        overall_impressions: value("overall_impressions"),
        outside_context: value("outside_context"),
        notes: value("notes"),
        photo_name: photo.photo_name,
        photo_type: photo.photo_type,
        photo_data: photo.photo_data
      };

      try {
        const response =
          await fetch(
            APPS_SCRIPT_URL,
            {
              method: "POST",
              headers: {
                "Content-Type":
                  "text/plain;charset=utf-8"
              },
              body: JSON.stringify(payload)
            }
          );

        if (!response.ok) {
          throw new Error(
            `Submission failed. HTTP ${response.status}`
          );
        }

        const result =
          await response.json();

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

        setTimeout(
          () => {
            resetForm();
            closePanel();
          },
          1200
        );

      } catch (error) {
        console.error(error);

        statusEl.textContent =
          "Submit failed. Please check your connection and try again.";

      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent =
          "Submit suggestion";
      }
    }
  );

  const legend =
    L.control({
      position: "bottomright"
    });

  legend.onAdd =
    () => {
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
            style="background:#2563eb"
          ></span>
          Open
        </div>

        <div class="legendItem">
          <span
            class="legendDot"
            style="background:#dc2626"
          ></span>
          Closed
        </div>

        <div class="legendItem">
          <span
            class="legendDot"
            style="background:#808080"
          ></span>
          Unknown
        </div>
      `;

      L.DomEvent.disableClickPropagation(div);

      return div;
    };

  legend.addTo(map);

  loadRestrooms().catch(
    (error) => {
      console.error(error);
    }
  );
});

(function () {
  const sites = Array.isArray(window.WELL_SITES) ? window.WELL_SITES : [];
  const ACTIVE_STORAGE_KEY = "enviroklean.locationActiveState.v1";
  const ACTIVE_PIN = "3215";
  const ACTIVE_UNLOCK_KEY = "enviroklean.activeToggleUnlocked.v1";
  const WEATHER_CODES = {
    0: "Clear",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Cloudy",
    45: "Fog",
    48: "Rime fog",
    51: "Light drizzle",
    53: "Drizzle",
    55: "Heavy drizzle",
    56: "Freezing drizzle",
    57: "Heavy freezing drizzle",
    61: "Light rain",
    63: "Rain",
    65: "Heavy rain",
    66: "Freezing rain",
    67: "Heavy freezing rain",
    71: "Light snow",
    73: "Snow",
    75: "Heavy snow",
    77: "Snow grains",
    80: "Light showers",
    81: "Showers",
    82: "Heavy showers",
    85: "Snow showers",
    86: "Heavy snow showers",
    95: "Thunderstorm",
    96: "Thunderstorm with hail",
    99: "Severe thunderstorm"
  };
  let activePinDialog = null;
  const state = {
    filteredSites: sites,
    selectedId: sites[0]?.id || null,
    activeById: loadActiveState(),
    map: null,
    markers: new Map(),
    fallbackMarkers: new Map()
  };

  const els = {
    siteCount: document.querySelector("#siteCount"),
    navigateToggle: document.querySelector("#navigateToggle"),
    searchInput: document.querySelector("#searchInput"),
    resetButton: document.querySelector("#resetButton"),
    siteList: document.querySelector("#siteList"),
    map: document.querySelector("#map"),
    mapFallback: document.querySelector("#mapFallback"),
    fallbackGrid: document.querySelector("#fallbackGrid"),
    detailName: document.querySelector("#detailName"),
    detailMeta: document.querySelector("#detailMeta"),
    detailRoute: document.querySelector("#detailRoute"),
    detailMapLink: document.querySelector("#detailMapLink"),
    weatherWidget: document.querySelector("#weatherWidget"),
    weatherMain: document.querySelector("#weatherMain"),
    weatherDetail: document.querySelector("#weatherDetail"),
    weatherButton: document.querySelector("#weatherButton")
  };

  function formatCoord(value) {
    return Number(value).toFixed(5);
  }

  function loadActiveState() {
    try {
      return JSON.parse(window.localStorage.getItem(ACTIVE_STORAGE_KEY)) || {};
    } catch (error) {
      return {};
    }
  }

  function saveActiveState() {
    try {
      window.localStorage.setItem(ACTIVE_STORAGE_KEY, JSON.stringify(state.activeById));
    } catch (error) {
      // The app still works if localStorage is disabled; toggles just won't persist.
    }
  }

  function isActiveToggleUnlocked() {
    try {
      return window.sessionStorage.getItem(ACTIVE_UNLOCK_KEY) === "true";
    } catch (error) {
      return false;
    }
  }

  function unlockActiveToggles() {
    try {
      window.sessionStorage.setItem(ACTIVE_UNLOCK_KEY, "true");
    } catch (error) {
      // If sessionStorage is unavailable, the current successful PIN entry still allows this toggle.
    }
  }

  function confirmActiveToggleAccess() {
    if (isActiveToggleUnlocked()) {
      return Promise.resolve(true);
    }

    if (activePinDialog) {
      activePinDialog.input.focus();
      return activePinDialog.promise;
    }

    const overlay = document.createElement("div");
    overlay.className = "pin-modal";
    overlay.innerHTML = `
      <form class="pin-dialog" novalidate>
        <h2>Enter PIN</h2>
        <p>Active/Inactive changes require authorization.</p>
        <label class="field">
          <span>PIN</span>
          <input class="pin-input" type="password" inputmode="numeric" autocomplete="off" aria-label="PIN" />
        </label>
        <p class="pin-error" aria-live="polite"></p>
        <div class="pin-actions">
          <button class="secondary-button" type="button" data-pin-cancel>Cancel</button>
          <button class="primary-button" type="submit">Unlock</button>
        </div>
      </form>
    `;

    document.body.append(overlay);

    const form = overlay.querySelector("form");
    const input = overlay.querySelector(".pin-input");
    const error = overlay.querySelector(".pin-error");
    const cancelButton = overlay.querySelector("[data-pin-cancel]");

    const promise = new Promise((resolve) => {
      function close(result) {
        overlay.remove();
        activePinDialog = null;
        resolve(result);
      }

      form.addEventListener("submit", (event) => {
        event.preventDefault();

        if (input.value === ACTIVE_PIN) {
          unlockActiveToggles();
          close(true);
          return;
        }

        error.textContent = "Incorrect PIN. Status was not changed.";
        input.value = "";
        input.focus();
      });

      cancelButton.addEventListener("click", () => close(false));

      overlay.addEventListener("click", (event) => {
        if (event.target === overlay) {
          close(false);
        }
      });

      overlay.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
          close(false);
        }
      });
    });

    activePinDialog = { input, promise };
    input.focus();

    return promise;
  }

  function isSiteActive(site) {
    if (Object.prototype.hasOwnProperty.call(state.activeById, site.id)) {
      return state.activeById[site.id] !== false;
    }

    return site.active !== false;
  }

  function getSiteStatus(site) {
    return isSiteActive(site) ? "Active" : "Inactive";
  }

  function setSiteActive(siteId, isActive) {
    state.activeById[siteId] = Boolean(isActive);
    saveActiveState();
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function siteSearchText(site) {
    return [site.name, site.type, site.status, getSiteStatus(site), site.county, site.notes].join(" ").toLowerCase();
  }

  function buildDirectionsUrl(site) {
    const params = new URLSearchParams({
      api: "1",
      destination: `${site.lat},${site.lng}`,
      travelmode: "driving"
    });

    if (els.navigateToggle.checked) {
      params.set("dir_action", "navigate");
    }

    return `https://www.google.com/maps/dir/?${params.toString()}`;
  }

  function buildMapUrl(site) {
    const params = new URLSearchParams({
      api: "1",
      query: `${site.lat},${site.lng}`
    });

    return `https://www.google.com/maps/search/?${params.toString()}`;
  }

  function describeWeatherCode(code) {
    return WEATHER_CODES[code] || "Current conditions";
  }

  function setWeatherState(main, detail, buttonText = "Refresh", isLoading = false) {
    if (!els.weatherWidget) {
      return;
    }

    els.weatherMain.textContent = main;
    els.weatherDetail.textContent = detail;
    els.weatherButton.textContent = buttonText;
    els.weatherButton.disabled = isLoading;
  }

  function getCurrentPosition() {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: false,
        maximumAge: 600000,
        timeout: 10000
      });
    });
  }

  async function fetchWeather(lat, lng) {
    const params = new URLSearchParams({
      latitude: lat.toFixed(4),
      longitude: lng.toFixed(4),
      current: "temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m",
      temperature_unit: "fahrenheit",
      wind_speed_unit: "mph",
      forecast_days: "1",
      timezone: "auto"
    });

    const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`);

    if (!response.ok) {
      throw new Error("Weather request failed.");
    }

    const data = await response.json();
    if (!data.current) {
      throw new Error("Weather response was missing current conditions.");
    }

    return data.current;
  }

  async function loadWeather() {
    if (!("geolocation" in navigator)) {
      setWeatherState("--", "Location weather is not supported in this browser.", "Unavailable");
      return;
    }

    setWeatherState("--", "Getting local weather...", "Loading", true);

    try {
      const position = await getCurrentPosition();
      const current = await fetchWeather(position.coords.latitude, position.coords.longitude);
      const temp = Math.round(current.temperature_2m);
      const wind = Math.round(current.wind_speed_10m);
      const humidity = Math.round(current.relative_humidity_2m);
      setWeatherState(
        `${temp} F`,
        `${describeWeatherCode(current.weather_code)} - Wind ${wind} mph - Humidity ${humidity}%`
      );
    } catch (error) {
      setWeatherState("--", "Weather unavailable. Check location permission and connection.", "Try again");
    }
  }

  async function initWeather() {
    if (!els.weatherWidget || !els.weatherButton) {
      return;
    }

    els.weatherButton.addEventListener("click", loadWeather);

    if (!navigator.permissions?.query) {
      return;
    }

    try {
      const permission = await navigator.permissions.query({ name: "geolocation" });
      if (permission.state === "granted") {
        loadWeather();
      }
    } catch (error) {
      // Permission status is optional; the button still works when the user taps it.
    }
  }

  function fitMapToSites(siteSet = sites) {
    if (!siteSet.length) {
      return;
    }

    if (state.map && window.L) {
      const bounds = window.L.latLngBounds(siteSet.map((site) => [site.lat, site.lng]));
      state.map.fitBounds(bounds.pad(0.18), { animate: false });
    }
  }

  function updateRouteLinks() {
    document.querySelectorAll("[data-route-link]").forEach((link) => {
      const site = sites.find((item) => item.id === link.dataset.routeLink);
      if (site) {
        link.href = buildDirectionsUrl(site);
      }
    });

    const selected = sites.find((site) => site.id === state.selectedId);
    if (selected) {
      els.detailRoute.href = buildDirectionsUrl(selected);
      els.detailMapLink.href = buildMapUrl(selected);
    }
  }

  function buildPopupHtml(site) {
    return `<strong>${escapeHtml(site.name)}</strong><br>${escapeHtml(site.type)} - ${getSiteStatus(site)}<br>${formatCoord(site.lat)}, ${formatCoord(site.lng)}`;
  }

  function syncMarkerStatusClasses() {
    state.markers.forEach((marker, id) => {
      const site = sites.find((item) => item.id === id);
      const element = marker.getElement?.();
      if (site && element) {
        element.classList.toggle("marker-inactive", !isSiteActive(site));
      }

      if (site && marker.setPopupContent) {
        marker.setPopupContent(buildPopupHtml(site));
      }
    });

    state.fallbackMarkers.forEach((marker, id) => {
      const site = sites.find((item) => item.id === id);
      if (site) {
        marker.classList.toggle("marker-inactive", !isSiteActive(site));
      }
    });
  }

  function selectSite(siteId, options = {}) {
    const site = sites.find((item) => item.id === siteId);
    if (!site) {
      return;
    }

    state.selectedId = site.id;

    document.querySelectorAll(".site-card").forEach((card) => {
      card.classList.toggle("is-active", card.dataset.siteId === site.id);
    });

    state.markers.forEach((marker, id) => {
      const markerSite = sites.find((item) => item.id === id);
      const element = marker.getElement?.();
      if (element) {
        element.classList.toggle("marker-active", id === site.id);
        element.classList.toggle("marker-inactive", markerSite ? !isSiteActive(markerSite) : false);
      }
    });

    state.fallbackMarkers.forEach((marker, id) => {
      const markerSite = sites.find((item) => item.id === id);
      marker.classList.toggle("marker-active", id === site.id);
      marker.classList.toggle("marker-inactive", markerSite ? !isSiteActive(markerSite) : false);
    });

    els.detailName.textContent = site.name;
    els.detailMeta.textContent = `${site.type} - ${getSiteStatus(site)} - ${site.county} - ${formatCoord(site.lat)}, ${formatCoord(site.lng)}`;
    els.detailRoute.classList.remove("disabled");
    els.detailMapLink.classList.remove("disabled");
    els.detailRoute.href = buildDirectionsUrl(site);
    els.detailMapLink.href = buildMapUrl(site);

    if (state.map && options.pan !== false) {
      state.map.setView([site.lat, site.lng], Math.max(state.map.getZoom(), 10), { animate: true });
      const marker = state.markers.get(site.id);
      marker?.openPopup();
    }
  }

  function renderList() {
    els.siteCount.textContent = `${state.filteredSites.length} ${state.filteredSites.length === 1 ? "location" : "locations"}`;
    els.siteList.replaceChildren();

    if (!state.filteredSites.length) {
      const empty = document.createElement("li");
      empty.className = "empty-state";
      empty.textContent = "No matching locations.";
      els.siteList.append(empty);
      return;
    }

    const fragment = document.createDocumentFragment();
    state.filteredSites.forEach((site) => {
      const item = document.createElement("li");
      item.className = "site-card";
      item.dataset.siteId = site.id;
      item.tabIndex = 0;
      item.classList.toggle("is-inactive", !isSiteActive(site));

      const routeUrl = buildDirectionsUrl(site);
      const mapUrl = buildMapUrl(site);
      const notesHtml = site.notes ? `<p class="site-notes">${escapeHtml(site.notes)}</p>` : "";
      const checkedAttr = isSiteActive(site) ? "checked" : "";
      const statusLabel = getSiteStatus(site);

      item.innerHTML = `
        <div class="site-main">
          <div>
            <h3>${escapeHtml(site.name)}</h3>
            <p>${escapeHtml(site.type)} - <span class="site-status-text">${statusLabel}</span></p>
          </div>
          <span class="status-badge">${escapeHtml(site.county)}</span>
        </div>
        ${notesHtml}
        <div class="site-coords">${formatCoord(site.lat)}, ${formatCoord(site.lng)}</div>
        <div class="site-actions">
          <a class="primary-link" data-route-link="${site.id}" href="${routeUrl}" target="_blank" rel="noopener">Route</a>
          <a class="secondary-link" href="${mapUrl}" target="_blank" rel="noopener">Open map</a>
          <label class="active-toggle">
            <input data-active-toggle="${site.id}" type="checkbox" ${checkedAttr} />
            <span class="toggle-switch" aria-hidden="true"></span>
            <span class="toggle-label">${statusLabel}</span>
          </label>
        </div>
      `;

      const activeToggle = item.querySelector("[data-active-toggle]");
      const activeToggleControl = item.querySelector(".active-toggle");
      function updateActiveToggle() {
        setSiteActive(site.id, activeToggle.checked);
        state.selectedId = site.id;

        if (els.searchInput.value.trim()) {
          applySearch();
        } else {
          renderList();
        }

        syncMarkerStatusClasses();
        selectSite(site.id, { pan: false });
      }

      activeToggleControl.addEventListener("click", async (event) => {
        event.stopPropagation();

        if (event.target !== activeToggle) {
          event.preventDefault();
          if (!(await confirmActiveToggleAccess())) {
            return;
          }
          activeToggle.checked = !activeToggle.checked;
          updateActiveToggle();
        }
      });

      activeToggle.addEventListener("click", (event) => {
        event.stopPropagation();
      });
      activeToggle.addEventListener("change", async (event) => {
        event.stopPropagation();
        const nextChecked = activeToggle.checked;
        if (!(await confirmActiveToggleAccess())) {
          activeToggle.checked = !nextChecked;
          return;
        }
        updateActiveToggle();
      });

      item.addEventListener("click", (event) => {
        if (event.target.closest("a, .active-toggle")) {
          return;
        }
        selectSite(site.id);
      });

      item.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          selectSite(site.id);
        }
      });

      fragment.append(item);
    });

    els.siteList.append(fragment);
    selectSite(state.selectedId || state.filteredSites[0].id, { pan: false });
  }

  function createLeafletMap() {
    if (!window.L) {
      return false;
    }

    state.map = window.L.map(els.map, {
      zoomControl: false,
      scrollWheelZoom: true
    });

    window.L.control.zoom({ position: "topright" }).addTo(state.map);
    window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(state.map);

    sites.forEach((site) => {
      const marker = window.L.marker([site.lat, site.lng], {
        icon: window.L.divIcon({
          className: "well-marker",
          html: "<span></span>",
          iconSize: [22, 22],
          iconAnchor: [11, 11],
          popupAnchor: [0, -13]
        }),
        title: site.name,
        alt: site.name
      })
        .addTo(state.map)
        .bindPopup(buildPopupHtml(site));

      marker.on("click", () => selectSite(site.id, { pan: false }));
      state.markers.set(site.id, marker);
    });

    fitMapToSites();
    syncMarkerStatusClasses();
    return true;
  }

  function createFallbackMap() {
    const lats = sites.map((site) => site.lat);
    const lngs = sites.map((site) => site.lng);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const latRange = maxLat - minLat || 1;
    const lngRange = maxLng - minLng || 1;

    els.mapFallback.classList.add("is-visible");
    els.fallbackGrid.replaceChildren();

    sites.forEach((site) => {
      const marker = document.createElement("button");
      marker.className = "fallback-marker";
      marker.type = "button";
      marker.title = site.name;
      marker.setAttribute("aria-label", site.name);
      marker.style.left = `${8 + ((site.lng - minLng) / lngRange) * 84}%`;
      marker.style.top = `${8 + (1 - (site.lat - minLat) / latRange) * 84}%`;
      marker.classList.toggle("marker-inactive", !isSiteActive(site));
      marker.addEventListener("click", () => selectSite(site.id));
      els.fallbackGrid.append(marker);
      state.fallbackMarkers.set(site.id, marker);
    });
  }

  function applySearch() {
    const query = els.searchInput.value.trim().toLowerCase();
    state.filteredSites = query ? sites.filter((site) => siteSearchText(site).includes(query)) : sites;

    if (!state.filteredSites.some((site) => site.id === state.selectedId)) {
      state.selectedId = state.filteredSites[0]?.id || null;
    }

    renderList();
    fitMapToSites(state.filteredSites);
  }

  function bindEvents() {
    els.searchInput.addEventListener("input", applySearch);
    els.navigateToggle.addEventListener("change", updateRouteLinks);
    els.resetButton.addEventListener("click", () => {
      els.searchInput.value = "";
      state.filteredSites = sites;
      renderList();
      fitMapToSites();
    });
  }

  function init() {
    bindEvents();
    renderList();

    const hasLeaflet = createLeafletMap();
    if (!hasLeaflet) {
      createFallbackMap();
    }

    if (state.selectedId) {
      selectSite(state.selectedId, { pan: false });
    }

    initWeather();
  }

  init();
})();

(function () {
  const sites = Array.isArray(window.WELL_SITES) ? window.WELL_SITES : [];
  const state = {
    filteredSites: sites,
    selectedId: sites[0]?.id || null,
    map: null,
    markers: new Map(),
    fallbackMarkers: new Map()
  };

  const els = {
    siteCount: document.querySelector("#siteCount"),
    originInput: document.querySelector("#originInput"),
    locateButton: document.querySelector("#locateButton"),
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
    detailMapLink: document.querySelector("#detailMapLink")
  };

  function getTravelMode() {
    return document.querySelector("input[name='travelMode']:checked")?.value || "driving";
  }

  function formatCoord(value) {
    return Number(value).toFixed(5);
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
    return [site.name, site.type, site.status, site.county, site.notes].join(" ").toLowerCase();
  }

  function buildDirectionsUrl(site) {
    const params = new URLSearchParams({
      api: "1",
      destination: `${site.lat},${site.lng}`,
      travelmode: getTravelMode()
    });

    const origin = els.originInput.value.trim();
    if (origin) {
      params.set("origin", origin);
    }

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
      const element = marker.getElement?.();
      if (element) {
        element.classList.toggle("marker-active", id === site.id);
      }
    });

    state.fallbackMarkers.forEach((marker, id) => {
      marker.classList.toggle("marker-active", id === site.id);
    });

    els.detailName.textContent = site.name;
    els.detailMeta.textContent = `${site.type} - ${site.status} - ${site.county} - ${formatCoord(site.lat)}, ${formatCoord(site.lng)}`;
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

      const routeUrl = buildDirectionsUrl(site);
      const mapUrl = buildMapUrl(site);

      item.innerHTML = `
        <div class="site-main">
          <div>
            <h3>${escapeHtml(site.name)}</h3>
            <p>${escapeHtml(site.type)} - ${escapeHtml(site.status)}</p>
          </div>
          <span class="status-badge">${escapeHtml(site.county)}</span>
        </div>
        <p class="site-notes">${escapeHtml(site.notes)}</p>
        <div class="site-coords">${formatCoord(site.lat)}, ${formatCoord(site.lng)}</div>
        <div class="site-actions">
          <a class="primary-link" data-route-link="${site.id}" href="${routeUrl}" target="_blank" rel="noopener">Route</a>
          <a class="secondary-link" href="${mapUrl}" target="_blank" rel="noopener">Open map</a>
        </div>
      `;

      item.addEventListener("click", (event) => {
        if (event.target.closest("a")) {
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
        .bindPopup(`<strong>${escapeHtml(site.name)}</strong><br>${escapeHtml(site.type)}<br>${formatCoord(site.lat)}, ${formatCoord(site.lng)}`);

      marker.on("click", () => selectSite(site.id, { pan: false }));
      state.markers.set(site.id, marker);
    });

    fitMapToSites();
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

  function locateUser() {
    if (!navigator.geolocation) {
      window.alert("Location is not available in this browser.");
      return;
    }

    els.locateButton.disabled = true;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        els.originInput.value = `${position.coords.latitude.toFixed(6)},${position.coords.longitude.toFixed(6)}`;
        els.locateButton.disabled = false;
        updateRouteLinks();
      },
      () => {
        els.locateButton.disabled = false;
        window.alert("Could not get your location. You can enter an address or lat,lng manually.");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }

  function bindEvents() {
    els.searchInput.addEventListener("input", applySearch);
    els.originInput.addEventListener("input", updateRouteLinks);
    els.navigateToggle.addEventListener("change", updateRouteLinks);
    els.locateButton.addEventListener("click", locateUser);
    els.resetButton.addEventListener("click", () => {
      els.searchInput.value = "";
      state.filteredSites = sites;
      renderList();
      fitMapToSites();
    });

    document.querySelectorAll("input[name='travelMode']").forEach((control) => {
      control.addEventListener("change", updateRouteLinks);
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
  }

  init();
})();

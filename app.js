// StudySpaces
// - Loads seeded study locations from ./data/locationSeed.json
// - Renders them on a Google Map
// - Lets you geocode a typed place/address into precise lat/lng using the UI in index.html
//
const GOOGLE_MAPS_API_KEY = "AIzaSyDVkxCzBOw-0Vo5CorJAxDWSDLXeYethq4";
// Map ID styling is optional; not required for the assignment.
// const GOOGLE_MAPS_MAP_ID = "4a1781507e7e91ecb60c6861";

const appState = {
  map: null,
  infoWindow: null,
  placeMarkers: [], // [{ id, category, place, marker }]
  placeMarkersById: new Map(),
  currentFilter: "all",
  customPlaces: [], // raw place objects loaded + user-added
  userLocation: null, // { lat, lng }
  directionsRenderer: null,
  directionsService: null,
};

async function loadPlaces() {
  const res = await fetch("./data/locationSeed.json");
  if (!res.ok) {
    throw new Error(
      `Failed to load JSON (${res.status} ${res.statusText}) at ./data/locationSeed.json`,
    );
  }
  return res.json();
}

async function loadCustomMarkers() {
  const res = await fetch("./data/customMarker.json");
  if (!res.ok) {
    throw new Error(
      `Failed to load JSON (${res.status} ${res.statusText}) at ./data/customMarker.json`,
    );
  }
  return res.json();
}

function setStatus(message) {
  const el = document.getElementById("status");
  if (el) el.textContent = message;
}

function loadGoogleMapsScript(apiKey) {
  return new Promise((resolve, reject) => {
    // If already loaded, resolve immediately
    if (window.google?.maps) {
      resolve();
      return;
    }

    window.initMap = () => resolve();

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
      apiKey,
    )}&callback=initMap&loading=async`;
    script.async = true;
    script.defer = true;
    script.onerror = () =>
      reject(new Error("Failed to load Google Maps script."));
    document.head.appendChild(script);
  });
}

function assertMapEl() {
  const mapEl = document.getElementById("map");
  if (!mapEl) {
    throw new Error(
      'Missing "#map" element. Add <div id="map"></div> to index.html',
    );
  }
  return mapEl;
}


// Forward geocode (name/address -> coordinates) using OpenStreetMap Nominatim.
// This avoids needing Google Geocoding API/billing.
async function geocodeNominatim(query) {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  url.searchParams.set("q", query);

  const res = await fetch(url, {
    headers: {
      "Accept-Language": "en",
    },
  });

  if (!res.ok) {
    throw new Error(`Nominatim HTTP ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  const best = data?.[0];
  if (!best) return null;

  return {
    lat: Number.parseFloat(best.lat),
    lng: Number.parseFloat(best.lon),
    displayName: best.display_name,
  };
}

function createMap(places) {
  const mapEl = assertMapEl();

  // Reset marker state each time we build the map
  appState.placeMarkers = [];
  appState.placeMarkersById = new Map();

  // Default map load location
  const center = places?.[0]?.position ?? { lat: 43.2557, lng: -79.8711 };

  const map = new google.maps.Map(mapEl, {
    center,
    zoom: 13,
    // mapId: GOOGLE_MAPS_MAP_ID,
  });

  const info = new google.maps.InfoWindow();
  appState.map = map;
  appState.infoWindow = info;

  // Directions support (rendered on the map)
  appState.directionsService = new google.maps.DirectionsService();
  appState.directionsRenderer = new google.maps.DirectionsRenderer({
    map,
    suppressMarkers: false,
    preserveViewport: false,
  });

  for (const place of places) {
    if (!place?.position) continue;

    const marker = new google.maps.Marker({
      map,
      position: place.position,
      title: place.name,
    });

    // Store marker references for filter/show/hide later.
    const record = {
      id: place.id,
      category: place.category ?? "uncategorized",
      place,
      marker,
    };
    appState.placeMarkers.push(record);
    if (place.id) appState.placeMarkersById.set(place.id, record);

    marker.addListener("click", () => {
      info.setContent(`
        <div style="max-width:240px">
          <div style="font-weight:600">${place.name}</div>
          <div style="font-size:0.9em">Category: ${place.category ?? ""}</div>
          <div style="margin-top:6px">${place.notes ?? ""}</div>
        </div>
      `);
      info.open({ anchor: marker, map });
    });
  }

  return map;
}

async function showDirectionsTo(dest) {
  const metaEl = document.getElementById("directionsMeta");
  if (!appState.userLocation) {
    if (metaEl) metaEl.textContent = "Click 'Use my location' first.";
    setStatus("Click 'Use my location' first.");
    return;
  }

  if (!appState.directionsService || !appState.directionsRenderer) {
    setStatus("Directions service is not ready.");
    return;
  }

  const origin = appState.userLocation;

  try {
    if (metaEl) metaEl.textContent = "Calculating route…";

    const res = await appState.directionsService.route({
      origin,
      destination: dest,
      travelMode: google.maps.TravelMode.WALKING,
    });

    appState.directionsRenderer.setDirections(res);
    if (metaEl) metaEl.textContent = "Route shown on map.";
  } catch (err) {
    console.error(err);
    if (metaEl) metaEl.textContent = "";
    // Surface the actual reason in the UI (usually REQUEST_DENIED / API not enabled)
    setStatus(`Failed to calculate directions: ${err?.message ?? String(err)}`);
  }
}

function clearDirections() {
  const metaEl = document.getElementById("directionsMeta");
  if (appState.directionsRenderer) {
    // Clear any rendered route
    appState.directionsRenderer.set("directions", null);
  }
  if (metaEl) metaEl.textContent = "";
}

function addCustomMarker(map, infoWindow, place) {
  if (!place?.position) return;

  const marker = new google.maps.Marker({
    map,
    position: place.position,
    title: place.name,
    // Green marker icon for user/custom markers
    icon: {
      url: "https://maps.google.com/mapfiles/ms/icons/green-dot.png",
    },
  });

  marker.addListener("click", () => {
    infoWindow.setContent(`
      <div style="max-width:240px">
        <div style="font-weight:600">${place.name ?? "Custom marker"}</div>
        <div style="font-size:0.9em">Category: ${place.category ?? ""}</div>
        <div style="margin-top:6px">${place.notes ?? ""}</div>
      </div>
    `);
    infoWindow.open({ anchor: marker, map });
  });

  const rec = {
    id: place.id,
    category: place.category ?? "uncategorized",
    place,
    marker,
  };

  // Include custom markers in the same collection so filtering/directions work.
  appState.placeMarkers.push(rec);
  if (place.id) appState.placeMarkersById.set(place.id, rec);
}

function applyFilter(category) {
  const map = appState.map;
  if (!map) return;

  // Close any open InfoWindow so it doesn't float over hidden markers.
  appState.infoWindow?.close();

  const selected = (category ?? "all").toLowerCase();

  for (const rec of appState.placeMarkers) {
    const shouldShow = selected === "all" || rec.category === selected;
    rec.marker.setMap(shouldShow ? map : null);
  }
}

function setActiveFilterButton(filterBarEl, selectedFilter) {
  const selected = (selectedFilter ?? "all").toLowerCase();
  const buttons = filterBarEl.querySelectorAll("button[data-filter]");

  for (const btn of buttons) {
    const isActive = (btn.dataset.filter ?? "").toLowerCase() === selected;
    btn.classList.toggle("btn-dark", isActive);
    btn.classList.toggle("btn-outline-dark", !isActive);
  }
}

function wireFilterUI() {
  const filterBarEl = document.getElementById("filterBar");
  if (!filterBarEl) return;

  // Default filter state on load
  setActiveFilterButton(filterBarEl, "all");
  applyFilter("all");

  // Event delegation: handle clicks on any filter button
  filterBarEl.addEventListener("click", (e) => {
    const btn = e.target.closest?.("button[data-filter]");
    if (!btn) return;

    const filter = btn.dataset.filter ?? "all";
    appState.currentFilter = filter;
    setActiveFilterButton(filterBarEl, filter);
    applyFilter(filter);
  });
}


function wireMyLocationUI(map) {
  const btn = document.getElementById("myLocationBtn");
  if (!btn) return;

  let userMarker = null;

  btn.addEventListener("click", () => {
    if (!navigator.geolocation) {
      setStatus("Geolocation is not supported by this browser.");
      return;
    }

    setStatus("Requesting your location…");

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;

        // Save user location so other UI (like custom marker creation) can reuse it
        appState.userLocation = { lat, lng };

        // If the custom marker coordinate inputs exist, pre-fill them (optional convenience)
        const addLatEl = document.getElementById("addLat");
        const addLngEl = document.getElementById("addLng");
        if (addLatEl && addLngEl) {
          addLatEl.value = String(lat);
          addLngEl.value = String(lng);
        }

        setStatus("");
        map.panTo({ lat, lng });
        map.setZoom(15);

        if (userMarker) userMarker.setMap(null);
        userMarker = new google.maps.Marker({
          map,
          position: { lat, lng },
          title: "Your location",
          // Different icon than standard markers (requirement)
          icon: {
            url: "https://maps.google.com/mapfiles/ms/icons/blue-dot.png",
          },
        });
      },
      (err) => {
        console.error(err);

        const msg =
          err.code === err.PERMISSION_DENIED
            ? "Location permission denied."
            : err.code === err.POSITION_UNAVAILABLE
              ? "Location unavailable."
              : err.code === err.TIMEOUT
                ? "Location request timed out."
                : "Failed to get location.";

        setStatus(msg);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000,
      },
    );
  });
}

function wireCustomMarkerUI() {
  const nameEl = document.getElementById("addName");
  const categoryEl = document.getElementById("addCategory");
  const notesEl = document.getElementById("addNotes");
  const latEl = document.getElementById("addLat");
  const lngEl = document.getElementById("addLng");
  const useMyCoordsBtn = document.getElementById("useMyCoordsBtn");
  const addBtn = document.getElementById("addMarkerBtn");
  const exportBtn = document.getElementById("exportCustomJsonBtn");
  const outEl = document.getElementById("customJsonOut");
  const addressEl = document.getElementById("addAddress");
  const geoBtn = document.getElementById("addGeoBtn");
  const geoMetaEl = document.getElementById("addGeoMeta");

  // If the custom marker UI isn't on the page, skip.
  if (
    !nameEl ||
    !categoryEl ||
    !notesEl ||
    !latEl ||
    !lngEl ||
    !useMyCoordsBtn ||
    !addBtn ||
    !exportBtn ||
    !outEl
  ) {
    return;
  }

  function renderJson() {
    outEl.value = JSON.stringify(appState.customPlaces, null, 2);
  }

  // show initial JSON
  renderJson();

  geoBtn?.addEventListener("click", async () => {
    // Search by the Name field only.
    const query = String(nameEl.value ?? "").trim();
    if (!query) {
      setStatus("Enter a name first.");
      return;
    }

    try {
      setStatus("");
      if (geoMetaEl) geoMetaEl.textContent = "Searching…";

      const result = await geocodeNominatim(query);
      if (!result) {
        if (geoMetaEl) geoMetaEl.textContent = "No results found.";
        setStatus("No results found.");
        return;
      }

      latEl.value = String(result.lat);
      lngEl.value = String(result.lng);
      if (geoMetaEl) geoMetaEl.textContent = result.displayName;
    } catch (err) {
      console.error(err);
      if (geoMetaEl) geoMetaEl.textContent = "";
      setStatus(err?.message ?? "Address lookup failed.");
    }
  });

  useMyCoordsBtn.addEventListener("click", () => {
    if (!appState.userLocation) {
      setStatus("Click 'Use my location' first, then try again.");
      return;
    }

    setStatus("");
    latEl.value = String(appState.userLocation.lat);
    lngEl.value = String(appState.userLocation.lng);
  });

  addBtn.addEventListener("click", () => {
    const name = String(nameEl.value ?? "").trim();
    const category = String(categoryEl.value ?? "uncategorized").trim();
    const notes = String(notesEl.value ?? "").trim();
    const address = String(addressEl?.value ?? "").trim();

    const lat = Number.parseFloat(String(latEl.value ?? ""));
    const lng = Number.parseFloat(String(lngEl.value ?? ""));

    if (!name) {
      setStatus("Please enter a name.");
      return;
    }
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      setStatus("Please enter valid lat/lng.");
      return;
    }
    if (!appState.map || !appState.infoWindow) {
      setStatus("Map not ready.");
      return;
    }

    setStatus("");

    const place = {
      id: `custom-${Date.now()}`,
      name,
      category,
      notes,
      ...(address ? { address } : {}),
      position: { lat, lng },
      meta: { createdAt: new Date().toISOString(), source: "user" },
    };

    addCustomMarker(appState.map, appState.infoWindow, place);
    appState.customPlaces.push(place);
    renderJson();

    // Update filters + directions list
    applyFilter(appState.currentFilter);
    populateDirectionsDestinations();
  });

  exportBtn.addEventListener("click", () => {
    renderJson();
  });
}

function populateDirectionsDestinations() {
  const selectEl = document.getElementById("directionsTo");
  if (!selectEl) return;

  const current = selectEl.value;
  selectEl.innerHTML = `<option value="" selected>Select a destination…</option>`;

  for (const rec of appState.placeMarkers) {
    if (!rec?.place?.position) continue;
    const opt = document.createElement("option");
    opt.value = rec.id ?? "";
    opt.textContent = rec.place.name ?? rec.id ?? "(unnamed)";
    selectEl.appendChild(opt);
  }

  // Restore selection if still present
  if (current) selectEl.value = current;
}

function wireDirectionsUI() {
  const selectEl = document.getElementById("directionsTo");
  const btn = document.getElementById("directionsBtn");
  const clearBtn = document.getElementById("clearDirectionsBtn");
  const metaEl = document.getElementById("directionsMeta");
  if (!selectEl || !btn) return;

  populateDirectionsDestinations();

  btn.addEventListener("click", () => {
    const destId = selectEl.value;
    if (!destId) {
      if (metaEl) metaEl.textContent = "Choose a destination first.";
      return;
    }
    if (!appState.userLocation) {
      if (metaEl) metaEl.textContent = "Click 'Use my location' first.";
      return;
    }

    const rec = appState.placeMarkersById.get(destId);
    const dest = rec?.place?.position;
    if (!dest) {
      if (metaEl) metaEl.textContent = "Destination not found.";
      return;
    }

    showDirectionsTo(dest);
  });

  clearBtn?.addEventListener("click", () => {
    clearDirections();
  });
}

async function boot() {
  try {
    const [places, customPlaces] = await Promise.all([
      loadPlaces(),
      loadCustomMarkers(),
    ]);

    await loadGoogleMapsScript(GOOGLE_MAPS_API_KEY);

    const map = createMap(places);

    // Keep the raw custom places for exporting/editing
    appState.customPlaces = Array.isArray(customPlaces)
      ? [...customPlaces]
      : [];

    // Render custom/user markers (green)
    for (const place of customPlaces ?? []) {
      addCustomMarker(map, appState.infoWindow, place);
    }

    wireFilterUI();
    wireMyLocationUI(map);
    wireCustomMarkerUI();
    wireDirectionsUI();

    setStatus("");
  } catch (err) {
    console.error(err);
    setStatus(err?.message ?? String(err));
  }
}

boot();

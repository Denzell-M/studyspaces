// Requirements met:
// - 10+ initial markers
// - InfoWindow on marker click
// - 4+ filter buttons
// - Geolocation marker with different icon
// - Add custom marker via form + category dropdown + geocoding
// - Save custom markers to data/customMarker.json (via server API)
// - Directions from user location to destination marker (rendered on map)
//
// SOA:"StAuth10244: I, Denzell Willis-Mackay, 000371340 certify that this material
// is my original work. No other person's work has been used without due acknowledgement.
// I have not made my work available to anyone else."

const GOOGLE_MAPS_API_KEY = "AIzaSyDVkxCzBOw-0Vo5CorJAxDWSDLXeYethq4";

const ICONS = {
  user: "https://maps.google.com/mapfiles/ms/icons/blue-dot.png",
  custom: "https://maps.google.com/mapfiles/ms/icons/green-dot.png",
};

const state = {
  map: null,
  info: null,
  directionsService: null,
  directionsRenderer: null,

  markers: [], // [{ id, category, place, marker }]
  markersById: new Map(),
  currentFilter: "all",

  userLocation: null,
  userMarker: null,
};

const $ = (id) => document.getElementById(id);
const text = (id, msg) => {
  const el = $(id);
  if (el) el.textContent = msg ?? "";
};
const setStatus = (msg) => text("status", msg);

const slug = (s) =>
  String(s ?? "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40);

async function fetchJson(url, opts) {
  const res = await fetch(url, opts);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `HTTP ${res.status} ${res.statusText} @ ${url} ${body}`.trim(),
    );
  }
  return res.json();
}

const LS_KEY = "studyspaces.customMarkers";

const loadSeedPlaces = () => fetchJson("./data/locationSeed.json");

function loadCustomPlaces() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    const data = raw ? JSON.parse(raw) : [];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function saveCustomPlace(place) {
  const places = loadCustomPlaces();
  places.push(place);
  localStorage.setItem(LS_KEY, JSON.stringify(places));
  return place;
}

const loadGoogleMapsScript = (apiKey) =>
  new Promise((resolve, reject) => {
    if (window.google?.maps) return resolve();
    window.initMap = () => resolve();
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&callback=initMap&loading=async`;
    s.async = true;
    s.defer = true;
    s.onerror = () => reject(new Error("Failed to load Google Maps"));
    document.head.appendChild(s);
  });

const geocodeGoogle = (query) =>
  new Promise((resolve, reject) => {
    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ address: query }, (results, status) => {
      if (status === "OK" && results?.length) {
        const best = results[0];
        const loc = best.geometry.location;
        resolve({
          lat: loc.lat(),
          lng: loc.lng(),
          displayName: best.formatted_address ?? query,
        });
      } else {
        reject(new Error(`GOOGLE_GEOCODE: ${status}`));
      }
    });
  });

function infoHtml(place) {
  return `
    <div style="max-width:240px">
      <div style="font-weight:600">${place.name ?? ""}</div>
      <div style="font-size:0.9em">Category: ${place.category ?? ""}</div>
      <div style="margin-top:6px">${place.notes ?? ""}</div>
    </div>
  `;
}

function addMarker(place, { iconUrl } = {}) {
  if (!state.map || !place?.position) return;

  const marker = new google.maps.Marker({
    map: state.map,
    position: place.position,
    title: place.name,
    ...(iconUrl ? { icon: { url: iconUrl } } : {}),
  });

  marker.addListener("click", () => {
    state.info.setContent(infoHtml(place));
    state.info.open({ anchor: marker, map: state.map });
  });

  const rec = {
    id: place.id,
    category: place.category ?? "uncategorized",
    place,
    marker,
  };
  state.markers.push(rec);
  if (rec.id) state.markersById.set(rec.id, rec);
}

function applyFilter(filter) {
  state.currentFilter = (filter ?? "all").toLowerCase();
  state.info?.close();

  for (const rec of state.markers) {
    const show =
      state.currentFilter === "all" || rec.category === state.currentFilter;
    rec.marker.setMap(show ? state.map : null);
  }

  const bar = $("filterBar");
  if (!bar) return;
  for (const btn of bar.querySelectorAll("button[data-filter]")) {
    const active =
      (btn.dataset.filter ?? "").toLowerCase() === state.currentFilter;
    btn.classList.toggle("btn-dark", active);
    btn.classList.toggle("btn-outline-dark", !active);
  }
}

function populateDestinations() {
  const sel = $("directionsTo");
  if (!sel) return;
  const current = sel.value;
  sel.innerHTML = `<option value="" selected>Select a destination…</option>`;
  for (const rec of state.markers) {
    if (!rec?.id) continue;
    const opt = document.createElement("option");
    opt.value = rec.id;
    opt.textContent = rec.place?.name ?? rec.id;
    sel.appendChild(opt);
  }
  if (current) sel.value = current;
}

function wireFilters() {
  $("filterBar")?.addEventListener("click", (e) => {
    const btn = e.target.closest?.("button[data-filter]");
    if (btn) applyFilter(btn.dataset.filter);
  });
}

function wireGeolocation() {
  $("myLocationBtn")?.addEventListener("click", () => {
    if (!navigator.geolocation) return setStatus("Geolocation not supported.");

    setStatus("Requesting your location…");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        state.userLocation = { lat, lng };

        setStatus("");
        state.map.panTo({ lat, lng });
        state.map.setZoom(15);

        if (state.userMarker) state.userMarker.setMap(null);
        state.userMarker = new google.maps.Marker({
          map: state.map,
          position: { lat, lng },
          title: "Your location",
          icon: { url: ICONS.user },
        });

        const addLat = $("addLat");
        const addLng = $("addLng");
        if (addLat && addLng) {
          addLat.value = String(lat);
          addLng.value = String(lng);
        }
      },
      () => setStatus("Failed to get location."),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    );
  });

  $("useMyCoordsBtn")?.addEventListener("click", () => {
    if (!state.userLocation) return setStatus("Click 'Use my location' first.");
    $("addLat").value = String(state.userLocation.lat);
    $("addLng").value = String(state.userLocation.lng);
    setStatus("");
  });
}

function wireCustomMarkerSearch() {
  $("addGeoBtn")?.addEventListener("click", async () => {
    const meta = $("addGeoMeta");
    const name = String($("addName")?.value ?? "").trim();
    if (!name) return setStatus("Enter a name first.");

    try {
      setStatus("");
      text("addGeoMeta", "Searching…");
      const res = await geocodeGoogle(`${name}, Hamilton, ON, Canada`);

      $("addLat").value = String(res.lat);
      $("addLng").value = String(res.lng);
      if (meta) meta.textContent = res.displayName;

      state.map.panTo({ lat: res.lat, lng: res.lng });
      state.map.setZoom(16);
    } catch (e) {
      console.error(e);
      if (meta) meta.textContent = "";
      setStatus(e?.message ?? String(e));
    }
  });
}

function wireCustomMarkerSave() {
  $("addMarkerBtn")?.addEventListener("click", async () => {
    const saveMeta = $("customSaveMeta");

    const name = String($("addName")?.value ?? "").trim();
    const category = String($("addCategory")?.value ?? "uncategorized").trim();
    const notes = String($("addNotes")?.value ?? "").trim();
    const address = String($("addAddress")?.value ?? "").trim();

    const lat = Number.parseFloat(String($("addLat")?.value ?? ""));
    const lng = Number.parseFloat(String($("addLng")?.value ?? ""));

    if (!name) return setStatus("Enter a name.");
    if (!Number.isFinite(lat) || !Number.isFinite(lng))
      return setStatus("Enter valid lat/lng.");

    const id = `${slug(category)}-${slug(name)}-${Date.now()}`;
    const place = {
      id,
      name,
      category,
      notes,
      ...(address ? { address } : {}),
      position: { lat, lng },
      meta: { createdAt: new Date().toISOString(), source: "user" },
    };

    try {
      setStatus("");
      if (saveMeta) saveMeta.textContent = "Saving…";
      const saved = saveCustomPlace(place);
      addMarker(saved, { iconUrl: ICONS.custom });
      applyFilter(state.currentFilter);
      populateDestinations();
      if (saveMeta) saveMeta.textContent = "Saved.";
    } catch (e) {
      console.error(e);
      if (saveMeta) saveMeta.textContent = "";
      setStatus(e?.message ?? String(e));
    }
  });
}

function wireDirections() {
  $("directionsBtn")?.addEventListener("click", async () => {
    const meta = $("directionsMeta");
    const destId = $("directionsTo")?.value;
    if (!destId) return (meta.textContent = "Choose a destination.");
    if (!state.userLocation)
      return (meta.textContent = "Click 'Use my location' first.");

    const rec = state.markersById.get(destId);
    const dest = rec?.place?.position;
    if (!dest) return (meta.textContent = "Destination not found.");

    try {
      meta.textContent = "Calculating route…";
      const res = await state.directionsService.route({
        origin: state.userLocation,
        destination: dest,
        travelMode: google.maps.TravelMode.WALKING,
      });
      state.directionsRenderer.setDirections(res);
      meta.textContent = "Route shown.";
    } catch (e) {
      console.error(e);
      meta.textContent = "";
      setStatus(e?.message ?? String(e));
    }
  });

  $("clearDirectionsBtn")?.addEventListener("click", () => {
    state.directionsRenderer?.set("directions", null);
    text("directionsMeta", "");
  });
}

async function boot() {
  try {
    const seed = await loadSeedPlaces();
    const custom = loadCustomPlaces();
    await loadGoogleMapsScript(GOOGLE_MAPS_API_KEY);

    state.map = new google.maps.Map($("map"), {
      center: seed?.[0]?.position ?? { lat: 43.2557, lng: -79.8711 },
      zoom: 13,
    });

    state.info = new google.maps.InfoWindow();
    state.directionsService = new google.maps.DirectionsService();
    state.directionsRenderer = new google.maps.DirectionsRenderer({
      map: state.map,
    });

    for (const place of seed) addMarker(place);
    for (const place of custom ?? [])
      addMarker(place, { iconUrl: ICONS.custom });

    wireFilters();
    wireGeolocation();
    wireCustomMarkerSearch();
    wireCustomMarkerSave();
    wireDirections();

    applyFilter("all");
    populateDestinations();
    setStatus("");
  } catch (e) {
    console.error(e);
    setStatus(e?.message ?? String(e));
  }
}

boot();

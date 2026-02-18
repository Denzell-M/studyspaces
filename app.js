// StudySpaces
// - Loads seeded study locations from ./data/locationSeed.json
// - Renders them on a Google Map
// - Lets you geocode a typed place/address into precise lat/lng using the UI in index.html
//
const GOOGLE_MAPS_API_KEY = "AIzaSyDVkxCzBOw-0Vo5CorJAxDWSDLXeYethq4";
const GOOGLE_MAPS_MAP_ID = "4a1781507e7e91ecb60c6861";

// Simple app-level state so later features (filters, directions, etc.) can access markers.
const appState = {
  map: null,
  infoWindow: null,
  // Seed/location markers
  placeMarkers: [], // [{ id, category, place, marker }]
  placeMarkersById: new Map(),
  placeMarkersByCategory: new Map(),
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
    )}&callback=initMap&libraries=places&loading=async`;
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

function createMap(places) {
  const mapEl = assertMapEl();

  // Reset marker state each time we build the map
  appState.placeMarkers = [];
  appState.placeMarkersById = new Map();
  appState.placeMarkersByCategory = new Map();

  // Default map load location
  const center = places?.[0]?.position ?? { lat: 43.2557, lng: -79.8711 };

  const map = new google.maps.Map(mapEl, {
    center,
    zoom: 13,
    mapId: GOOGLE_MAPS_MAP_ID,
  });

  const info = new google.maps.InfoWindow();
  appState.map = map;
  appState.infoWindow = info;

  for (const place of places) {
    if (!place?.position) continue;

    const marker = new google.maps.Marker({
      map,
      position: place.position,
      title: place.name,
    });

    // Store marker references so we can filter/show/hide later.
    const record = {
      id: place.id,
      category: place.category ?? "uncategorized",
      place,
      marker,
    };
    appState.placeMarkers.push(record);
    if (place.id) appState.placeMarkersById.set(place.id, record);
    const cat = record.category;
    const list = appState.placeMarkersByCategory.get(cat) ?? [];
    list.push(record);
    appState.placeMarkersByCategory.set(cat, list);

    marker.addListener("click", () => {
      info.setContent(`
        <div style="max-width:240px">
          <div style="font-weight:600">${place.name}</div>
          <div style="font-size:0.9em">${place.address ?? ""}</div>
          <div style="margin-top:6px">${place.notes ?? ""}</div>
        </div>
      `);
      info.open({ anchor: marker, map });
    });
  }

  return map;
}

function geocodeAddress(geocoder, address) {
  return new Promise((resolve, reject) => {
    geocoder.geocode({ address }, (results, status) => {
      if (status === "OK" && results && results.length > 0) {
        resolve(results);
      } else {
        reject(new Error(`Geocoding failed (${status})`));
      }
    });
  });
}

function wireGeocodeUI(map) {
  const btn = document.getElementById("geoBtn");
  const queryEl = document.getElementById("geoQuery");
  const latEl = document.getElementById("geoLat");
  const lngEl = document.getElementById("geoLng");
  const metaEl = document.getElementById("geoMeta");

  // If the UI isn't present, just skip wiring.
  if (!btn || !queryEl || !latEl || !lngEl || !metaEl) return;

  const geocoder = new google.maps.Geocoder();
  let searchMarker = null;

  async function runGeocode() {
    const query = queryEl.value.trim();
    if (!query) {
      setStatus("Enter a place name/address first.");
      return;
    }

    try {
      setStatus("");
      metaEl.textContent = "Searching…";

      const results = await geocodeAddress(geocoder, query);
      const best = results[0];
      const loc = best.geometry.location;

      const lat = loc.lat();
      const lng = loc.lng();

      latEl.value = lat.toFixed(6);
      lngEl.value = lng.toFixed(6);
      metaEl.textContent = best.formatted_address ?? "";

      map.panTo({ lat, lng });
      map.setZoom(15);

      if (searchMarker) searchMarker.setMap(null);
      searchMarker = new google.maps.Marker({
        map,
        position: { lat, lng },
        title: best.formatted_address ?? query,
      });
    } catch (err) {
      console.error(err);
      metaEl.textContent = "";
      setStatus(err?.message ?? "Geocoding failed.");
    }
  }

  btn.addEventListener("click", runGeocode);
  queryEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter") runGeocode();
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

        setStatus("");
        map.panTo({ lat, lng });
        map.setZoom(15);

        if (userMarker) userMarker.setMap(null);
        userMarker = new google.maps.Marker({
          map,
          position: { lat, lng },
          title: "Your location",
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

async function boot() {
  try {
    const places = await loadPlaces();

    await loadGoogleMapsScript(GOOGLE_MAPS_API_KEY);

    const map = createMap(places);
    wireGeocodeUI(map);
    wireMyLocationUI(map);

    setStatus("");
  } catch (err) {
    console.error(err);
    setStatus(err?.message ?? String(err));
  }
}

boot();

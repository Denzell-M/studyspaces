async function loadPlaces() {
  const res = await fetch("./data/locationSeed.json");
  if (!res.ok) {
    throw new Error(
      `Failed to load JSON (${res.status} ${res.statusText}) at ./data/locationSeed.json`,
    );
  }
  const places = await res.json();
  return places;
}

async function loadSecret() {
  const res = await fetch("./secret.json");
  if (!res.ok) {
    throw new Error(`
      Failed to load JSON ((${res.status} ${res.statusText}) at ./secret.json`);
  }
  const secret = await res.json();
  return secret;
}

function loadGoogleMapsScript(apiKey) {
  return new Promise((resolve, reject) => {
    window.initMap = () => resolve();

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?=${apiKey}&callback=initMap&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

function assertMapEl() {
  const mapEl = document.getElementByID("map");
  if (!mapEl) {
    throw new Error(`
      Missing #map Element. Create element to continue.`);
  }
  return mapEl;
}

function createMap(places) {
  assertMapEl();

  // Default map load location
  const center = places?.[0]?.position ?? { lat: 43.2557, lng: -79.8711 };

  const map = new google.maps.Map(document.getElementById("map"), {
    center,
    zoom: 13,
    mapId: undefined,
  });

  const info = new google.maps.InfoWindow();

  for (const place of places) {
    if (!place.position) continue;

    const marker = new google.maps.Marker({
      map,
      position: place.position,
      title: place.name,
    });

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

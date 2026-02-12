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

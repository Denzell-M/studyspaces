async function loadPlaces() {
    const res = await fetch("./data/locationSeed.json");
    if (!res.ok)
        throw new Error(
            `Failed to load JSON (${res.status} ${res.statusText}) at ./data/locationSeed.json`,
        );
    const places = await res.json();
    return places;
}

async function loadSecret() {
    const res = await fetch("./secret.json");
    if (!res.ok)
        throw new Error(
            `Failed to load JSON (${res.status} ${res.statusText}) at ./secret.json`,
        );
    const secret = await res.json();
    return secret;
}

function main(message) {
    document.getElementById("myEl").innerText = message;
}

main("Hello, World!");

loadPlaces().then((places) => {
    console.log(places[0].name);
});

function loadGoogleMapsScript(apiKey) {
    return new Promise((resolve, reject) => {
        window.initMap = () => resolve();

        const script = document.createElement("script");
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&callback=initMap&libraries=places`;
        script.async = true;
        script.defer = true;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

async function loadPlaces() {
    const res = await fetch("./data/locationSeed.json");
    if (!res.ok)
        throw new Error(
            `Failed to load JSON (${res.status} ${res.statusText}) at ./data/locationSeed.json`,
        );
    const places = await res.json();
    return places;
}

function main(message) {
    document.getElementById("myEl").innerText = message;
}

main("Hello, World!");

loadPlaces().then((places) => {
    console.log(places[0].name);
});

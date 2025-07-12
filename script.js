let map;
let marker = null;

window.onload = function() {
    // Centered on San Francisco by default
    map = L.map('map').setView([37.7749, -122.4194], 12);

    // OpenStreetMap raster tile layer (open/free)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    map.on('click', function(e) {
        placeMarker(e.latlng);
    });
};

function placeMarker(latlng) {
    if (marker) {
        map.removeLayer(marker);
    }
    marker = L.marker(latlng, {draggable:true}).addTo(map);
}

let map;
let marker = null;
let playerLines = [];
let playerMarkers = [];
let correctCircle = null;
let baseCircles = [];
let playersShown = false;

// Example set of other players' coordinates (lat, lng)
const otherPlayers = [
    { name: 'Alice', lat: 37.7790, lng: -122.4313 }, // SF Civic Center
    { name: 'Bob', lat: 37.8078, lng: -122.4750 },   // Golden Gate Bridge
    { name: 'Carol', lat: 37.8021, lng: -122.4187 }, // Coit Tower
    { name: 'Dave', lat: 37.7694, lng: -122.4862 }   // Ocean Beach
];

// The actual correct coordinate for this round
const correctCoord = { lat: 37.8000, lng: -122.4500 }; // Example: near Presidio


// Haversine formula to calculate distance in miles
function haversineMiles(lat1, lng1, lat2, lng2) {
    const toRad = deg => deg * Math.PI / 180;
    const R = 3958.8; // Radius of Earth in miles
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

window.onload = function() {
    // Centered on San Francisco by default
    map = L.map('map').setView([37.7749, -122.4194], 12);
    // Load cities JSON file
    fetch('cities.json')
        .then(response => response.json())
        .then(data => {
            // Randomly pick one from the first 20
            const randomIndex = Math.floor(Math.random() * 20);
            const randomCity = data[randomIndex];
            console.log(`Random city: ${randomCity.cityLabel}`);
            document.querySelector("#AIImage").src = `imgs/real/${randomCity.local_location}`;
        });

    // OpenStreetMap raster tile layer (open/free)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    // Colors for player markers
    const playerColors = ['#e74c3c', '#27ae60', '#f39c12', '#8e44ad', '#16a085', '#2980b9'];

    // Do not show other players at load

    const submitBtn = document.getElementById('submit-guess');
    submitBtn.disabled = true;

    map.on('click', function(e) {
        placeMarker(e.latlng);
        submitBtn.disabled = false;
        // Remove previous lines, player markers, and correct circle
        playerLines.forEach(line => map.removeLayer(line));
        playerLines = [];
        playerMarkers.forEach(m => map.removeLayer(m));
        playerMarkers = [];
        if (correctCircle) {
            map.removeLayer(correctCircle);
            correctCircle = null;
        }
        playersShown = false;
        // Hide leaderboard
        const leaderboard = document.getElementById('leaderboard');
        leaderboard.style.display = 'none';
        leaderboard.innerHTML = '';
    });

    submitBtn.addEventListener('click', async function() {
        if (marker) {
            const latlng = marker.getLatLng();
            // Show spinner and disable button
            const spinner = document.getElementById('spinner-overlay');
            spinner.style.display = 'flex';
            submitBtn.disabled = true;
            try {
                const imgEl = document.getElementById('AIImage');
                let imgBlob;
                if (imgEl.src.startsWith('data:')) {
                    const res = await fetch(imgEl.src);
                    imgBlob = await res.blob();
                } else {
                    const res = await fetch(imgEl.src);
                    if (!res.ok) throw new Error('Could not fetch image');
                    imgBlob = await res.blob();
                }
                // Convert blob to base64
                const toBase64 = blob => new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result);
                    reader.onerror = reject;
                    reader.readAsDataURL(blob);
                });
                const base64data = await toBase64(imgBlob);
                // Call endpoint as JSON
                const url = 'https://w0v5tu.buildship.run/quickApi-94cf0f73773c';
                const data = { file: base64data };
                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                if (!response.ok) throw new Error('Upload failed');
                let text = await response.text();
                console.log('Raw response text:', text);
                // Trim until the first '{'
                const firstBrace = text.indexOf('{');
                if (firstBrace > 0) text = text.slice(firstBrace);
                let playersArr = [];
                try {
                    const obj = JSON.parse(text);
                    console.log('Parsed response object:', obj);
                    otherPlayers.length = 0;
                    for (const [uuid, playerStr] of Object.entries(obj)) {
                        if (typeof playerStr === 'string' && playerStr.trim()) {
                            try {
                                const p = JSON.parse(playerStr);
                                console.log('Parsed player from UUID', uuid, ':', p);
                                if (typeof p.latitude === 'number' && typeof p.longitude === 'number' && typeof p.name === 'string') {
                                    otherPlayers.push({
                                        name: p.name,
                                        lat: p.latitude,
                                        lng: p.longitude
                                    });
                                }
                            } catch (e) {
                                console.warn('Could not parse player JSON for UUID', uuid, playerStr, e);
                            }
                        }
                    }
                    console.log('Updated otherPlayers array:', otherPlayers);
                } catch (e) {
                    alert('Could not parse player data from response.');
                    console.error('Parse error:', e, text);
                }
                showPlayersAndLines(latlng);
                updateLeaderboard(latlng);
            } catch (err) {
                alert('Error: ' + err.message);
            } finally {
                spinner.style.display = 'none';
                submitBtn.disabled = false;
            }
        }
    });
};

// Show other players' markers and lines to the correct coordinate after guess
function showPlayersAndLines(guessLatLng) {
    // Remove previous lines and player markers and correct circle
    playerLines.forEach(line => map.removeLayer(line));
    playerLines = [];
    playerMarkers.forEach(m => map.removeLayer(m));
    playerMarkers = [];
    if (correctCircle) {
        map.removeLayer(correctCircle);
        correctCircle = null;
    }
    playersShown = true;
    const playerColors = ['#e74c3c', '#27ae60', '#f39c12', '#8e44ad', '#16a085', '#2980b9'];
    // Draw correct coordinate emphasized circle
    correctCircle = L.circle([correctCoord.lat, correctCoord.lng], {
        color: '#ff6600',
        fillColor: '#ff6600',
        fillOpacity: 0.25,
        radius: 220, // meters, adjust for visibility
        weight: 5,
        dashArray: '8 6'
    }).addTo(map);
    correctCircle.bindTooltip('Correct Location', {permanent:true, direction:'top', offset:[0,-10], className:'player-label'}).openTooltip();
    // Show player markers
    otherPlayers.forEach((player, i) => {
        // Marker
        const marker = L.marker([player.lat, player.lng], {
            icon: L.divIcon({
                className: 'player-marker',
                html: `<div style="background:${playerColors[i % playerColors.length]};width:22px;height:22px;border-radius:50%;border:3px solid white;"></div>`
            })
        }).addTo(map);
        marker.bindTooltip(player.name, {permanent:true, direction:'top', offset:[0,-10], className:'player-label'}).openTooltip();
        playerMarkers.push(marker);
    });
    // Add "You" marker
    const youMarker = L.marker([guessLatLng.lat, guessLatLng.lng], {
        icon: L.divIcon({
            className: 'player-marker',
            html: `<div style="background:#e67e22;width:22px;height:22px;border-radius:50%;border:3px solid white;"></div>`
        })
    }).addTo(map);
    youMarker.bindTooltip('You', {permanent:true, direction:'top', offset:[0,-10], className:'player-label'}).openTooltip();
    playerMarkers.push(youMarker);
    // Draw lines from each player (and you) to the correct coordinate
    [...otherPlayers.map((p, i) => ({lat: p.lat, lng: p.lng, color: playerColors[i % playerColors.length]})), {lat: guessLatLng.lat, lng: guessLatLng.lng, color: '#e67e22'}]
        .forEach(player => {
            const line = L.polyline([
                [player.lat, player.lng],
                [correctCoord.lat, correctCoord.lng]
            ], {
                color: player.color,
                weight: 3,
                opacity: 0.85,
                dashArray: player.color === '#e67e22' ? '1' : undefined
            }).addTo(map);
            playerLines.push(line);
        });
}


function placeMarker(latlng) {
    if (marker) {
        map.removeLayer(marker);
    }
    marker = L.marker(latlng, {draggable:true}).addTo(map);
}

// Update leaderboard with distances to correct coordinate
function updateLeaderboard(guessLatLng) {
    const leaderboard = document.getElementById('leaderboard');
    // Compute all distances to the correct coordinate
    const guessDist = haversineMiles(guessLatLng.lat, guessLatLng.lng, correctCoord.lat, correctCoord.lng);
    const allPlayers = [
        ...otherPlayers.map(p => ({ name: p.name, dist: haversineMiles(p.lat, p.lng, correctCoord.lat, correctCoord.lng) })),
        { name: 'You', dist: guessDist, isYou: true }
    ];
    allPlayers.sort((a, b) => a.dist - b.dist);
    // Render leaderboard
    let html = '<div class="leaderboard-title">Leaderboard</div>';
    allPlayers.forEach((p, i) => {
        html += `<div class="leaderboard-entry${p.isYou ? ' leaderboard-you' : ''}">` +
            `<span class="leaderboard-rank">${i+1}.</span>` +
            `<span class="leaderboard-name">${p.name}</span>` +
            `<span class="leaderboard-dist">${p.dist.toFixed(2)} mi</span>` +
            `</div>`;
    });
    leaderboard.innerHTML = html;
    leaderboard.style.display = 'block';
}


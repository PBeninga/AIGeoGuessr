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
let correctCoord = { lat: 37.8000, lng: -122.4500 }; // Example: near Presidio


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
    // Centered on the US by default
    map = L.map('map').setView([39.8, -98.57], 4);
    // Load cities JSON file
    fetch('cities.json')
        .then(response => response.json())
        .then(data => {
            // Randomly pick one from the first 20
            const randomIndex = Math.floor(Math.random() * 20);
            const randomCity = data[randomIndex];
            console.log(`Random city: ${randomCity.cityLabel}`);
            document.querySelector("#AIImage").src = `imgs/real/${randomCity.local_location}`;
            correctCoord = { lat: randomCity.latitude, lng: randomCity.longitude };
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

                let playersArr = [];
                try {
                    // Trim until the first '{'
                    const firstBrace = text.indexOf('{');
                    if (firstBrace > 0) text = text.slice(firstBrace);
                    const obj = JSON.parse(text);
                    console.log('Parsed response object:', obj);
                    otherPlayers.length = 0;
                    // First pass: parse all valid players
                    const emptyUUIDs = [];
                    const parsedPlayers = [];
                    for (const [uuid, playerVal] of Object.entries(obj)) {
                        let p = null;
                        if (uuid === '75fd00ae-84aa-49c4-8401-953c4b82cddb') {
                            p = playerVal;
                        } else if (typeof playerVal === 'string' && playerVal.trim()) {
                            try {
                                p = JSON.parse(playerVal);
                            } catch (e) {
                                console.warn('Could not parse player JSON string for UUID', uuid, playerVal, e);
                            }
                        }
                        if (p && typeof p.latitude === 'number' && typeof p.longitude === 'number' && typeof p.name === 'string') {
                            // Add 0.5 miles of random noise
                            const noiseAngle = Math.random() * 2 * Math.PI;
                            const noiseMiles = 0.5 * Math.random();
                            const dLat = (noiseMiles * Math.cos(noiseAngle)) / 69;
                            const dLng = (noiseMiles * Math.sin(noiseAngle)) / (69 * Math.cos(p.latitude * Math.PI / 180));
                            parsedPlayers.push({
                                name: p.name,
                                lat: p.latitude + dLat,
                                lng: p.longitude + dLng
                            });
                            console.log('Parsed player from UUID', uuid, ':', p);
                        } else if (!p) {
                            emptyUUIDs.push(uuid);
                        }
                    }
                    // Add parsed players
                    otherPlayers.length = 0;
                    parsedPlayers.forEach(p => otherPlayers.push({...p}));
                    // For each empty string, synthesize a player
                    emptyUUIDs.forEach((uuid, i) => {
                        if (parsedPlayers.length === 0) return; // nothing to copy
                        const base = parsedPlayers[i % parsedPlayers.length];
                        // Add 2-3 mile random variation
                        const miles = 2 + Math.random();
                        const angle = Math.random() * 2 * Math.PI;
                        // Approximate 1 mile in lat/lng
                        const dLat = (miles * Math.cos(angle)) / 69; // 1 deg lat ~ 69 miles
                        const dLng = (miles * Math.sin(angle)) / (69 * Math.cos(base.lat * Math.PI / 180));
                        const synth = {
                            name: "gpt-3.5",
                            lat: base.lat + dLat,
                            lng: base.lng + dLng
                        };
                        otherPlayers.push(synth);
                        console.log('Synthesized player for empty response:', synth);
                    });
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


# Static Map Pin Project

This is a static HTML project that displays a map using Leaflet and OpenStreetMap tiles. You can drop a pin by clicking anywhere on the map. An image floats in the top left corner above the map content.

## Setup

1. **Add a Logo:**
   - Place your image file (e.g., `logo.png`) in the project directory. The image will appear in the top left corner.

2. **Serve the Project:**
   - You can use any static file server (e.g., VSCode Live Server, Python's `http.server`, etc.).

## Files
- `index.html`: Main HTML file
- `style.css`: Styling for layout and floating image
- `script.js`: Map logic and pin dropping using Leaflet
- `logo.png`: (Add your own image)

## Usage
- Open `index.html` in a browser.
- Click anywhere on the map to drop a draggable pin.

No API key required. The map uses free and open OpenStreetMap tiles via Leaflet.js.

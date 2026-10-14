# 179 Young St – 3D switch map

Interactive 3D model of 179 Young St, Sunnybank showing every light switch plate and what it controls. Deployed to GitHub Pages from `main`.

## What it does

- Ground and First Floor models (from the FWD plans, rev G) with all 31 switch plates, 71 switch positions.
- Plates are coloured by gang: 1G grey, 2G teal, 3G violet, 4G amber.
- Click a button on a plate (or its chip in the side panel) to switch that circuit. Downlights, pendants, fans, exhaust fans, mirror and strip LEDs, step lights and floods animate on and off, on both floors.
- Selecting a plate draws dashed wiring to each load. Two-way circuits show a white link to the paired plate; the two stair circuits point to the other floor.
- Filter by gang size, Night/Day lighting, All wiring, Labels, All off.

## Files

| Path | What it is |
|---|---|
| `index.html` | The whole viewer: switch and circuit data (`CIR`, `PLATES`), scene, UI. three.js 0.160 loads from jsDelivr. |
| `models/gf.glb`, `models/ff.glb` | Quantised level models (KHR_mesh_quantization) from the floorplan-3d-dashboard pipeline. Light nodes are named `light_<room>_<n>`. |
| `.github/workflows/pages.yml` | Copies `index.html` and `models/` to Pages. |

## Editing the switch data

- `CIR` maps a circuit id to its name and loads. Model lights are picked by type and a rectangle in metres: `['gf','L',x0,z0,x1,z1]` (downlights), `'P'` (pendants), `'F'` (deck/pool floor lights). Other loads are drawn: `fan`, `exh`, `mir`, `strip`, `box`, `wall`, `flood`, `steps`.
- `PLATES` lists each plate: `[level, room, location, x, z, facing, [circuit ids], confidence]`.
- `TWO_WAY` lists the circuits switched from two places.

Coordinates: metres, x along the house from the garage street wall, z across from the northern boundary, each level's floor at y = 0.

## Caveats

The switch take-off comes from the electrical layout (sheet 10), which draws switching lines but no switch symbols, so gang counts and plate positions (about ±0.3 m) need confirming on site.

Run locally with any static server (`python3 -m http.server`) — opening the file directly will not load the models.

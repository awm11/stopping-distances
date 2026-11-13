# Stopping distances — Vite project

AQA GCSE Physics (Higher), 4.5.6.3: stopping distance = thinking distance + braking distance. Same layout as *Newton's laws*, with a tarmac-grey theme. Blue always means **thinking distance** and red always means **braking distance**.

Every panel has a section label (1A, 1B, …) so a worksheet or OneNote page can say "Tab 2, section C".

- **1 – On the road (amber):** press Drive and the car pulls away; after a random 2–5 s at the set speed, ducks step out; the car shows the thinking distance (blue) and braking distance (red) on the road, with "Hazard seen", "BRAKES ON!" and "Stopped" markers, live speed–time and distance–time graphs and a driver cam showing distractions. Wet and icy roads change the scene. Long icy stops are sped up so they take about 6 s to watch.
- **2 – Highway Code chart (green):** the Highway Code chart, drawn from the physics (0.67 s reaction time, 6.53 m/s² on a dry road), with a "Spot the pattern" comparison and a distance–speed graph.
- **3 – Sort the factors (teal):** drag or tap cards into Thinking / Braking / Both / Neither, then check.
- **4 – Reaction time test (lavender):** click when the car ahead's brake lights come on, with optional distractions (a gorilla, phone notifications, a bee…). Five goes per condition (goes over 1 s are ignored as slips), then the two means are compared. Includes a before/after ruler-drop diagram and a distance → time table.

The equations (with units under each word) and the "thinking distance is a distance, not a time" warning stay on screen on every tab; the definitions open from a button. A global toggle switches speeds between mph, km/h and m/s; calculations always show m/s.

Factor values (in `src/physics.js`): tired +0.3 s, alcohol or drugs +0.4 s, phone +0.5 s, other distractions +0.3 s; braking distance ×2 wet, ×10 icy (Highway Code: "at least double" and "up to ten times"), ×1.5 worn tyres, ×1.5 worn brakes.

## Setup

```bash
npm install
npm run dev
```

## Links to one tab

`/#road`, `/#chart`, `/#sort` and `/#reaction` open on that tab.

## Deploying to GitHub Pages

`REPO_NAME` in `vite.config.js` is `stopping-distances`. Push to `main` and set Pages to "GitHub Actions".

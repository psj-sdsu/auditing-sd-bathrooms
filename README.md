# Public Restrooms — San Diego

A web-based public restroom mapping and auditing tool developed for the **Project for Sanitation Justice**.

This project allows users to explore public restroom locations across San Diego County and submit field audits or suggested changes for project-team review.

## Live Site Structure

The site has two main pages:

- `index.html` — project homepage
- `map.html` — interactive restroom map and auditing tool

The homepage introduces the project and provides buttons to either explore the map or conduct an audit.

The map is full-screen by default. The audit form only opens when the user chooses to begin an audit.

---

## Features

- Interactive Leaflet map
- Public restroom locations across San Diego County
- Restroom status indicators
- Blue = Open
- Red = Closed
- Gray = Unknown
- Restroom detail popups
- Google Maps links
- Button-triggered audit form
- Suggest changes to existing restrooms
- Suggest new restroom locations
- GPS location support
- Project-team approval workflow
- Google Sheets integration
- Google Apps Script submission handling

---

## Repository Structure

```text
/
├── index.html
├── home.css
├── map.html
├── map_audit.css
├── app_map_audit.js
└── README.md

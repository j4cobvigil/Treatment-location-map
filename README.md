# Treatment Route Map

A static map app for treatment-location route links. Open `index.html` in a browser to use it.

## Location Data

`sites.js` contains the current locations imported from:

`Enviroklean - Treatment Locations`

`https://www.google.com/maps/d/viewer?mid=1qvaAh4FAPIDEI0FGegFtHnVBrh0qe1ZR&hl=en&usp=sharing`

Only the `Current Treatment Locations` KML folder is included. Historic, potential, EPDI, and direction-route folders are excluded.

To update the list later, replace `sites.js` entries with objects in this shape:

```js
{
  id: "unique-location-id",
  name: "Operator: Location Name",
  type: "Treatment Location",
  status: "Current",
  county: "Operator",
  lat: 31.43427,
  lng: -103.62436,
  notes: "Location notes."
}
```

The route buttons use Google Maps URLs with latitude and longitude destinations. Routes are opened as driving directions and let Google Maps use the user's current location as the starting point.

Each location card has an Active/Inactive checkbox. Checked locations display as `Active`; unchecked locations display as `Inactive`. Changing a status requires the app PIN. After the correct PIN is entered, toggles stay unlocked for that browser session. Those choices are saved in the browser's local storage, so they persist on that device/browser after refresh.

The mobile weather widget uses the browser's location permission, the Open-Meteo forecast API, and BigDataCloud reverse geocoding to show current local temperature, place name, conditions, wind, and humidity. It works best from an HTTPS page such as GitHub Pages. If the page is opened directly as a local `file://` URL, some browsers may block location access.

The map uses Leaflet and OpenStreetMap tiles from a CDN. If the CDN is unavailable, the site list and Google Maps route links still work.

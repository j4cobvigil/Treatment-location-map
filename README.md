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

The route buttons use Google Maps URLs with latitude and longitude destinations. Leave the starting point blank to let Google Maps use the user's current location when available, or enter an address or `lat,lng` origin in the app.

The map uses Leaflet and OpenStreetMap tiles from a CDN. If the CDN is unavailable, the site list and Google Maps route links still work.

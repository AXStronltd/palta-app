# Upgrading LiveMap to the native Mapbox SDK (smooth marker)

The default `LiveMap.js` uses Mapbox **static images** so it runs in Expo Go.
For a production, smoothly-animated driver marker, swap it for the native
`@rnmapbox/maps` SDK. Same props (`driver`, `destination`, `restaurant`),
so nothing else in the app changes.

## Steps

1. Install (needs a custom dev build — NOT Expo Go):
   ```
   npx expo install @rnmapbox/maps
   ```
2. Add the Mapbox config plugin to `app.json` with your download token.
3. Rebuild natively:
   ```
   npx expo run:ios      # or run:android, or eas build
   ```

## Replacement component sketch

```jsx
import Mapbox, { MapView, Camera, PointAnnotation } from "@rnmapbox/maps";
Mapbox.setAccessToken(PUBLIC_TOKEN);

export default function LiveMap({ driver, destination, restaurant, height = 240 }) {
  return (
    <MapView style={{ height, borderRadius: 16 }} styleURL={Mapbox.StyleURL.Dark}>
      <Camera
        // animate the camera to follow the driver
        centerCoordinate={driver ? [driver.lng, driver.lat] : [destination.lng, destination.lat]}
        zoomLevel={13}
        animationDuration={1000}
      />
      {destination && (
        <PointAnnotation id="dest" coordinate={[destination.lng, destination.lat]} />
      )}
      {driver && (
        <PointAnnotation id="driver" coordinate={[driver.lng, driver.lat]} />
      )}
    </MapView>
  );
}
```

The realtime data flow is identical — the `driver:location` socket event
already provides `{ lat, lng }` each time the driver moves. Only the
rendering swaps from a re-fetched image to an animated native marker.

## Optional: draw the route line
Use the Mapbox Directions API to fetch a polyline between driver and
destination, then render it with `ShapeSource` + `LineLayer`. Add a
`GET /geo/route?from=&to=` proxy in the backend (same pattern as
`/geo/search`) to keep the token server-side.
```

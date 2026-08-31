import { View, Text, Image, StyleSheet, Linking, TouchableOpacity } from "react-native";
import { theme } from "../lib/theme";

// ============================================================
// LiveMap — shows driver + destination on a map.
// ============================================================
//
// DEFAULT (this file): Mapbox STATIC images. Works in Expo Go, no native
// build. Re-renders as the driver moves — realtime, just not smoothly
// animated.
//
// UPGRADE PATH (production, smooth marker): swap this component for
// @rnmapbox/maps (interactive SDK). It needs a custom dev build:
//   npx expo install @rnmapbox/maps
//   + a native rebuild (eas build / expo run:ios|android).
// Keep the same props (driver, destination, restaurant) so nothing else
// changes. The native version is stubbed in LiveMap.native-notes.md.
// ============================================================

const MAP_W = 640;
const MAP_H = 360;

function buildStaticUrl({ token, driver, destination, restaurant }) {
  if (!token) return null;
  const markers = [];
  // Destination (customer) — accent pin
  if (destination?.lat) markers.push(`pin-l-home+9FE870(${destination.lng},${destination.lat})`);
  // Restaurant — grey pin
  if (restaurant?.lat) markers.push(`pin-s-restaurant+888888(${restaurant.lng},${restaurant.lat})`);
  // Driver — car pin (bright)
  if (driver?.lat) markers.push(`pin-l-car+4ADE80(${driver.lng},${driver.lat})`);

  if (markers.length === 0) return null;
  const overlay = markers.join(",");
  // "auto" fits all markers in view.
  return (
    `https://api.mapbox.com/styles/v1/mapbox/dark-v11/static/` +
    `${overlay}/auto/${MAP_W}x${MAP_H}@2x?padding=60&access_token=${token}`
  );
}

export default function LiveMap({ token, driver, destination, restaurant, height = 240 }) {
  const url = buildStaticUrl({ token, driver, destination, restaurant });

  function openInMaps() {
    const target = driver?.lat ? driver : destination;
    if (target?.lat) Linking.openURL(`https://maps.google.com/?q=${target.lat},${target.lng}`);
  }

  if (!url) {
    return (
      <View style={[styles.fallback, { height }]}>
        <Text style={styles.fallbackText}>
          {token ? "Waiting for driver location…" : "Map needs MAPBOX_TOKEN"}
        </Text>
      </View>
    );
  }

  return (
    <TouchableOpacity activeOpacity={0.9} onPress={openInMaps}>
      <Image source={{ uri: url }} style={[styles.map, { height }]} />
      {driver?.lat && (
        <View style={styles.liveBadge}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>Live</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  map: { width: "100%", borderRadius: theme.radius, backgroundColor: theme.surface },
  fallback: { width: "100%", borderRadius: theme.radius, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.line, alignItems: "center", justifyContent: "center" },
  fallbackText: { color: theme.textDim, fontSize: 14 },
  liveBadge: { position: "absolute", top: 12, left: 12, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(14,15,12,0.85)", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.accent },
  liveText: { color: theme.accent, fontSize: 12, fontWeight: "800" },
});

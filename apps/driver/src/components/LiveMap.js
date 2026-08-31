import { View, Text, Image, StyleSheet, Linking, TouchableOpacity } from "react-native";
import { theme } from "../lib/theme";

// Driver-side LiveMap. Static Mapbox images (Expo Go friendly).
// Native upgrade path identical to the customer app's LiveMap.native-notes.md.

const MAP_W = 640, MAP_H = 360;

function buildStaticUrl({ token, self, target }) {
  if (!token) return null;
  const markers = [];
  if (target?.lat) markers.push(`pin-l+9FE870(${target.lng},${target.lat})`);
  if (self?.lat) markers.push(`pin-l-car+4ADE80(${self.lng},${self.lat})`);
  if (markers.length === 0) return null;
  return `https://api.mapbox.com/styles/v1/mapbox/dark-v11/static/${markers.join(",")}/auto/${MAP_W}x${MAP_H}@2x?padding=60&access_token=${token}`;
}

export default function LiveMap({ token, self, target, height = 200 }) {
  const url = buildStaticUrl({ token, self, target });
  if (!url) {
    return (
      <View style={[styles.fallback, { height }]}>
        <Text style={styles.fallbackText}>{token ? "Locating…" : "Map needs MAPBOX_TOKEN"}</Text>
      </View>
    );
  }
  return (
    <TouchableOpacity activeOpacity={0.9} onPress={() => target?.lat && Linking.openURL(`https://maps.google.com/?q=${target.lat},${target.lng}`)}>
      <Image source={{ uri: url }} style={[styles.map, { height }]} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  map: { width: "100%", borderRadius: theme.radius, backgroundColor: theme.surface },
  fallback: { width: "100%", borderRadius: theme.radius, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.line, alignItems: "center", justifyContent: "center" },
  fallbackText: { color: theme.textDim, fontSize: 14 },
});

import { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Image,
} from "react-native";
import { api, API_URL } from "../lib/api";
import { theme } from "../lib/theme";
import { addressStore } from "../lib/addressStore";

// We render a Mapbox STATIC image for the preview (no native SDK needed,
// works in Expo Go). The interactive @rnmapbox/maps SDK gets wired in on
// Day 11 for live driver tracking, which needs a dev build anyway.
function staticMapUrl(lat, lng, token) {
  if (!token) return null;
  return (
    `https://api.mapbox.com/styles/v1/mapbox/dark-v11/static/` +
    `pin-l+9FE870(${lng},${lat})/${lng},${lat},14,0/600x300@2x` +
    `?access_token=${token}`
  );
}

export default function AddressScreen({ navigation, route }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [label, setLabel] = useState("Home");
  const [saved, setSaved] = useState([]);
  // The app doesn't hold the Mapbox token; for the static preview we ask
  // the backend to hand a public token via a tiny config call.
  const [mapToken, setMapToken] = useState(route?.params?.mapToken || null);

  useEffect(() => {
    api.get("/addresses").then((r) => setSaved(r.data.addresses)).catch(() => {});
    api.get("/geo/config").then((r) => setMapToken(r.data.publicToken)).catch(() => {});
  }, []);

  // Debounced search
  useEffect(() => {
    if (query.trim().length < 3) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const { data } = await api.get("/geo/search", { params: { q: query } });
        setResults(data.results);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [query]);

  function choose(r) {
    setSelected(r);
    setResults([]);
    setQuery(r.name);
  }

  async function saveAndUse() {
    if (!selected) return;
    const payload = {
      label,
      lat: selected.lat,
      lng: selected.lng,
      fullAddress: selected.fullAddress,
    };
    try {
      const { data } = await api.post("/addresses", payload);
      addressStore.set(data.address);
    } catch {
      // even if save fails, use it locally for this session
      addressStore.set(payload);
    }
    navigation.goBack();
  }

  function useSaved(addr) {
    addressStore.set(addr);
    navigation.goBack();
  }

  const mapUrl = selected && staticMapUrl(selected.lat, selected.lng, mapToken);

  return (
    <View style={styles.container}>
      <View style={styles.searchWrap}>
        <TextInput
          style={styles.search}
          placeholder="Search street, area, or place"
          placeholderTextColor={theme.textDim}
          value={query}
          onChangeText={setQuery}
          autoFocus
        />
        {loading && <ActivityIndicator color={theme.accent} style={styles.searchSpin} />}
      </View>

      {/* Search results */}
      {results.length > 0 && (
        <FlatList
          data={results}
          keyExtractor={(r) => r.id}
          style={styles.results}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.resultRow} onPress={() => choose(item)}>
              <Text style={styles.resultName}>{item.name}</Text>
              <Text style={styles.resultAddr}>{item.fullAddress}</Text>
            </TouchableOpacity>
          )}
        />
      )}

      {/* Selected preview + save */}
      {selected && results.length === 0 && (
        <View style={styles.selectedCard}>
          {mapUrl ? (
            <Image source={{ uri: mapUrl }} style={styles.map} />
          ) : (
            <View style={[styles.map, styles.mapFallback]}>
              <Text style={styles.mapFallbackText}>
                Map preview needs MAPBOX_TOKEN
              </Text>
            </View>
          )}
          <Text style={styles.selectedAddr}>{selected.fullAddress}</Text>

          <Text style={styles.labelHead}>Label</Text>
          <View style={styles.labelRow}>
            {["Home", "Work", "Other"].map((l) => (
              <TouchableOpacity
                key={l}
                style={[styles.labelChip, label === l && styles.labelChipOn]}
                onPress={() => setLabel(l)}
              >
                <Text style={[styles.labelChipText, label === l && styles.labelChipTextOn]}>
                  {l}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={styles.saveBtn} onPress={saveAndUse}>
            <Text style={styles.saveText}>Use this address</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Saved addresses when nothing is being searched */}
      {!selected && results.length === 0 && saved.length > 0 && (
        <View style={styles.savedWrap}>
          <Text style={styles.savedHead}>Saved places</Text>
          {saved.map((a) => (
            <TouchableOpacity key={a.id} style={styles.savedRow} onPress={() => useSaved(a)}>
              <Text style={styles.savedLabel}>{a.label}</Text>
              <Text style={styles.savedAddr} numberOfLines={1}>
                {a.fullAddress}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg, padding: 16 },
  searchWrap: { justifyContent: "center" },
  search: {
    backgroundColor: theme.surface,
    borderRadius: theme.radius,
    borderWidth: 1,
    borderColor: theme.line,
    color: theme.text,
    fontSize: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  searchSpin: { position: "absolute", right: 16 },
  results: { marginTop: 8 },
  resultRow: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.line },
  resultName: { color: theme.text, fontSize: 16, fontWeight: "600" },
  resultAddr: { color: theme.textDim, fontSize: 13, marginTop: 2 },
  selectedCard: { marginTop: 16 },
  map: { width: "100%", height: 160, borderRadius: theme.radius, backgroundColor: theme.surface },
  mapFallback: { alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: theme.line },
  mapFallbackText: { color: theme.textDim, fontSize: 13 },
  selectedAddr: { color: theme.text, fontSize: 15, marginTop: 12 },
  labelHead: { color: theme.textDim, fontSize: 13, marginTop: 16, marginBottom: 8 },
  labelRow: { flexDirection: "row", gap: 8 },
  labelChip: {
    borderWidth: 1,
    borderColor: theme.line,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  labelChipOn: { backgroundColor: theme.accent, borderColor: theme.accent },
  labelChipText: { color: theme.text, fontSize: 14 },
  labelChipTextOn: { color: "#0E0F0C", fontWeight: "700" },
  saveBtn: {
    backgroundColor: theme.accent,
    borderRadius: theme.radius,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 20,
  },
  saveText: { color: "#0E0F0C", fontSize: 16, fontWeight: "700" },
  savedWrap: { marginTop: 20 },
  savedHead: { color: theme.textDim, fontSize: 13, marginBottom: 8 },
  savedRow: {
    backgroundColor: theme.surface,
    borderRadius: theme.radius,
    borderWidth: 1,
    borderColor: theme.line,
    padding: 14,
    marginBottom: 8,
  },
  savedLabel: { color: theme.accent, fontSize: 14, fontWeight: "700" },
  savedAddr: { color: theme.text, fontSize: 14, marginTop: 2 },
});

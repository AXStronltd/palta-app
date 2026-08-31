// Palta home — location header, search, category chips, and horizontal
// discovery rails (Popular Near You, Groceries & Shops, Send a Parcel).
// Wired to the real /restaurants API with a graceful demo fallback.
import { useEffect, useState } from "react";
import { View, Text, ScrollView, TextInput, TouchableOpacity, Image, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../lib/api";
import { theme } from "../lib/theme";
import { SectionHeader, DiscoveryCard } from "../components/PaltaUI";

const CHIPS = ["All", "Food", "Groceries", "Shops", "Parcels"];

export default function HomeScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [chip, setChip] = useState("All");
  const [merchants, setMerchants] = useState([]);

  useEffect(() => {
    api.get("/restaurants")
      .then((r) => setMerchants(r.data.restaurants || r.data || []))
      .catch(() => setMerchants([]));
  }, []);

  const restaurants = merchants.filter((m) => (m.merchantType || "RESTAURANT") === "RESTAURANT");
  const shops = merchants.filter((m) => (m.merchantType || "RESTAURANT") !== "RESTAURANT");

  const toCard = (m) => ({
    id: m.id,
    name: m.name,
    img: m.imageUrl || m.coverUrl,
    rating: m.rating ?? 4.6,
    time: m.estimatedPrepTime ? `${m.estimatedPrepTime}–${m.estimatedPrepTime + 10} min` : "20–30 min",
  });

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: insets.top + 4, paddingBottom: 24 }}>
        {/* location header */}
        <View style={styles.loc}>
          <View style={styles.av} />
          <View style={{ flex: 1 }}>
            <Text style={styles.locK}>Deliver to</Text>
            <Text style={styles.locV}>Karen, Nairobi ▾</Text>
          </View>
          <View style={styles.bell}><Text>🔔</Text></View>
        </View>

        {/* search */}
        <TouchableOpacity style={styles.search} onPress={() => navigation.navigate("Search")}>
          <Text style={styles.searchText}>🔍  Search food, groceries, shops...</Text>
        </TouchableOpacity>

        {/* category chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {CHIPS.map((c) => (
            <TouchableOpacity key={c} onPress={() => setChip(c)} style={[styles.chip, chip === c && styles.chipOn]}>
              <Text style={[styles.chipText, chip === c && styles.chipTextOn]}>{c}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Popular Near You */}
        <SectionHeader title="Popular Near You" action="See all" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
          {restaurants.map((m) => (
            <DiscoveryCard key={m.id} item={toCard(m)} onPress={() => navigation.navigate("RestaurantMenu", { restaurant: m })} />
          ))}
        </ScrollView>

        {/* Groceries & Shops */}
        <SectionHeader title="Groceries & Shops" action="See all" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
          {shops.map((m) => (
            <DiscoveryCard key={m.id} item={toCard(m)} onPress={() => navigation.navigate("RestaurantMenu", { restaurant: m })} />
          ))}
        </ScrollView>

        {/* Send a Parcel */}
        <SectionHeader title="Send a Parcel" action="See all" />
        <TouchableOpacity style={styles.parcel} activeOpacity={0.9} onPress={() => navigation.navigate("ParcelCreate")}>
          <View style={{ flex: 1 }}>
            <Text style={styles.parcelH}>Send Now</Text>
            <Text style={styles.parcelS}>Door to door delivery</Text>
          </View>
          <Text style={styles.parcelBox}>📦</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  loc: { flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 18, paddingVertical: 8 },
  av: { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.surfaceAlt },
  locK: { fontSize: 12, color: theme.textDim },
  locV: { fontSize: 15, fontWeight: "700", color: theme.text },
  bell: { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.surfaceAlt, alignItems: "center", justifyContent: "center" },
  search: { marginHorizontal: 18, marginBottom: 8, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.line, borderRadius: 13, paddingVertical: 14, paddingHorizontal: 15 },
  searchText: { color: theme.textDim, fontSize: 14 },
  chips: { paddingHorizontal: 18, paddingBottom: 10, gap: 9 },
  chip: { backgroundColor: theme.surfaceAlt, borderWidth: 1, borderColor: theme.line, borderRadius: 20, paddingVertical: 9, paddingHorizontal: 16, marginRight: 9 },
  chipOn: { backgroundColor: theme.accent, borderColor: theme.accent },
  chipText: { fontSize: 14, fontWeight: "600", color: theme.text },
  chipTextOn: { color: theme.onAccent },
  rail: { paddingHorizontal: 18, paddingBottom: 6 },
  parcel: { marginHorizontal: 18, borderRadius: 14, backgroundColor: theme.accent, paddingVertical: 16, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", gap: 14 },
  parcelH: { fontSize: 16, fontWeight: "800", color: "#fff" },
  parcelS: { fontSize: 12, color: "rgba(255,255,255,0.9)", marginTop: 2 },
  parcelBox: { fontSize: 34 },
});

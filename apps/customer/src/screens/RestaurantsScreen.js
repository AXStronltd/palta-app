import { useEffect, useState, useCallback } from "react";
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, TextInput, ScrollView, Modal,
} from "react-native";
import { api } from "../lib/api";
import { theme } from "../lib/theme";
import { formatMoney } from "../lib/money";
import { useSelectedAddress } from "../lib/addressStore";

const SORTS = [
  { key: "rating", label: "Top rated" },
  { key: "prepTime", label: "Fastest" },
  { key: "deliveryFee", label: "Cheapest delivery" },
];

export default function RestaurantsScreen({ user, navigation }) {
  const [restaurants, setRestaurants] = useState([]);
  const [cuisines, setCuisines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const address = useSelectedAddress();

  // Filter state
  const [query, setQuery] = useState("");
  const [merchantType, setMerchantType] = useState(null); // null = All
  const [activeCuisine, setActiveCuisine] = useState(null);
  const [sort, setSort] = useState("rating");
  const [showFilters, setShowFilters] = useState(false);
  const [minRating, setMinRating] = useState(null);
  const [maxPrepTime, setMaxPrepTime] = useState(null);

  // Load cuisine chips once
  useEffect(() => {
    api.get("/restaurants/cuisines").then((r) => setCuisines(r.data.cuisines)).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { sort };
      if (query.trim()) params.q = query.trim();
      if (merchantType) params.type = merchantType;
      if (activeCuisine) params.cuisine = activeCuisine;
      if (minRating) params.minRating = minRating;
      if (maxPrepTime) params.maxPrepTime = maxPrepTime;
      const { data } = await api.get("/restaurants", { params });
      setRestaurants(data.restaurants);
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  }, [query, merchantType, activeCuisine, sort, minRating, maxPrepTime]);

  // Debounced reload on any filter change
  useEffect(() => {
    const t = setTimeout(load, query ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, query]);

  const activeFilterCount =
    (minRating ? 1 : 0) + (maxPrepTime ? 1 : 0) + (activeCuisine ? 1 : 0);

  return (
    <View style={styles.container}>
      {/* Address bar */}
      <TouchableOpacity style={styles.addressBar} onPress={() => navigation.navigate("Address")} activeOpacity={0.7}>
        <Text style={styles.addressLabel}>
          {address ? `Deliver to · ${address.label}` : "Set your delivery address"}
        </Text>
        <Text style={styles.addressText} numberOfLines={1}>
          {address ? address.fullAddress : "Tap to choose where your food arrives"}
          <Text style={styles.chevron}>  ⌄</Text>
        </Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.ordersLink} onPress={() => navigation.navigate("Orders")}>
        <Text style={styles.ordersLinkText}>My orders →</Text>
      </TouchableOpacity>

      {/* Search bar */}
      <View style={styles.searchRow}>
        <TextInput
          style={styles.search}
          placeholder="Search restaurants or dishes"
          placeholderTextColor={theme.textDim}
          value={query}
          onChangeText={setQuery}
          returnKeyType="search"
        />
        <TouchableOpacity style={styles.filterBtn} onPress={() => setShowFilters(true)}>
          <Text style={styles.filterBtnText}>Filters{activeFilterCount ? ` (${activeFilterCount})` : ""}</Text>
        </TouchableOpacity>
      </View>

      {/* Merchant type tabs — shop by category */}
      <View style={styles.chipsWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
          <Chip label="All" active={!merchantType} onPress={() => setMerchantType(null)} />
          <Chip label="🍔 Food" active={merchantType === "RESTAURANT"} onPress={() => setMerchantType("RESTAURANT")} />
          <Chip label="🛒 Grocery" active={merchantType === "GROCERY"} onPress={() => setMerchantType("GROCERY")} />
          <Chip label="💊 Pharmacy" active={merchantType === "PHARMACY"} onPress={() => setMerchantType("PHARMACY")} />
          <Chip label="🏪 Convenience" active={merchantType === "CONVENIENCE"} onPress={() => setMerchantType("CONVENIENCE")} />
          <Chip label="🛍️ Retail" active={merchantType === "RETAIL"} onPress={() => setMerchantType("RETAIL")} />
        </ScrollView>
      </View>

      {/* Cuisine chips */}
      <View style={styles.chipsWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
          <Chip label="All" active={!activeCuisine} onPress={() => setActiveCuisine(null)} />
          {cuisines.map((c) => (
            <Chip key={c} label={c} active={activeCuisine === c} onPress={() => setActiveCuisine(c)} />
          ))}
        </ScrollView>
      </View>

      {loading && <ActivityIndicator color={theme.accent} style={{ marginTop: 30 }} />}
      {error && <Text style={styles.error}>{error}</Text>}
      {!loading && !error && restaurants.length === 0 && (
        <Text style={styles.empty}>No restaurants match. Try clearing a filter.</Text>
      )}

      <FlatList
        data={restaurants}
        keyExtractor={(r) => r.id}
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => {
              if (!address) { navigation.navigate("Address"); return; }
              navigation.navigate("Menu", { restaurant: item });
            }}
          >
            <View style={styles.cardTop}>
              <Text style={styles.name}>{item.name}</Text>
              <View style={styles.ratingPill}><Text style={styles.ratingText}>★ {item.rating.toFixed(1)}</Text></View>
            </View>
            <Text style={styles.cuisine}>{item.cuisineType}</Text>
            <Text style={styles.meta}>{item.estimatedPrepTime} min · {formatMoney(item.deliveryFee, item.currency)} delivery</Text>
            <View style={styles.aiHint}><Text style={styles.aiHintText}>✦ Order by chat</Text></View>
          </TouchableOpacity>
        )}
      />

      {/* Filter sheet */}
      <Modal visible={showFilters} animationType="slide" transparent onRequestClose={() => setShowFilters(false)}>
        <View style={styles.sheetOverlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Filters</Text>

            <Text style={styles.filterHead}>Sort by</Text>
            <View style={styles.optRow}>
              {SORTS.map((s) => (
                <TouchableOpacity key={s.key} style={[styles.opt, sort === s.key && styles.optOn]} onPress={() => setSort(s.key)}>
                  <Text style={[styles.optText, sort === s.key && styles.optTextOn]}>{s.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.filterHead}>Minimum rating</Text>
            <View style={styles.optRow}>
              {[null, 4.0, 4.5].map((r) => (
                <TouchableOpacity key={String(r)} style={[styles.opt, minRating === r && styles.optOn]} onPress={() => setMinRating(r)}>
                  <Text style={[styles.optText, minRating === r && styles.optTextOn]}>{r ? `★ ${r}+` : "Any"}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.filterHead}>Max delivery time</Text>
            <View style={styles.optRow}>
              {[null, 20, 25].map((t) => (
                <TouchableOpacity key={String(t)} style={[styles.opt, maxPrepTime === t && styles.optOn]} onPress={() => setMaxPrepTime(t)}>
                  <Text style={[styles.optText, maxPrepTime === t && styles.optTextOn]}>{t ? `≤ ${t} min` : "Any"}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.applyBtn} onPress={() => setShowFilters(false)}>
              <Text style={styles.applyText}>Show results</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setMinRating(null); setMaxPrepTime(null); setActiveCuisine(null); setSort("rating"); }}>
              <Text style={styles.clearText}>Clear all</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Chip({ label, active, onPress }) {
  return (
    <TouchableOpacity style={[styles.chip, active && styles.chipOn]} onPress={onPress}>
      <Text style={[styles.chipText, active && styles.chipTextOn]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  addressBar: {
    marginTop: 56, marginHorizontal: 16, backgroundColor: theme.surface,
    borderWidth: 1, borderColor: theme.line, borderRadius: theme.radius,
    paddingHorizontal: 16, paddingVertical: 12,
  },
  addressLabel: { color: theme.accent, fontSize: 12, fontWeight: "700", letterSpacing: 0.3 },
  addressText: { color: theme.text, fontSize: 15, marginTop: 2 },
  chevron: { color: theme.textDim },
  ordersLink: { alignSelf: "flex-end", marginRight: 16, marginTop: 8 },
  ordersLinkText: { color: theme.accent, fontSize: 14, fontWeight: "600" },
  searchRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16, marginTop: 12 },
  search: {
    flex: 1, backgroundColor: theme.surface, borderRadius: theme.radius,
    borderWidth: 1, borderColor: theme.line, color: theme.text, fontSize: 15,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  filterBtn: {
    backgroundColor: theme.surfaceAlt, borderRadius: theme.radius,
    paddingHorizontal: 14, justifyContent: "center", borderWidth: 1, borderColor: theme.line,
  },
  filterBtnText: { color: theme.text, fontSize: 14, fontWeight: "600" },
  chipsWrap: { marginTop: 12 },
  chipsRow: { paddingHorizontal: 16, gap: 8 },
  chip: {
    backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.line,
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8,
  },
  chipOn: { backgroundColor: theme.accent, borderColor: theme.accent },
  chipText: { color: theme.text, fontSize: 14 },
  chipTextOn: { color: "#0E0F0C", fontWeight: "700" },
  card: {
    backgroundColor: theme.surface, borderRadius: theme.radius,
    borderWidth: 1, borderColor: theme.line, padding: 16,
  },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  name: { color: theme.text, fontSize: 19, fontWeight: "700" },
  ratingPill: { backgroundColor: theme.surfaceAlt, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  ratingText: { color: theme.accent, fontSize: 13, fontWeight: "700" },
  cuisine: { color: theme.textDim, fontSize: 14, marginTop: 4 },
  meta: { color: theme.textDim, fontSize: 13, marginTop: 6 },
  aiHint: { alignSelf: "flex-start", marginTop: 12, backgroundColor: theme.bubbleUser, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
  aiHintText: { color: theme.accent, fontSize: 13, fontWeight: "600" },
  error: { color: theme.danger, textAlign: "center", marginTop: 40 },
  empty: { color: theme.textDim, textAlign: "center", marginTop: 40, fontSize: 15 },
  sheetOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: theme.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, paddingBottom: 36, borderTopWidth: 1, borderColor: theme.line,
  },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: theme.line, alignSelf: "center", marginBottom: 16 },
  sheetTitle: { color: theme.text, fontSize: 22, fontWeight: "800", marginBottom: 8 },
  filterHead: { color: theme.textDim, fontSize: 13, marginTop: 16, marginBottom: 8 },
  optRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  opt: { borderWidth: 1, borderColor: theme.line, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 9 },
  optOn: { backgroundColor: theme.accent, borderColor: theme.accent },
  optText: { color: theme.text, fontSize: 14 },
  optTextOn: { color: "#0E0F0C", fontWeight: "700" },
  applyBtn: { backgroundColor: theme.accent, borderRadius: theme.radius, paddingVertical: 16, alignItems: "center", marginTop: 24 },
  applyText: { color: "#0E0F0C", fontSize: 16, fontWeight: "700" },
  clearText: { color: theme.textDim, textAlign: "center", marginTop: 14, fontSize: 15 },
});

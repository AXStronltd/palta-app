// StoreScreen — grocery / supermarket catalog (Card 8).
// Browse a merchant's items by aisle, search, add to cart with quantity
// controls, and a live cart bar. Uses the shared cartStore + money lib so
// checkout is identical to food. A "store" is a Restaurant with
// merchantType GROCERY/PHARMACY/RETAIL; its MenuItems are the products.
import { useEffect, useState, useCallback, useMemo } from "react";
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, FlatList, ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { theme } from "../lib/theme";
import { api } from "../lib/api";
import { formatMoney } from "../lib/money";
import { cart, useCart } from "../lib/cartStore";

export default function StoreScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const storeId = route.params?.storeId || route.params?.restaurantId;
  const [store, setStore] = useState(route.params?.store || null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [aisle, setAisle] = useState("all");
  const cartState = useCart();

  const load = useCallback(() => {
    if (!storeId) { setLoading(false); return; }
    setLoading(true);
    api.get(`/restaurants/${storeId}`)
      .then((r) => {
        setStore(r.data.restaurant || r.data);
        setItems((r.data.restaurant?.menuItems || r.data.menuItems || []));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [storeId]);

  useEffect(() => { load(); }, [load]);

  // Aisles = the distinct categories present in this store's items.
  const aisles = useMemo(() => {
    const set = [...new Set(items.map((i) => i.category).filter(Boolean))];
    return ["all", ...set];
  }, [items]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = items;
    if (q) list = list.filter((i) => i.name.toLowerCase().includes(q));
    else if (aisle !== "all") list = list.filter((i) => i.category === aisle);
    return list;
  }, [items, query, aisle]);

  const currency = store?.currency || "KES";

  function qtyFor(item) {
    const line = cartState.lines.find((l) => l.menuItemId === item.id);
    return line ? line.quantity : 0;
  }
  function addOne(item) {
    cart.add({
      restaurantId: store.id, restaurantName: store.name,
      menuItemId: item.id, name: item.name, price: item.price, quantity: 1,
    });
  }
  function decOne(item) {
    const line = cartState.lines.find((l) => l.menuItemId === item.id);
    if (line) cart.setQuantity(line.key, line.quantity - 1);
  }

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.bg }]}>
        <ActivityIndicator color={theme.accent} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{store?.name || "Store"}</Text>
      </View>

      {/* Trust row */}
      <View style={styles.trustRow}>
        <View style={styles.verified}><Text style={styles.verifiedText}>✓ Verified</Text></View>
        <View style={[styles.status, store?.isOpen ? styles.open : styles.closed]}>
          <Text style={store?.isOpen ? styles.openText : styles.closedText}>
            {store?.isOpen ? "🟢 Open now" : "🔴 Closed"}
          </Text>
        </View>
        <Text style={styles.meta}>★ {store?.rating ?? "—"} · {formatMoney(store?.deliveryFee ?? 0, currency)} delivery</Text>
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <Text style={{ fontSize: 15 }}>🔍</Text>
        <TextInput
          style={styles.search}
          placeholder={`Search ${store?.name || "store"}…`}
          placeholderTextColor={theme.textDim}
          value={query}
          onChangeText={setQuery}
          returnKeyType="search"
        />
      </View>

      {/* Aisle chips */}
      {!query ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {aisles.map((a) => (
            <TouchableOpacity key={a} onPress={() => setAisle(a)}
              style={[styles.chip, aisle === a && styles.chipOn]}>
              <Text style={[styles.chipText, aisle === a && styles.chipTextOn]}>
                {a === "all" ? "All" : a}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : null}

      {/* Product list */}
      <FlatList
        data={visible}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: 16, paddingBottom: cartState.count() ? 100 : 24 }}
        ListEmptyComponent={<Text style={styles.empty}>No products found</Text>}
        renderItem={({ item }) => {
          const qty = qtyFor(item);
          const soldOut = item.isAvailable === false;
          return (
            <View style={[styles.item, soldOut && styles.itemSoldOut]}>
              <View style={styles.itemImg}><Text style={{ fontSize: 22 }}>🛒</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemPrice}>
                  {formatMoney(item.price, currency)}
                  {soldOut ? <Text style={styles.soldOut}>  · Sold out</Text> : null}
                </Text>
              </View>
              {soldOut ? (
                <View style={styles.outTag}><Text style={styles.outTagText}>Sold out</Text></View>
              ) : qty > 0 ? (
                <View style={styles.qtyCtl}>
                  <TouchableOpacity style={styles.qBtn} onPress={() => decOne(item)}>
                    <Text style={styles.qBtnText}>−</Text>
                  </TouchableOpacity>
                  <Text style={styles.qNum}>{qty}</Text>
                  <TouchableOpacity style={styles.qBtn} onPress={() => addOne(item)}>
                    <Text style={styles.qBtnText}>＋</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={styles.addBtn} onPress={() => addOne(item)}>
                  <Text style={styles.addBtnText}>＋ Add</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        }}
      />

      {/* Cart bar */}
      {cartState.count() > 0 ? (
        <TouchableOpacity
          style={[styles.cartBar, { paddingBottom: insets.bottom + 14 }]}
          onPress={() => navigation.navigate("Checkout")}
        >
          <View style={styles.cartCount}><Text style={styles.cartCountText}>{cartState.count()}</Text></View>
          <Text style={styles.cartText}>View cart</Text>
          <Text style={styles.cartTotal}>{formatMoney(cart.subtotal(), currency)}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 8 },
  back: { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.surface, alignItems: "center", justifyContent: "center" },
  backText: { fontSize: 22, color: theme.text },
  title: { fontSize: 20, fontWeight: "800", color: theme.text, flex: 1 },
  trustRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 18, paddingBottom: 8, flexWrap: "wrap" },
  verified: { backgroundColor: theme.accentSoft, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  verifiedText: { color: theme.accent, fontSize: 11, fontWeight: "800" },
  status: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  open: { backgroundColor: theme.accentSoft }, closed: { backgroundColor: "#3A1F1D" },
  openText: { color: theme.accentDark, fontSize: 12, fontWeight: "800" },
  closedText: { color: theme.danger, fontSize: 12, fontWeight: "800" },
  meta: { color: theme.textDim, fontSize: 12.5 },
  searchWrap: { flexDirection: "row", alignItems: "center", gap: 9, backgroundColor: theme.surface, borderWidth: 1.5, borderColor: theme.line, borderRadius: 13, marginHorizontal: 18, paddingHorizontal: 14 },
  search: { flex: 1, paddingVertical: 13, fontSize: 16, fontWeight: "700", color: theme.text },
  chips: { paddingHorizontal: 18, paddingVertical: 10, gap: 8 },
  chip: { backgroundColor: theme.surface, borderWidth: 1.5, borderColor: theme.line, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9, marginRight: 8 },
  chipOn: { backgroundColor: theme.surface, borderColor: theme.surface },
  chipText: { fontSize: 12.5, fontWeight: "800", color: theme.textDim },
  chipTextOn: { color: theme.onAccent },
  item: { flexDirection: "row", alignItems: "center", gap: 13, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.line, borderRadius: 15, padding: 12, marginBottom: 9 },
  itemSoldOut: { opacity: 0.6 },
  itemImg: { width: 46, height: 46, borderRadius: 12, backgroundColor: theme.surface, alignItems: "center", justifyContent: "center" },
  itemName: { fontWeight: "800", fontSize: 14, color: theme.text },
  itemPrice: { color: theme.textDim, fontSize: 12.5, marginTop: 1 },
  soldOut: { color: theme.danger, fontWeight: "800" },
  addBtn: { backgroundColor: theme.accentSoft, borderRadius: 11, paddingHorizontal: 14, paddingVertical: 9 },
  addBtnText: { color: theme.accentDark, fontWeight: "800", fontSize: 13 },
  qtyCtl: { flexDirection: "row", alignItems: "center", backgroundColor: theme.accent, borderRadius: 11, overflow: "hidden" },
  qBtn: { width: 34, height: 36, alignItems: "center", justifyContent: "center" },
  qBtnText: { color: theme.onAccent, fontSize: 19, fontWeight: "800" },
  qNum: { color: theme.onAccent, fontWeight: "800", fontSize: 15, minWidth: 24, textAlign: "center" },
  outTag: { backgroundColor: theme.line, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  outTagText: { color: theme.textDim, fontSize: 11, fontWeight: "800" },
  empty: { textAlign: "center", color: theme.textDim, padding: 30, fontSize: 14 },
  cartBar: { position: "absolute", left: 16, right: 16, bottom: 0, backgroundColor: theme.accent, borderRadius: 16, paddingHorizontal: 18, paddingTop: 15, flexDirection: "row", alignItems: "center", gap: 12 },
  cartCount: { backgroundColor: "rgba(255,255,255,0.25)", borderRadius: 9, minWidth: 28, height: 28, alignItems: "center", justifyContent: "center" },
  cartCountText: { color: theme.onAccent, fontWeight: "800", fontSize: 14 },
  cartText: { flex: 1, color: theme.onAccent, fontWeight: "800", fontSize: 15 },
  cartTotal: { color: theme.onAccent, fontWeight: "800", fontSize: 15 },
});

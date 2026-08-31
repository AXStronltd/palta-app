import { useEffect, useState, useMemo } from "react";
import {
  View, Text, SectionList, TouchableOpacity, StyleSheet, ActivityIndicator,
} from "react-native";
import { api } from "../lib/api";
import { theme } from "../lib/theme";
import { formatMoney } from "../lib/money";
import { useCart, cart } from "../lib/cartStore";

export default function RestaurantMenuScreen({ route, navigation }) {
  const { restaurant } = route.params;
  const [menu, setMenu] = useState([]);
  const [loading, setLoading] = useState(true);
  const cartState = useCart();

  useEffect(() => {
    api
      .get(`/restaurants/${restaurant.id}`)
      .then((r) => setMenu(r.data.restaurant.menuItems || []))
      .catch(() => setMenu([]))
      .finally(() => setLoading(false));
  }, [restaurant.id]);

  // Group into sections by category
  const sections = useMemo(() => {
    const byCat = {};
    for (const item of menu) {
      (byCat[item.category] ||= []).push(item);
    }
    return Object.entries(byCat).map(([title, data]) => ({ title, data }));
  }, [menu]);

  const cartForThis = cartState.restaurantId === restaurant.id;
  const count = cartForThis ? cart.count() : 0;
  const subtotal = cartForThis ? cart.subtotal() : 0;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.accent} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 120 }}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.name}>{restaurant.name}</Text>
            <Text style={styles.meta}>
              {restaurant.cuisineType} · ★ {restaurant.rating.toFixed(1)} ·{" "}
              {restaurant.estimatedPrepTime} min
            </Text>
            {restaurant.description ? (
              <Text style={styles.desc}>{restaurant.description}</Text>
            ) : null}

            {/* AI ordering entry — the two paths live side by side */}
            <TouchableOpacity
              style={styles.aiBar}
              onPress={() => navigation.navigate("Order", { restaurant })}
            >
              <Text style={styles.aiBarText}>✦ Or just tell Palta what you want</Text>
            </TouchableOpacity>
          </View>
        }
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionHead}>{section.title}</Text>
        )}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.item}
            onPress={() => navigation.navigate("ItemDetail", { restaurant, item })}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.itemName}>{item.name}</Text>
              {item.description ? (
                <Text style={styles.itemDesc} numberOfLines={2}>{item.description}</Text>
              ) : null}
              <Text style={styles.itemPrice}>{formatMoney(item.price, restaurant.currency)}</Text>
            </View>
            <View style={styles.addBadge}>
              <Text style={styles.addBadgeText}>+</Text>
            </View>
          </TouchableOpacity>
        )}
      />

      {/* Sticky cart bar */}
      {count > 0 && (
        <TouchableOpacity
          style={styles.cartBar}
          onPress={() => navigation.navigate("Checkout", { restaurant })}
        >
          <View style={styles.cartCount}><Text style={styles.cartCountText}>{count}</Text></View>
          <Text style={styles.cartBarText}>View cart</Text>
          <Text style={styles.cartBarTotal}>{formatMoney(subtotal, restaurant.currency)}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  center: { flex: 1, backgroundColor: theme.bg, alignItems: "center", justifyContent: "center" },
  header: { padding: 20, paddingBottom: 8 },
  name: { color: theme.text, fontSize: 28, fontWeight: "800", letterSpacing: -0.5 },
  meta: { color: theme.textDim, fontSize: 14, marginTop: 6 },
  desc: { color: theme.textDim, fontSize: 14, marginTop: 8, lineHeight: 20 },
  aiBar: {
    backgroundColor: theme.bubbleUser, borderRadius: theme.radius,
    paddingVertical: 12, paddingHorizontal: 16, marginTop: 16,
  },
  aiBarText: { color: theme.accent, fontSize: 15, fontWeight: "600" },
  sectionHead: {
    color: theme.text, fontSize: 18, fontWeight: "800",
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8, backgroundColor: theme.bg,
  },
  item: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 20, paddingVertical: 14,
    borderTopWidth: 1, borderTopColor: theme.line,
  },
  itemName: { color: theme.text, fontSize: 16, fontWeight: "600" },
  itemDesc: { color: theme.textDim, fontSize: 13, marginTop: 3, lineHeight: 18 },
  itemPrice: { color: theme.text, fontSize: 15, marginTop: 6, fontWeight: "600" },
  addBadge: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: theme.surfaceAlt,
    borderWidth: 1, borderColor: theme.line, alignItems: "center", justifyContent: "center",
  },
  addBadgeText: { color: theme.accent, fontSize: 22, fontWeight: "700", marginTop: -2 },
  cartBar: {
    position: "absolute", left: 16, right: 16, bottom: 24,
    backgroundColor: theme.accent, borderRadius: theme.radius,
    flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 16, gap: 12,
  },
  cartCount: { backgroundColor: "#0E0F0C", borderRadius: 12, minWidth: 26, height: 26, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
  cartCountText: { color: theme.accent, fontWeight: "800", fontSize: 14 },
  cartBarText: { color: "#0E0F0C", fontWeight: "800", fontSize: 16, flex: 1 },
  cartBarTotal: { color: "#0E0F0C", fontWeight: "800", fontSize: 16 },
});

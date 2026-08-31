import { useEffect, useState, useCallback } from "react";
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity, RefreshControl } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "../lib/api";
import { theme } from "../lib/theme";
import { formatMoney } from "../lib/money";

const STATUS_COLOR = {
  PLACED: theme.textDim, ACCEPTED: theme.accent, PREPARING: theme.accent,
  READY: theme.accent, DRIVER_ASSIGNED: theme.accent, PICKED_UP: theme.accent,
  DELIVERING: theme.accent, DELIVERED: "#6FBF3E", CANCELLED: theme.danger, REJECTED: theme.danger,
};

export default function OrdersScreen({ navigation }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    api.get("/orders").then((r) => setOrders(r.data.orders)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={theme.accent} size="large" /></View>;
  }

  if (orders.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.empty}>No orders yet</Text>
        <TouchableOpacity style={styles.btn} onPress={() => navigation.popToTop()}>
          <Text style={styles.btnText}>Order something</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <FlatList
      style={{ backgroundColor: theme.bg }}
      data={orders}
      keyExtractor={(o) => o.id}
      contentContainerStyle={{ padding: 16, gap: 12 }}
      refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={theme.accent} />}
      renderItem={({ item }) => (
        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate("OrderDetail", { orderId: item.id })}>
          <View style={styles.top}>
            <Text style={styles.rest}>{item.restaurant?.name || "Restaurant"}</Text>
            <Text style={[styles.status, { color: STATUS_COLOR[item.status] || theme.textDim }]}>{item.status}</Text>
          </View>
          <Text style={styles.meta}>
            #{item.id.slice(-6).toUpperCase()} · {formatMoney(item.total, item.currency)} · {item.items.length} item{item.items.length > 1 ? "s" : ""}
          </Text>
        </TouchableOpacity>
      )}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: theme.bg, alignItems: "center", justifyContent: "center", padding: 24 },
  empty: { color: theme.textDim, fontSize: 17 },
  btn: { backgroundColor: theme.accent, borderRadius: theme.radius, paddingHorizontal: 24, paddingVertical: 14, marginTop: 20 },
  btnText: { color: "#0E0F0C", fontWeight: "700", fontSize: 16 },
  card: { backgroundColor: theme.surface, borderRadius: theme.radius, borderWidth: 1, borderColor: theme.line, padding: 16 },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  rest: { color: theme.text, fontSize: 17, fontWeight: "700" },
  status: { fontSize: 13, fontWeight: "800", letterSpacing: 0.5 },
  meta: { color: theme.textDim, fontSize: 14, marginTop: 6 },
});

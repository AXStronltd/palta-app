import { useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Alert } from "react-native";
import { api } from "../lib/api";
import { theme } from "../lib/theme";
import { formatMoney } from "../lib/money";
import { connectSocket, onEvent } from "../lib/socket";
import LiveMap from "../components/LiveMap";
import { addressStore } from "../lib/addressStore";
import { cart } from "../lib/cartStore";

// The customer-facing journey. CANCELLED/REJECTED handled separately.
const STAGES = [
  { key: "PLACED", label: "Order placed", sub: "We've received your order" },
  { key: "ACCEPTED", label: "Accepted", sub: "The restaurant confirmed your order" },
  { key: "PREPARING", label: "Preparing", sub: "Your food is being made" },
  { key: "READY", label: "Ready", sub: "Waiting for a driver" },
  { key: "DRIVER_ASSIGNED", label: "Driver assigned", sub: "A driver is heading to the restaurant" },
  { key: "PICKED_UP", label: "Picked up", sub: "Your order is with the driver" },
  { key: "DELIVERING", label: "On the way", sub: "Almost there" },
  { key: "DELIVERED", label: "Delivered", sub: "Enjoy your meal!" },
];

const STAGE_INDEX = Object.fromEntries(STAGES.map((s, i) => [s.key, i]));

export default function OrderTrackingScreen({ route, navigation }) {
  const { orderId } = route.params;
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [arrivedAtRestaurant, setArrivedAtRestaurant] = useState(false);
  const [driverLoc, setDriverLoc] = useState(null);   // { lat, lng } live
  const [mapToken, setMapToken] = useState(null);

  const load = useCallback(() => {
    api.get(`/orders/${orderId}`)
      .then((r) => {
        setOrder(r.data.order);
        setArrivedAtRestaurant(r.data.order.driverArrived);
        // Seed the last-known driver location if we don't have a live one.
        const dp = r.data.order.driverProfile;
        if (dp?.currentLat != null) {
          setDriverLoc((prev) => prev || { lat: dp.currentLat, lng: dp.currentLng });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [orderId]);

  useEffect(() => {
    load();
    api.get("/geo/config").then((r) => setMapToken(r.data.publicToken)).catch(() => {});
    let offUpdate, offStatus, offLocation;
    (async () => {
      await connectSocket();
      // Canonical live status event (Card 13). Fires on every backend
      // transition: ACCEPTED, PREPARING, DRIVER_ASSIGNED, PICKED_UP, DELIVERED…
      offStatus = onEvent("order:status", (payload) => {
        if (payload.orderId !== orderId) return;
        load();
      });
      // Legacy event name — kept for backward compatibility.
      offUpdate = onEvent("order:update", (payload) => {
        if (payload.orderId !== orderId) return;
        if (payload.driverArrived) setArrivedAtRestaurant(true);
        load();
      });
      // Live driver location for the map.
      offLocation = onEvent("driver:location", (payload) => {
        if (payload.orderId !== orderId) return;
        setDriverLoc({ lat: payload.lat, lng: payload.lng });
      });
    })();
    return () => { offUpdate?.(); offStatus?.(); offLocation?.(); };
  }, [orderId, load]);

  async function cancelOrder() {
    Alert.alert("Cancel order?", "This can't be undone.", [
      { text: "Keep order", style: "cancel" },
      {
        text: "Cancel order", style: "destructive",
        onPress: async () => {
          try { await api.post(`/orders/${orderId}/cancel`); load(); }
          catch (e) { Alert.alert("Couldn't cancel", e.response?.data?.error || e.message); }
        },
      },
    ]);
  }

  async function reorder() {
    try {
      const { data } = await api.get(`/orders/${orderId}/reorder`);
      cart.setFromAi({
        restaurantId: data.restaurant.id,
        restaurantName: data.restaurant.name,
        aiLines: data.lines,
      });
      if (data.unavailable?.length) {
        Alert.alert("Some items changed", `Not available now: ${data.unavailable.join(", ")}`);
      }
      navigation.navigate("Checkout", { restaurant: data.restaurant });
    } catch (e) {
      Alert.alert("Couldn't reorder", e.response?.data?.error || e.message);
    }
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={theme.accent} size="large" /></View>;
  }
  if (!order) {
    return <View style={styles.center}><Text style={styles.err}>Order not found</Text></View>;
  }

  const isCancelled = order.status === "CANCELLED" || order.status === "REJECTED";
  const currentIndex = STAGE_INDEX[order.status] ?? 0;
  const canCancel = ["PLACED", "ACCEPTED", "PREPARING"].includes(order.status);
  const dp = order.driverProfile;

  // Destination coords for the map: use the saved address if it matches
  // the order's delivery address, else fall back to the restaurant area.
  const saved = addressStore.get();
  const destinationCoords =
    saved && saved.fullAddress === order.deliveryAddress
      ? { lat: saved.lat, lng: saved.lng }
      : null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
      <Text style={styles.orderNum}>Order #{order.id.slice(-6).toUpperCase()}</Text>
      <Text style={styles.rest}>{order.restaurant?.name}</Text>

      {isCancelled ? (
        <View style={styles.cancelBox}>
          <Text style={styles.cancelTitle}>
            {order.status === "REJECTED" ? "Order rejected" : "Order cancelled"}
          </Text>
          <Text style={styles.cancelSub}>
            {order.status === "REJECTED"
              ? "The restaurant couldn't accept this order. You won't be charged."
              : "This order was cancelled."}
          </Text>
        </View>
      ) : (
        <>
          {/* Current status headline */}
          <View style={styles.headline}>
            <Text style={styles.headlineLabel}>{STAGES[currentIndex]?.label}</Text>
            <Text style={styles.headlineSub}>
              {order.status === "DRIVER_ASSIGNED" && arrivedAtRestaurant
                ? "Your driver is at the restaurant"
                : STAGES[currentIndex]?.sub}
            </Text>
          </View>

          {/* Driver card (once assigned) */}
          {order.driver && dp && (
            <View style={styles.driverCard}>
              <View style={styles.driverAvatar}><Text style={styles.driverInitial}>{order.driver.name?.[0] || "D"}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.driverName}>{order.driver.name || "Your driver"}</Text>
                <Text style={styles.driverVehicle}>
                  {[dp.vehicleColor, dp.vehicleMake, dp.vehicleModel].filter(Boolean).join(" ")}
                  {dp.licensePlate ? ` · ${dp.licensePlate}` : ""}
                </Text>
              </View>
            </View>
          )}

          {/* Timeline */}
          <View style={styles.timeline}>
            {STAGES.map((stage, i) => {
              const done = i < currentIndex;
              const active = i === currentIndex;
              return (
                <View key={stage.key} style={styles.tlRow}>
                  <View style={styles.tlLeft}>
                    <View style={[styles.tlDot, (done || active) && styles.tlDotOn, active && styles.tlDotActive]}>
                      {done && <Text style={styles.tlCheck}>✓</Text>}
                    </View>
                    {i < STAGES.length - 1 && <View style={[styles.tlLine, done && styles.tlLineOn]} />}
                  </View>
                  <View style={styles.tlContent}>
                    <Text style={[styles.tlLabel, (done || active) && styles.tlLabelOn]}>{stage.label}</Text>
                    {active && <Text style={styles.tlSub}>{stage.sub}</Text>}
                  </View>
                </View>
              );
            })}
          </View>

          {/* Live map — shown once a driver is on the order */}
          {["DRIVER_ASSIGNED", "PICKED_UP", "DELIVERING"].includes(order.status) && (
            <View style={styles.mapWrap}>
              <LiveMap
                token={mapToken}
                driver={driverLoc}
                restaurant={order.restaurant?.lat ? { lat: order.restaurant.lat, lng: order.restaurant.lng } : null}
                destination={destinationCoords}
                height={220}
              />
            </View>
          )}

          {order.status === "DELIVERED" && (
            <View style={styles.deliveredActions}>
              <TouchableOpacity
                style={styles.rateBtn}
                onPress={() => navigation.navigate("RateOrder", { order })}
              >
                <Text style={styles.rateBtnText}>Rate your order</Text>
              </TouchableOpacity>
              <View style={styles.actionRow}>
                <TouchableOpacity style={styles.actionBtn} onPress={reorder}>
                  <Text style={styles.actionBtnText}>Reorder</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate("Receipt", { orderId })}>
                  <Text style={styles.actionBtnText}>Receipt</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {canCancel && (
            <TouchableOpacity style={styles.cancelBtn} onPress={cancelOrder}>
              <Text style={styles.cancelBtnText}>Cancel order</Text>
            </TouchableOpacity>
          )}
        </>
      )}

      {/* Order summary */}
      <View style={styles.summary}>
        <Text style={styles.summaryHead}>Order summary</Text>
        {order.items.map((it, idx) => (
          <View key={idx} style={styles.sumRow}>
            <Text style={styles.sumItem}>{it.quantity}× {it.name}</Text>
            <Text style={styles.sumPrice}>{formatMoney(it.price * it.quantity, order.currency)}</Text>
          </View>
        ))}
        <View style={styles.sumDivider} />
        <View style={styles.sumRow}><Text style={styles.sumDim}>Total</Text><Text style={styles.sumTotal}>{formatMoney(order.total, order.currency)}</Text></View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  center: { flex: 1, backgroundColor: theme.bg, alignItems: "center", justifyContent: "center" },
  err: { color: theme.danger, fontSize: 16 },
  orderNum: { color: theme.textDim, fontSize: 14, marginTop: 20 },
  rest: { color: theme.text, fontSize: 26, fontWeight: "800", marginTop: 4 },
  headline: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.accent, borderRadius: theme.radius, padding: 20, marginTop: 20 },
  headlineLabel: { color: theme.accent, fontSize: 20, fontWeight: "800" },
  headlineSub: { color: theme.textDim, fontSize: 14, marginTop: 4 },
  driverCard: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.line, borderRadius: theme.radius, padding: 16, marginTop: 16 },
  driverAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: theme.accent, alignItems: "center", justifyContent: "center" },
  driverInitial: { color: "#0E0F0C", fontSize: 20, fontWeight: "800" },
  driverName: { color: theme.text, fontSize: 17, fontWeight: "700" },
  driverVehicle: { color: theme.textDim, fontSize: 14, marginTop: 2 },
  timeline: { marginTop: 24 },
  tlRow: { flexDirection: "row", gap: 14 },
  tlLeft: { alignItems: "center", width: 28 },
  tlDot: { width: 24, height: 24, borderRadius: 12, backgroundColor: theme.surfaceAlt, borderWidth: 2, borderColor: theme.line, alignItems: "center", justifyContent: "center" },
  tlDotOn: { backgroundColor: theme.accent, borderColor: theme.accent },
  tlDotActive: { backgroundColor: theme.bg, borderColor: theme.accent },
  tlCheck: { color: "#0E0F0C", fontSize: 12, fontWeight: "800" },
  tlLine: { width: 2, flex: 1, backgroundColor: theme.line, minHeight: 28 },
  tlLineOn: { backgroundColor: theme.accent },
  tlContent: { flex: 1, paddingBottom: 20 },
  tlLabel: { color: theme.textDim, fontSize: 16, fontWeight: "600" },
  tlLabelOn: { color: theme.text },
  tlSub: { color: theme.textDim, fontSize: 13, marginTop: 2 },
  mapWrap: { marginTop: 20 },
  deliveredActions: { marginTop: 20, gap: 10 },
  rateBtn: { backgroundColor: theme.accent, borderRadius: theme.radius, paddingVertical: 16, alignItems: "center" },
  rateBtnText: { color: "#0E0F0C", fontSize: 16, fontWeight: "800" },
  actionRow: { flexDirection: "row", gap: 10 },
  actionBtn: { flex: 1, borderWidth: 1, borderColor: theme.line, borderRadius: theme.radius, paddingVertical: 14, alignItems: "center" },
  actionBtnText: { color: theme.text, fontSize: 15, fontWeight: "700" },
  mapNote: { color: theme.textDim, fontSize: 12, fontStyle: "italic", textAlign: "center", marginTop: 8 },
  cancelBtn: { borderWidth: 1, borderColor: theme.danger, borderRadius: theme.radius, paddingVertical: 14, alignItems: "center", marginTop: 20 },
  cancelBtnText: { color: theme.danger, fontSize: 15, fontWeight: "700" },
  cancelBox: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.line, borderRadius: theme.radius, padding: 20, marginTop: 20 },
  cancelTitle: { color: theme.danger, fontSize: 18, fontWeight: "800" },
  cancelSub: { color: theme.textDim, fontSize: 14, marginTop: 6, lineHeight: 20 },
  summary: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.line, borderRadius: theme.radius, padding: 16, marginTop: 28 },
  summaryHead: { color: theme.text, fontSize: 16, fontWeight: "800", marginBottom: 10 },
  sumRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  sumItem: { color: theme.text, fontSize: 15 },
  sumPrice: { color: theme.text, fontSize: 15 },
  sumDivider: { height: 1, backgroundColor: theme.line, marginVertical: 8 },
  sumDim: { color: theme.textDim, fontSize: 15 },
  sumTotal: { color: theme.accent, fontSize: 17, fontWeight: "800" },
});

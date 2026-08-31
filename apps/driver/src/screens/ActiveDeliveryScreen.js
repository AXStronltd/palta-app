import { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, Linking } from "react-native";
import { api } from "../lib/api";
import { theme } from "../lib/theme";
import LiveMap from "../components/LiveMap";

// Maps the current order status to the next action the driver takes.
const NEXT_ACTION = {
  DRIVER_ASSIGNED: { action: "pickup", label: "Confirm pickup", hint: "Head to the restaurant and collect the order" },
  PICKED_UP: { action: "deliver", label: "Start delivery", hint: "Drive to the customer" },
  DELIVERING: { action: "complete", label: "Complete delivery", hint: "Hand the order to the customer" },
};

const STEPS = ["DRIVER_ASSIGNED", "PICKED_UP", "DELIVERING", "DELIVERED"];
const STEP_LABEL = {
  DRIVER_ASSIGNED: "Assigned",
  PICKED_UP: "Picked up",
  DELIVERING: "On the way",
  DELIVERED: "Delivered",
};

export default function ActiveDeliveryScreen({ order, onUpdate, onComplete, selfLoc, mapToken }) {
  const [busy, setBusy] = useState(false);
  const status = order.status;
  const next = NEXT_ACTION[status];
  const stepIndex = STEPS.indexOf(status);

  // Where the driver is heading right now.
  const target =
    status === "DRIVER_ASSIGNED" && order.restaurant?.lat
      ? { lat: order.restaurant.lat, lng: order.restaurant.lng }
      : null; // dropoff has no stored coords in this build; restaurant shown pre-pickup

  async function act(action) {
    setBusy(true);
    try {
      const { data } = await api.post(`/driver/order/${order.id}/action`, { action });
      if (action === "complete") {
        onComplete?.(data.order);
      } else {
        onUpdate?.(data.order);
      }
    } catch (e) {
      Alert.alert("Couldn't update", e.response?.data?.error || e.message);
    } finally {
      setBusy(false);
    }
  }

  function openMaps() {
    const r = order.restaurant;
    if (status === "DRIVER_ASSIGNED" && r?.lat) {
      Linking.openURL(`https://maps.google.com/?q=${r.lat},${r.lng}`);
    } else {
      const q = encodeURIComponent(order.deliveryAddress || "");
      Linking.openURL(`https://maps.google.com/?q=${q}`);
    }
  }

  return (
    <View style={styles.container}>
      {/* Turn/status banner — the one-glance "what now" for the driver */}
      <View style={styles.navBanner}>
        <Text style={styles.navBannerLabel}>
          {status === "DRIVER_ASSIGNED" ? "📍 TO PICKUP" : "🚗 ON DELIVERY"}
        </Text>
        <Text style={styles.navBannerMain}>
          {status === "DRIVER_ASSIGNED" ? `Head to ${order.restaurant?.name || "the restaurant"}` : "Deliver to the customer"}
        </Text>
      </View>

      {/* Progress steps */}
      <View style={styles.steps}>
        {STEPS.map((s, i) => (
          <View key={s} style={styles.stepItem}>
            <View style={[styles.dot, i <= stepIndex && styles.dotOn]}>
              {i < stepIndex && <Text style={styles.dotCheck}>✓</Text>}
            </View>
            <Text style={[styles.stepLabel, i <= stepIndex && styles.stepLabelOn]}>{STEP_LABEL[s]}</Text>
          </View>
        ))}
      </View>

      {/* Live map — large, near full-screen so it reads like navigation */}
      <View style={styles.mapWrap}>
        <LiveMap token={mapToken} self={selfLoc} target={target} height={340} />
      </View>

      {/* Destination card */}
      <View style={styles.card}>
        <Text style={styles.cardLabel}>
          {status === "DRIVER_ASSIGNED" ? "Pick up from" : "Deliver to"}
        </Text>
        <Text style={styles.cardMain}>
          {status === "DRIVER_ASSIGNED" ? order.restaurant?.name : "Customer"}
        </Text>
        <Text style={styles.cardAddr}>
          {status === "DRIVER_ASSIGNED" ? order.restaurant?.address : order.deliveryAddress}
        </Text>
        <TouchableOpacity style={styles.mapsBtn} onPress={openMaps}>
          <Text style={styles.mapsBtnText}>Open in Maps</Text>
        </TouchableOpacity>
      </View>

      {/* Arrived (only before pickup) */}
      {status === "DRIVER_ASSIGNED" && !order.driverArrived && (
        <TouchableOpacity style={styles.secondaryBtn} onPress={() => act("arrived")} disabled={busy}>
          <Text style={styles.secondaryText}>I've arrived at the restaurant</Text>
        </TouchableOpacity>
      )}
      {status === "DRIVER_ASSIGNED" && order.driverArrived && (
        <Text style={styles.arrivedNote}>✓ Arrival shared with customer</Text>
      )}

      {/* Primary action */}
      {next && (
        <View style={styles.footer}>
          <Text style={styles.hint}>{next.hint}</Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => act(next.action)} disabled={busy}>
            {busy ? <ActivityIndicator color="#07120C" /> : <Text style={styles.primaryText}>{next.label}</Text>}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  navBanner: { backgroundColor: theme.surface, borderRadius: 14, padding: 14, marginBottom: 14 },
  navBannerLabel: { color: theme.accent, fontSize: 11, fontWeight: "800", letterSpacing: 0.5 },
  navBannerMain: { color: theme.text, fontSize: 17, fontWeight: "800", marginTop: 3 },
  mapWrap: { marginBottom: 20 },
  steps: { flexDirection: "row", justifyContent: "space-between", marginBottom: 24 },
  stepItem: { alignItems: "center", flex: 1 },
  dot: { width: 28, height: 28, borderRadius: 14, backgroundColor: theme.surfaceAlt, borderWidth: 2, borderColor: theme.line, alignItems: "center", justifyContent: "center", marginBottom: 6 },
  dotOn: { backgroundColor: theme.accent, borderColor: theme.accent },
  dotCheck: { color: "#07120C", fontSize: 13, fontWeight: "800" },
  stepLabel: { color: theme.textDim, fontSize: 11, textAlign: "center" },
  stepLabelOn: { color: theme.text, fontWeight: "700" },
  card: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.accent, borderRadius: theme.radius, padding: 20 },
  cardLabel: { color: theme.accent, fontSize: 12, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase" },
  cardMain: { color: theme.text, fontSize: 22, fontWeight: "800", marginTop: 8 },
  cardAddr: { color: theme.textDim, fontSize: 15, marginTop: 6 },
  mapsBtn: { backgroundColor: theme.surfaceAlt, borderRadius: 12, paddingVertical: 12, alignItems: "center", marginTop: 16 },
  mapsBtnText: { color: theme.accent, fontSize: 15, fontWeight: "700" },
  secondaryBtn: { borderWidth: 1, borderColor: theme.line, borderRadius: theme.radius, paddingVertical: 14, alignItems: "center", marginTop: 16 },
  secondaryText: { color: theme.text, fontSize: 15, fontWeight: "600" },
  arrivedNote: { color: theme.accent, fontSize: 14, marginTop: 16, textAlign: "center" },
  footer: { marginTop: "auto", paddingTop: 20 },
  hint: { color: theme.textDim, fontSize: 14, textAlign: "center", marginBottom: 12 },
  primaryBtn: { backgroundColor: theme.accent, borderRadius: theme.radius, paddingVertical: 18, alignItems: "center" },
  primaryText: { color: "#07120C", fontSize: 17, fontWeight: "800" },
});

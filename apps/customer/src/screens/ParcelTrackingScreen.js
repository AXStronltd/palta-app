// Parcel live tracking — map, driver card, status timeline.
// A parcel is an Order with jobType=PARCEL, so it gets the same live
// `order:status` events as any other order (Card 13).
import { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { theme } from "../lib/theme";
import { api } from "../lib/api";
import { connectSocket, onEvent } from "../lib/socket";

// Backend order states mapped to the parcel-facing steps.
const STEPS = [
  { label: "Driver assigned", states: ["DRIVER_ASSIGNED"] },
  { label: "Collected", states: ["PICKED_UP"] },
  { label: "In transit", states: ["DELIVERING"] },
  { label: "Delivered", states: ["DELIVERED"] },
];
function stepIndexFor(status) {
  if (status === "DELIVERED") return 3;
  if (status === "DELIVERING") return 2;
  if (status === "PICKED_UP") return 1;
  if (status === "DRIVER_ASSIGNED") return 0;
  return 0; // PLACED/ACCEPTED — still finding/assigning
}

export default function ParcelTrackingScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const orderId = route.params?.parcel?.id || route.params?.orderId;
  const [parcel, setParcel] = useState(route.params?.parcel || {});
  const CURRENT = stepIndexFor(parcel.status);

  const load = useCallback(() => {
    if (!orderId) return;
    api.get(`/orders/${orderId}`).then((r) => setParcel(r.data.order)).catch(() => {});
  }, [orderId]);

  useEffect(() => {
    load();
    let offStatus;
    (async () => {
      await connectSocket();
      offStatus = onEvent("order:status", (payload) => {
        if (payload.orderId !== orderId) return;
        load();
      });
    })();
    return () => { offStatus?.(); };
  }, [orderId, load]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <TouchableOpacity style={styles.back} onPress={() => navigation.navigate("Home")}>
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Send Parcel Tracking</Text>
      </View>
      <Text style={styles.orderId}>Order #{parcel.id || "PALTP78901"}</Text>

      {/* map placeholder — real app uses native map SDK */}
      <View style={styles.map}>
        <Text style={styles.mapPin}>📦</Text>
        <Text style={styles.mapCar}>🚗</Text>
        <Text style={styles.mapHome}>🏠</Text>
      </View>

      <ScrollView style={styles.sheet} contentContainerStyle={{ padding: 18 }}>
        <View style={styles.headRow}>
          <Text style={{ color: theme.accent, fontSize: 18 }}>📦</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.headTitle}>Driver has your parcel</Text>
            <Text style={styles.headSub}>Arriving in 12 min</Text>
          </View>
        </View>

        <View style={styles.drv}>
          <View style={styles.drvAv} />
          <View>
            <Text style={styles.drvName}>David Mwangi</Text>
            <Text style={styles.drvSub}>KCE 456D · Car</Text>
          </View>
          <View style={styles.rate}><Text style={styles.rateText}><Text style={{ color: theme.star }}>★</Text> 4.9</Text></View>
        </View>

        <View style={styles.drvBtns}>
          {["📍 Where are you?", "📞 Call me", "🙋 I'm here"].map((b) => (
            <View key={b} style={styles.drvBtn}><Text style={styles.drvBtnText}>{b}</Text></View>
          ))}
        </View>

        {parcel.proofPin ? (
          <View style={styles.pin}>
            <Text style={styles.pinLabel}>Delivery PIN (share with recipient)</Text>
            <Text style={styles.pinValue}>{parcel.proofPin}</Text>
          </View>
        ) : null}

        <View style={styles.tl}>
          {STEPS.map((s, i) => {
            const done = i < CURRENT, active = i === CURRENT;
            return (
              <View key={s.label} style={styles.tlr}>
                <View style={styles.tlCol}>
                  <View style={[styles.dot, (done || active) && styles.dotOn]}>
                    {done ? <Text style={styles.dotCheck}>✓</Text> : null}
                  </View>
                  {i < STEPS.length - 1 ? <View style={[styles.line, done && styles.lineOn]} /> : null}
                </View>
                <View style={styles.tlLabel}>
                  <Text style={[styles.tlText, (done || active) && { color: theme.text }]}>{s.label}</Text>
                  <Text style={styles.tlTime}>{active ? "In progress" : (done ? "Done" : "")}</Text>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 18, paddingBottom: 6 },
  back: { width: 38, height: 38, borderRadius: 19, backgroundColor: theme.surfaceAlt, alignItems: "center", justifyContent: "center" },
  backText: { color: theme.text, fontSize: 22, marginTop: -2 },
  title: { fontSize: 16, fontWeight: "800", color: theme.text },
  orderId: { color: theme.textDim, fontSize: 12, paddingHorizontal: 18, paddingBottom: 6 },
  map: { height: 200, backgroundColor: "#0e1613", marginHorizontal: 0, position: "relative" },
  mapPin: { position: "absolute", left: "20%", top: "24%", fontSize: 26 },
  mapCar: { position: "absolute", left: "50%", top: "46%", fontSize: 28 },
  mapHome: { position: "absolute", right: "18%", bottom: "22%", fontSize: 26 },
  sheet: { backgroundColor: theme.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, marginTop: -24 },
  headRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 },
  headTitle: { fontWeight: "700", color: theme.text },
  headSub: { color: theme.textDim, fontSize: 13 },
  drv: { flexDirection: "row", alignItems: "center", gap: 12 },
  drvAv: { width: 48, height: 48, borderRadius: 24, backgroundColor: theme.surfaceAlt },
  drvName: { fontWeight: "700", color: theme.text },
  drvSub: { color: theme.textDim, fontSize: 12 },
  rate: { marginLeft: "auto", backgroundColor: theme.surfaceAlt, borderRadius: 9, paddingHorizontal: 9, paddingVertical: 4 },
  rateText: { fontSize: 13, fontWeight: "700", color: theme.text },
  drvBtns: { flexDirection: "row", gap: 10, marginVertical: 14 },
  drvBtn: { flex: 1, backgroundColor: theme.surfaceAlt, borderWidth: 1, borderColor: theme.line, borderRadius: 11, padding: 11, alignItems: "center" },
  drvBtnText: { fontSize: 12, fontWeight: "600", color: theme.text },
  pin: { backgroundColor: theme.accentSoft, borderWidth: 1, borderColor: theme.accent, borderRadius: 12, padding: 14, marginBottom: 14 },
  pinLabel: { color: theme.textDim, fontSize: 12 },
  pinValue: { color: theme.accent, fontSize: 26, fontWeight: "800", letterSpacing: 6, marginTop: 4 },
  tl: { marginTop: 6 },
  tlr: { flexDirection: "row", gap: 12 },
  tlCol: { alignItems: "center" },
  dot: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: theme.line, backgroundColor: theme.surfaceAlt, alignItems: "center", justifyContent: "center" },
  dotOn: { backgroundColor: theme.accent, borderColor: theme.accent },
  dotCheck: { color: "#fff", fontSize: 9 },
  line: { width: 2, flex: 1, backgroundColor: theme.line, minHeight: 26 },
  lineOn: { backgroundColor: theme.accent },
  tlLabel: { flex: 1, flexDirection: "row", justifyContent: "space-between", paddingBottom: 22 },
  tlText: { fontSize: 14, color: theme.textDim, fontWeight: "600" },
  tlTime: { fontSize: 12, color: theme.textDim },
});

import { useEffect, useState, useCallback, useRef } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Switch, Alert, ActivityIndicator, ScrollView } from "react-native";
import * as Location from "expo-location";
import { api, clearToken } from "../lib/api";
import { theme } from "../lib/theme";
import { formatMoney } from "../lib/money";
import { connectSocket, onEvent, disconnectSocket } from "../lib/socket";
import DeliveryRequestModal from "./DeliveryRequestModal";
import ActiveDeliveryScreen from "./ActiveDeliveryScreen";

export default function DriverHomeScreen({ profile, onLogout }) {
  const [online, setOnline] = useState(profile?.isOnline || false);
  const [busy, setBusy] = useState(false);
  const [request, setRequest] = useState(null);   // incoming offer
  const [activeOrder, setActiveOrder] = useState(null);
  const [earnings, setEarnings] = useState({ today: 0, total: 0 });
  const [selfLoc, setSelfLoc] = useState(null);
  const [mapToken, setMapToken] = useState(null);
  const locationSub = useRef(null);

  const loadEarnings = useCallback(() => {
    api.get("/driver/earnings").then((r) => setEarnings(r.data)).catch(() => {});
  }, []);

  // Connect socket + subscribe to delivery requests
  useEffect(() => {
    let offReq, offUpd, offStatus;
    (async () => {
      await connectSocket();
      offReq = onEvent("delivery:request", (payload) => setRequest(payload));
      offUpd = onEvent("order:update", () => refreshActive());
      // Card 13: canonical status event — keep the driver's active delivery in sync.
      offStatus = onEvent("order:status", () => refreshActive());
    })();
    refreshActive();
    loadEarnings();
    api.get("/geo/config").then((r) => setMapToken(r.data.publicToken)).catch(() => {});
    return () => { offReq?.(); offUpd?.(); offStatus?.(); stopLocation(); };
  }, []);

  const refreshActive = useCallback(() => {
    api.get("/driver/active").then((r) => setActiveOrder(r.data.order)).catch(() => {});
  }, []);

  async function toggleOnline(next) {
    setBusy(true);
    try {
      await api.post("/driver/online", { isOnline: next });
      setOnline(next);
      if (next) startLocation(); else stopLocation();
    } catch (e) {
      Alert.alert("Couldn't update", e.response?.data?.error || e.message);
    } finally { setBusy(false); }
  }

  async function startLocation() {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Location needed", "Allow location so we can match you to nearby orders.");
      return;
    }
    // Send an immediate fix, then watch.
    const first = await Location.getCurrentPositionAsync({});
    pushLocation(first.coords);
    locationSub.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.Balanced, distanceInterval: 50, timeInterval: 15000 },
      (loc) => pushLocation(loc.coords)
    );
  }

  function stopLocation() {
    locationSub.current?.remove?.();
    locationSub.current = null;
  }

  function pushLocation(coords) {
    setSelfLoc({ lat: coords.latitude, lng: coords.longitude });
    api.post("/driver/location", { lat: coords.latitude, lng: coords.longitude }).catch(() => {});
  }

  async function accept(orderId) {
    try {
      const { data } = await api.post("/driver/accept", { orderId });
      setRequest(null);
      setActiveOrder(data.order);
    } catch (e) {
      setRequest(null);
      Alert.alert("Too late", e.response?.data?.error || "This delivery was taken.");
    }
  }

  async function decline(orderId, auto = false) {
    setRequest(null);
    if (!auto) api.post("/driver/decline", { orderId }).catch(() => {});
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.hi}>Hi, {profile?.fullName?.split(" ")[0] || "Driver"}</Text>
          <Text style={styles.earnings}>
            Today {formatMoney(earnings.today || 0, earnings.currency)} · Total {formatMoney(earnings.total || 0, earnings.currency)}
          </Text>
        </View>
        <TouchableOpacity onPress={async () => { await clearToken(); disconnectSocket(); onLogout?.(); }}>
          <Text style={styles.logout}>Log out</Text>
        </TouchableOpacity>
      </View>

      {activeOrder ? (
        <ScrollView style={{ flex: 1, marginTop: 20 }} contentContainerStyle={{ flexGrow: 1 }}>
          <ActiveDeliveryScreen
            order={activeOrder}
            selfLoc={selfLoc}
            mapToken={mapToken}
            onUpdate={(o) => setActiveOrder({ ...activeOrder, ...o })}
            onComplete={() => { setActiveOrder(null); loadEarnings(); }}
          />
        </ScrollView>
      ) : (
        <>
          {/* Online toggle */}
          <View style={styles.onlineCard}>
            <View>
              <Text style={styles.onlineLabel}>{online ? "You're online" : "You're offline"}</Text>
              <Text style={styles.onlineSub}>{online ? "Waiting for delivery requests" : "Go online to receive orders"}</Text>
            </View>
            {busy ? <ActivityIndicator color={theme.accent} /> : (
              <Switch
                value={online}
                onValueChange={toggleOnline}
                trackColor={{ false: theme.surfaceAlt, true: theme.accentDark }}
                thumbColor={online ? theme.accent : theme.textDim}
              />
            )}
          </View>

          {online ? (
            <View style={styles.waiting}>
              <ActivityIndicator color={theme.accent} />
              <Text style={styles.waitingText}>Listening for nearby orders…</Text>
            </View>
          ) : (
            <View style={styles.waiting}>
              <Text style={styles.waitingText}>Flip the switch to start earning.</Text>
            </View>
          )}
        </>
      )}

      <DeliveryRequestModal request={request} onAccept={accept} onDecline={decline} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg, padding: 20, paddingTop: 60 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  hi: { color: theme.text, fontSize: 26, fontWeight: "800" },
  earnings: { color: theme.accent, fontSize: 14, marginTop: 4, fontWeight: "600" },
  logout: { color: theme.textDim, fontSize: 14 },
  onlineCard: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.line, borderRadius: theme.radius, padding: 20, marginTop: 24 },
  onlineLabel: { color: theme.text, fontSize: 18, fontWeight: "800" },
  onlineSub: { color: theme.textDim, fontSize: 13, marginTop: 4 },
  activeCard: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.accent, borderRadius: theme.radius, padding: 20, marginTop: 20 },
  activeStatus: { color: theme.accent, fontSize: 13, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase" },
  activeRest: { color: theme.text, fontSize: 20, fontWeight: "800", marginTop: 8 },
  activeAddr: { color: theme.textDim, fontSize: 14, marginTop: 6 },
  activeNote: { color: theme.textDim, fontSize: 12, marginTop: 14, fontStyle: "italic" },
  waiting: { alignItems: "center", justifyContent: "center", padding: 40, marginTop: 20, gap: 12 },
  waitingText: { color: theme.textDim, fontSize: 15 },
});

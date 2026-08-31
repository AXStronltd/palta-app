import { useEffect, useState, useRef } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Modal, Vibration, Platform } from "react-native";
import { theme } from "../lib/theme";

// Best-effort alarm sound. expo-av may not be installed in every build, so we
// load it lazily and no-op if unavailable — vibration still fires regardless.
let Audio = null;
try { Audio = require("expo-av").Audio; } catch (e) { /* optional */ }

export default function DeliveryRequestModal({ request, onAccept, onDecline }) {
  const [remaining, setRemaining] = useState(0);
  const timerRef = useRef(null);
  const soundRef = useRef(null);

  // ---- Card 14: the alarm — vibration + sound so a driver never misses it ----
  useEffect(() => {
    if (!request) return;
    // Repeating vibration pattern until the driver responds (wait, buzz, buzz…).
    // On Android the array pattern repeats from index given as 2nd arg.
    try {
      if (Platform.OS === "android") Vibration.vibrate([0, 400, 200, 400], true);
      else {
        // iOS ignores custom patterns; pulse on an interval instead.
        Vibration.vibrate();
        var vibLoop = setInterval(() => Vibration.vibrate(), 1500);
      }
    } catch (e) {}

    // Play a looping alert tone if expo-av + an asset are available.
    (async () => {
      if (!Audio) return;
      try {
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
        const { sound } = await Audio.Sound.createAsync(
          require("../../assets/alarm.mp3"),
          { isLooping: true, volume: 1.0 }
        );
        soundRef.current = sound;
        await sound.playAsync();
      } catch (e) { /* asset missing in dev — vibration still covers it */ }
    })();

    return () => {
      try { Vibration.cancel(); } catch (e) {}
      if (typeof vibLoop !== "undefined") clearInterval(vibLoop);
      if (soundRef.current) { soundRef.current.stopAsync().catch(() => {}); soundRef.current.unloadAsync().catch(() => {}); }
    };
  }, [request?.orderId]);

  function stopAlarm() {
    try { Vibration.cancel(); } catch (e) {}
    if (soundRef.current) { soundRef.current.stopAsync().catch(() => {}); }
  }

  useEffect(() => {
    if (!request) return;
    setRemaining(Math.ceil((request.expiresInMs || 30000) / 1000));
    timerRef.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(timerRef.current);
          stopAlarm();
          onDecline?.(request.orderId, true); // auto-decline on timeout
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [request?.orderId]);

  if (!request) return null;

  const accept = () => { stopAlarm(); onAccept?.(request.orderId); };
  const decline = () => { stopAlarm(); onDecline?.(request.orderId); };

  return (
    <Modal visible transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.timerBar}>
            <View style={[styles.timerFill, { width: `${(remaining / 30) * 100}%` }]} />
          </View>
          <Text style={styles.timer}>{remaining}s</Text>

          <Text style={styles.title}>New delivery</Text>

          <View style={styles.card}>
            <Row label="Pick up" value={request.restaurant?.name || "Restaurant"} />
            <Row label="From" value={request.restaurant?.address || "—"} />
            <Row label="Deliver to" value={request.deliveryAddress || "—"} />
            <Row label="Distance" value={`${request.distanceKm ?? "—"} km to pickup`} />
            <Row label="Items" value={`${request.itemCount} item${request.itemCount > 1 ? "s" : ""}`} />
          </View>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.decline} onPress={decline}>
              <Text style={styles.declineText}>Decline</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.accept} onPress={accept}>
              <Text style={styles.acceptText}>Accept</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function Row({ label, value }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet: { backgroundColor: theme.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40, borderTopWidth: 1, borderColor: theme.line },
  timerBar: { height: 5, borderRadius: 3, backgroundColor: theme.surfaceAlt, overflow: "hidden", marginBottom: 8 },
  timerFill: { height: 5, backgroundColor: theme.accent },
  timer: { color: theme.accent, fontSize: 14, fontWeight: "800", textAlign: "right", marginBottom: 12 },
  title: { color: theme.text, fontSize: 26, fontWeight: "800", marginBottom: 16 },
  card: { backgroundColor: theme.surfaceAlt, borderRadius: theme.radius, padding: 16, gap: 12 },
  row: { flexDirection: "row", justifyContent: "space-between", gap: 16 },
  rowLabel: { color: theme.textDim, fontSize: 14 },
  rowValue: { color: theme.text, fontSize: 14, fontWeight: "600", flex: 1, textAlign: "right" },
  actions: { flexDirection: "row", gap: 12, marginTop: 24 },
  decline: { flex: 1, borderWidth: 1, borderColor: theme.line, borderRadius: theme.radius, paddingVertical: 16, alignItems: "center" },
  declineText: { color: theme.textDim, fontSize: 16, fontWeight: "700" },
  accept: { flex: 2, backgroundColor: theme.accent, borderRadius: theme.radius, paddingVertical: 16, alignItems: "center" },
  acceptText: { color: "#07120C", fontSize: 16, fontWeight: "800" },
});

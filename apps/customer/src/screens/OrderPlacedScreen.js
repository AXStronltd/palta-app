import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { theme } from "../lib/theme";
import { formatMoney } from "../lib/money";

export default function OrderPlacedScreen({ route, navigation }) {
  const { order, payment } = route.params;
  const isCash = payment?.provider === "cash";
  const isMock = payment?.mock;

  return (
    <View style={styles.container}>
      <View style={styles.checkCircle}>
        <Text style={styles.check}>✓</Text>
      </View>
      <Text style={styles.title}>Order placed</Text>
      <Text style={styles.sub}>
        Order #{order.id.slice(-6).toUpperCase()} · {formatMoney(order.total, order.currency)}
      </Text>

      <View style={styles.statusCard}>
        <Text style={styles.statusLabel}>Status</Text>
        <Text style={styles.statusValue}>{order.status}</Text>
        <Text style={styles.statusHint}>
          The restaurant will accept and start preparing. Live tracking
          arrives on Day 11.
        </Text>
      </View>

      {isCash ? (
        <Text style={styles.pay}>Pay cash on delivery.</Text>
      ) : isMock ? (
        <Text style={styles.pay}>Payment simulated (dev mode — no Stripe key set).</Text>
      ) : (
        <Text style={styles.pay}>Card payment authorized.</Text>
      )}

      <TouchableOpacity style={styles.btn} onPress={() => navigation.replace("OrderDetail", { orderId: order.id })}>
        <Text style={styles.btnText}>Track order</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => navigation.popToTop()}>
        <Text style={styles.link}>Back to home</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg, alignItems: "center", justifyContent: "center", padding: 24 },
  checkCircle: {
    width: 88, height: 88, borderRadius: 44, backgroundColor: theme.accent,
    alignItems: "center", justifyContent: "center", marginBottom: 24,
  },
  check: { color: "#0E0F0C", fontSize: 48, fontWeight: "900", marginTop: -4 },
  title: { color: theme.text, fontSize: 30, fontWeight: "800" },
  sub: { color: theme.textDim, fontSize: 16, marginTop: 8 },
  statusCard: {
    backgroundColor: theme.surface, borderRadius: theme.radius, borderWidth: 1,
    borderColor: theme.line, padding: 20, marginTop: 32, width: "100%", alignItems: "center",
  },
  statusLabel: { color: theme.textDim, fontSize: 13 },
  statusValue: { color: theme.accent, fontSize: 22, fontWeight: "800", marginTop: 4, letterSpacing: 1 },
  statusHint: { color: theme.textDim, fontSize: 13, marginTop: 12, textAlign: "center", lineHeight: 19 },
  pay: { color: theme.textDim, fontSize: 14, marginTop: 20 },
  btn: { backgroundColor: theme.accent, borderRadius: theme.radius, paddingVertical: 16, paddingHorizontal: 40, marginTop: 32 },
  btnText: { color: "#0E0F0C", fontSize: 16, fontWeight: "800" },
  link: { color: theme.textDim, fontSize: 15, marginTop: 18 },
});

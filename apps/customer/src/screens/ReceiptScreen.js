import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { api } from "../lib/api";
import { theme } from "../lib/theme";
import { formatMoney } from "../lib/money";

export default function ReceiptScreen({ route }) {
  const { orderId } = route.params;
  const [receipt, setReceipt] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/orders/${orderId}/receipt`)
      .then((r) => setReceipt(r.data.receipt))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [orderId]);

  if (loading) return <View style={styles.center}><ActivityIndicator color={theme.accent} size="large" /></View>;
  if (!receipt) return <View style={styles.center}><Text style={styles.err}>Receipt unavailable</Text></View>;

  const fmt = (d) => (d ? new Date(d).toLocaleString() : "—");

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 24 }}>
      <View style={styles.head}>
        <Text style={styles.logo}>Palta</Text>
        <Text style={styles.receiptLabel}>Receipt</Text>
      </View>

      <View style={styles.block}>
        <Row label="Order" value={`#${receipt.shortId}`} />
        <Row label="Restaurant" value={receipt.restaurant} />
        <Row label="Placed" value={fmt(receipt.placedAt)} />
        {receipt.deliveredAt && <Row label="Delivered" value={fmt(receipt.deliveredAt)} />}
        <Row label="Type" value={receipt.deliveryType === "PICKUP" ? "Pickup" : "Delivery"} />
        {receipt.deliveryType !== "PICKUP" && <Row label="To" value={receipt.deliveryAddress} />}
      </View>

      <View style={styles.itemsBlock}>
        {receipt.items.map((it, i) => (
          <View key={i}>
            <View style={styles.itemRow}>
              <Text style={styles.itemName}>{it.quantity}× {it.name}</Text>
              <Text style={styles.itemPrice}>{formatMoney(it.price * it.quantity, receipt.currency)}</Text>
            </View>
            {it.options?.length > 0 && <Text style={styles.itemOpts}>{it.options.map((o) => o.name).join(", ")}</Text>}
          </View>
        ))}
      </View>

      <View style={styles.totals}>
        <Row label="Subtotal" value={formatMoney(receipt.subtotal, receipt.currency)} dim />
        <Row label="Delivery" value={formatMoney(receipt.deliveryFee, receipt.currency)} dim />
        <Row label="Tip" value={formatMoney(receipt.tip, receipt.currency)} dim />
        <View style={styles.divider} />
        <Row label="Total" value={formatMoney(receipt.total, receipt.currency)} big />
      </View>

      <Text style={styles.footer}>Thanks for ordering with Palta.</Text>
    </ScrollView>
  );
}

function Row({ label, value, dim, big }) {
  return (
    <View style={styles.row}>
      <Text style={big ? styles.big : dim ? styles.dim : styles.rowLabel}>{label}</Text>
      <Text style={big ? styles.big : dim ? styles.dim : styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  center: { flex: 1, backgroundColor: theme.bg, alignItems: "center", justifyContent: "center" },
  err: { color: theme.danger, fontSize: 16 },
  head: { alignItems: "center", marginTop: 20, marginBottom: 24 },
  logo: { color: theme.accent, fontSize: 34, fontWeight: "800", letterSpacing: -1 },
  receiptLabel: { color: theme.textDim, fontSize: 14, letterSpacing: 2, textTransform: "uppercase", marginTop: 4 },
  block: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.line, borderRadius: theme.radius, padding: 16 },
  itemsBlock: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.line, borderRadius: theme.radius, padding: 16, marginTop: 16 },
  itemRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 5 },
  itemName: { color: theme.text, fontSize: 15 },
  itemPrice: { color: theme.text, fontSize: 15 },
  itemOpts: { color: theme.textDim, fontSize: 13, marginBottom: 4 },
  totals: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.line, borderRadius: theme.radius, padding: 16, marginTop: 16 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  rowLabel: { color: theme.textDim, fontSize: 14 },
  rowValue: { color: theme.text, fontSize: 14, fontWeight: "600", flex: 1, textAlign: "right" },
  dim: { color: theme.textDim, fontSize: 15 },
  big: { color: theme.accent, fontSize: 18, fontWeight: "800" },
  divider: { height: 1, backgroundColor: theme.line, marginVertical: 8 },
  footer: { color: theme.textDim, fontSize: 13, textAlign: "center", marginTop: 24 },
});

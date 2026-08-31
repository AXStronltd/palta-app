import { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from "react-native";
import { api } from "../lib/api";
import { theme } from "../lib/theme";
import { formatMoney } from "../lib/money";
import { useSelectedAddress } from "../lib/addressStore";
import { useCart, cart } from "../lib/cartStore";

const TIPS = [0, 1, 2, 3];

export default function CheckoutScreen({ route, navigation }) {
  const restaurant = route.params?.restaurant;
  const currency = restaurant?.currency || "AED";
  const address = useSelectedAddress();
  const cartState = useCart();
  const lines = cartState.lines;

  const [tip, setTip] = useState(2);
  const [payMethod, setPayMethod] = useState("card"); // "card" | "cash"
  const [deliveryType, setDeliveryType] = useState("DELIVERY");
  const [placing, setPlacing] = useState(false);

  const subtotal = cart.subtotal();
  const deliveryFee = deliveryType === "PICKUP" ? 0 : (restaurant?.deliveryFee || 0);
  const total = subtotal + deliveryFee + tip;

  if (lines.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>Your cart is empty</Text>
        <Text style={styles.emptySub}>Add items or ask Palta to build an order.</Text>
        <TouchableOpacity style={styles.emptyBtn} onPress={() => navigation.popToTop()}>
          <Text style={styles.emptyBtnText}>Browse restaurants</Text>
        </TouchableOpacity>
      </View>
    );
  }

  async function placeOrder() {
    if (deliveryType === "DELIVERY" && !address) {
      Alert.alert("No address", "Add a delivery address first.");
      return;
    }
    setPlacing(true);
    try {
      const { data } = await api.post("/orders", {
        restaurantId: cartState.restaurantId,
        lines: lines.map((l) => ({
          menuItemId: l.menuItemId,
          quantity: l.quantity,
          options: l.options || [],
          notes: l.notes || "",
        })),
        tip,
        deliveryAddress: deliveryType === "DELIVERY" ? address?.fullAddress || "" : "",
        deliveryType,
        paymentMethod: payMethod,
      });

      // For a real card payment, `data.payment.clientSecret` would now be
      // confirmed with the Stripe SDK. In mock/dev mode it's pre-succeeded.
      // (Stripe SDK confirmation is wired when you add a real key + dev build.)

      cart.clear();
      navigation.replace("OrderPlaced", { order: data.order, payment: data.payment });
    } catch (e) {
      Alert.alert("Couldn't place order", e.response?.data?.error || e.message);
    } finally {
      setPlacing(false);
    }
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 20 }}>
        <Text style={styles.h1}>Your order</Text>
        <Text style={styles.sub}>{cartState.restaurantName}</Text>

        {/* Delivery / pickup toggle */}
        <View style={styles.toggleRow}>
          {["DELIVERY", "PICKUP"].map((t) => (
            <TouchableOpacity key={t} style={[styles.toggle, deliveryType === t && styles.toggleOn]} onPress={() => setDeliveryType(t)}>
              <Text style={[styles.toggleText, deliveryType === t && styles.toggleTextOn]}>
                {t === "DELIVERY" ? "Delivery" : "Pickup"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {deliveryType === "DELIVERY" && (
          <TouchableOpacity style={styles.addressBlock} onPress={() => navigation.navigate("Address")}>
            <Text style={styles.addressLabel}>
              {address ? `Delivering to · ${address.label}` : "Add a delivery address"}
            </Text>
            <Text style={styles.addressText}>{address ? address.fullAddress : "Tap to set"}</Text>
          </TouchableOpacity>
        )}

        {/* Items */}
        <View style={styles.card}>
          {lines.map((line) => (
            <View key={line.key} style={styles.lineWrap}>
              <View style={styles.lineTop}>
                <Text style={styles.item}>{line.name}</Text>
                <Text style={styles.price}>{formatMoney(line.price * line.quantity, currency)}</Text>
              </View>
              {line.options?.length > 0 && <Text style={styles.opts}>{line.options.map((o) => o.name).join(", ")}</Text>}
              {line.notes ? <Text style={styles.notesText}>“{line.notes}”</Text> : null}
              <View style={styles.stepper}>
                <TouchableOpacity style={styles.stepBtn} onPress={() => cart.setQuantity(line.key, line.quantity - 1)}>
                  <Text style={styles.stepText}>−</Text>
                </TouchableOpacity>
                <Text style={styles.qtyNum}>{line.quantity}</Text>
                <TouchableOpacity style={styles.stepBtn} onPress={() => cart.setQuantity(line.key, line.quantity + 1)}>
                  <Text style={styles.stepText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>

        {/* Tip */}
        <Text style={styles.sectionHead}>Add a tip</Text>
        <View style={styles.tipRow}>
          {TIPS.map((t) => (
            <TouchableOpacity key={t} style={[styles.tip, tip === t && styles.tipOn]} onPress={() => setTip(t)}>
              <Text style={[styles.tipText, tip === t && styles.tipTextOn]}>{t === 0 ? "None" : `$${t}`}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Payment method */}
        <Text style={styles.sectionHead}>Payment</Text>
        <View style={styles.payRow}>
          {[["card", "Card"], ["cash", "Cash on delivery"]].map(([m, label]) => (
            <TouchableOpacity key={m} style={[styles.pay, payMethod === m && styles.payOn]} onPress={() => setPayMethod(m)}>
              <Text style={[styles.payText, payMethod === m && styles.payTextOn]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Totals */}
        <View style={styles.totals}>
          <Row label="Subtotal" value={formatMoney(subtotal, currency)} dim />
          <Row label={deliveryType === "PICKUP" ? "Pickup" : "Delivery"} value={formatMoney(deliveryFee, currency)} dim />
          <Row label="Tip" value={formatMoney(tip, currency)} dim />
          <Row label="Total" value={formatMoney(total, currency)} big />
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={[styles.btn, placing && styles.btnDisabled]} onPress={placeOrder} disabled={placing}>
          {placing ? <ActivityIndicator color="#0E0F0C" /> : (
            <Text style={styles.btnText}>Place order · {formatMoney(total, currency)}</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

function Row({ label, value, dim, big }) {
  return (
    <View style={styles.row}>
      <Text style={big ? styles.totalT : dim ? styles.dim : styles.item}>{label}</Text>
      <Text style={big ? styles.totalT : dim ? styles.dim : styles.item}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  center: { flex: 1, backgroundColor: theme.bg, alignItems: "center", justifyContent: "center", padding: 24 },
  emptyTitle: { color: theme.text, fontSize: 22, fontWeight: "800" },
  emptySub: { color: theme.textDim, fontSize: 15, marginTop: 8, textAlign: "center" },
  emptyBtn: { backgroundColor: theme.accent, borderRadius: theme.radius, paddingHorizontal: 24, paddingVertical: 14, marginTop: 24 },
  emptyBtnText: { color: "#0E0F0C", fontWeight: "700", fontSize: 16 },
  h1: { color: theme.text, fontSize: 26, fontWeight: "800", marginTop: 40 },
  sub: { color: theme.textDim, fontSize: 16, marginTop: 4, marginBottom: 16 },
  toggleRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  toggle: { flex: 1, borderWidth: 1, borderColor: theme.line, borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  toggleOn: { backgroundColor: theme.accent, borderColor: theme.accent },
  toggleText: { color: theme.text, fontSize: 15, fontWeight: "600" },
  toggleTextOn: { color: "#0E0F0C", fontWeight: "800" },
  addressBlock: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.line, borderRadius: theme.radius, padding: 14, marginBottom: 16 },
  addressLabel: { color: theme.accent, fontSize: 12, fontWeight: "700" },
  addressText: { color: theme.text, fontSize: 15, marginTop: 2 },
  card: { backgroundColor: theme.surface, borderRadius: theme.radius, borderWidth: 1, borderColor: theme.line, padding: 16 },
  lineWrap: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: theme.line },
  lineTop: { flexDirection: "row", justifyContent: "space-between" },
  item: { color: theme.text, fontSize: 16, fontWeight: "600" },
  price: { color: theme.text, fontSize: 16, fontWeight: "600" },
  opts: { color: theme.textDim, fontSize: 13, marginTop: 3 },
  notesText: { color: theme.textDim, fontSize: 13, marginTop: 3, fontStyle: "italic" },
  stepper: { flexDirection: "row", alignItems: "center", gap: 16, marginTop: 10 },
  stepBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: theme.surfaceAlt, borderWidth: 1, borderColor: theme.line, alignItems: "center", justifyContent: "center" },
  stepText: { color: theme.accent, fontSize: 20, fontWeight: "700", marginTop: -2 },
  qtyNum: { color: theme.text, fontSize: 16, fontWeight: "800", minWidth: 20, textAlign: "center" },
  sectionHead: { color: theme.text, fontSize: 17, fontWeight: "800", marginTop: 24, marginBottom: 10 },
  tipRow: { flexDirection: "row", gap: 8 },
  tip: { flex: 1, borderWidth: 1, borderColor: theme.line, borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  tipOn: { backgroundColor: theme.accent, borderColor: theme.accent },
  tipText: { color: theme.text, fontSize: 15, fontWeight: "600" },
  tipTextOn: { color: "#0E0F0C", fontWeight: "800" },
  payRow: { flexDirection: "row", gap: 8 },
  pay: { flex: 1, borderWidth: 1, borderColor: theme.line, borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  payOn: { backgroundColor: theme.surfaceAlt, borderColor: theme.accent },
  payText: { color: theme.text, fontSize: 14, fontWeight: "600" },
  payTextOn: { color: theme.accent, fontWeight: "800" },
  totals: { marginTop: 24, backgroundColor: theme.surface, borderRadius: theme.radius, borderWidth: 1, borderColor: theme.line, padding: 16 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 5 },
  dim: { color: theme.textDim, fontSize: 15 },
  totalT: { color: theme.accent, fontSize: 18, fontWeight: "800" },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: theme.line },
  btn: { backgroundColor: theme.accent, borderRadius: theme.radius, paddingVertical: 17, alignItems: "center" },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: "#0E0F0C", fontSize: 17, fontWeight: "800" },
});

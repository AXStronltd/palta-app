import { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, Alert, ScrollView } from "react-native";
import { api } from "../lib/api";
import { theme } from "../lib/theme";

function Stars({ value, onChange }) {
  return (
    <View style={styles.starsRow}>
      {[1, 2, 3, 4, 5].map((n) => (
        <TouchableOpacity key={n} onPress={() => onChange(n)} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
          <Text style={[styles.star, n <= value && styles.starOn]}>★</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

export default function RateOrderScreen({ route, navigation }) {
  const { order } = route.params; // { id, restaurant, driver, deliveryType }
  const hasDriver = order.deliveryType !== "PICKUP" && order.driver;

  const [food, setFood] = useState(0);
  const [driver, setDriver] = useState(0);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (food === 0) { Alert.alert("Add a rating", "Please rate the food."); return; }
    setSaving(true);
    try {
      await api.post(`/orders/${order.id}/rate`, {
        foodRating: food,
        driverRating: hasDriver && driver > 0 ? driver : undefined,
        comment: comment.trim() || undefined,
      });
      Alert.alert("Thank you", "Your rating helps other Palta customers.");
      navigation.goBack();
    } catch (e) {
      Alert.alert("Couldn't submit", e.response?.data?.error || e.message);
    } finally { setSaving(false); }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 24 }}>
      <Text style={styles.h1}>How was it?</Text>
      <Text style={styles.sub}>{order.restaurant?.name}</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Food</Text>
        <Stars value={food} onChange={setFood} />
      </View>

      {hasDriver && (
        <View style={styles.card}>
          <Text style={styles.label}>Driver{order.driver?.name ? ` · ${order.driver.name}` : ""}</Text>
          <Stars value={driver} onChange={setDriver} />
        </View>
      )}

      <Text style={styles.label}>Add a comment (optional)</Text>
      <TextInput
        style={styles.input}
        placeholder="Tell us more…"
        placeholderTextColor={theme.textDim}
        value={comment}
        onChangeText={setComment}
        multiline
      />

      <TouchableOpacity style={[styles.btn, saving && styles.btnDisabled]} onPress={submit} disabled={saving}>
        {saving ? <ActivityIndicator color="#0E0F0C" /> : <Text style={styles.btnText}>Submit rating</Text>}
      </TouchableOpacity>
      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Text style={styles.skip}>Skip for now</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  h1: { color: theme.text, fontSize: 28, fontWeight: "800", marginTop: 30 },
  sub: { color: theme.textDim, fontSize: 16, marginTop: 4, marginBottom: 24 },
  card: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.line, borderRadius: theme.radius, padding: 18, marginBottom: 16 },
  label: { color: theme.textDim, fontSize: 14, marginBottom: 10, marginTop: 4 },
  starsRow: { flexDirection: "row", gap: 8 },
  star: { color: theme.line, fontSize: 40 },
  starOn: { color: theme.accent },
  input: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.line, borderRadius: 12, color: theme.text, fontSize: 15, padding: 14, minHeight: 90, textAlignVertical: "top", marginTop: 4 },
  btn: { backgroundColor: theme.accent, borderRadius: theme.radius, paddingVertical: 17, alignItems: "center", marginTop: 24 },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: "#0E0F0C", fontSize: 17, fontWeight: "800" },
  skip: { color: theme.textDim, textAlign: "center", marginTop: 18, fontSize: 15 },
});

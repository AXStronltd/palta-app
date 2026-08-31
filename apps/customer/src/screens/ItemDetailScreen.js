import { useState, useMemo } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, Alert,
} from "react-native";
import { theme } from "../lib/theme";
import { formatMoney } from "../lib/money";
import { cart } from "../lib/cartStore";

export default function ItemDetailScreen({ route, navigation }) {
  const { restaurant, item } = route.params;
  const groups = item.options?.groups || [];

  // selected: { [groupIndex]: Set(choiceId) or choiceId }
  const [selected, setSelected] = useState({});
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");

  function toggleChoice(gi, group, choiceId) {
    setSelected((prev) => {
      const next = { ...prev };
      if (group.multi) {
        const set = new Set(next[gi] || []);
        set.has(choiceId) ? set.delete(choiceId) : set.add(choiceId);
        next[gi] = set;
      } else {
        next[gi] = choiceId; // single-select
      }
      return next;
    });
  }

  function isChosen(gi, group, choiceId) {
    const v = selected[gi];
    if (group.multi) return v instanceof Set && v.has(choiceId);
    return v === choiceId;
  }

  // Flatten selected options into [{ id, name, price }]
  const chosenOptions = useMemo(() => {
    const out = [];
    groups.forEach((group, gi) => {
      const v = selected[gi];
      if (group.multi && v instanceof Set) {
        group.choices.filter((c) => v.has(c.id)).forEach((c) => out.push(c));
      } else if (!group.multi && v) {
        const c = group.choices.find((x) => x.id === v);
        if (c) out.push(c);
      }
    });
    return out;
  }, [selected, groups]);

  const optionsTotal = chosenOptions.reduce((s, o) => s + (o.price || 0), 0);
  const unitPrice = item.price + optionsTotal;
  const lineTotal = unitPrice * quantity;

  // Required groups must have a selection
  const missingRequired = groups.some((g, gi) => g.required && !selected[gi]);

  function addToCart() {
    // Different restaurant already in cart? confirm reset.
    const state = cart.get();
    if (state.restaurantId && state.restaurantId !== restaurant.id) {
      Alert.alert(
        "Start a new cart?",
        `Your cart has items from ${state.restaurantName}. Adding this will clear it.`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "New cart", style: "destructive", onPress: doAdd },
        ]
      );
      return;
    }
    doAdd();
  }

  function doAdd() {
    cart.add({
      restaurantId: restaurant.id,
      restaurantName: restaurant.name,
      menuItemId: item.id,
      name: item.name,
      price: item.price,
      quantity,
      options: chosenOptions,
      notes: notes.trim(),
    });
    navigation.goBack();
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <Text style={styles.name}>{item.name}</Text>
        {item.description ? <Text style={styles.desc}>{item.description}</Text> : null}
        <Text style={styles.basePrice}>{formatMoney(item.price, restaurant.currency)}</Text>

        {groups.map((group, gi) => (
          <View key={gi} style={styles.group}>
            <View style={styles.groupHeadRow}>
              <Text style={styles.groupHead}>{group.group}</Text>
              <Text style={styles.groupTag}>
                {group.required ? "Required" : "Optional"}
                {group.multi ? " · choose any" : " · choose one"}
              </Text>
            </View>
            {group.choices.map((c) => {
              const chosen = isChosen(gi, group, c.id);
              return (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.choice, chosen && styles.choiceOn]}
                  onPress={() => toggleChoice(gi, group, c.id)}
                >
                  <View style={[styles.check, chosen && styles.checkOn]}>
                    {chosen && <Text style={styles.checkMark}>✓</Text>}
                  </View>
                  <Text style={styles.choiceName}>{c.name}</Text>
                  {c.price > 0 && <Text style={styles.choicePrice}>+{formatMoney(c.price, restaurant.currency)}</Text>}
                </TouchableOpacity>
              );
            })}
          </View>
        ))}

        {/* Special instructions */}
        <Text style={styles.groupHead}>Special instructions</Text>
        <TextInput
          style={styles.notes}
          placeholder="e.g. no onions, extra napkins"
          placeholderTextColor={theme.textDim}
          value={notes}
          onChangeText={setNotes}
          multiline
        />

        {/* Quantity */}
        <View style={styles.qtyRow}>
          <Text style={styles.groupHead}>Quantity</Text>
          <View style={styles.stepper}>
            <TouchableOpacity style={styles.stepBtn} onPress={() => setQuantity((q) => Math.max(1, q - 1))}>
              <Text style={styles.stepText}>−</Text>
            </TouchableOpacity>
            <Text style={styles.qtyNum}>{quantity}</Text>
            <TouchableOpacity style={styles.stepBtn} onPress={() => setQuantity((q) => Math.min(20, q + 1))}>
              <Text style={styles.stepText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.addBtn, missingRequired && styles.addBtnDisabled]}
          onPress={addToCart}
          disabled={missingRequired}
        >
          <Text style={styles.addBtnText}>
            {missingRequired ? "Choose required options" : `Add ${quantity} · ` + formatMoney(lineTotal, restaurant.currency)}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  name: { color: theme.text, fontSize: 26, fontWeight: "800", letterSpacing: -0.5 },
  desc: { color: theme.textDim, fontSize: 15, marginTop: 8, lineHeight: 21 },
  basePrice: { color: theme.text, fontSize: 18, fontWeight: "700", marginTop: 10 },
  group: { marginTop: 24 },
  groupHeadRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  groupHead: { color: theme.text, fontSize: 17, fontWeight: "800", marginTop: 24, marginBottom: 4 },
  groupTag: { color: theme.textDim, fontSize: 12, marginTop: 24 },
  choice: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.line,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, marginTop: 8,
  },
  choiceOn: { borderColor: theme.accent },
  check: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: theme.line,
    alignItems: "center", justifyContent: "center",
  },
  checkOn: { backgroundColor: theme.accent, borderColor: theme.accent },
  checkMark: { color: "#0E0F0C", fontSize: 13, fontWeight: "800" },
  choiceName: { color: theme.text, fontSize: 15, flex: 1 },
  choicePrice: { color: theme.textDim, fontSize: 14 },
  notes: {
    backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.line,
    borderRadius: 12, color: theme.text, fontSize: 15, padding: 14, marginTop: 8,
    minHeight: 64, textAlignVertical: "top",
  },
  qtyRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  stepper: { flexDirection: "row", alignItems: "center", gap: 18, marginTop: 20 },
  stepBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: theme.surfaceAlt,
    borderWidth: 1, borderColor: theme.line, alignItems: "center", justifyContent: "center",
  },
  stepText: { color: theme.accent, fontSize: 24, fontWeight: "700", marginTop: -2 },
  qtyNum: { color: theme.text, fontSize: 20, fontWeight: "800", minWidth: 24, textAlign: "center" },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: theme.line },
  addBtn: { backgroundColor: theme.accent, borderRadius: theme.radius, paddingVertical: 17, alignItems: "center" },
  addBtnDisabled: { opacity: 0.4 },
  addBtnText: { color: "#0E0F0C", fontSize: 17, fontWeight: "800" },
});

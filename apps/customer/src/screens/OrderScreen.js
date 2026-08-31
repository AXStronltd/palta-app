import { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { api } from "../lib/api";
import { theme } from "../lib/theme";
import { formatMoney } from "../lib/money";
import { cart } from "../lib/cartStore";

const SUGGESTIONS = [
  "Something under $15",
  "Feed two people",
  "Just a quick snack",
  "Surprise me",
];

export default function OrderScreen({ route, navigation }) {
  const { restaurant } = route.params;
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: `Hi! I'm your Palta assistant for ${restaurant.name}. Tell me what you're in the mood for and I'll build your order.`,
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [cart, setCart] = useState([]);
  const [subtotal, setSubtotal] = useState(0);
  const listRef = useRef(null);

  async function send(text) {
    const message = (text ?? input).trim();
    if (!message || loading) return;
    setInput("");

    const newHistory = [...messages, { role: "user", content: message }];
    setMessages(newHistory);
    setLoading(true);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);

    try {
      // Send only prior turns as history (exclude the greeting).
      const history = newHistory
        .slice(1)
        .map((m) => ({ role: m.role, content: m.content }));

      const { data } = await api.post("/ai/order", {
        restaurantId: restaurant.id,
        message,
        history: history.slice(0, -1), // history before this message
      });

      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
      if (data.cart?.length) {
        setCart(data.cart);
        setSubtotal(data.subtotal);
        // Write the AI-built cart into the shared store so tap-added
        // items and chat-added items live in one cart at checkout.
        cart.setFromAi({
          restaurantId: restaurant.id,
          restaurantName: restaurant.name,
          aiLines: data.cart,
        });
      }
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Sorry — I couldn't reach the kitchen just now. Try again in a moment.",
        },
      ]);
    } finally {
      setLoading(false);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={90}
    >
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(_, i) => String(i)}
        contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
        renderItem={({ item }) => (
          <View
            style={[
              styles.bubble,
              item.role === "user" ? styles.bubbleUser : styles.bubbleAi,
            ]}
          >
            <Text style={styles.bubbleText}>{item.content}</Text>
          </View>
        )}
        ListFooterComponent={
          loading ? (
            <View style={[styles.bubble, styles.bubbleAi]}>
              <ActivityIndicator color={theme.accent} />
            </View>
          ) : null
        }
      />

      {/* Quick suggestion chips (only before first order) */}
      {cart.length === 0 && !loading && (
        <View style={styles.chips}>
          {SUGGESTIONS.map((s) => (
            <TouchableOpacity key={s} style={styles.chip} onPress={() => send(s)}>
              <Text style={styles.chipText}>{s}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Live cart summary */}
      {cart.length > 0 && (
        <View style={styles.cart}>
          <View style={{ flex: 1 }}>
            {cart.map((line, i) => (
              <Text key={i} style={styles.cartLine}>
                {line.quantity}× {line.name}
                <Text style={styles.cartPrice}>
                  {"  "}{formatMoney(line.price * line.quantity, restaurant.currency)}
                </Text>
              </Text>
            ))}
            <Text style={styles.cartTotal}>Subtotal {formatMoney(subtotal, restaurant.currency)}</Text>
          </View>
          <TouchableOpacity
            style={styles.checkoutBtn}
            onPress={() => navigation.navigate("Checkout", { restaurant })}
          >
            <Text style={styles.checkoutText}>Review</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Tell Palta what you want…"
          placeholderTextColor={theme.textDim}
          value={input}
          onChangeText={setInput}
          onSubmitEditing={() => send()}
          returnKeyType="send"
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!input || loading) && styles.sendDisabled]}
          onPress={() => send()}
          disabled={!input || loading}
        >
          <Text style={styles.sendText}>↑</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  bubble: {
    maxWidth: "82%",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 10,
  },
  bubbleUser: {
    backgroundColor: theme.bubbleUser,
    alignSelf: "flex-end",
    borderBottomRightRadius: 4,
  },
  bubbleAi: {
    backgroundColor: theme.surface,
    alignSelf: "flex-start",
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: theme.line,
  },
  bubbleText: { color: theme.text, fontSize: 16, lineHeight: 22 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 16, paddingBottom: 8 },
  chip: {
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.line,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipText: { color: theme.text, fontSize: 14 },
  cart: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.surfaceAlt,
    marginHorizontal: 12,
    marginBottom: 8,
    borderRadius: theme.radius,
    padding: 14,
    gap: 12,
  },
  cartLine: { color: theme.text, fontSize: 14, marginBottom: 2 },
  cartPrice: { color: theme.textDim },
  cartTotal: { color: theme.accent, fontSize: 15, fontWeight: "700", marginTop: 4 },
  checkoutBtn: {
    backgroundColor: theme.accent,
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  checkoutText: { color: "#0E0F0C", fontWeight: "700", fontSize: 15 },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: theme.line,
  },
  input: {
    flex: 1,
    backgroundColor: theme.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: theme.line,
    color: theme.text,
    fontSize: 16,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  sendBtn: {
    backgroundColor: theme.accent,
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
  },
  sendDisabled: { opacity: 0.4 },
  sendText: { color: "#0E0F0C", fontSize: 22, fontWeight: "800" },
});

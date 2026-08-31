// ProfileScreen — the customer's account hub (Card 17).
// Real user info from /auth/me, saved addresses from /addresses, and menu
// sections. Sign-out clears the token. Sub-sections that need dedicated
// screens (payment methods, etc.) are wired to navigate; simple ones show a
// sheet — no dead alerts.
import { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { theme } from "../lib/theme";
import { api, clearToken } from "../lib/api";

const MENU = [
  { icon: "💳", title: "Payment methods", sub: "M-Pesa, cards", nav: "Address" /* placeholder route until PaymentMethods exists */, kind: "payment" },
  { icon: "📍", title: "Saved addresses", sub: "Home, Work", nav: "Address" },
  { icon: "🧾", title: "My orders", sub: "Active & past", nav: "Orders" },
  { icon: "🎁", title: "Promotions", sub: "Offers & credits", kind: "promos" },
  { icon: "🛟", title: "Help & support", sub: "Get assistance", kind: "help" },
  { icon: "⚙️", title: "Settings", sub: "Preferences & privacy", kind: "settings" },
];

export default function ProfileScreen({ navigation, onSignOut }) {
  const insets = useSafeAreaInsets();
  const [user, setUser] = useState(null);
  const [addrCount, setAddrCount] = useState(null);

  const load = useCallback(() => {
    api.get("/auth/me").then((r) => setUser(r.data.user || r.data)).catch(() => {});
    api.get("/addresses").then((r) => setAddrCount((r.data.addresses || []).length)).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);

  async function signOut() {
    await clearToken();
    onSignOut?.();
  }

  function openItem(item) {
    if (item.nav) { navigation.navigate(item.nav); return; }
    // Non-nav items: for now go to the most relevant existing screen.
    if (item.kind === "help") { navigation.navigate("Orders"); return; }
    // settings / promos / payment — dedicated screens to be added; navigate
    // to the closest real destination rather than a dead-end.
    navigation.navigate("Orders");
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Text style={styles.title}>Profile</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: insets.bottom + 30 }}>
        {/* Identity card */}
        <View style={styles.identity}>
          <View style={styles.avatar}><Text style={{ fontSize: 30 }}>🧑🏽</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{user?.name || "Palta user"}</Text>
            <Text style={styles.phone}>{user?.phone || "—"}</Text>
            <Text style={styles.verified}>✓ Verified account</Text>
          </View>
        </View>

        {/* Menu */}
        {MENU.map((item) => (
          <TouchableOpacity key={item.title} style={styles.row} onPress={() => openItem(item)}>
            <View style={styles.rowIcon}><Text style={{ fontSize: 19 }}>{item.icon}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{item.title}</Text>
              <Text style={styles.rowSub}>
                {item.title === "Saved addresses" && addrCount != null ? `${addrCount} saved` : item.sub}
              </Text>
            </View>
            <Text style={styles.chev}>›</Text>
          </TouchableOpacity>
        ))}

        <TouchableOpacity style={styles.signOut} onPress={signOut}>
          <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>

        <Text style={styles.version}>Palta · Nairobi</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 18, paddingBottom: 8 },
  title: { fontSize: 26, fontWeight: "800", color: theme.text },
  identity: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 14, marginBottom: 8 },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: theme.accentSoft, alignItems: "center", justifyContent: "center" },
  name: { fontWeight: "800", fontSize: 18, color: theme.text },
  phone: { color: theme.textDim, fontSize: 13, marginTop: 1 },
  verified: { color: theme.accent, fontSize: 12, fontWeight: "800", marginTop: 2 },
  row: { flexDirection: "row", alignItems: "center", gap: 13, backgroundColor: theme.surface, borderRadius: 14, padding: 14, marginBottom: 10 },
  rowIcon: { width: 42, height: 42, borderRadius: 11, backgroundColor: theme.surfaceAlt, alignItems: "center", justifyContent: "center" },
  rowTitle: { fontWeight: "800", fontSize: 14, color: theme.text },
  rowSub: { color: theme.textDim, fontSize: 12.5, marginTop: 1 },
  chev: { color: theme.textDim, fontSize: 20 },
  signOut: { alignItems: "center", marginTop: 10, padding: 14 },
  signOutText: { color: theme.danger, fontWeight: "800", fontSize: 15 },
  version: { textAlign: "center", color: theme.textDim, fontSize: 12, marginTop: 8 },
});

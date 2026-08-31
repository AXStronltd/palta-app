// Choose-your-role screen. One Palta identity, multiple roles.
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { theme } from "../lib/theme";

const ROLES = [
  { key: "order", icon: "🛍️", title: "I want to order", desc: "Get food, groceries & more" },
  { key: "sell", icon: "🏪", title: "I want to sell", desc: "Register my restaurant or shop" },
  { key: "deliver", icon: "🛵", title: "I want to deliver", desc: "Earn by delivering orders" },
  { key: "parcel", icon: "📦", title: "I want to send", desc: "Send parcels / documents" },
];

export default function RoleSelectScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <View>
          <Text style={styles.title}>Choose your role</Text>
          <Text style={styles.sub}>You can switch anytime</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {ROLES.map((r) => (
          <TouchableOpacity
            key={r.key}
            activeOpacity={0.85}
            style={styles.role}
            onPress={() => {
              // All-in-one Palta: route each role to its home.
              if (r.key === "deliver") navigation.navigate("DriverHome");
              else if (r.key === "sell") navigation.navigate("Home"); // merchant onboarding via web dashboard for now
              else navigation.navigate("Home"); // order / parcel → customer home
            }}
          >
            <View style={styles.ri}><Text style={styles.riText}>{r.icon}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rt}>{r.title}</Text>
              <Text style={styles.rd}>{r.desc}</Text>
            </View>
            <Text style={styles.chev}>›</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: theme.bg },
  header: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 18, paddingBottom: 10 },
  back: { width: 38, height: 38, borderRadius: 19, backgroundColor: theme.surfaceAlt, alignItems: "center", justifyContent: "center" },
  backText: { color: theme.text, fontSize: 22, marginTop: -2 },
  title: { fontSize: 20, fontWeight: "800", color: theme.text },
  sub: { fontSize: 12, color: theme.textDim, marginTop: 2 },
  list: { padding: 18, paddingTop: 6 },
  role: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.line, borderRadius: 16, padding: 16, marginBottom: 12 },
  ri: { width: 46, height: 46, borderRadius: 13, backgroundColor: theme.accentSoft, alignItems: "center", justifyContent: "center" },
  riText: { fontSize: 22 },
  rt: { fontSize: 16, fontWeight: "700", color: theme.text },
  rd: { color: theme.textDim, fontSize: 13, marginTop: 2 },
  chev: { color: theme.textDim, fontSize: 22 },
});

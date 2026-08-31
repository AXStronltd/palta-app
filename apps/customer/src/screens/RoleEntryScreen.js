// RoleEntryScreen — the gate after login.
// Implements the all-in-one model where each role sees ONLY its own world:
//   • No roles yet  → pick a role (each role has its own onboarding).
//   • One role      → go straight into that role's home.
//   • Many roles    → choose which role to enter this session.
// A customer never sees driver screens; a driver never sees customer screens.
import { useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { theme } from "../lib/theme";
import { api } from "../lib/api";

// Map a stored role to where it should land, and its label.
const ROLE_INFO = {
  CUSTOMER:   { label: "Order food & more", icon: "🛍️", home: "Home",       onboard: null },
  DRIVER:     { label: "Drive & earn",       icon: "🛵", home: "DriverHome", onboard: "DriverKyc" },
  RESTAURANT: { label: "My shop",            icon: "🏪", home: "Home",       onboard: null }, // merchant dashboard is web for now
};

// The roles a NEW user can choose from, each with its own onboarding path.
const CHOOSE = [
  { role: "CUSTOMER",   icon: "🛍️", title: "I want to order",  desc: "Food, groceries, parcels & rides" },
  { role: "DRIVER",     icon: "🛵", title: "I want to drive",  desc: "Earn delivering — needs verification" },
  { role: "RESTAURANT", icon: "🏪", title: "I run a business", desc: "List my restaurant or shop" },
];

export default function RoleEntryScreen({ navigation, user, onPickRole }) {
  const insets = useSafeAreaInsets();
  const [roles, setRoles] = useState(user?.roles || []);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Ask the backend for the freshest role list.
    api.get("/auth/me")
      .then((r) => {
        const u = r.data.user || r.data;
        const rs = u.roles && u.roles.length ? u.roles : (u.role ? [u.role] : []);
        setRoles(rs);
        // One role → go straight in, no picker.
        if (rs.length === 1) enterRole(rs[0], true);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function enterRole(role, replace = false) {
    const info = ROLE_INFO[role] || ROLE_INFO.CUSTOMER;
    navigation.reset({ index: 0, routes: [{ name: info.home }] });
  }

  // New user picks a role → run that role's onboarding (or straight to home).
  function chooseRole(role) {
    const info = ROLE_INFO[role] || ROLE_INFO.CUSTOMER;
    onPickRole?.(role);
    if (info.onboard) {
      navigation.navigate(info.onboard, { role }); // e.g. driver KYC
    } else {
      navigation.reset({ index: 0, routes: [{ name: info.home }] });
    }
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={theme.accent} size="large" /></View>;
  }

  // ---- NO ROLES → first-time role picker (each has its own onboarding) ----
  if (!roles.length) {
    return (
      <View style={[styles.wrap, { paddingTop: insets.top + 20 }]}>
        <Text style={styles.title}>Welcome to Palta</Text>
        <Text style={styles.sub}>How do you want to use Palta? You can add another role later.</Text>
        <ScrollView contentContainerStyle={styles.list}>
          {CHOOSE.map((c) => (
            <TouchableOpacity key={c.role} style={styles.card} activeOpacity={0.85} onPress={() => chooseRole(c.role)}>
              <View style={styles.ci}><Text style={styles.ciText}>{c.icon}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.ct}>{c.title}</Text>
                <Text style={styles.cd}>{c.desc}</Text>
              </View>
              <Text style={styles.chev}>›</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  }

  // ---- MANY ROLES → choose which world to enter this session ----
  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 20 }]}>
      <Text style={styles.title}>Enter as…</Text>
      <Text style={styles.sub}>Choose how you want to use Palta right now.</Text>
      <ScrollView contentContainerStyle={styles.list}>
        {roles.map((role) => {
          const info = ROLE_INFO[role] || ROLE_INFO.CUSTOMER;
          return (
            <TouchableOpacity key={role} style={styles.card} activeOpacity={0.85} onPress={() => enterRole(role)}>
              <View style={styles.ci}><Text style={styles.ciText}>{info.icon}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.ct}>{info.label}</Text>
              </View>
              <Text style={styles.chev}>›</Text>
            </TouchableOpacity>
          );
        })}
        {/* Add a new role they don't have yet */}
        {CHOOSE.filter((c) => !roles.includes(c.role)).map((c) => (
          <TouchableOpacity key={c.role} style={[styles.card, styles.addCard]} activeOpacity={0.85} onPress={() => chooseRole(c.role)}>
            <View style={styles.ci}><Text style={styles.ciText}>＋</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.ct}>Add: {c.title.replace("I want to ", "").replace("I run a ", "")}</Text>
              <Text style={styles.cd}>{c.desc}</Text>
            </View>
            <Text style={styles.chev}>›</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: theme.bg },
  wrap: { flex: 1, backgroundColor: theme.bg, paddingHorizontal: 20 },
  title: { fontSize: 28, fontWeight: "800", color: theme.text },
  sub: { fontSize: 14, color: theme.textDim, marginTop: 6, marginBottom: 18 },
  list: { paddingBottom: 30 },
  card: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.line, borderRadius: 16, padding: 16, marginBottom: 12 },
  addCard: { borderStyle: "dashed" },
  ci: { width: 46, height: 46, borderRadius: 12, backgroundColor: theme.accentSoft, alignItems: "center", justifyContent: "center" },
  ciText: { fontSize: 22 },
  ct: { fontWeight: "800", fontSize: 16, color: theme.text },
  cd: { color: theme.textDim, fontSize: 13, marginTop: 2 },
  chev: { color: theme.textDim, fontSize: 22 },
});

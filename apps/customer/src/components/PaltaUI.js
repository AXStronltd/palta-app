// Shared Palta UI primitives — real React Native components.
import { View, Text, TouchableOpacity, StyleSheet, Image } from "react-native";
import { theme } from "../lib/theme";

export function PButton({ label, onPress, ghost, style }) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={[styles.btn, ghost && styles.btnGhost, style]}
    >
      <Text style={[styles.btnText, ghost && styles.btnGhostText]}>{label}</Text>
    </TouchableOpacity>
  );
}

// The Palta logo mark — rounded green square with a dot + stem forming a "P".
export function PMark({ size = 38 }) {
  return (
    <View style={[styles.mark, { width: size, height: size, borderRadius: size * 0.32 }]}>
      <View style={[styles.markDot, { top: size * 0.24, left: size * 0.24, width: size * 0.32, height: size * 0.32, borderRadius: size * 0.16 }]} />
      <View style={[styles.markStem, { top: size * 0.34, left: size * 0.47, width: size * 0.16, height: size * 0.37 }]} />
    </View>
  );
}

export function SectionHeader({ title, action, onAction }) {
  return (
    <View style={styles.shead}>
      <Text style={styles.sheadTitle}>{title}</Text>
      {action ? (
        <Text style={styles.sheadAction} onPress={onAction}>{action}</Text>
      ) : null}
    </View>
  );
}

// Horizontal discovery card (Popular Near You, Groceries & Shops).
export function DiscoveryCard({ item, onPress }) {
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={styles.dcard}>
      <View style={styles.dimg}>
        {item.img ? <Image source={{ uri: item.img }} style={styles.dimgImg} /> : null}
        <View style={styles.fav}><Text>🤍</Text></View>
      </View>
      <Text style={styles.dname}>{item.name}</Text>
      <Text style={styles.dmeta}>
        {item.time} <Text style={{ color: theme.star }}>★</Text> {item.rating}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: { backgroundColor: theme.accent, borderRadius: 14, paddingVertical: 16, alignItems: "center" },
  btnGhost: { backgroundColor: "transparent", borderWidth: 1, borderColor: theme.line },
  btnText: { color: theme.onAccent, fontSize: 16, fontWeight: "700" },
  btnGhostText: { color: theme.text },

  mark: { backgroundColor: theme.accent, position: "relative" },
  markDot: { position: "absolute", backgroundColor: "#fff" },
  markStem: { position: "absolute", backgroundColor: "#fff", borderRadius: 3, transform: [{ rotate: "20deg" }] },

  shead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", paddingHorizontal: 18, paddingTop: 14, paddingBottom: 10 },
  sheadTitle: { fontSize: 17, fontWeight: "800", color: theme.text },
  sheadAction: { color: theme.accent, fontSize: 13, fontWeight: "700" },

  dcard: { width: 158, marginRight: 13 },
  dimg: { height: 104, borderRadius: 14, overflow: "hidden", backgroundColor: theme.surfaceAlt },
  dimgImg: { width: "100%", height: "100%" },
  fav: { position: "absolute", top: 8, right: 8, width: 28, height: 28, borderRadius: 14, backgroundColor: "rgba(6,10,9,0.6)", alignItems: "center", justifyContent: "center" },
  dname: { fontSize: 15, fontWeight: "700", color: theme.text, marginTop: 8 },
  dmeta: { fontSize: 12, color: theme.textDim, marginTop: 3 },
});

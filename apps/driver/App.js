import { useEffect, useState } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { api, getToken, clearToken } from "./src/lib/api";
import { theme } from "./src/lib/theme";
import LoginScreen from "./src/screens/LoginScreen";
import KycScreen from "./src/screens/KycScreen";
import DriverHomeScreen from "./src/screens/DriverHomeScreen";

export default function App() {
  const [booting, setBooting] = useState(true);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null); // has kycStatus once loaded

  useEffect(() => {
    (async () => {
      const token = await getToken();
      if (token) {
        try {
          const me = await api.get("/auth/me");
          setUser(me.data.user);
          const dp = await api.get("/driver/me");
          setProfile(dp.data.profile);
        } catch {
          await clearToken();
        }
      }
      setBooting(false);
    })();
  }, []);

  function handleAuthed(u) {
    setUser(u);
    api.get("/driver/me").then((r) => setProfile(r.data.profile)).catch(() => {});
  }

  function logout() { setUser(null); setProfile(null); }

  if (booting) {
    return <View style={styles.center}><ActivityIndicator color={theme.accent} size="large" /></View>;
  }

  let screen;
  if (!user) {
    screen = <LoginScreen onAuthed={handleAuthed} />;
  } else if (profile?.kycStatus === "APPROVED") {
    screen = <DriverHomeScreen profile={profile} onLogout={logout} />;
  } else {
    screen = (
      <KycScreen
        onApproved={(p) => setProfile(p)}
        onSubmitted={(p) => setProfile(p)}
      />
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      {screen}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: theme.bg, alignItems: "center", justifyContent: "center" },
});

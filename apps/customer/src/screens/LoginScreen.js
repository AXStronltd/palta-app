import { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { api, saveToken } from "../lib/api";
import { theme } from "../lib/theme";

export default function LoginScreen({ onAuthed }) {
  const [step, setStep] = useState("phone"); // "phone" | "code"
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [country, setCountry] = useState("AE");
  const [countries, setCountries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get("/config/countries")
      .then((r) => {
        setCountries(r.data.countries || []);
        if (r.data.countries?.[0]) setCountry(r.data.countries[0].code);
      })
      .catch(() => setCountries([{ code: "AE", name: "UAE", dialCode: "+971" }]));
  }, []);

  async function requestOtp() {
    setError(null);
    setLoading(true);
    try {
      const { data } = await api.post("/auth/request-otp", { phone, country });
      // DEV convenience: auto-fill the code the backend returned.
      if (data.devCode) setCode(data.devCode);
      setStep("code");
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  }

  async function verify() {
    setError(null);
    setLoading(true);
    try {
      const { data } = await api.post("/auth/verify", {
        phone,
        code,
        country,
        name: name || undefined,
        role: "CUSTOMER",
      });
      await saveToken(data.token);
      onAuthed(data.user);
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.header}>
        <Text style={styles.logo}>Palta</Text>
        <Text style={styles.tag}>Food, the fast way.</Text>
      </View>

      {step === "phone" ? (
        <View style={styles.form}>
          <Text style={styles.label}>Your name</Text>
          <TextInput
            style={styles.input}
            placeholder="Ahmed"
            placeholderTextColor={theme.textDim}
            value={name}
            onChangeText={setName}
          />
          <Text style={styles.label}>Country</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.countryRow}>
            {countries.map((c) => (
              <TouchableOpacity
                key={c.code}
                style={[styles.countryChip, country === c.code && styles.countryChipOn]}
                onPress={() => setCountry(c.code)}
              >
                <Text style={[styles.countryChipText, country === c.code && styles.countryChipTextOn]}>
                  {c.code} {c.dialCode}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.label}>Phone number</Text>
          <TextInput
            style={styles.input}
            placeholder="+971 50 123 4567"
            placeholderTextColor={theme.textDim}
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
          />
          <TouchableOpacity
            style={[styles.btn, (!phone || loading) && styles.btnDisabled]}
            onPress={requestOtp}
            disabled={!phone || loading}
          >
            {loading ? (
              <ActivityIndicator color="#0E0F0C" />
            ) : (
              <Text style={styles.btnText}>Send code</Text>
            )}
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.form}>
          <Text style={styles.label}>Enter the 6-digit code</Text>
          <TextInput
            style={[styles.input, styles.codeInput]}
            placeholder="000000"
            placeholderTextColor={theme.textDim}
            keyboardType="number-pad"
            maxLength={6}
            value={code}
            onChangeText={setCode}
          />
          <TouchableOpacity
            style={[styles.btn, (code.length !== 6 || loading) && styles.btnDisabled]}
            onPress={verify}
            disabled={code.length !== 6 || loading}
          >
            {loading ? (
              <ActivityIndicator color="#0E0F0C" />
            ) : (
              <Text style={styles.btnText}>Verify & continue</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setStep("phone")}>
            <Text style={styles.link}>Change number</Text>
          </TouchableOpacity>
        </View>
      )}

      {error && <Text style={styles.error}>{error}</Text>}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg, justifyContent: "center", padding: 24 },
  header: { alignItems: "center", marginBottom: 40 },
  logo: { color: theme.accent, fontSize: 52, fontWeight: "800", letterSpacing: -1.5 },
  tag: { color: theme.textDim, fontSize: 16, marginTop: 6 },
  form: { gap: 10 },
  label: { color: theme.textDim, fontSize: 13, marginTop: 8, marginLeft: 4 },
  countryRow: { flexGrow: 0, marginVertical: 8 },
  countryChip: { borderWidth: 1, borderColor: theme.line, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, marginRight: 8 },
  countryChipOn: { backgroundColor: theme.accent, borderColor: theme.accent },
  countryChipText: { color: theme.text, fontSize: 14, fontWeight: "600" },
  countryChipTextOn: { color: "#0E0F0C" },
  input: {
    backgroundColor: theme.surface,
    borderRadius: theme.radius,
    borderWidth: 1,
    borderColor: theme.line,
    color: theme.text,
    fontSize: 17,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  codeInput: { fontSize: 28, letterSpacing: 8, textAlign: "center" },
  btn: {
    backgroundColor: theme.accent,
    borderRadius: theme.radius,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 16,
  },
  btnDisabled: { opacity: 0.4 },
  btnText: { color: "#0E0F0C", fontSize: 17, fontWeight: "700" },
  link: { color: theme.accent, textAlign: "center", marginTop: 16, fontSize: 15 },
  error: { color: theme.danger, textAlign: "center", marginTop: 20, fontSize: 14 },
});

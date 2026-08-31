import { useEffect, useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Image, Alert,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { api } from "../lib/api";
import { theme } from "../lib/theme";

const REQUIRED_DOCS = [
  { type: "DRIVERS_LICENSE", label: "Driver's license" },
  { type: "NATIONAL_ID", label: "National ID / passport" },
  { type: "VEHICLE_PHOTO", label: "Photo of your vehicle" },
];

export default function KycScreen({ onApproved, onSubmitted }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(null); // doc type being uploaded

  // Form fields
  const [form, setForm] = useState({
    fullName: "", dateOfBirth: "", vehicleType: "Car",
    vehicleMake: "", vehicleModel: "", vehicleColor: "", licensePlate: "",
  });
  const [docs, setDocs] = useState({}); // type -> fileUrl

  useEffect(() => {
    api.get("/driver/me").then(({ data }) => {
      const p = data.profile;
      setProfile(p);
      setForm((f) => ({
        ...f,
        fullName: p.fullName || "",
        dateOfBirth: p.dateOfBirth || "",
        vehicleType: p.vehicleType || "Car",
        vehicleMake: p.vehicleMake || "",
        vehicleModel: p.vehicleModel || "",
        vehicleColor: p.vehicleColor || "",
        licensePlate: p.licensePlate || "",
      }));
      const dmap = {};
      (p.documents || []).forEach((d) => { dmap[d.type] = d.fileUrl; });
      setDocs(dmap);
      if (p.kycStatus === "APPROVED") onApproved?.(p);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  function setField(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  async function saveProfile() {
    setSaving(true);
    try {
      const { data } = await api.patch("/driver/profile", form);
      setProfile(data.profile);
    } catch (e) {
      Alert.alert("Couldn't save", e.response?.data?.error || e.message);
    } finally { setSaving(false); }
  }

  async function pickAndUpload(type) {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission needed", "Allow photo access to upload documents.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.6,
      base64: true,
    });
    if (result.canceled) return;

    setUploading(type);
    try {
      const asset = result.assets[0];
      const { data } = await api.post("/driver/documents", {
        type,
        base64: asset.base64,
        ext: "jpg",
      });
      setDocs((d) => ({ ...d, [type]: data.document.fileUrl }));
    } catch (e) {
      Alert.alert("Upload failed", e.response?.data?.error || e.message);
    } finally { setUploading(null); }
  }

  async function submit() {
    // Save latest form first
    await saveProfile();
    try {
      const { data } = await api.post("/driver/submit");
      if (data.autoApproved) {
        Alert.alert("Approved", "Your account is approved. You can go online.");
        onApproved?.(data.profile);
      } else {
        onSubmitted?.(data.profile);
      }
    } catch (e) {
      const detail = e.response?.data;
      if (detail?.missingDocs || detail?.missingFields) {
        Alert.alert("Almost there",
          "Missing: " + [...(detail.missingFields || []), ...(detail.missingDocs || [])].join(", "));
      } else {
        Alert.alert("Couldn't submit", detail?.error || e.message);
      }
    }
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={theme.accent} size="large" /></View>;
  }

  // Pending review state
  if (profile?.kycStatus === "PENDING" && profile?.kycSubmittedAt) {
    return (
      <View style={styles.center}>
        <View style={styles.pendingBadge}><Text style={styles.pendingIcon}>⏳</Text></View>
        <Text style={styles.pendingTitle}>Under review</Text>
        <Text style={styles.pendingSub}>
          We're verifying your documents. You'll be notified when approved —
          usually within a day.
        </Text>
      </View>
    );
  }

  const allDocsUploaded = REQUIRED_DOCS.every((d) => docs[d.type]);
  const detailsComplete = form.fullName && form.vehicleType && form.licensePlate;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
      <Text style={styles.h1}>Become a Palta driver</Text>
      <Text style={styles.sub}>A few details and documents to get you on the road.</Text>

      <Text style={styles.section}>Personal</Text>
      <Field label="Full name" value={form.fullName} onChange={(v) => setField("fullName", v)} placeholder="As on your license" />
      <Field label="Date of birth" value={form.dateOfBirth} onChange={(v) => setField("dateOfBirth", v)} placeholder="YYYY-MM-DD" />

      <Text style={styles.section}>Vehicle</Text>
      <View style={styles.vehicleTypeRow}>
        {["Car", "Motorbike", "Bicycle"].map((t) => (
          <TouchableOpacity key={t} style={[styles.vt, form.vehicleType === t && styles.vtOn]} onPress={() => setField("vehicleType", t)}>
            <Text style={[styles.vtText, form.vehicleType === t && styles.vtTextOn]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Field label="Make" value={form.vehicleMake} onChange={(v) => setField("vehicleMake", v)} placeholder="Toyota" />
      <Field label="Model" value={form.vehicleModel} onChange={(v) => setField("vehicleModel", v)} placeholder="Corolla" />
      <Field label="Color" value={form.vehicleColor} onChange={(v) => setField("vehicleColor", v)} placeholder="White" />
      <Field label="License plate" value={form.licensePlate} onChange={(v) => setField("licensePlate", v)} placeholder="A 12345" />

      <Text style={styles.section}>Documents</Text>
      {REQUIRED_DOCS.map((d) => (
        <TouchableOpacity key={d.type} style={styles.docRow} onPress={() => pickAndUpload(d.type)} disabled={uploading === d.type}>
          {docs[d.type] ? (
            <Image source={{ uri: `${api.defaults.baseURL}${docs[d.type]}` }} style={styles.docThumb} />
          ) : (
            <View style={[styles.docThumb, styles.docThumbEmpty]}>
              <Text style={styles.docPlus}>+</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.docLabel}>{d.label}</Text>
            <Text style={[styles.docStatus, docs[d.type] && styles.docStatusOk]}>
              {uploading === d.type ? "Uploading…" : docs[d.type] ? "Uploaded ✓" : "Tap to upload"}
            </Text>
          </View>
        </TouchableOpacity>
      ))}

      <TouchableOpacity
        style={[styles.submitBtn, (!allDocsUploaded || !detailsComplete) && styles.submitDisabled]}
        onPress={submit}
        disabled={!allDocsUploaded || !detailsComplete}
      >
        <Text style={styles.submitText}>
          {!detailsComplete ? "Fill required details" : !allDocsUploaded ? "Upload all documents" : "Submit for review"}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function Field({ label, value, onChange, placeholder }) {
  return (
    <View style={{ marginTop: 12 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput style={styles.input} value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={theme.textDim} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  center: { flex: 1, backgroundColor: theme.bg, alignItems: "center", justifyContent: "center", padding: 24 },
  h1: { color: theme.text, fontSize: 26, fontWeight: "800", marginTop: 40 },
  sub: { color: theme.textDim, fontSize: 15, marginTop: 6 },
  section: { color: theme.accent, fontSize: 13, fontWeight: "800", letterSpacing: 1, marginTop: 28, textTransform: "uppercase" },
  fieldLabel: { color: theme.textDim, fontSize: 13, marginBottom: 6, marginLeft: 4 },
  input: { backgroundColor: theme.surface, borderRadius: 12, borderWidth: 1, borderColor: theme.line, color: theme.text, fontSize: 16, paddingHorizontal: 14, paddingVertical: 12 },
  vehicleTypeRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  vt: { flex: 1, borderWidth: 1, borderColor: theme.line, borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  vtOn: { backgroundColor: theme.accent, borderColor: theme.accent },
  vtText: { color: theme.text, fontSize: 14, fontWeight: "600" },
  vtTextOn: { color: "#07120C", fontWeight: "800" },
  docRow: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.line, borderRadius: 12, padding: 12, marginTop: 12 },
  docThumb: { width: 56, height: 56, borderRadius: 8, backgroundColor: theme.surfaceAlt },
  docThumbEmpty: { alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: theme.line },
  docPlus: { color: theme.accent, fontSize: 28, fontWeight: "700" },
  docLabel: { color: theme.text, fontSize: 15, fontWeight: "600" },
  docStatus: { color: theme.textDim, fontSize: 13, marginTop: 3 },
  docStatusOk: { color: theme.accent },
  submitBtn: { backgroundColor: theme.accent, borderRadius: theme.radius, paddingVertical: 17, alignItems: "center", marginTop: 32 },
  submitDisabled: { opacity: 0.4 },
  submitText: { color: "#07120C", fontSize: 17, fontWeight: "800" },
  pendingBadge: { width: 88, height: 88, borderRadius: 44, backgroundColor: theme.surfaceAlt, alignItems: "center", justifyContent: "center", marginBottom: 24 },
  pendingIcon: { fontSize: 40 },
  pendingTitle: { color: theme.text, fontSize: 26, fontWeight: "800" },
  pendingSub: { color: theme.textDim, fontSize: 15, marginTop: 12, textAlign: "center", lineHeight: 21 },
});

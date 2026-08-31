// Palta design system — teal-green on near-black.
// "Everything. Delivered. Beautifully."
export const theme = {
  bg: "#0B0F0E",        // near-black app background
  surface: "#141A18",   // card
  surfaceAlt: "#1C2523",// raised card
  line: "#26302D",      // hairline
  text: "#F2F5F4",      // primary text
  textDim: "#93A29D",   // muted
  accent: "#16B08A",    // Palta teal-green
  accentDark: "#0E8E6E",
  accentSoft: "#1C3A33",// green tint background
  onAccent: "#FFFFFF",
  star: "#F5B84E",
  danger: "#F0685E",
  radius: 16,
};

// Currency helper — Palta launches in Nairobi (KES).
export function KES(n) {
  return "KES " + Number(n || 0).toLocaleString("en-KE");
}

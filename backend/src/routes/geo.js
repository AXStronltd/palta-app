// Geocoding routes — proxy to Mapbox so the token stays server-side.
//
// Two endpoints:
//   GET /geo/search?q=...          forward geocode (address text -> places)
//   GET /geo/reverse?lat=&lng=     reverse geocode (pin -> address text)
//
// Swap the provider here later without touching the apps.

const express = require("express");

const router = express.Router();

const MAPBOX_TOKEN = process.env.MAPBOX_TOKEN || "";
const BASE = "https://api.mapbox.com/geocoding/v5/mapbox.places";

// GET /geo/config — hands the app a public token for static map previews.
// (A Mapbox public "pk." token is safe to expose; restrict it by URL in
// your Mapbox account settings.)
router.get("/config", (_req, res) => {
  res.json({ publicToken: MAPBOX_TOKEN });
});

// GET /geo/search?q=marina&proximity=lng,lat
router.get("/search", async (req, res) => {
  const q = (req.query.q || "").toString().trim();
  if (!q) return res.status(400).json({ error: "q is required" });
  if (!MAPBOX_TOKEN) return res.status(500).json({ error: "MAPBOX_TOKEN not set" });

  const params = new URLSearchParams({
    access_token: MAPBOX_TOKEN,
    limit: "6",
    types: "address,poi,place,neighborhood",
  });
  if (req.query.proximity) params.set("proximity", req.query.proximity.toString());

  try {
    const r = await fetch(`${BASE}/${encodeURIComponent(q)}.json?${params}`);
    const data = await r.json();
    const results = (data.features || []).map((f) => ({
      id: f.id,
      name: f.text,
      fullAddress: f.place_name,
      lat: f.center[1],
      lng: f.center[0],
    }));
    res.json({ results });
  } catch (err) {
    console.error("[/geo/search]", err.message);
    res.status(502).json({ error: "Geocoding failed" });
  }
});

// GET /geo/reverse?lat=..&lng=..
router.get("/reverse", async (req, res) => {
  const { lat, lng } = req.query;
  if (!lat || !lng) return res.status(400).json({ error: "lat and lng required" });
  if (!MAPBOX_TOKEN) return res.status(500).json({ error: "MAPBOX_TOKEN not set" });

  const params = new URLSearchParams({
    access_token: MAPBOX_TOKEN,
    limit: "1",
    types: "address,poi,place",
  });

  try {
    const r = await fetch(`${BASE}/${lng},${lat}.json?${params}`);
    const data = await r.json();
    const f = (data.features || [])[0];
    res.json({
      result: f
        ? { fullAddress: f.place_name, name: f.text, lat: Number(lat), lng: Number(lng) }
        : { fullAddress: `${lat}, ${lng}`, name: "Pinned location", lat: Number(lat), lng: Number(lng) },
    });
  } catch (err) {
    console.error("[/geo/reverse]", err.message);
    res.status(502).json({ error: "Reverse geocoding failed" });
  }
});

module.exports = router;

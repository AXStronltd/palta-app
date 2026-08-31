// Public config routes — lets apps discover enabled countries + currency.

const express = require("express");
const { listEnabledCountries } = require("../config/countries");

const router = express.Router();

// GET /config/countries — the countries Palta is live in (for a picker)
router.get("/countries", (_req, res) => {
  res.json({ countries: listEnabledCountries() });
});

module.exports = router;

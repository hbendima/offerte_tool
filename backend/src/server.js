const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const app = express();
const PORT = process.env.PORT || 3001;

// Import dashboard routes (offertes)
const dashboardRoutes = require("./routes/dashboard");

app.use(cors());
app.use(bodyParser.json());

// Dashboard routes (GET /api/dashboard)
app.use("/api", dashboardRoutes);

// Calculatie endpoint (POST /api/calc)
app.post("/api/calc", (req, res) => {
  // Verwacht: req.body.products = [{sku, amount}, ...]
  const products = req.body.products.map((row, i) => ({
    sku: row.sku,
    amount: Number(row.amount),
    name: "Product " + row.sku,
    price: 12.5 + i,     // Mock prijs
    cost: 8.2 + i,       // Mock kostprijs
    margin_pct: ((12.5 + i - (8.2 + i)) / (12.5 + i)) * 100,
  }));
  res.json({ products });
});

// Health check
app.get("/", (req, res) => {
  res.send("API server is running!");
});

app.listen(PORT, () => {
  console.log(`API server running on port ${PORT}`);
});
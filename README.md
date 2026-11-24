# WorthIt ⚡
> **Amazon Price History & Deal Validator**

WorthIt is a fast, tile-based web application that vets Amazon deals in real time against historical pricing benchmarks (All-Time Low, All-Time High, Historical Average) to spot fake sales and validate genuine discounts.

![WorthIt Preview](client/public/favicon.svg)

---

## ✨ Features

- **Live Amazon Scraping**: Real-time extraction of live deal prices, strike-through list prices, and product metadata.
- **CamelCamelCamel Integration**: Automated historical price lookup (ATL, ATH, 50-day average) with zero mock data.
- **Mathematical Deal Vetting**:
  - `ALL-TIME LOW DEAL`: Identifies record historic low prices.
  - `RECOMMENDED DEAL`: Spots strong discounts below historical averages.
  - `HOLD / TYPICAL PRICE`: Flags everyday retail pricing.
  - `FAKE SALE ALERT`: Detects deceptive discounts where Amazon's "sale" price is actually higher than its historical average.
- **Modern Tile-Based UI**:
  - Clean 3-tile pricing dashboard (Current, All-Time Low, All-Time High).
  - High-contrast recommendation banner.
  - Dark / Light mode toggle.
  - Wishlist bulk scanning and CSV export.

---

## 🚀 Quick Start (Local)

### 1. Install Dependencies
```bash
npm run install:all
```

### 2. Run Development Server
```bash
npm run dev
```
Open [http://localhost:5001](http://localhost:5001) in your browser.

---

## 🛠️ Production Build

```bash
# Build both client and server
npm run build

# Start production server
npm start
```

---

## 🌐 Deployment (Render / Railway / Docker)

WorthIt is pre-configured for full-stack single-port deployment:
- **Build Command:** `npm run build`
- **Start Command:** `npm start`
- **Port:** Controlled via `PORT` environment variable (default: `5001`).

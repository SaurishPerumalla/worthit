import { DealVerdict, HistoricalPriceData, VerdictTier } from '../types.js';

export function evaluateDeal(
  currentPrice: number,
  listPrice: number | null,
  historical: HistoricalPriceData,
  thresholdPercent: number = 12
): DealVerdict {
  const pCurrent = currentPrice;
  const pLow = historical.allTimeLow.price;
  const pHigh = historical.allTimeHigh.price;
  const pAvg = historical.historicalAverage;

  // 1. Savings vs Historical Average (%)
  // Positive means cheaper than average
  const deltaAvg = Number((((pAvg - pCurrent) / pAvg) * 100).toFixed(1));

  // 2. Proximity to All-Time Low (%)
  // Positive means above all-time low
  const deltaLow = Number((((pCurrent - pLow) / pLow) * 100).toFixed(1));

  // 3. Historical Range Position (%)
  // 0% = ATL, 100% = ATH
  let rangePos = 50;
  if (pHigh > pLow) {
    rangePos = Math.max(0, Math.min(100, Number((((pCurrent - pLow) / (pHigh - pLow)) * 100).toFixed(1))));
  }

  // Savings in dollars vs historical average
  const savingsDollars = Number(Math.max(0, pAvg - pCurrent).toFixed(2));

  // Fake discount detection:
  // If Amazon claims a strike-through list price higher than current price,
  // but the current price is higher than the true historical average!
  let isFakeDiscountAlert = false;
  let fakeDiscountMessage: string | undefined = undefined;

  if (listPrice && listPrice > pCurrent && pCurrent > pAvg) {
    isFakeDiscountAlert = true;
    fakeDiscountMessage = `⚠️ Fake Discount Alert: Amazon claims this is discounted from $${listPrice.toFixed(2)}, but its current price ($${pCurrent.toFixed(2)}) is actually HIGHER than its real historical average ($${pAvg.toFixed(2)})!`;
  }

  const thresholdRatio = thresholdPercent / 100;

  // Tier 1: All-Time Low / Instant Buy (within 3% of ATL)
  if (pCurrent <= pLow * 1.03) {
    const score = Math.min(100, Math.max(90, Math.round(100 - Math.max(0, deltaLow) * 3)));
    return {
      tier: 'APPROVED_ALL_TIME_LOW',
      score,
      badgeLabel: 'APPROVED: ALL-TIME LOW',
      headline: 'Instant Buy — Record Historic Low',
      explanation: `Approved! Currently at or within 3% of its all-time historic low price ($${pLow.toFixed(2)} recorded on ${historical.allTimeLow.date || 'prior date'}).`,
      deltaAvgPercent: deltaAvg,
      deltaLowPercent: deltaLow,
      rangePositionPercent: rangePos,
      isFakeDiscountAlert,
      fakeDiscountMessage,
      savingsDollars
    };
  }

  // Tier 2: Strong Historical Deal (at least threshold% below average)
  if (pCurrent <= pAvg * (1 - thresholdRatio)) {
    // Score scaled between 75 and 89 based on savings beyond threshold
    const extraSavings = deltaAvg - thresholdPercent;
    const score = Math.min(89, Math.max(75, Math.round(75 + Math.min(14, extraSavings * 0.7))));
    return {
      tier: 'APPROVED_STRONG_DEAL',
      score,
      badgeLabel: 'APPROVED DEAL',
      headline: `${deltaAvg}% Below Historical Average`,
      explanation: `Approved! Selling for ${deltaAvg}% ($${savingsDollars.toFixed(2)}) below its historical average price ($${pAvg.toFixed(2)}).`,
      deltaAvgPercent: deltaAvg,
      deltaLowPercent: deltaLow,
      rangePositionPercent: rangePos,
      isFakeDiscountAlert,
      fakeDiscountMessage,
      savingsDollars
    };
  }

  // Tier 3: Typical Retail Price (within +-5% of average or between threshold and 1.05x avg)
  if (pCurrent <= pAvg * 1.05) {
    // Score scaled between 45 and 74
    const score = Math.min(74, Math.max(45, Math.round(60 + deltaAvg * 1.2)));
    return {
      tier: 'HOLD_TYPICAL_PRICE',
      score,
      badgeLabel: 'HOLD / TYPICAL PRICE',
      headline: 'Standard Everyday Retail Price',
      explanation: `Hold off unless needed now. This item is selling at its standard historical average ($${pAvg.toFixed(2)}). Wait for a drop near its low ($${pLow.toFixed(2)}).`,
      deltaAvgPercent: deltaAvg,
      deltaLowPercent: deltaLow,
      rangePositionPercent: rangePos,
      isFakeDiscountAlert,
      fakeDiscountMessage,
      savingsDollars
    };
  }

  // Tier 4: Reject Overpriced / Fake Discount
  const overpricePct = Math.abs(deltaAvg);
  const score = Math.min(44, Math.max(5, Math.round(44 - Math.min(39, (pCurrent / pAvg - 1) * 60))));

  return {
    tier: 'REJECT_OVERPRICED',
    score,
    badgeLabel: isFakeDiscountAlert ? 'REJECT: FAKE DISCOUNT' : 'REJECT: OVERPRICED',
    headline: isFakeDiscountAlert ? 'Fake Sale Alert' : `${overpricePct}% Above Historical Average`,
    explanation: isFakeDiscountAlert && fakeDiscountMessage
      ? fakeDiscountMessage
      : `Overpriced! Currently selling for ${overpricePct}% ABOVE its historical average price ($${pAvg.toFixed(2)}). Historical range is $${pLow.toFixed(2)} – $${pHigh.toFixed(2)}.`,
    deltaAvgPercent: deltaAvg,
    deltaLowPercent: deltaLow,
    rangePositionPercent: rangePos,
    isFakeDiscountAlert,
    fakeDiscountMessage,
    savingsDollars: 0
  };
}

import type {
  Holding,
  Position,
  MutualFundHolding,
  USStockHolding,
  GoldHolding,
  Order,
  PortfolioSummary,
} from "../types/portfolio.js";

export function buildPortfolioSummary(
  holdings: Holding[],
  positions: Position[],
  mutualFunds: MutualFundHolding[],
  usStocks: USStockHolding[],
  gold: GoldHolding[],
): PortfolioSummary {
  const equityValue = holdings.reduce((sum, h) => sum + h.currentValue, 0);
  const equityInvested = holdings.reduce((sum, h) => sum + h.investedValue, 0);
  const mfValue = mutualFunds.reduce((sum, m) => sum + m.currentValue, 0);
  const mfInvested = mutualFunds.reduce((sum, m) => sum + m.investedValue, 0);
  const usValue = usStocks.reduce((sum, u) => sum + u.currentValueINR, 0);
  const usInvested = usStocks.reduce((sum, u) => sum + u.investedValueINR, 0);
  const goldValue = gold.reduce((sum, g) => sum + g.currentValue, 0);
  const goldInvested = gold.reduce((sum, g) => sum + g.investedValue, 0);
  const fnoValue = positions.reduce((sum, p) => sum + (p.lastPrice * p.quantity), 0);

  const totalInvested = equityInvested + mfInvested + usInvested + goldInvested;
  const totalCurrent = equityValue + mfValue + usValue + goldValue;
  const totalPnl = totalCurrent - totalInvested;

  const brokerMap = new Map<string, { invested: number; current: number }>();
  for (const h of holdings) {
    const entry = brokerMap.get(h.broker) || { invested: 0, current: 0 };
    entry.invested += h.investedValue;
    entry.current += h.currentValue;
    brokerMap.set(h.broker, entry);
  }
  for (const m of mutualFunds) {
    const entry = brokerMap.get(m.broker) || { invested: 0, current: 0 };
    entry.invested += m.investedValue;
    entry.current += m.currentValue;
    brokerMap.set(m.broker, entry);
  }
  for (const u of usStocks) {
    const entry = brokerMap.get(u.broker) || { invested: 0, current: 0 };
    entry.invested += u.investedValueINR;
    entry.current += u.currentValueINR;
    brokerMap.set(u.broker, entry);
  }
  for (const g of gold) {
    const entry = brokerMap.get(g.broker) || { invested: 0, current: 0 };
    entry.invested += g.investedValue;
    entry.current += g.currentValue;
    brokerMap.set(g.broker, entry);
  }

  return {
    totalInvestedValue: totalInvested,
    totalCurrentValue: totalCurrent,
    totalPnl,
    totalPnlPercent: totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0,
    assetAllocation: {
      equity: equityValue,
      mutualFunds: mfValue,
      usStocks: usValue,
      gold: goldValue,
      fno: fnoValue,
    },
    brokerWise: Array.from(brokerMap.entries()).map(([broker, data]) => ({
      broker,
      investedValue: data.invested,
      currentValue: data.current,
      pnl: data.current - data.invested,
    })),
  };
}

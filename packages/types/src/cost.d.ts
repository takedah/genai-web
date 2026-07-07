export type EstimatedCostSummary = {
  // 生コスト（プロバイダ由来通貨での合計）。
  totalCost: number;
  // 生コストの通貨。プロバイダ由来の表記をそのまま保持する（破壊的正規化はしない）。
  currency: string;
  converted?: {
    totalCost: number;
    currency: string;
    rate: number;
    // 変換元通貨。表示側で「fromCurrency → currency」の組を確認できる。
    fromCurrency: string;
  };
};

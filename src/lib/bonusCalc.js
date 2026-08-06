// 依館別設定計算單一同仁單日獎金
// settings 來自 bonus_settings 表；不同館可以有不同規則（linear / tiered）
//
// 門檻邏輯（require_full_completion=true 時）：
//   實際門檻 = min(min_rooms_for_bonus, 當天分配間數)
//   門檻比的是「扣掉缺失後的淨間數」，不是原始完成間數——
//   例如分配14間，15:00前完成13間但其中2間有缺失，淨間數只有11間，
//   門檻是min(12,14)=12，11 < 12，一樣算沒達標，整天不算獎金
//   （如果沒有缺失，淨間數就等於完成間數，效果不變）
export function calculateBonus(settings, { assignedCount, completedBeforeDeadlineCount, defectCount, overrideWaiveGate }) {
  const netRooms = Math.max(completedBeforeDeadlineCount - defectCount, 0);

  if (settings.require_full_completion && !overrideWaiveGate) {
    const fixedThreshold = settings.min_rooms_for_bonus ?? assignedCount;
    const threshold = Math.min(fixedThreshold, assignedCount);
    if (netRooms < threshold) {
      return { bonus_amount: 0, net_rooms: netRooms, disqualified: true };
    }
  }

  if (settings.rate_type === 'tiered') {
    const tier1Max = settings.tier1_max ?? 12;
    const tier1Rate = settings.tier1_rate ?? 0;
    const tier2Rate = settings.tier2_rate ?? 0;
    const tier1Rooms = Math.min(netRooms, tier1Max);
    const tier2Rooms = Math.max(netRooms - tier1Max, 0);
    const bonus = tier1Rooms * tier1Rate + tier2Rooms * tier2Rate;
    return { bonus_amount: bonus, net_rooms: netRooms, disqualified: false };
  }

  // 預設：linear，淨間數 × 固定單價
  const bonus = netRooms * (settings.rate_per_room ?? 0);
  return { bonus_amount: bonus, net_rooms: netRooms, disqualified: false };
}

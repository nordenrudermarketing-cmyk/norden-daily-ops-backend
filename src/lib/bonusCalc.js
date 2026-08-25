// 依館別設定計算單一同仁單日獎金
// settings 來自 bonus_settings 表；不同館可以有不同規則（linear / tiered）
//
// 門檻邏輯（require_full_completion=true 時）：
//   實際門檻 = min(min_rooms_for_bonus, 當天分配間數)
//   門檻比的是「扣掉缺失後的淨間數」，不是原始完成間數
//
// overrideNetRooms：如果這天有「已核准的獎金申覆」，會直接用申覆核准的間數計算，
//   不再判斷門檻（因為店經理已經人工確認過這天的實際狀況了）
export function calculateBonus(settings, { assignedCount, completedBeforeDeadlineCount, defectCount, overrideNetRooms }) {
  let netRooms;
  let disqualified = false;

  if (overrideNetRooms !== undefined && overrideNetRooms !== null) {
    netRooms = overrideNetRooms;
  } else {
    netRooms = Math.max(completedBeforeDeadlineCount - defectCount, 0);

    if (settings.require_full_completion) {
      const fixedThreshold = settings.min_rooms_for_bonus ?? assignedCount;
      const threshold = Math.min(fixedThreshold, assignedCount);
      if (netRooms < threshold) {
        return { bonus_amount: 0, net_rooms: netRooms, disqualified: true };
      }
    }
  }

  let bonusAmount = 0;
  if (settings.rate_type === 'tiered') {
    const tier1Max = settings.tier1_max ?? 0;
    const tier1Rate = settings.tier1_rate ?? 0;
    const tier2Rate = settings.tier2_rate ?? 0;
    const tier1Rooms = Math.min(netRooms, tier1Max);
    const tier2Rooms = Math.max(netRooms - tier1Max, 0);
    bonusAmount = tier1Rooms * tier1Rate + tier2Rooms * tier2Rate;
  } else {
    // linear：淨間數 × 固定單價
    bonusAmount = netRooms * (settings.rate_per_room ?? 0);
  }

  return { bonus_amount: bonusAmount, net_rooms: netRooms, disqualified: false };
}

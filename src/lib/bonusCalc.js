// 依館別設定計算單一同仁單日獎金
// settings 來自 bonus_settings 表；不同館可以有不同規則（linear / tiered），
// 也可以要求「當天要把被分配的房間全部在期限前完成，否則整天不算獎金」
export function calculateBonus(settings, { assignedCount, completedBeforeDeadlineCount, defectCount }) {
  const netRooms = Math.max(completedBeforeDeadlineCount - defectCount, 0);

  if (settings.require_full_completion && completedBeforeDeadlineCount < assignedCount) {
    return { bonus_amount: 0, net_rooms: netRooms, disqualified: true };
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

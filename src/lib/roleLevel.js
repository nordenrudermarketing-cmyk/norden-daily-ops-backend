import { supabase } from '../supabaseClient.js';

// ============================================================
// 職務等級（帳號管理、自評面談、待辦事項共用）
//
//   hq       總公司
//   manager  店經理
//   deputy   店副理（店經理的職務代理人，不能動店經理以上的帳號）
//   staff    其他（房務、客務）
//
// 前端送來的 actor_id 只代表「目前登入的是誰」，
// 真正的職務一律由後端拿 actor_id 去資料庫查，前端改 localStorage 沒有用。
// ⚠ 仍擋不住知道 API 的人自己偽造 actor_id（見 CLAUDE.md 已知限制）。
// ============================================================

const LEVEL_BY_ROLE = { 總公司: 'hq', 店經理: 'manager', 店副理: 'deputy' };

export function levelOf(roleName) {
  return LEVEL_BY_ROLE[roleName] || 'staff';
}

// 館別主管（店經理、店副理）
export function isBranchLead(level) {
  return level === 'manager' || level === 'deputy';
}

// 副理（含）以上
export function isLeadOrAbove(level) {
  return level === 'hq' || isBranchLead(level);
}

// 查出目前登入的人：{ id, name, branch_id, is_active, roles: { name, category }, level }
// 查不到或已停用就回 null
export async function loadActor(actorId) {
  if (!actorId) return null;
  const { data, error } = await supabase
    .from('staff')
    .select('id, name, branch_id, is_active, roles(name, category)')
    .eq('id', actorId)
    .maybeSingle();
  if (error || !data || data.is_active === false) return null;
  return { ...data, level: levelOf(data.roles?.name) };
}

/**
 * 戦闘参加者を表すインターフェース。
 * 戦闘中のみ有効な一時的な状態（イニシアティブ、行動済みフラグなど）を管理する。
 * 永続的なデータ（HP, ステータス効果など）は GameCharacter 側に保持される。
 */
export interface Combatant {
  // キャラクターを一意に特定するID (GameCharacter.identifier)
  characterId: string;

  // --- 戦闘中のみ有効な一時パラメータ ---
  
  // イニシアティブ（行動値）。
  // 行動順決定に使用される数値。
  initiative: number; 
  
  // 行動済みフラグ。
  // ラウンド内で行動を終えたかどうかを表す。
  hasActed: boolean;
}

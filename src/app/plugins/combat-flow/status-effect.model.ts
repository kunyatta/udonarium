// 効果（操作パラメータ）の定義
// USER_MANUAL.md に記載の「機械的な効果」に相当
export interface Effect {
  // 効果の種類:
  // 'attributeChange': ラウンド終了時などに値を増減させる (旧「ラウンド毎の増減」)
  // 'buffDebuff': 付与されている間だけ値を増減させる (旧「能力値バフ/デバフ」)
  type: 'attributeChange' | 'buffDebuff'; 

  // 対象パラメータ名: どのパラメータを変化させるか (例: 'HP', 'MP')
  target: string; 

  // 変化量: パラメータをいくつ変化させるか (例: -5, +10)
  value: number;  
}

// 視覚効果の定義
// USER_MANUAL.md に記載の「視覚効果」に相当
export interface VisualEffect {
  type: string; // 'filter', 'aura', 'color' など
  value: string; // CSSの filter, color 値など (例: 'grayscale(100%)', '#FFD700', 'rgba(255,0,0,0.5)')
}

// ステータス効果（辞書データ）の定義
export interface StatusEffect {
  id: string;              // ユニークID (UUID)
  name: string;            // 効果名
  emoji: string;           // アイコン (絵文字)
  description: string;     // 説明文 (ツールチップ用)
  
  // 持続時間関連
  duration: number;        // 持続ラウンド数 (-1は「永遠」、0は「一瞬」を想定)
                           // USER_MANUAL.md の「持続ラウンド」「永続」に対応
  isPermanent: boolean;    // マニュアルの「永続」チェックボックスに対応。durationが-1の時にtrue。

  // 視覚効果
  visualEffects: VisualEffect[]; // 視覚効果リスト (複数設定可能)

  // 操作パラメータ (旧: 機械的な効果)
  effects: Effect[];       // 操作パラメータのリスト (複数設定可能)
}

// キャラクターに付与された状態のステータス効果
// StatusEffect とは別に、キャラクターに付随する動的な情報を保持
export interface ActiveStatusEffect extends StatusEffect {
  remainingRounds: number; // 残りラウンド数
  startRound: number;      // 効果が付与されたラウンド
}

/**
 * プラグインのメタデータと登録制御フラグを定義するインターフェース。
 * 自動登録スクリプトによって解析されます。
 */
export interface PluginManifest {
  // システム内で一意のID (例: 'CombatFlow')
  id: string;
  // ランチャー等に表示されるUIの名前
  name: string;
  // バージョン情報 (例: '1.0.0')
  version: string;
  // プラグインの概要
  description: string;
  
  // 表示されるアイコン (Material Icons) (任意)
  icon?: string;
  // 表示されるアイコンのCSSクラス (任意)
  iconClass?: string;
  
  // --- 制御フラグ ---

  // 有効化フラグ (任意)。
  // falseの場合、開発・本番の両方で登録から除外されます（コンパイル対象外）。
  // 省略時は true (有効) として扱われます。
  isEnabled?: boolean;

  // 実験的/テスト用フラグ (任意)。
  // trueの場合、本番ビルドからは除外されます。
  // 省略時は false (本番適用) として扱われます。
  isExperimental?: boolean;
}

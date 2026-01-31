/**
 * プラグインのメタデータと登録制御フラグを定義するインターフェース。
 * 自動登録スクリプトによって解析されます。
 */
export interface PluginManifest {
  // システム内で一意のID (例: 'CombatFlow')
  id: string;
  // リソースのルートとなるディレクトリ名 (例: 'combat-flow') (任意)
  // 省略時は pluginName (id) が使用されますが、IDとフォルダ名が異なる場合は必須です。
  path?: string;
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

  // チュートリアル画像 (任意)。
  // プラグインフォルダ内の画像ファイル名（例: 'tutorial.png'）を指定します。
  tutorialImage?: string;

  // プラグイン専用の音声リソース (任意)。
  // 音声ファイル名（例: 'decision.mp3'）の配列を指定します。
  // 登録された音声は AudioStorage に自動的にロードされ、
  // URLパス (例: './assets/plugins/my-plugin/decision.mp3') を
  // そのまま識別子として SoundEffect.play() 等で使用可能になります。
  sounds?: string[];

  // 変更履歴 (任意)
  changelog?: ChangelogEntry[];
}

/**
 * 変更履歴の1項目を表すインターフェース
 */
export interface ChangelogEntry {
  // バージョン (任意)
  version?: string;
  // 日付 (任意)
  date?: string;
  // 更新内容
  content: string;
}

/**
 * Mod システム全体のメタデータを定義します。
 * L1: オリジナル (basedOn)
 * L2: Mod システム (version)
 */
export const MOD_SYSTEM_MANIFEST = {
  // Modの名称 (プラグイン情報パネル等で表示)
  name: 'Mod',
  // Modのアイコン (プラグイン情報パネル等で表示)
  icon: 'info',
  // ベースとなっているオリジナルの Udonarium バージョン
  basedOn: '1.17.4',
  // オリジナル作者
  originalAuthor: 'TK11235',
  // 開発・提供
  authors: ['kunyatta(Code generator: Gemini CLI)'],
  // システムの概要
  description: 'Gemini CLIというAIを使ったコード生成による改造。主だった派生Udonariumを参考にしつつソードワールド2.5用に向けた機能中心に実装。',
  // Mod システム (基盤・サービス) のバージョン
  version: '0.2.2',
  // 最終更新日 (配布時などのリリース日に相当。手動で更新)
  updatedAt: '2026-02-22',
  // 変更履歴
  changelog: [
    { date: '2026/02/22', version: '0.2.2', content: 'ブラウザタイトルにModのバージョンを追記' },
    { date: '2026/02/04', version: '0.2.1', content: 'ルーム保存時の重複ファイルエラーを修正。本体コードに残存していたプラグイン依存のカスタムUIのひとつを排除' },
    { date: '2026/02/03', version: '0.2.0', content: 'DataElement拡張システム(DataElementExtensionService)の構築。キャラクターパラメータへのカスタムUI追加をプラグインから動的に行えるように変更。' }
  ]
};

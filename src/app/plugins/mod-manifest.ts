/**
 * Mod システム全体のメタデータを定義します。
 * L1: オリジナル (basedOn)
 * L2: Mod システム (version)
 */
export const MOD_SYSTEM_MANIFEST = {
  // Modの名称 (プラグイン情報パネル等で表示)
  name: 'このModについて',
  // Modのアイコン (プラグイン情報パネル等で表示)
  icon: 'info',
  // Mod システム (基盤・サービス) のバージョン
  version: '0.1.4',
  // ベースとなっているオリジナルの Udonarium バージョン
  basedOn: '1.17.4',
  // オリジナル作者
  originalAuthor: 'TK11235',
  // 開発・提供
  authors: ['kunyatta(Code generator: Gemini CLI)'],
  // システムの概要
  description: 'Gemini CLIというAIを使ったコード生成による改造。主にソードワールド2.5用に向けた機能中心に改造しています。このModの名前はまだ思いついていません。',
  // 最終更新日 (配布時などのリリース日に相当。手動で更新)
  updatedAt: '2026-01-23'
};

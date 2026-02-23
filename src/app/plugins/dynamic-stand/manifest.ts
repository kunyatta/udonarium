import { PluginManifest } from '../plugin-manifest';

export const MANIFEST: PluginManifest = {
  id: 'dynamic-stand-plugin',
  path: 'dynamic-stand',
  name: '立ち絵',
  version: '1.4.0',
  description: 'チャットの発言に合わせてキャラクターの立ち絵画像を自動表示・演出します。',
  tutorialImage: 'tutorial.png',
  changelog: [
    { date: '2026/02/23', version: '1.4.0', content: 'チャットメッセージの送信元IDを参照する厳密なキャラクター特定ロジックを実装。同名キャラクターが複数存在する場合の表示精度を大幅に向上。' },
    { date: '2026/02/23', version: '1.3.0', content: 'キャラクター詳細設定処理を CharacterDataExtensionService へ移管し、自動項目付加の堅牢性を向上' },
    { date: '2026/01/23', version: '1.2.1', content: '立ち絵のサイズと表示ロジックの修正' },
    { date: '2026/01/23', version: '1.2.0', content: '説明動画を追加' },
    { date: '2026/01/23', version: '1.1.1', content: '立ち絵のサイズと表示ロジックの修正' }
  ],
  icon: 'recent_actors',
  isExperimental: false
};

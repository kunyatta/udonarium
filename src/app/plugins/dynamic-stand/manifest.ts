import { PluginManifest } from '../plugin-manifest';

export const MANIFEST: PluginManifest = {
  id: 'dynamic-stand-plugin',
  path: 'dynamic-stand',
  name: '立ち絵',
  version: '1.1.2',
  description: 'チャットの発言に合わせてキャラクターの立ち絵画像を自動表示・演出します。',
  tutorialImage: 'tutorial.png',
  changelog: [
    { date: '2026/01/23', version: '1.2.2', content: '説明動画を追加' },
    { date: '2026/01/23', version: '1.1.1', content: '立ち絵のサイズと表示ロジックの修正' }
  ],
  icon: 'recent_actors',
  isExperimental: false
};

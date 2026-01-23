import { PluginManifest } from '../plugin-manifest';

export const MANIFEST: PluginManifest = {
  id: 'dynamic-stand-plugin',
  name: '立ち絵',
  version: '1.1.1',
  description: 'チャットの発言に合わせてキャラクターの立ち絵画像を自動表示・演出します。',
  changelog: [
    { date: '2026/01/23', version: '1.1.1', content: '立ち絵のサイズと表示ロジックの修正' }
  ],
  icon: 'recent_actors',
  isExperimental: false
};

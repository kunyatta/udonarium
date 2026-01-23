import { PluginManifest } from '../plugin-manifest';

export const MANIFEST: PluginManifest = {
  id: 'cut-in-plugin',
  name: 'カットイン',
  version: '1.2.1',
  description: 'チャットの発言に合わせて画面全体にカットイン画像を演出します。',
  changelog: [
    { date: '2026/01/22', version: '1.2.1', content: '不具合の修正' },
    { date: '2026/01/22', version: '1.2.0', content: 'YouTube Shorts対応' },
    { date: '2026/01/22', version: '1.1.1', content: '配置ガイド表示に対応。演出詳細のUIも修正' },
    { date: '2026/01/22', version: '1.1.0', content: 'UIを更新' }
  ],
  icon: 'burst_mode',
  isExperimental: false
};

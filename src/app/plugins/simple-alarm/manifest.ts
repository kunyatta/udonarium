import { PluginManifest } from '../plugin-manifest';

export const MANIFEST: PluginManifest = {
  id: 'SimpleAlarm',
  path: 'simple-alarm',
  name: 'タイマー',
  version: '1.2.0',
  description: '設定した時間が経過するとアラーム音を鳴らして通知します。全プレイヤーに共有されます。',
  changelog: [
    { date: '2026/02/28', version: '1.2.0', content: 'プラグインシステムのルール変更による対応。' },
    { date: '2026/01/31', version: '1.1.0', content: 'プラグインリソース管理方式への対応。' }
  ],
  icon: 'alarm',
  isExperimental: false,
  sounds: ['alarm.mp3']
};

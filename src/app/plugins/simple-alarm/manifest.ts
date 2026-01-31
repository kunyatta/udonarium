import { PluginManifest } from '../plugin-manifest';

export const MANIFEST: PluginManifest = {
  id: 'SimpleAlarm',
  path: 'simple-alarm',
  name: 'タイマー',
  version: '1.1.0',
  description: '設定した時間が経過するとアラーム音を鳴らして通知します。全プレイヤーに共有されます。',
  changelog: [
    { version: '1.1.0', content: 'プラグインリソース管理方式への対応。' }
  ],
  icon: 'alarm',
  isExperimental: false,
  sounds: ['alarm.mp3']
};

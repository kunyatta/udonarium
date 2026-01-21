import { PluginManifest } from '../plugin-manifest';

export const MANIFEST: PluginManifest = {
  id: 'SimpleAlarm',
  name: 'タイマー',
  version: '1.0.0',
  description: '設定した時間が経過するとアラーム音を鳴らして通知します。全プレイヤーに共有されます。',
  icon: 'alarm',
  isExperimental: false
};

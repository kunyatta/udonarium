import { PluginManifest } from '../plugin-manifest';

export const MANIFEST: PluginManifest = {
  id: 'logout-plugin',
  name: '退出',
  version: '1.0.0',
  description: 'ルームから退出してトップ画面に戻ります。他の参加者との接続をすべて切断し、ページを再読み込みします。',
  icon: 'exit_to_app',
  isExperimental: false
};

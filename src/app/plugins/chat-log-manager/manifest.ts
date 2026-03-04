import { PluginManifest } from '../plugin-manifest';

export const MANIFEST: PluginManifest = {
  id: 'ChatLogManager',
  name: 'ログ管理',
  version: '1.1.0',
  description: 'チャットログのテキスト出力および削除を行います。',
  changelog: [
    { date: '2026/03/05', version: '1.1.0', content: 'チャットログのテキスト出力機能を追加。UIをタブ形式にリニューアル。' },
    { date: '2026/01/22', version: '1.0.0', content: 'チャットログの削除機能を実装。' }
  ],
  icon: 'history_edu',
  isExperimental: false
};

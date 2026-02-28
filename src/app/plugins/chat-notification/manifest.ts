import { PluginManifest } from '../plugin-manifest';

export const MANIFEST: PluginManifest = {
  id: 'ChatNotification',
  path: 'chat-notification',
  name: 'チャット通知',
  version: '1.2.0',
  description: 'チャット受信時に通知音を再生します。',
  icon: 'notifications',
  isEnabled: true,
  isExperimental: false,
  sounds: ['decision42.mp3'],
  changelog: [
    { date: '2026/02/28', version: '1.2.0', content: 'プラグインシステムのルール変更による対応。' },
    { date: '2026-01-31', version: '1.1.0', content: 'プラグインリソース管理方式への対応。自己発言の除外、および入室時の過去ログ通知抑制ロジックを実装。UI拡張のラベル分離仕様への追随。' },
    { date: '2026-01-31', version: '1.0.0', content: '新規作成。' }
  ]
};
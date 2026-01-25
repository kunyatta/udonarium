import { PluginManifest } from '../plugin-manifest';

export const MANIFEST: PluginManifest = {
  id: 'ChatMessageActionPlugin',
  name: 'チャットメッセージ拡張',
  version: '1.1.0',
  description: 'チャットメッセージの機能を拡張します。URLの自動リンク化や、送信済みメッセージの編集機能を提供します。',
  changelog: [
    { date: '2026/01/26', version: '1.1.0', content: 'チャットメッセージの編集機能を追加' },
    { date: '2026/01/23', version: '1.0.1', content: 'URLリンクロジックの修正' }
  ],
  icon: 'chat_bubble',
  isExperimental: false
};

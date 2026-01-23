import { PluginManifest } from '../plugin-manifest';

export const MANIFEST: PluginManifest = {
  id: 'ChatMessageActionPlugin',
  name: 'チャットメッセージ拡張',
  version: '1.0.1',
  description: 'チャットメッセージの表示機能を拡張します。URLの自動リンク化などのフィルタリング処理を担当します。',
  changelog: [
    { date: '2026/01/23', version: '1.0.1', content: 'URLリンクロジックの修正' }
  ],
  icon: 'chat_bubble',
  isExperimental: false
};

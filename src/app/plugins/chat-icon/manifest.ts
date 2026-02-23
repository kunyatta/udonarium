import { PluginManifest } from '../plugin-manifest';

export const MANIFEST: PluginManifest = {
  id: 'chat-icon',
  name: 'チャットアイコン',
  version: '1.1.0',
  description: 'チャットログに表示するアイコンを立ち絵とは別に設定できるようにします。',
  isEnabled: true,
  changelog: [
    { date: '2026/02/23', version: '1.1.0', content: '詳細項目の動的なデフォルト値（メイン画像参照）に対応し、CharacterDataExtensionService による共通セットアップ機能を実装' }
  ]
};

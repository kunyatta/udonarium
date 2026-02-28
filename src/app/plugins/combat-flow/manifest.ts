import { PluginManifest } from '../plugin-manifest';
import { PLUGIN_ID } from './combat-flow.constants';

export const MANIFEST: PluginManifest = {
  id: PLUGIN_ID,
  name: '戦闘フロー',
  version: '1.1.0',
  description: '汎用的な戦闘進行管理機能を提供します。戦況を一覧するマネージャに加え、盤面と連動する戦闘中パネル、キャラクターごとの戦闘アクションパネルなどが連携して動作します。',
  tutorialImage: 'tutorial.png',
  changelog: [
    { date: '2026/02/28', version: '1.1.0', content: 'プラグインシステムのルール変更による対応。' },
    { date: '2026/01/24', version: '1.0.1', content: '説明動画を追加' }
  ],
  icon: 'swords',
  iconClass: 'material-symbols-outlined',
  isExperimental: false
};

import { PluginManifest } from '../plugin-manifest';
import { PLUGIN_ID } from './combat-flow.constants';

export const MANIFEST: PluginManifest = {
  id: PLUGIN_ID,
  name: '戦闘フロー',
  version: '1.0.0',
  description: '汎用的な戦闘進行管理機能を提供します。戦況を一覧するマネージャに加え、盤面と連動する戦闘中パネル、キャラクターごとの戦闘アクションパネルなどが連携して動作します。',
  changelog: [],
  icon: 'swords',
  iconClass: 'material-symbols-outlined',
  isExperimental: false
};

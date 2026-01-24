import { PluginManifest } from '../plugin-manifest';

export const MANIFEST: PluginManifest = {
  id: 'TargetSelectorPlugin',
  path: 'target-selector',
  name: 'ターゲット選択',
  version: '1.0.1',
  description: '盤面で選択しているキャラクターの名前を、チャット入力欄に自動で挿入します。攻撃対象や効果対象の名前を素早く入力するための補助ツールです。',
  tutorialImage: 'tutorial.png',
  changelog: [
    { date: '2026/01/24', version: '1.0.1', content: '説明動画を追加' }
  ],
  icon: 'location_searching',
  isExperimental: false
};

import { PluginManifest } from '../plugin-manifest';

export const MANIFEST: PluginManifest = {
  id: 'plugin-info',
  name: 'プラグイン情報',
  version: '1.1.1',
  description: 'インストールされているプラグインの一覧を表示し、情報の確認を行います。',
  changelog: [
    { date: '2026/01/23', version: '1.1.1', content: '更新履歴欄を作成' }
  ],
  icon: 'extension',
  isExperimental: false
};

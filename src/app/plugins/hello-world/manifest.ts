import { PluginManifest } from '../plugin-manifest';

export const MANIFEST: PluginManifest = {
  id: 'HelloWorldPlugin',
  name: 'Hello World',
  version: '0.1.0',
  description: 'プラグインシステムの動作確認用サンプルプラグインです。起動時にコンソールにメッセージを表示します。',
  icon: 'check_circle',
  isExperimental: true
};

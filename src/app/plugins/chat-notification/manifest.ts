import { PluginManifest } from '../plugin-manifest';

export const MANIFEST: PluginManifest = {
  id: 'ChatNotification',
  path: 'chat-notification',
  name: 'チャット通知',
  version: '1.0.0',
  description: 'チャット受信時に通知音を再生します。',
  isEnabled: true,
  isExperimental: false,
  sounds: ['decision42.mp3']
};

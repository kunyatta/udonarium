import { Injectable, OnDestroy } from '@angular/core';
import { ChatListenerService } from '../service/chat-listener.service';
import { UIExtensionService } from '../service/ui-extension.service';
import { UserPersistenceService } from '../service/user-persistence.service';
import { SoundEffect } from '../../class/sound-effect';
import { Network } from '@udonarium/core/system';
import { ChatMessage } from '@udonarium/chat-message';
import { MANIFEST } from './manifest';

// 設定定数
const CONFIG = {
  get SOUND_IDENTIFIER() {
    return `./assets/plugins/${MANIFEST.path}/${MANIFEST.sounds[0]}`;
  },
  // デフォルトで通知を有効にするかどうか
  DEFAULT_ENABLED: false,
};

@Injectable()
export class ChatNotificationService implements OnDestroy {

  private _isNotificationEnabled: boolean = CONFIG.DEFAULT_ENABLED;

  get isNotificationEnabled(): boolean {
    return this._isNotificationEnabled;
  }

  constructor(
    private chatListener: ChatListenerService,
    private uiExtension: UIExtensionService,
    private userPersistence: UserPersistenceService
  ) {
    this.initialize();
  }

  private initialize() {
    this.loadSettings();
    this.registerChatListener();
    this.registerUIAction();
  }

  private loadSettings() {
    this.userPersistence.registerPlugin('chat-notification', {
      save: () => ({ isEnabled: this._isNotificationEnabled }),
      load: (data: any) => {
        if (data && typeof data.isEnabled === 'boolean') {
          this._isNotificationEnabled = data.isEnabled;
        }
      }
    });
  }

  private registerChatListener() {
    this.chatListener.addRule({
      owner: this,
      name: 'ChatNotification',
      keyword: '', // 全てのメッセージを対象
      isLocalOnly: false, // 他人の発言も監視
      callback: (message: ChatMessage) => this.handleMessage(message)
    });
  }

  private handleMessage(message: ChatMessage) {
    if (!this._isNotificationEnabled) return;
    if (message.isSendFromSelf) return; // 自分の発言は除外

    // 入室時やルームロード時の過去ログ一括受信（同期）による通知ラッシュを防ぐため、
    // 現在時刻より3秒（3000ms）以上前のメッセージは通知対象外とする
    const now = Date.now();
    if (now - message.timestamp > 3000) return;

    // 必要に応じてシステムメッセージの除外などをここに追加

    // 通知音を再生 (ローカルのみ)
    SoundEffect.playLocal(CONFIG.SOUND_IDENTIFIER);
  }

  private registerUIAction() {
    this.uiExtension.registerAction('chat-window', {
      name: 'ChatNotification',
      label: '', // 文字表記なし
      icon: () => this._isNotificationEnabled ? 'notifications' : 'notifications_off',
      description: () => this._isNotificationEnabled ? 'チャット通知: ON' : 'チャット通知: OFF',
      action: () => this.toggleNotification(),
      priority: 100 // タイマーボタン(priority:0)の後ろに配置
    });
  }

  private toggleNotification() {
    this._isNotificationEnabled = !this._isNotificationEnabled;
    // UIを更新するために再登録
    this.registerUIAction();
    // 設定変更を即座に保存
    this.userPersistence.savePluginData();
  }

  ngOnDestroy() {
    // サービスの破棄が必要な場合の処理（通常はシングルトンなので呼ばれない）
  }
}

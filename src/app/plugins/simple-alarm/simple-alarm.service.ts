import { Injectable, NgZone } from '@angular/core';
import { ObjectStore } from '@udonarium/core/synchronize-object/object-store';
import { EventSystem } from '@udonarium/core/system';
import { Alarm } from './alarm';
import { ChatMessageService } from 'service/chat-message.service';
import { ChatTab } from '@udonarium/chat-tab';
import { ChatTabList } from '@udonarium/chat-tab-list';
import { AudioPlayer } from '@udonarium/core/file-storage/audio-player';
import { AudioStorage } from '@udonarium/core/file-storage/audio-storage';
import { PeerCursor } from '@udonarium/peer-cursor';
import { PluginPanelSyncService } from '../service/plugin-panel-sync.service';
import { PLUGIN_ID, FILE_NAME_HINT_ALARM, NOTIFICATION_STATE_KEY, ALARM_IDENTIFIER, ALARM_OBJECT_NAME } from './simple-alarm.constants';
import { PluginUiService } from '../service/plugin-ui.service'; // 追加
import { SimpleAlarmPanelComponent } from './simple-alarm-panel.component'; // 追加
import { ChatLoggerService } from '../service/chat-logger.service';

@Injectable({
  providedIn: 'root'
})
export class SimpleAlarmService {
  public static alarmSoundIdentifier: string = '';
  
  targetTabIdentifier: string = '';
  private timerId: any = null;

  get alarm(): Alarm {
    let alarm = ObjectStore.instance.get<Alarm>(ALARM_IDENTIFIER);
    if (!alarm) {
      alarm = new Alarm(ALARM_IDENTIFIER);
      ObjectStore.instance.add(alarm);
      alarm.initialize();
    }
    return alarm;
  }

  get isRunning(): boolean { return this.alarm.isRunning; }
  get remainingTime(): number { return this.alarm.remainingTime; }

  constructor(
    private chatMessageService: ChatMessageService,
    private chatLoggerService: ChatLoggerService,
    private ngZone: NgZone,
    private pluginPanelSyncService: PluginPanelSyncService,
    private pluginUiService: PluginUiService // 追加
  ) {
    this.initialize();
  }

  initialize(): void {
    EventSystem.register(this)
      .on('ALARM_START', () => this.startLocalTimer())
      .on('ALARM_STOP', () => this.stopLocalTimer())
      .on('UPDATE_GAME_OBJECT', event => {
        // 他のクライアントでアラームが操作された場合、local timerを同期する
        if (event.data.identifier === this.alarm.identifier) {
          if (this.alarm.isRunning && !this.timerId) {
            this.startLocalTimer();
          } else if (!this.alarm.isRunning && this.timerId) {
            this.stopLocalTimer();
          }
        }

        // ChatTabListが更新された場合、ターゲットタブを確認する
        if (event.data.identifier === ChatTabList.instance.identifier) {
          this.ensureTargetTab();
        }
      })
      .on('XML_LOADED', () => {
        // ルームデータロード時、ターゲットタブの再確認を行う
        this.ensureTargetTab();

        // ルームデータロード時、アラームが動いていればタイマーを開始する
        if (this.alarm.isRunning && !this.timerId) {
          this.startLocalTimer();
        }
      });
      // .on(ChatTabList.UPDATED, ... ) は存在しないイベントのため削除

    if (this.isRunning) {
      this.startLocalTimer();
    }

    // アラーム音のロード（初回のみ）
    if (!SimpleAlarmService.alarmSoundIdentifier) {
      const audio = AudioStorage.instance.add('./assets/sounds/alarm/alarm.mp3');
      audio.isHidden = true;
      SimpleAlarmService.alarmSoundIdentifier = audio.identifier;
    }
  }

  // 通知先タブが有効か確認し、無効なら再設定する
  private ensureTargetTab(): void {
    const tabs = ChatTabList.instance.chatTabs;
    const targetExists = tabs.some(tab => tab.identifier === this.targetTabIdentifier);

    // 現在のターゲットが存在しない、かつタブリストが空でない場合、先頭のタブをデフォルトにする
    if (!targetExists && tabs.length > 0) {
      this.targetTabIdentifier = tabs[0].identifier;
    }
  }

  startAlarm(time: number, title: string) {
    this.alarm.time = time;
    this.alarm.title = title;
    this.alarm.startTime = Date.now();
    this.alarm.isRunning = true;
    this.alarm.ownerId = PeerCursor.myCursor.identifier; // ★追加: オーナーIDを保存
    EventSystem.trigger('ALARM_START', { alarmIdentifier: this.alarm.identifier });
    this.sendChatMessage(`アラーム「${title}」を ${time}秒 にセットしました。`);
  }

  stopAlarm() {
    this.alarm.stopAlarm();
    this.sendChatMessage(`アラーム「${this.alarm.title}」を停止しました。`);
    // アラームが停止したときに、もし通知パネルが開いていたら閉じるように同期する
    this.pluginPanelSyncService.setPanelOpenState(
      PLUGIN_ID,
      FILE_NAME_HINT_ALARM,
      false, // 閉じる状態
      NOTIFICATION_STATE_KEY
    );
  }

  private startLocalTimer() {
    this.stopLocalTimer();
    this.timerId = setInterval(() => {
      const remaining = this.alarm.remainingTime;
      if (remaining <= 0) {
        this.onTimeUp();
      }
    }, 1000);
  }

  private stopLocalTimer() {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  private onTimeUp() {
    this.stopLocalTimer();
    this.alarm.stopAlarm();
    
    // 通知パネルを開くようにP2P同期する
    this.pluginPanelSyncService.setPanelOpenState(
      PLUGIN_ID,
      FILE_NAME_HINT_ALARM,
      true, // 開く状態
      NOTIFICATION_STATE_KEY
      // `alarmTitle`, `alarmMessage` は `AlarmNotificationComponent` が `Alarm` から直接取得するため、ここでは渡さない
    );

    // チャットログはタイマーをセットしたオーナーのみが送信する
    if (this.alarm.ownerId === (PeerCursor.myCursor ? PeerCursor.myCursor.identifier : '')) {
      this.sendChatMessage(`アラーム「${this.alarm.title}」の時間になりました！`);
    }
    
    // 音を鳴らす (ローカルのみ)
    const audio = AudioStorage.instance.get(SimpleAlarmService.alarmSoundIdentifier);
    if (audio && audio.isReady) {
      AudioPlayer.play(audio, 0.5);
    }

    // 設定パネルを閉じる (GMの操作工数削減のため)
    // Localのみ閉じればよく、他プレイヤーには影響しない
    this.pluginUiService.close(SimpleAlarmPanelComponent);
  }

  private sendChatMessage(text: string): void {
    this.chatLoggerService.sendMessage(text, {
      tabIdentifier: this.targetTabIdentifier
    });
  }
}

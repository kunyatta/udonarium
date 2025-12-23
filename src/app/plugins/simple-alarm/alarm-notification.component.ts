import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef, Input } from '@angular/core';
import { SimpleAlarmService } from './simple-alarm.service';
import { PluginPanelSyncService } from '../service/plugin-panel-sync.service';
import { PluginUiService } from '../service/plugin-ui.service'; // 追加
import { PLUGIN_ID, FILE_NAME_HINT_ALARM, NOTIFICATION_STATE_KEY } from './simple-alarm.constants';
// import { AudioPlayer } from '@udonarium/core/file-storage/audio-player'; // コメントアウト
// import { AudioStorage } from '@udonarium/core/file-storage/audio-storage'; // コメントアウト
import { EventSystem } from '@udonarium/core/system';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-alarm-notification',
  templateUrl: './alarm-notification.component.html',
  styleUrls: ['./alarm-notification.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AlarmNotificationComponent implements OnInit, OnDestroy {
  get alarmTitle(): string { return this.simpleAlarmService.alarm.title; }

  // 「タイトル N秒経過しました」という形式のメッセージを生成
  get displayMessage(): string {
    return `${this.alarmTitle} ${this.simpleAlarmService.alarm.time}秒経過しました`;
  }

  private destroy$ = new Subject<void>();

  constructor(
    private simpleAlarmService: SimpleAlarmService,
    private pluginPanelSyncService: PluginPanelSyncService,
    private pluginUiService: PluginUiService, // 追加
    private changeDetectorRef: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    // Alarmオブジェクトの変更をEventSystemで購読し、UIを更新
    EventSystem.register(this).on('UPDATE_GAME_OBJECT', event => {
      if (event.data.identifier === this.simpleAlarmService.alarm.identifier) {
        this.changeDetectorRef.markForCheck();
      }
    });
  }

  ngOnDestroy(): void {
    // パネルを閉じてもP2P同期状態は変更しない（個別に閉じる仕様）
    this.destroy$.next();
    this.destroy$.complete();
    EventSystem.unregister(this);
  }

  // 「閉じる」ボタンが押されたとき
  closePanel(): void {
    // ローカルのパネルのみを閉じる
    this.pluginUiService.close(AlarmNotificationComponent);
  }
}

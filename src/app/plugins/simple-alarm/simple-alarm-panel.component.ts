import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { EventSystem } from '@udonarium/core/system';
import { SimpleAlarmService } from './simple-alarm.service';
import { PluginUiService } from '../service/plugin-ui.service'; // 追加
import { ChatTab } from '@udonarium/chat-tab';
import { ChatTabList } from '@udonarium/chat-tab-list';
import { Alarm } from './alarm';

@Component({
  selector: 'app-simple-alarm-panel',
  templateUrl: './simple-alarm-panel.component.html',
  styleUrls: ['./simple-alarm-panel.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SimpleAlarmPanelComponent implements OnInit, OnDestroy {

  // 入力用
  inputMinutes: number = 1;
  inputSeconds: number = 0;
  inputTitle: string = 'タイマー';

  get targetTabIdentifier(): string { return this.simpleAlarmService.targetTabIdentifier; }
  set targetTabIdentifier(value: string) { this.simpleAlarmService.targetTabIdentifier = value; }

  get alarm(): Alarm { return this.simpleAlarmService.alarm; }

  get isRunning(): boolean { return this.simpleAlarmService.isRunning; }
  // get remainingTime(): number { return this.simpleAlarmService.remainingTime; } // Removed as per Lily's UI
  get title(): string { return this.simpleAlarmService.alarm.title; } // テンプレートでalarm.titleに直接アクセス

  get chatTabs(): ChatTab[] {
    return ChatTabList.instance.chatTabs;
  }

  constructor(
    private simpleAlarmService: SimpleAlarmService,
    private pluginUiService: PluginUiService, // 追加
    private changeDetectorRef: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    // Alarmオブジェクトの変更をEventSystemで購読し、UIを更新
    EventSystem.register(this)
      .on('UPDATE_GAME_OBJECT', event => {
        if (event.data.identifier === this.simpleAlarmService.alarm.identifier) {
          this.changeDetectorRef.markForCheck();
        }
      })
      .on('XML_LOADED', () => {
        // ルームデータロード時にパネルを閉じる（古い参照を破棄するため）
        this.pluginUiService.close(SimpleAlarmPanelComponent);
      });
  }

  ngOnDestroy(): void {
    EventSystem.unregister(this);
  }

  setAlarm() {
    const totalSeconds = (this.inputMinutes * 60) + this.inputSeconds;
    if (totalSeconds <= 0) return;

    this.simpleAlarmService.startAlarm(totalSeconds, this.inputTitle);
  }

  stopAlarm() {
    this.simpleAlarmService.stopAlarm();
  }
}


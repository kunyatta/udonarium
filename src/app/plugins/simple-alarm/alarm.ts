import { SyncObject, SyncVar } from '@udonarium/core/synchronize-object/decorator';
import { ObjectNode } from '@udonarium/core/synchronize-object/object-node';
import { EventSystem } from '@udonarium/core/system';
import { ALARM_OBJECT_NAME } from './simple-alarm.constants'; // 追加

@SyncObject(ALARM_OBJECT_NAME) // 定数を使用
export class Alarm extends ObjectNode {
  @SyncVar() title: string = 'タイマー'; // アラームのタイトル
  // @SyncVar() message: string = '時間になりました！'; // アラームのメッセージ（追加） // REMOVED
  @SyncVar() time: number = 0; // 設定時間（秒）
  @SyncVar() startTime: number = 0; // 開始時刻（Unix Timestamp）
  @SyncVar() isRunning: boolean = false;
  @SyncVar() ownerId: string = ''; // アラームをセットしたプレイヤーのPeer ID

  startAlarm(time: number, title: string) { // message引数削除
    this.time = time;
    this.title = title;
    // this.message = message; // メッセージも設定 // REMOVED
    this.startTime = Date.now();
    this.isRunning = true;
    EventSystem.trigger('ALARM_START', { alarmIdentifier: this.identifier });
  }

  stopAlarm() {
    this.isRunning = false;
    EventSystem.trigger('ALARM_STOP', { alarmIdentifier: this.identifier });
  }

  // 残り時間を計算（秒）
  get remainingTime(): number {
    if (!this.isRunning) return 0;
    const elapsed = (Date.now() - this.startTime) / 1000;
    return Math.max(0, Math.ceil(this.time - elapsed));
  }
}

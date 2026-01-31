import { Injectable, Injector } from '@angular/core';
import { IPlugin } from '../i-plugin';
import { ChatNotificationService } from './chat-notification.service';
import { MANIFEST } from './manifest';

@Injectable()
export class ChatNotificationPlugin implements IPlugin {
  readonly manifest = MANIFEST;
  readonly pluginName = MANIFEST.id;

  constructor(
    private chatNotificationService: ChatNotificationService
  ) { }

  initialize(): void {
    // サービスはコンストラクタでの注入時にインスタンス化され、
    // そのコンストラクタ内で初期化処理(initialize)が走る設計になっているため、
    // ここで明示的に呼び出す必要はないが、将来的な拡張のためにメソッドは残しておく。
  }
}

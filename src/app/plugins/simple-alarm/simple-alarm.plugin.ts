import { Injector, Injectable, OnDestroy, NgZone } from '@angular/core'; // Injectable, OnDestroy, NgZoneを追加
import { IPluginWithUI } from '../i-plugin';
import { SimpleAlarmPanelComponent } from './simple-alarm-panel.component';
import { SimpleAlarmService } from './simple-alarm.service';
import { PluginPanelSyncService } from '../service/plugin-panel-sync.service';
import { AlarmNotificationComponent } from './alarm-notification.component'; // 追加
import { PLUGIN_ID, FILE_NAME_HINT_ALARM, NOTIFICATION_STATE_KEY } from './simple-alarm.constants';
import { EventSystem } from '@udonarium/core/system';
import { UIExtensionService } from '../service/ui-extension.service';
import { PluginUiService } from '../service/plugin-ui.service';

@Injectable() // 追加
export class SimpleAlarmPlugin implements IPluginWithUI, OnDestroy { // OnDestroyを追加
  readonly pluginName = 'SimpleAlarm';
  
  readonly name = 'タイマー';
  readonly icon = 'alarm';
  readonly type = 'panel';
  
  readonly component = SimpleAlarmPanelComponent;
  readonly width = 250;
  readonly height = 315;
  // readonly layout = 'full-auto'; // panelオプションとして渡す

  // private destroy$ = new Subject<void>(); // 不要

  constructor(
    private simpleAlarmService: SimpleAlarmService,
    private pluginPanelSyncService: PluginPanelSyncService, // 追加
    private ngZone: NgZone, // 追加
    private uiExtensionService: UIExtensionService,
    private pluginUiService: PluginUiService
  ) { }

  initialize(): void { }

  initializeUI(injector: Injector): void {
    // サービスを初期化して常駐させる
    const service = injector.get(SimpleAlarmService); // このままでOK

    this.uiExtensionService.registerAction('chat-window', {
      name: this.name,
      icon: this.icon,
      action: (context, pointer) => {
        this.pluginUiService.openAtCursor(this.component, {
          title: this.name,
          width: this.width,
          height: this.height,
          align: 'bottom-center'
          // layout: 'full-auto' // SimpleAlarmは固定サイズっぽいのでコメントアウトのままにするか、必要なら追加
        }, pointer);
      }
    });

    // AlarmNotificationComponentのP2P同期開閉をPluginPanelSyncServiceに登録
    this.pluginPanelSyncService.registerPanelSync(
      this, // 自身のインスタンスをコンテキストとして渡す
      PLUGIN_ID,
      FILE_NAME_HINT_ALARM,
      AlarmNotificationComponent,
      {
        title: 'アラーム通知',
        width: 300,
        height: 150,
        isSingleton: true,
        layout: 'full-auto', // layoutオプションはここで設定
        position: 'center', // 画面中央に表示
      },
      NOTIFICATION_STATE_KEY // 通知パネルの開閉状態を管理するキー
    );

    // simple-alarm.service.tsとalarm-notification.component.tsが
    // setPanelOpenStateを呼び出すので、プラグイン側での購読は不要。
    // そのため、destroy$も不要になる。

    // ルームがロードされた際（XML_LOADEDイベント時）にinitializeUIが再度呼び出されるように登録
    EventSystem.register(this).on('XML_LOADED', () => this.initializeUI(injector));
  }

  ngOnDestroy(): void {
    // this.destroy$.next(); // 不要
    // this.destroy$.complete(); // 不要
    EventSystem.unregister(this);
  }
}

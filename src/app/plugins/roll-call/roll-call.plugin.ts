import { Injector, Injectable, OnDestroy, NgZone } from '@angular/core';
import { IPluginWithUI } from '../i-plugin';
import { RollCallControlComponent } from './roll-call-control.component';
import { RollCallAnswerComponent } from './roll-call-answer.component';
import { RollCallService } from './roll-call.service';
import { EventSystem } from '@udonarium/core/system';
import { ROLL_CALL_UI_DEFAULTS } from './roll-call.constants';
import { UIExtensionService } from '../service/ui-extension.service';
import { PluginUiService } from '../service/plugin-ui.service';

@Injectable()
export class RollCallPlugin implements IPluginWithUI, OnDestroy {
  readonly pluginName = 'RollCall';
  
  // ランチャー表示設定
  readonly name = '点呼/投票';
  readonly icon = 'group';
  readonly type = 'panel';
  
  // 管理パネルの設定
  readonly component = RollCallControlComponent;
  readonly width = ROLL_CALL_UI_DEFAULTS.CONTROL.width;
  readonly height = ROLL_CALL_UI_DEFAULTS.CONTROL.height;
  readonly layout = 'full-auto';
  readonly isSingleton = true; // 管理パネルはシングルトン
  readonly version = '1.0.0';
  readonly description = 'PLへの点呼や簡単な投票機能を提供します。全員の回答を一覧できます。';

  constructor(
    private ngZone: NgZone,
    private uiExtensionService: UIExtensionService,
    private pluginUiService: PluginUiService
  ) { }

  initialize(): void {
    // 初期化処理
  }

  initializeUI(injector: Injector): void {
    // サービスを初期化して常駐させる
    // これによりRollCallServiceが初期化され、Voteオブジェクトの監視が始まる
    const service = injector.get(RollCallService);

    this.uiExtensionService.registerAction('chat-window', {
      name: this.name,
      icon: this.icon,
      action: (context, pointer) => {
        this.pluginUiService.openAtCursor(this.component, {
          title: this.name,
          width: this.width,
          height: this.height,
          isSingleton: this.isSingleton,
          layout: this.layout,
          align: 'bottom-center'
        }, pointer);
      }
    });

    // ルームロード時の再初期化
    EventSystem.register(this).on('XML_LOADED', () => this.initializeUI(injector));
  }

  ngOnDestroy(): void {
    EventSystem.unregister(this);
  }
}

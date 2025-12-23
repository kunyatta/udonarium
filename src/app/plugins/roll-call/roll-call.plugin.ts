import { Injector, Injectable, OnDestroy, NgZone } from '@angular/core';
import { IPluginWithUI } from '../i-plugin';
import { RollCallControlComponent } from './roll-call-control.component';
import { RollCallAnswerComponent } from './roll-call-answer.component';
import { RollCallService } from './roll-call.service';
import { EventSystem } from '@udonarium/core/system';
import { ROLL_CALL_UI_DEFAULTS } from './roll-call.constants';

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

  constructor(
    private ngZone: NgZone
  ) { }

  initialize(): void {
    // 初期化処理
  }

  initializeUI(injector: Injector): void {
    // サービスを初期化して常駐させる
    // これによりRollCallServiceが初期化され、Voteオブジェクトの監視が始まる
    const service = injector.get(RollCallService);

    // ルームロード時の再初期化
    EventSystem.register(this).on('XML_LOADED', () => this.initializeUI(injector));
  }

  ngOnDestroy(): void {
    EventSystem.unregister(this);
  }
}

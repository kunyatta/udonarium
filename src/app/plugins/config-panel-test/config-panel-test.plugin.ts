import { Injectable, Type, Injector } from '@angular/core';
import { IPluginWithUI } from '../i-plugin';
import { ConfigPanelTestComponent } from './config-panel-test.component';

@Injectable({
  providedIn: 'root'
})
export class ConfigPanelTestPlugin implements IPluginWithUI {
  readonly pluginName = 'config-panel-test'; // IPlugin
  readonly name = '設定パネルテスト'; // IPluginWithUI (Label)
  readonly type = 'panel';
  readonly component: Type<any> = ConfigPanelTestComponent;
  readonly isSingleton = true;
  readonly width = 600;
  readonly height = 500;
  readonly version = '0.1.0';
  readonly description = 'プラグイン設定パネルの動作をテストするためのプラグインです。\nPluginDataContainerとの同期や、UIコンポーネントの自動生成を検証します。';
  readonly isExperimental = true;

  initializeUI(injector: Injector): void {
    // UI初期化処理が必要ならここに記述
  }
}

import { Injectable, Type, Injector } from '@angular/core';
import { IPluginWithUI } from '../i-plugin';
import { ConfigPanelTestComponent } from './config-panel-test.component';
import { MANIFEST } from './manifest';

@Injectable({
  providedIn: 'root'
})
export class ConfigPanelTestPlugin implements IPluginWithUI {
  readonly manifest = MANIFEST;
  readonly pluginName = MANIFEST.id;
  readonly name = MANIFEST.name;
  readonly type = 'panel';
  readonly icon = MANIFEST.icon;
  readonly component: Type<any> = ConfigPanelTestComponent;
  readonly isSingleton = true;
  readonly width = 600;
  readonly height = 500;

  initializeUI(injector: Injector): void {
    // UI初期化処理が必要ならここに記述
  }
}

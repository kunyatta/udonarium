import { CutInSettingComponent } from './cut-in-setting.component';
import { IPluginWithUI } from '../i-plugin';
import { Injectable, Injector } from '@angular/core';
import { CutInService } from './cut-in.service';
import { UIExtensionService } from '../service/ui-extension.service';
import { PluginUiService } from '../service/plugin-ui.service';

@Injectable()
export class CutInPlugin implements IPluginWithUI {
  readonly pluginName: string = 'cut-in-plugin';

  // IPluginWithUI properties
  readonly name: string = 'カットイン';
  readonly type: 'panel' = 'panel';
  readonly icon: string = 'burst_mode'; 
  readonly component = CutInSettingComponent;
  readonly width: number = 500;
  readonly height: number = 600;
  readonly isSingleton: boolean = true;

  constructor(
    private uiExtensionService: UIExtensionService,
    private pluginUiService: PluginUiService
  ) {}

  initialize(): void {
    // UIなしの初期化
  }

  initializeUI(injector: Injector): void {
    // サービスのインスタンスを injector から取得することで、
    // この時点でサービスがインスタンス化され、監視が開始される。
    const service = injector.get(CutInService);
    console.log('[CutInPlugin] UI Initialized');

    this.uiExtensionService.registerAction('main-menu', {
      name: this.name,
      icon: this.icon,
      priority: 110, // 戦闘(100)の後に表示
      action: () => {
        this.pluginUiService.open(this.component, {
          title: this.name,
          width: this.width,
          height: this.height,
          isSingleton: this.isSingleton
        });
      }
    });
  }
}

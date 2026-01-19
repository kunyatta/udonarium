import { Injectable, Injector } from '@angular/core';
import { IPluginWithUI } from '../i-plugin';
import { PluginLauncherPanelComponent } from './plugin-launcher-panel.component';
import { UIExtensionService } from '../service/ui-extension.service';
import { PluginUiService } from '../service/plugin-ui.service';

@Injectable()
export class PluginLauncherPlugin implements IPluginWithUI {
  readonly pluginName: string = 'plugin-launcher';

  // IPluginWithUI properties
  name: string = '機能管理';
  type: 'panel' = 'panel';
  icon: string = 'extension';
  component = PluginLauncherPanelComponent;
  width: number = 150;
  height: number = 400;

  constructor(
    private uiExtensionService: UIExtensionService,
    private pluginUiService: PluginUiService
  ) {
    console.log(`${this.pluginName}: Constructed`);
  }

  initializeUI(injector: Injector): void {
    this.uiExtensionService.registerAction('settings', {
      name: '機能管理',
      icon: 'extension',
      priority: 1000, // 末尾に配置
      separator: true, // 区切り線を入れる
      action: () => {
        this.pluginUiService.open(this.component, {
          title: this.name,
          width: this.width,
          height: this.height
        });
      }
    });
    console.log(`${this.pluginName}: UI initialized. Registered to settings menu.`);
  }
}

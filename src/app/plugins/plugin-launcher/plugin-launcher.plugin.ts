import { Injectable, Injector } from '@angular/core';
import { IPluginWithUI } from '../i-plugin';
import { PluginLauncherPanelComponent } from './plugin-launcher-panel.component';
import { UIExtensionService } from '../service/ui-extension.service';
import { PluginUiService } from '../service/plugin-ui.service';
import { MANIFEST } from './manifest';

@Injectable()
export class PluginLauncherPlugin implements IPluginWithUI {
  readonly manifest = MANIFEST;
  readonly pluginName = MANIFEST.id;

  // IPluginWithUI properties (Manifestから参照、または上書き)
  readonly name = MANIFEST.name;
  readonly icon = MANIFEST.icon;
  readonly type: 'panel' = 'panel';
  component = PluginLauncherPanelComponent;
  width: number = 600;
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

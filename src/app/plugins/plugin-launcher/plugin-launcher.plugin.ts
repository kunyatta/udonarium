import { Injectable, Injector } from '@angular/core';
import { IPluginWithUI } from '../i-plugin';
import { PluginLauncherPanelComponent } from './plugin-launcher-panel.component';

@Injectable()
export class PluginLauncherPlugin implements IPluginWithUI {
  readonly pluginName: string = 'plugin-launcher';

  // IPluginWithUI properties
  name: string = '拡張パネル';
  type: 'panel' = 'panel';
  icon: string = 'extension';
  component = PluginLauncherPanelComponent;
  width: number = 150;
  height: number = 400;

  constructor() {
    console.log(`${this.pluginName}: Constructed`);
  }

  initializeUI(injector: Injector): void {
    // This plugin is launched by the user from the toolbox menu,
    // so no action is needed here on initialization.
    console.log(`${this.pluginName}: UI initialized. Panel will be opened by user action.`);
  }
}

import { Injectable, Injector } from '@angular/core';
import { IPluginWithUI } from '../i-plugin';
import { UIExtensionService } from '../service/ui-extension.service';
import { Network } from '@udonarium/core/system';
import { MANIFEST } from './manifest';

@Injectable()
export class LogoutPlugin implements IPluginWithUI {
  readonly manifest = MANIFEST;
  readonly pluginName = MANIFEST.id;

  readonly name = MANIFEST.name;
  readonly icon = MANIFEST.icon;
  readonly type: 'toggle' = 'toggle';

  constructor() {
    console.log(`[${this.pluginName}] Constructed`);
  }

  // IPlugin properties
  initialize(): void {
    console.log(`[${this.pluginName}] initialize called`);
  }

  // IPluginWithUI properties
  initializeUI(injector: Injector): void {
    console.log(`[${this.pluginName}] initializeUI called`);
    const uiExtensionService = injector.get(UIExtensionService);

    uiExtensionService.registerAction('main-menu-bottom', {
      name: this.name,
      icon: this.icon,
      priority: 200,
      action: () => {
        console.log(`[${this.pluginName}] Main menu action triggered`);
        this.executeLogout();
      }
    });
  }

  toggleCallback(isActive: boolean): void {
    console.log(`[${this.pluginName}] toggleCallback called: ${isActive}`);
    if (isActive) {
      this.executeLogout();
    }
  }

  private executeLogout() {
    const isRoom = Network.peer?.isRoom;
    const message = `他の参加者との接続を切断し${isRoom ? '、ルームから退出し' : ''}ます。
（ページが再読み込みされます）`;
    if (window.confirm(message)) {
      location.reload();
    }
  }
}

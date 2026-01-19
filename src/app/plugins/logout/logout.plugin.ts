import { Injectable, Injector } from '@angular/core';
import { IPluginWithUI } from '../i-plugin';
import { UIExtensionService } from '../service/ui-extension.service';
import { Network } from '@udonarium/core/system';

@Injectable()
export class LogoutPlugin implements IPluginWithUI {
  readonly pluginName: string = 'logout-plugin';
  readonly name: string = '退出';
  readonly icon: string = 'exit_to_app';
  readonly type: 'toggle' = 'toggle';
  readonly version: string = '1.0.0';
  readonly description: string = 'ルームから退出してトップ画面に戻ります。他の参加者との接続をすべて切断し、ページを再読み込みします。';

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

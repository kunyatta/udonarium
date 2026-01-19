import { Injector, Injectable } from '@angular/core';
import { IPluginWithUI } from '../i-plugin';
import { PluginUiService } from '../service/plugin-ui.service';
import { ChatLogManagerPanelComponent } from './chat-log-manager-panel.component';
import { UIExtensionService } from '../service/ui-extension.service';

@Injectable()
export class ChatLogManagerPlugin implements IPluginWithUI {
  readonly pluginName = 'ChatLogManager';
  
  // ランチャー表示設定
  readonly name = 'ログ管理';
  readonly icon = 'history_edu'; // または delete_sweep
  readonly type = 'panel';
  
  // パネル設定
  readonly component = ChatLogManagerPanelComponent;
  readonly width = 300;
  readonly height = 290;
  readonly version = '1.0.0';
  readonly description = 'チャットログの保存、一括削除、チャットタブの管理を行います。';

  constructor(
    private uiExtensionService: UIExtensionService,
    private pluginUiService: PluginUiService
  ) { }

  initialize(): void {
    // 初期化処理が必要ならここに記述
  }

  initializeUI(injector: Injector): void {
    this.uiExtensionService.registerAction('chat-window', {
      name: this.name,
      icon: this.icon,
      priority: -10, // 他のボタンより左に表示する
      action: (context, pointer) => {
        this.pluginUiService.openAtCursor(this.component, {
          title: this.name,
          width: this.width,
          height: this.height,
          align: 'bottom-center',
          isSingleton: true
        }, pointer);
      }
    });
  }
}

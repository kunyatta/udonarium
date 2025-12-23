import { Injector } from '@angular/core';
import { IPluginWithUI } from '../i-plugin';
import { PluginUiService } from '../service/plugin-ui.service';
import { ChatLogManagerPanelComponent } from './chat-log-manager-panel.component';

export class ChatLogManagerPlugin implements IPluginWithUI {
  readonly pluginName = 'ChatLogManager';
  
  // ランチャー表示設定
  readonly name = 'ログ管理';
  readonly icon = 'history_edu'; // または delete_sweep
  readonly type = 'panel';
  
  // パネル設定
  readonly component = ChatLogManagerPanelComponent;
  readonly width = 300;
  readonly height = 250;

  initialize(): void {
    // 初期化処理が必要ならここに記述
  }

  initializeUI(injector: Injector): void {
    // UI初期化が必要ならここに記述
  }
}

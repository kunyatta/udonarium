import { Injectable } from '@angular/core';
import { IPluginWithUI } from '../i-plugin';
import { TestPanelComponent } from './test-panel.component';

@Injectable()
export class TestPlugin implements IPluginWithUI {
  readonly pluginName: string = 'TestPlugin';

  // --- IPluginWithUIのためのプロパティ (プラグインランチャー表示用) ---
  name: string = 'テストプラグイン (StateService)';
  type: 'panel' = 'panel';
  icon: string = 'science';
  component = TestPanelComponent;
  width: number = 400;
  height: number = 300;

  // このプラグインの責務はUIをシステムに登録することだけなので、
  // initializeやinitializeUIでの特別な処理は不要。
  initialize(): void { }
  initializeUI(): void { }
}

import { Injector } from '@angular/core';
import { IPluginWithUI } from '../i-plugin';
import { RollResultChartPanelComponent } from './roll-result-chart-panel.component';
import { RollResultChartService } from './roll-result-chart.service';
import { PluginUiService } from '../service/plugin-ui.service';
import { UIExtensionService } from '../service/ui-extension.service';

export class RollResultChartPlugin implements IPluginWithUI {
  readonly pluginName = 'Roll Result Chart Plugin';
  readonly name = '結果チャート';
  readonly icon = 'list_alt';
  readonly type = 'panel';
  readonly isSingleton = true;

  constructor(
    private chartService: RollResultChartService,
    private pluginUiService: PluginUiService,
    private uiExtension: UIExtensionService
  ) {}

  initialize(): void {
    this.chartService.initialize();
  }

  initializeUI(injector: Injector): void {
    // Register Menu Action
    this.uiExtension.registerAction('main-menu', {
      name: '結果チャート設定',
      icon: 'list_alt',
      priority: 120,
      action: () => this.openPanel()
    });
  }

  private openPanel() {
    this.pluginUiService.open(RollResultChartPanelComponent, {
      title: '結果チャート設定',
      width: 600,
      height: 600,
      isSingleton: true
    });
  }
}

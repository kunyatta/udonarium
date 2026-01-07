import { Injector } from '@angular/core';
import { IPluginWithUI } from '../i-plugin';
import { RollResultChartPanelComponent } from './roll-result-chart-panel.component';
import { RollResultChartService } from './roll-result-chart.service';
import { PluginUiService } from '../service/plugin-ui.service';
import { UIExtensionService } from '../service/ui-extension.service';

export class RollResultChartPlugin implements IPluginWithUI {
  readonly pluginName = 'Roll Result Chart Plugin';
  readonly name = 'ダイスロール表';
  readonly icon = 'list_alt';
  readonly type = 'panel';
  readonly component = RollResultChartPanelComponent;
  readonly width = 600;
  readonly height = 600;
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
      name: 'ダイスロール表',
      icon: 'list_alt',
      priority: 120,
      action: () => this.openPanel()
    });
  }

  private openPanel() {
    this.pluginUiService.open(RollResultChartPanelComponent, {
      title: 'ダイスロール表',
      width: 600,
      height: 600,
      isSingleton: true
    });
  }
}

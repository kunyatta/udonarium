import { Injector } from '@angular/core';
import { IPluginWithUI } from '../i-plugin';
import { RollResultChartPanelComponent } from './roll-result-chart-panel.component';
import { RollResultChartService } from './roll-result-chart.service';
import { PluginUiService } from '../service/plugin-ui.service';
import { UIExtensionService } from '../service/ui-extension.service';
import { MANIFEST } from './manifest';

export class RollResultChartPlugin implements IPluginWithUI {
  readonly manifest = MANIFEST;
  readonly pluginName = MANIFEST.id;
  readonly name = MANIFEST.name;
  readonly icon = MANIFEST.icon;
  readonly type = 'panel';
  readonly component = RollResultChartPanelComponent;
  readonly width = 600;
  readonly height = 600;

  constructor(
    private chartService: RollResultChartService,
    private pluginUiService: PluginUiService,
    private uiExtension: UIExtensionService
  ) {}

  initialize(): void {
    // Service initialization is now handled by its constructor.
  }

  initializeUI(injector: Injector): void {
    // Register Menu Action
    this.uiExtension.registerAction('main-menu', {
      name: 'ダイスチャート',
      icon: 'list_alt',
      priority: 120,
      action: () => this.openPanel()
    });
  }

  private openPanel() {
    this.pluginUiService.open(RollResultChartPanelComponent, {
      title: 'ダイスチャート',
      width: 600,
      height: 600
    });
  }
}

import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { IPlugin, IPluginWithUI } from '../i-plugin';
import { PluginService } from '../service/plugin.service';
import { PluginUiService, PluginPanelOption } from '../service/plugin-ui.service';

@Component({
  selector: 'app-plugin-launcher-panel',
  templateUrl: './plugin-launcher-panel.component.html',
  styleUrls: ['./plugin-launcher-panel.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PluginLauncherPanelComponent implements OnInit, OnDestroy {
  
  pluginUIs: IPluginWithUI[] = [];
  private openPanelCount: number = 0;

  constructor(
    private pluginService: PluginService,
    private pluginUiService: PluginUiService,
    private changeDetector: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    // Get all plugins that have a UI and are not the launcher itself
    this.pluginUIs = this.pluginService.getPlugins()
      .filter(p => this.isPluginWithUI(p) && p.pluginName !== 'plugin-launcher') as IPluginWithUI[];
  }

  ngOnDestroy(): void {
    // Clean up if needed
  }

  private isPluginWithUI(plugin: IPlugin): plugin is IPluginWithUI {
    return 'initializeUI' in plugin;
  }

  openPluginPanel(pluginUI: IPluginWithUI): void {
    if (pluginUI.component) {
      const option: PluginPanelOption = {
        title: pluginUI.name,
        width: pluginUI.width,
        height: pluginUI.height,
        layout: pluginUI.layout,
        isSingleton: pluginUI.isSingleton // プラグイン側の設定に従う
      };
      this.openPanelCount++;
      this.pluginUiService.open(pluginUI.component, option);
    }
  }

  onToggleButtonClick(pluginUI: IPluginWithUI): void {
    if (pluginUI.toggleCallback) {
      const newState = !pluginUI.isActive;
      // Update the state in the service/plugin instance first
      const originalPlugin = this.pluginService.getPlugins().find(p => p.pluginName === pluginUI.pluginName) as IPluginWithUI;
      if (originalPlugin) {
        originalPlugin.isActive = newState;
      }
      // Then execute the callback
      pluginUI.toggleCallback(newState);
      // And finally, update the view
      this.changeDetector.markForCheck();
    }
  }
}

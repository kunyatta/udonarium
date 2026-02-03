import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { IPlugin, IPluginWithUI } from '../i-plugin';
import { PluginService } from '../service/plugin.service';
import { PluginUiService, PluginPanelOption } from '../service/plugin-ui.service';
import { MOD_SYSTEM_MANIFEST } from '../mod-manifest';
import { isProduction } from '../plugin-registry';

@Component({
  selector: 'app-plugin-info-panel',
  templateUrl: './plugin-info-panel.component.html',
  styleUrls: ['./plugin-info-panel.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PluginInfoPanelComponent implements OnInit, OnDestroy {
  
  readonly MOD_MANIFEST = MOD_SYSTEM_MANIFEST;
  readonly isProduction = isProduction;
  launchTime: string = '';

  pluginUIs: IPluginWithUI[] = [];
  selectedPlugin: IPluginWithUI | null = null;
  private openPanelCount: number = 0;

  constructor(
    private pluginService: PluginService,
    private pluginUiService: PluginUiService,
    private changeDetector: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    // Record launch time for development debugging
    const now = new Date();
    this.launchTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

    // Create a virtual plugin for the Mod system info
    const modInfo: any = {
      pluginName: 'mod-system',
      name: this.MOD_MANIFEST.name,
      icon: this.MOD_MANIFEST.icon,
      manifest: {
        id: 'mod-system',
        name: this.MOD_MANIFEST.name,
        version: this.MOD_MANIFEST.version,
        description: `${this.MOD_MANIFEST.description}\n\nAuthors: ${this.MOD_MANIFEST.authors.join(', ')}\nBased on: Udonarium v${this.MOD_MANIFEST.basedOn} by ${(this.MOD_MANIFEST as any).originalAuthor}\nLast Updated: ${this.MOD_MANIFEST.updatedAt}`,
        icon: this.MOD_MANIFEST.icon,
        isExperimental: false,
        changelog: (this.MOD_MANIFEST as any).changelog
      }
    };

    // Get all plugins that have a manifest and prepend the mod info
    this.pluginUIs = [
      modInfo,
      ...this.pluginService.getPlugins()
        .filter(p => !!p.manifest) as IPluginWithUI[]
    ];
  }

  ngOnDestroy(): void {
    // Clean up if needed
  }

  selectPlugin(pluginUI: IPluginWithUI): void {
    this.selectedPlugin = pluginUI;
  }

  clearSelection(): void {
    this.selectedPlugin = null;
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

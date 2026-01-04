import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PLUGIN_TOKEN } from '../i-plugin';
import { RollResultChartPlugin } from './roll-result-chart.plugin';
import { RollResultChartService } from './roll-result-chart.service';
import { RollResultChartPanelComponent } from './roll-result-chart-panel.component';
import { PluginUiService } from '../service/plugin-ui.service';
import { UIExtensionService } from '../service/ui-extension.service';

@NgModule({
  imports: [
    CommonModule,
    FormsModule
  ],
  declarations: [
    RollResultChartPanelComponent
  ],
  providers: [
    {
      provide: PLUGIN_TOKEN,
      useFactory: (service: RollResultChartService, ui: PluginUiService, ext: UIExtensionService) => {
        return new RollResultChartPlugin(service, ui, ext);
      },
      deps: [RollResultChartService, PluginUiService, UIExtensionService],
      multi: true
    },
    RollResultChartService
  ]
})
export class RollResultChartModule { }

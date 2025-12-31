import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DynamicStandPlugin } from './dynamic-stand.plugin';
import { DynamicStandPluginService } from './dynamic-stand.service';
import { DynamicStandSettingComponent } from './dynamic-stand-setting.component';
import { StandingRendererComponent } from './standing-renderer.component';
import { PLUGIN_TOKEN } from '../i-plugin';

@NgModule({
  imports: [
    CommonModule,
    FormsModule
  ],
  declarations: [
    DynamicStandSettingComponent,
    StandingRendererComponent
  ],
  exports: [
    DynamicStandSettingComponent
  ],
  providers: [
    DynamicStandPluginService,
    { provide: PLUGIN_TOKEN, useClass: DynamicStandPlugin, multi: true }
  ]
})
export class DynamicStandPluginModule {}

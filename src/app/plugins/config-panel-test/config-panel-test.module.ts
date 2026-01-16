import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ConfigPanelTestComponent } from './config-panel-test.component';
import { PLUGIN_TOKEN } from '../i-plugin';
import { ConfigPanelTestPlugin } from './config-panel-test.plugin';
import { ConfigPanelTestService } from './config-panel-test.service'; // Import Service

@NgModule({
  declarations: [ConfigPanelTestComponent],
  imports: [
    CommonModule,
    FormsModule
  ],
  providers: [
    { provide: PLUGIN_TOKEN, useClass: ConfigPanelTestPlugin, multi: true }
  ],
  exports: [ConfigPanelTestComponent]
})
export class ConfigPanelTestModule {
  constructor(private service: ConfigPanelTestService) { // Inject Service
    console.log('[ConfigPanelTest] Module Constructed');
  }
}

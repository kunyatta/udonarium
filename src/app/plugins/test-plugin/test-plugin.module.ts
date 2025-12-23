import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SharedModule } from '../../shared.module';
import { TestPanelComponent } from './test-panel.component';
import { TestPlugin } from './test.plugin';
import { PLUGIN_TOKEN } from '../i-plugin';
// import { TestRunnerService } from './service/test-runner.service';

@NgModule({
  imports: [
    CommonModule,
    SharedModule
  ],
  declarations: [
    TestPanelComponent
  ],
  providers: [
    TestPlugin,
    { provide: PLUGIN_TOKEN, useExisting: TestPlugin, multi: true }
    // TestRunnerService
  ],
  exports: [
    TestPanelComponent
  ]
})
export class TestPluginModule { }

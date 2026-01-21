import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OverlayControllerComponent } from './overlay-test/overlay-controller.component';
import { PLUGIN_TOKEN } from '../i-plugin';
import { OverlayTestPlugin } from './overlay-test-plugin.plugin';

@NgModule({
  declarations: [
    OverlayControllerComponent
  ],
  imports: [
    CommonModule,
    FormsModule
  ],
  exports: [
    OverlayControllerComponent
  ],
  providers: [
    { provide: PLUGIN_TOKEN, useClass: OverlayTestPlugin, multi: true }
  ]
})
export class OverlayTestPluginModule { }
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OverlayTestComponent } from './overlay-test/overlay-test.component';
import { OverlayControllerComponent } from './overlay-test/overlay-controller.component';
import { PLUGIN_TOKEN } from '../i-plugin';
import { OverlayTestPlugin } from './overlay-test-plugin.service';

@NgModule({
  declarations: [
    OverlayTestComponent,
    OverlayControllerComponent
  ],
  imports: [
    CommonModule,
    FormsModule
  ],
  exports: [
    OverlayTestComponent,
    OverlayControllerComponent
  ],
  providers: [
    { provide: PLUGIN_TOKEN, useClass: OverlayTestPlugin, multi: true }
  ]
})
export class OverlayTestPluginModule { }

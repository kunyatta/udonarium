import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AutoLayoutPanelComponent } from './auto-layout-panel/auto-layout-panel.component';
import { OverlayComponent } from './overlay/overlay.component';

@NgModule({
  declarations: [
    AutoLayoutPanelComponent,
    OverlayComponent
  ],
  imports: [
    CommonModule
  ],
  exports: [
    AutoLayoutPanelComponent,
    OverlayComponent
  ]
})
export class PluginsComponentsModule { }
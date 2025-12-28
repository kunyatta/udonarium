import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { YouTubePlayerModule } from '@angular/youtube-player';
import { AutoLayoutPanelComponent } from './auto-layout-panel/auto-layout-panel.component';
import { OverlayComponent } from './overlay/overlay.component';

@NgModule({
  declarations: [
    AutoLayoutPanelComponent,
    OverlayComponent
  ],
  imports: [
    CommonModule,
    YouTubePlayerModule
  ],
  exports: [
    AutoLayoutPanelComponent,
    OverlayComponent
  ]
})
export class PluginsComponentsModule { }
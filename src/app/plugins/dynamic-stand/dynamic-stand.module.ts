import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SharedModule } from '../../shared.module';
import { DynamicStandPlugin } from './dynamic-stand.plugin';
import { DynamicStandPluginService } from './dynamic-stand.service';
import { DynamicStandSettingComponent } from './dynamic-stand-setting.component';
import { EmotePaletteComponent } from './emote-palette.component';
import { ImageDataElementComponent } from '../components/image-data-element/image-data-element.component';
import { StandSideDataElementComponent } from './stand-side-data-element/stand-side-data-element.component';
import { PLUGIN_TOKEN } from '../i-plugin';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    SharedModule
  ],
  declarations: [
    DynamicStandSettingComponent,
    EmotePaletteComponent,
    ImageDataElementComponent,
    StandSideDataElementComponent
  ],
  exports: [
    DynamicStandSettingComponent,
    EmotePaletteComponent,
    ImageDataElementComponent,
    StandSideDataElementComponent
  ],
  providers: [
    DynamicStandPluginService,
    { provide: PLUGIN_TOKEN, useClass: DynamicStandPlugin, multi: true }
  ]
})
export class DynamicStandPluginModule {}

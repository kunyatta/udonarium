import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SharedModule } from '../../shared.module';
import { PLUGIN_TOKEN } from '../i-plugin';
import { CutInSettingComponent } from './cut-in-setting.component';
import { CutInService } from './cut-in.service';
import { CutInPlaybackService } from './cut-in-playback.service';
import { CutInPlugin } from './cut-in.plugin';

@NgModule({
  declarations: [
    CutInSettingComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    SharedModule
  ],
  providers: [
    { provide: PLUGIN_TOKEN, useClass: CutInPlugin, multi: true },
    CutInService,
    CutInPlaybackService
  ],
  exports: [
    CutInSettingComponent
  ]
})
export class CutInModule { }

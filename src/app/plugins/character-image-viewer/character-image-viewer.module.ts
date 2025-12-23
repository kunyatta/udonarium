import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SharedModule } from '../../shared.module';
import { CharacterImageViewerComponent } from './character-image-viewer.component';
import { CharacterImageViewerPlugin } from './character-image-viewer.plugin';
import { PLUGIN_TOKEN } from '../i-plugin';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    SharedModule
  ],
  declarations: [
    CharacterImageViewerComponent
  ],
  providers: [
    CharacterImageViewerPlugin,
    { provide: PLUGIN_TOKEN, useExisting: CharacterImageViewerPlugin, multi: true }
  ],
  exports: [
    CharacterImageViewerComponent
  ]
})
export class CharacterImageViewerModule { }

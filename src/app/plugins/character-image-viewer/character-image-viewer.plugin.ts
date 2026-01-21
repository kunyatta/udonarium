import { Injectable } from '@angular/core';
import { IPluginWithUI } from '../i-plugin';
import { CharacterImageViewerComponent } from './character-image-viewer.component';
import { MANIFEST } from './manifest';

@Injectable({
  providedIn: 'root'
})
export class CharacterImageViewerPlugin implements IPluginWithUI {
  readonly manifest = MANIFEST;
  readonly pluginName = MANIFEST.id;

  name = MANIFEST.name;
  type: 'panel' = 'panel';
  icon = MANIFEST.icon;
  component = CharacterImageViewerComponent;
  width: number = 800;
  height: number = 600;

  initialize(): void { }
  initializeUI(): void { }
}
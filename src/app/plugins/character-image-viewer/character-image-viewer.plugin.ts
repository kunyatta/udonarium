import { Injectable } from '@angular/core';
import { IPluginWithUI } from '../i-plugin';
import { CharacterImageViewerComponent } from './character-image-viewer.component';

@Injectable({
  providedIn: 'root'
})
export class CharacterImageViewerPlugin implements IPluginWithUI {
  readonly pluginName: string = 'CharacterImageViewerPlugin';

  name: string = 'キャラクター画像ビューア';
  type: 'panel' = 'panel';
  icon: string = 'image_search';
  component = CharacterImageViewerComponent;
  width: number = 800;
  height: number = 600;

  initialize(): void { }
  initializeUI(): void { }
}
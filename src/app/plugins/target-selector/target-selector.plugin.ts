import { Injectable } from '@angular/core';
import { IPlugin } from '../i-plugin';
import { TargetSelectorService } from './target-selector.service';
import { MANIFEST } from './manifest';

@Injectable()
export class TargetSelectorPlugin implements IPlugin {
  readonly manifest = MANIFEST;
  readonly pluginName = MANIFEST.id;
  readonly name = MANIFEST.name;
  readonly icon = MANIFEST.icon;

  constructor(private service: TargetSelectorService) {}

  initialize(): void {
    console.log('[TargetSelector] Plugin Initializing...');
    this.service.initialize();
  }
}

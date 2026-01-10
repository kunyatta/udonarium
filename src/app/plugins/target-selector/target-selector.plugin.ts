import { Injectable } from '@angular/core';
import { IPlugin } from '../i-plugin';
import { TargetSelectorService } from './target-selector.service';

@Injectable()
export class TargetSelectorPlugin implements IPlugin {
  readonly pluginName = 'TargetSelectorPlugin';

  constructor(private service: TargetSelectorService) {}

  initialize(): void {
    console.log('[TargetSelector] Plugin Initializing...');
    this.service.initialize();
  }
}

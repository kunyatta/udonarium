import { Injectable } from '@angular/core';
import { IPlugin } from '../i-plugin';
import { TargetSelectorService } from './target-selector.service';

@Injectable()
export class TargetSelectorPlugin implements IPlugin {
  readonly pluginName = 'TargetSelectorPlugin';
  
  constructor(private service: TargetSelectorService) {
    // サービスを確実に初期化させる
    console.log('TargetSelectorPlugin initialized');
  }

  // IPluginインターフェースの実装（必要であれば）
  // initializeなどのライフサイクルフックがあればここに記述
}

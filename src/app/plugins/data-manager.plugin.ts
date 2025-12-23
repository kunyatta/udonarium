import { Injectable } from '@angular/core';
import { IPlugin } from './i-plugin';

@Injectable({
  providedIn: 'root'
})
export class DataManagerPlugin implements IPlugin {
  readonly pluginName = 'data-manager-plugin';
  // このプラグインはUIを持たず、主にサービスをDIコンテナに登録する役割を担う
  // そのため、中身は空で良い

  initialize(): void {
    // 初期化処理が必要な場合はここに記述
    console.log('DataManagerPlugin initialized');
  }
}

import { CutInSettingComponent } from './cut-in-setting.component';
import { IPluginWithUI } from '../i-plugin';
import { Injectable, Injector } from '@angular/core';
import { CutInService } from './cut-in.service';

@Injectable()
export class CutInPlugin implements IPluginWithUI {
  readonly pluginName: string = 'cut-in-plugin';

  // IPluginWithUI properties
  readonly name: string = 'カットイン';
  readonly type: 'panel' = 'panel';
  readonly icon: string = 'burst_mode'; 
  readonly component = CutInSettingComponent;
  readonly width: number = 500;
  readonly height: number = 600;
  readonly isSingleton: boolean = true;

  constructor() {}

  initialize(): void {
    // UIなしの初期化
  }

  initializeUI(injector: Injector): void {
    // サービスのインスタンスを injector から取得することで、
    // この時点でサービスがインスタンス化され、監視が開始される。
    const service = injector.get(CutInService);
    console.log('[CutInPlugin] UI Initialized');
  }
}

import { Injectable, Injector, NgZone, OnDestroy } from '@angular/core';
import { IPluginWithUI } from '../i-plugin';
import { PluginUiService } from '../service/plugin-ui.service';
import { PluginDataObserverService } from '../service/plugin-data-observer.service';
import { CombatFlowControllerComponent } from './combat-flow-controller.component';
import { CombatFlowPanelComponent } from './combat-flow-panel.component';
import { CombatStateService } from './combat-state.service';
import { EventSystem } from '@udonarium/core/system';
import { PluginDataContainer } from '../../class/plugin-data-container';

export const COMBAT_FLOW_UI_DEFAULTS = {
  CONTROLLER: {
    width: 480,
    height: 720,
    title: '戦闘コントローラ'
  },
  PANEL: {
    width: 800,
    height: 300,
    title: '戦闘中'
  }
};

@Injectable()
export class CombatFlowPlugin implements IPluginWithUI, OnDestroy {
  readonly pluginName: string = 'combat-flow';
  readonly name: string = COMBAT_FLOW_UI_DEFAULTS.CONTROLLER.title;
  readonly type: 'panel' = 'panel';
  readonly icon: string = 'groups';
  readonly component = CombatFlowControllerComponent;
  width: number = COMBAT_FLOW_UI_DEFAULTS.CONTROLLER.width;
  height: number = COMBAT_FLOW_UI_DEFAULTS.CONTROLLER.height;

  private readonly PLUGIN_ID = 'combat-flow';
  private readonly FILE_NAME_HINT = 'default';
  private observer: { unsubscribe: () => void };

  constructor(
    private combatStateService: CombatStateService,
    private pluginUiService: PluginUiService,
    private observerService: PluginDataObserverService,
    private ngZone: NgZone
  ) { }

  initializeUI(injector: Injector): void {
    // ルームロード時に監視が重複しないよう、既存の監視があれば解除
    if (this.observer) this.observer.unsubscribe();
    
    // 監視を開始
    this.observer = this.observerService.observe(
      this,
      this.PLUGIN_ID,
      this.FILE_NAME_HINT,
      container => {
        // コンテナの有無や状態に基づいてパネルの表示/非表示を切り替える
        const isCombat = this.combatStateService.isCombat;
        this.checkAndTogglePanel(isCombat);
      }
    );

    // ルームロード時に監視を再セットアップ
    EventSystem.register(this).on('XML_LOADED', () => this.initializeUI(injector));
  }

  private checkAndTogglePanel(isCombat: boolean): void {
    const combatPanel = this.pluginUiService.find(CombatFlowPanelComponent);

    if (isCombat && !combatPanel) {
      this.pluginUiService.open(CombatFlowPanelComponent, {
        title: '戦闘中',
        width: 800, // 自動計算されるため、初期値はそこまで重要ではない
        height: 300, // 自動計算されるため、初期値はそこまで重要ではない
        isSingleton: true,
        layout: 'full-auto', // 自動リサイズを有効にする
      });
    } else if (!isCombat && combatPanel) {
      this.pluginUiService.close(CombatFlowPanelComponent);
    }
  }

  ngOnDestroy(): void {
    // コンポーネント破棄時に監視を解除
    if (this.observer) this.observer.unsubscribe();
    EventSystem.unregister(this);
  }
}
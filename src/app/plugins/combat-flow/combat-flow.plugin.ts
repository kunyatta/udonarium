import { Injectable, Injector, NgZone, OnDestroy } from '@angular/core';
import { IPluginWithUI } from '../i-plugin';
import { PluginUiService } from '../service/plugin-ui.service';
import { PluginDataObserverService } from '../service/plugin-data-observer.service';
import { CombatFlowPanelComponent } from './combat-flow-panel.component';
import { CombatFlowSettingsComponent } from './combat-flow-settings.component';
import { CombatFlowManagerComponent } from './combat-flow-manager.component';
import { BattleActionComponent } from './battle-action.component';
import { CombatStateService } from './combat-state.service';
import { EventSystem } from '@udonarium/core/system';
import { PluginDataContainer } from '../../class/plugin-data-container';
import { UIExtensionService } from '../service/ui-extension.service';
import { GameCharacter } from '@udonarium/game-character';
import { PLUGIN_ID } from './combat-flow.constants';

export const COMBAT_FLOW_UI_DEFAULTS = {
  CONTROLLER: {
    width: 480,
    height: 600,
    title: '戦闘アクション'
  },
  MANAGER: {
    width: 480,
    height: 500,
    title: '戦況マネージャ'
  },
  PANEL: {
    width: 800,
    height: 300,
    title: '戦闘中'
  }
};

@Injectable()
export class CombatFlowPlugin implements IPluginWithUI, OnDestroy {
  readonly pluginName: string = PLUGIN_ID;
  readonly name: string = COMBAT_FLOW_UI_DEFAULTS.MANAGER.title; // メインメニュー用
  readonly type: 'panel' = 'panel';
  readonly icon: string = 'swords'; // ----- MODIFICATION (kunyatta) -----
  readonly iconClass: string = 'material-symbols-outlined'; // ----- MODIFICATION (kunyatta) -----
  readonly component = CombatFlowManagerComponent; // メインメニュー用
  width: number = COMBAT_FLOW_UI_DEFAULTS.MANAGER.width;
  height: number = COMBAT_FLOW_UI_DEFAULTS.MANAGER.height;

  private readonly PLUGIN_ID = PLUGIN_ID;
  private readonly FILE_NAME_HINT = 'default';
  private observer: { unsubscribe: () => void };

  constructor(
    private combatStateService: CombatStateService,
    private pluginUiService: PluginUiService,
    private observerService: PluginDataObserverService,
    private uiExtensionService: UIExtensionService,
    private ngZone: NgZone
  ) { }

  initializeUI(injector: Injector): void {
    // UI Extension の登録
    this.uiExtensionService.registerAction('main-menu', {
      name: '戦闘', // アイコン名は維持
      icon: this.icon,
      iconClass: this.iconClass, // ----- MODIFICATION (kunyatta) -----
      priority: 100,
      action: () => {
        // メインメニューからは「戦況マネージャ」を開く
        this.pluginUiService.open(this.component, {
          title: this.name,
          width: this.width,
          height: this.height
        });
      }
    });

    this.uiExtensionService.registerAction('settings', {
      name: '戦闘設定',
      icon: 'settings',
      priority: 100,
      action: () => {
        this.pluginUiService.open(CombatFlowSettingsComponent, {
          title: '戦闘設定',
          width: 590,
          height: 600
        });
      }
    });

    this.uiExtensionService.registerAction('context-menu', {
      name: '戦闘アクションを表示',
      action: (context: GameCharacter, pointer) => {
        // コンテキストメニューからは「戦闘アクション」を開く
        this.pluginUiService.openAtCursor(BattleActionComponent, {
          title: COMBAT_FLOW_UI_DEFAULTS.CONTROLLER.title,
          width: COMBAT_FLOW_UI_DEFAULTS.CONTROLLER.width,
          height: COMBAT_FLOW_UI_DEFAULTS.CONTROLLER.height,
          isSingleton: false, // 複数キャラ同時に開けるようにする
          inputs: { initialCasterIdentifier: context.identifier },
          align: 'center'
        }, pointer);
      },
      condition: (context) => context instanceof GameCharacter,
      insertBeforeSeparator: 1
    });

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
import { Injectable, Injector } from '@angular/core';
import { EventSystem } from '@udonarium/core/system';
import { HttpClient } from '@angular/common/http';
import { ObjectStore } from '@udonarium/core/synchronize-object/object-store';

import { IPluginWithUI } from '../i-plugin';
import { PluginUiService, PluginPanelOption } from '../plugin-ui.service';
import { CombatState } from './models/combat-state';
import { Combatant } from './models/combatant';
import { CombatFlowControllerComponent } from './combat-flow-controller.component';
import { CombatFlowPanelComponent } from './combat-flow-panel.component';
import { StatusEffect } from './models/status-effect';
import { StatusEffectDictionary } from './models/status-effect-dictionary';
import { PluginDataService } from '../plugin-data.service';
import { CombatStateService } from './combat-state.service';

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
  },
  STATUS_EFFECT_EDITOR: {
    width: 480,
    height: 640,
    title: 'ステータス効果エディタ'
  },
  CHAT_PALETTE: {
    width: 620,
    height: 350
  }
};

@Injectable({
  providedIn: 'root'
})
export class CombatFlowPlugin implements IPluginWithUI {
  readonly pluginName: string = 'CombatFlowPlugin';
  private readonly PLUGIN_ID = 'combat-flow-plugin';
  private readonly SAVE_DATA_KEY = 'combat-flow-data';
  private saveDataTimer: NodeJS.Timeout | null = null;

  // --- IPluginWithUIのためのプロパティ (プラグインランチャー表示用) ---
  name: string = COMBAT_FLOW_UI_DEFAULTS.CONTROLLER.title;
  type: 'panel' = 'panel'; // クリックでパネルを開くタイプ
  icon: string = 'groups';
  component = CombatFlowControllerComponent; // 開くUIコンポーネントを指定
  width: number = COMBAT_FLOW_UI_DEFAULTS.CONTROLLER.width;
  height: number = COMBAT_FLOW_UI_DEFAULTS.CONTROLLER.height;

  constructor(
    private pluginUiService: PluginUiService,
    private http: HttpClient,
    private combatStateService: CombatStateService // 早期起動のためにインジェクト
  ) {}

  initialize(): void {
    this.initializeDictionary();
    // ----- MODIFICATION START (Gemini) for PluginDataIndependence - MoveInitialize -----
    this.combatStateService.restoreDictionary(); // 先に辞書データを復元
    this.combatStateService.initialize(); // アプリ起動時にプラグインデータを復元
    // ----- MODIFICATION END (Gemini) for PluginDataIndependence - MoveInitialize -----

    EventSystem.register(this)
      .on('SHOW_COMBAT_FLOW_PANEL', event => {
        const optimalWidth = this.calculateOptimalWidth();
        
        const option: PluginPanelOption = {
          title: COMBAT_FLOW_UI_DEFAULTS.PANEL.title,
          width: optimalWidth,
          height: COMBAT_FLOW_UI_DEFAULTS.PANEL.height,
          isSingleton: true // Ensure only one combat flow panel is open at a time.
        };
        this.pluginUiService.open(CombatFlowPanelComponent, option);
      })
      // ----- MODIFICATION START (Gemini) for CombatFlowPlugin - Resize on Combat Start -----
      .on('REQUEST_COMBAT_PANEL_RESIZE', event => {
        const optimalWidth = this.calculateOptimalWidth();

        const option: PluginPanelOption = {
          title: COMBAT_FLOW_UI_DEFAULTS.PANEL.title,
          width: optimalWidth,
          height: COMBAT_FLOW_UI_DEFAULTS.PANEL.height,
          isSingleton: true // Ensure only one combat flow panel is open at a time.
        };
        this.pluginUiService.open(CombatFlowPanelComponent, option);
      })
      .on('CLOSE_COMBAT_FLOW_PANEL', event => {
        this.pluginUiService.close(CombatFlowPanelComponent);
      });
      // ----- MODIFICATION END (Gemini) -----
  }

  // アプリのUI初期化後に呼ばれる
  initializeUI(injector: Injector): void {
    // ----- MODIFICATION START (Gemini) for AutoPanelDisplayFix - ProactiveTrigger -----
    // データ復元時に戦闘中だった場合にパネルを自動で開くためのトリガーを購読
    this.combatStateService.openPanel$.subscribe(() => {
      console.log('Combat in progress detected via trigger, opening combat panel...');
      const optimalWidth = this.calculateOptimalWidth();
      const option: PluginPanelOption = {
        title: COMBAT_FLOW_UI_DEFAULTS.PANEL.title,
        width: optimalWidth,
        height: COMBAT_FLOW_UI_DEFAULTS.PANEL.height,
        isSingleton: true
      };
      this.pluginUiService.open(CombatFlowPanelComponent, option);
    });
    // ----- MODIFICATION END (Gemini) for AutoPanelDisplayFix - ProactiveTrigger -----
  }

  /**
   * ステータス効果辞書を初期化する。
   * ObjectStoreに辞書が存在しない場合、assets/status-effect-dictionary.jsonから読み込みを試みる。
   * 読み込みに失敗した場合は、デフォルトのデータを生成する。
   */
  private initializeDictionary(): void {
    if (ObjectStore.instance.get<StatusEffectDictionary>('StatusEffectDictionary')) {
      return; 
    }

    this.http.get<any>('assets/status-effect-dictionary.json').subscribe({
      next: data => {
                  if (data.effects) {
                    for (const effectData of data.effects) {
                      StatusEffect.create(effectData);
                    }
                  }        if (data.dictionary) {
          // IDはコンストラクタで設定し、initializeは引数なしで呼び出す
          const dict = new StatusEffectDictionary(data.dictionary.identifier);
          dict.initialize();
          dict.templates = data.dictionary.templates || [];
          ObjectStore.instance.add(dict);
        }
      },
      error: _ => {
        this.createDefaultStatusEffects();
      }
    });
  }

  /**
   * デフォルトのステータス効果（死亡）を生成し、ObjectStoreに追加する。
   */
  private createDefaultStatusEffects(): void {
    const dictionary = new StatusEffectDictionary('StatusEffectDictionary');
    dictionary.initialize();
    ObjectStore.instance.add(dictionary);

    const deadStatus = new StatusEffect();
    deadStatus.persistentId = 'default-dead'; // ★ Add fixed persistent ID
    deadStatus.name = '死亡';
    deadStatus.icon = 'dangerous';
    deadStatus.initialRounds = -1; // ★ initialRounds を設定
    deadStatus.description = 'このキャラクターは行動できません。';
    deadStatus.visualEffects = [
      { type: 'filter', value: 'grayscale(100%)' },
      { type: 'backgroundColor', value: '#666' }
    ];
    deadStatus.initialize();
    ObjectStore.instance.add(deadStatus);
    dictionary.templates = [deadStatus.identifier];
  }

  private calculateOptimalWidth(): number {
    const state = ObjectStore.instance.get<CombatState>('CombatState');
    if (!state || !state.isCombat) {
      return COMBAT_FLOW_UI_DEFAULTS.PANEL.width;
    }

    const combatantCount = state.combatantIds.length;
    if (combatantCount === 0) {
      return COMBAT_FLOW_UI_DEFAULTS.PANEL.width;
    }

    // カード1枚あたりの定義 (CSSに準拠)
    const cardWidth = 120;    // .combatant-card の width
    const borderWidth = 4;      // .combatant-card の border (左右2pxずつ)
    const gap = 8;            // .combatants-container の gap
    const padding = 16;       // .panel-container の padding (左右8pxずつ)
    const auraPadding = 20;   // .combatants-container の padding (左右10pxずつ) オーラ表示用

    // ----- MODIFICATION START (Gemini) for CombatFlowPlugin - Safety Margin -----
    // ブラウザのレンダリング誤差やbox-sizingの解釈のズレを吸収するための安全マージン
    // カード1枚分のコンテンツ幅 + padding + border の合計値
    const safetyMargin = cardWidth + (8 * 2) + (2 * 2); // 120 + 16 + 4 = 140px
    // ----- MODIFICATION END (Gemini) -----

    // 全員のカードを表示するために必要な幅を計算
    // ----- MODIFICATION START (Gemini) for CombatFlowPlugin - Add Safety Margin -----
    const requiredWidth = ((cardWidth + borderWidth) * combatantCount) + (gap * (combatantCount - 1)) + padding + auraPadding + safetyMargin;
    // ----- MODIFICATION END (Gemini) -----

    // 画面幅からはみ出さないように最大幅を設定 (左右に少しマージンを持たせる)
    const maxWidth = window.innerWidth - 40;

    // 計算した幅とデフォルト幅のうち大きい方を採用し、かつ画面の最大幅を超えないようにする
    const finalWidth = Math.min(Math.max(requiredWidth, COMBAT_FLOW_UI_DEFAULTS.PANEL.width), maxWidth);

    return finalWidth;
  }
}
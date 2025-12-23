import { Component, OnInit, OnDestroy, ChangeDetectorRef, NgZone } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { GameCharacter } from '@udonarium/game-character';
import { ImageFile } from '@udonarium/core/file-storage/image-file';
import { EventSystem } from '@udonarium/core/system';
import { DataElement } from '@udonarium/data-element';
import { ObjectStore } from '@udonarium/core/synchronize-object/object-store';
import { ChatPalette } from '@udonarium/chat-palette';

import { ContextMenuAction, ContextMenuService } from 'service/context-menu.service';
import { PanelService } from 'service/panel.service';
import { CharacterDataService } from '../common/character-data.service';
import { GameCharacterSheetComponent } from 'component/game-character-sheet/game-character-sheet.component';
import { ChatPaletteComponent } from 'component/chat-palette/chat-palette.component';
import { PluginUiService, PanelOption } from '../plugin-ui.service';
import { CombatStateService, CombatantViewModel } from './combat-state.service';
import { Observable } from 'rxjs';
import { CombatFlowControllerComponent } from './combat-flow-controller.component';
import { COMBAT_FLOW_UI_DEFAULTS } from './combat-flow.plugin';
import { CombatState } from './models/combat-state';
import { Combatant } from './models/combatant';
import { StatusEffect } from './models/status-effect';

@Component({
  selector: 'app-combat-flow-panel',
  templateUrl: './combat-flow-panel.component.html',
  styleUrls: ['./combat-flow-panel.component.css']
})
export class CombatFlowPanelComponent implements OnInit, OnDestroy {

  viewModels$: Observable<CombatantViewModel[]>;
  isCombat$: Observable<boolean>;
  displayDataTags$: Observable<string>;

  constructor(
    private sanitizer: DomSanitizer,
    private pluginUiService: PluginUiService,
    private contextMenuService: ContextMenuService,
    private panelService: PanelService,
    public combatStateService: CombatStateService,
    private characterDataService: CharacterDataService
  ) { 
    this.viewModels$ = this.combatStateService.viewModels$;
    this.isCombat$ = this.combatStateService.isCombat$;
    this.displayDataTags$ = this.combatStateService.displayDataTags$;
  }

  ngOnInit(): void {
    // EventSystem registration for manual change detection is no longer needed.
  }

  ngOnDestroy(): void {
    EventSystem.unregister(this);
  }

  onSingleClick(combatant: Combatant): void {
    this.combatStateService.setActiveCombatant(combatant.identifier);
  }

  onDoubleClick(combatant: Combatant): void {
    this.combatStateService.toggleActed(combatant.identifier);
  }

  onContextMenu(event: MouseEvent, combatant: Combatant): void {
    event.stopPropagation();
    event.preventDefault();

    const character = ObjectStore.instance.get<GameCharacter>(combatant.characterId);
    if (!character) return;

    const actions: ContextMenuAction[] = [
      {
        name: '戦闘コントローラ',
        action: () => {
          this.pluginUiService.open(CombatFlowControllerComponent, {
            title: COMBAT_FLOW_UI_DEFAULTS.CONTROLLER.title,
            width: COMBAT_FLOW_UI_DEFAULTS.CONTROLLER.width,
            height: COMBAT_FLOW_UI_DEFAULTS.CONTROLLER.height,
            inputs: { initialCasterId: character.identifier } 
          });
        }
      },
      {
        name: 'キャラクターシートを開く',
        action: () => {
          const panelWidth = 700;
          const panelHeight = 800;
          const left = (window.innerWidth - panelWidth) / 2;
          const top = (window.innerHeight - panelHeight) / 2;
          const component = this.panelService.open<GameCharacterSheetComponent>(GameCharacterSheetComponent, {
            title: character.name ? `${character.name} の詳細` : 'キャラクターシート',
            width: panelWidth,
            height: panelHeight,
            left: left,
            top: top
          });
          component.tabletopObject = character;
        }
      },
      {
        name: 'チャットパレットを表示',
        action: () => {
          const panelWidth = COMBAT_FLOW_UI_DEFAULTS.CHAT_PALETTE.width;
          const panelHeight = COMBAT_FLOW_UI_DEFAULTS.CHAT_PALETTE.height;
          const left = (window.innerWidth - panelWidth) / 2;
          const top = (window.innerHeight - panelHeight) / 2;
          const component = this.panelService.open<ChatPaletteComponent>(ChatPaletteComponent, {
            title: `${character.name} のチャットパレット`,
            width: panelWidth,
            height: panelHeight,
            left: left,
            top: top
          });
          component.character = character;
        }
      }
    ];
    this.contextMenuService.open({ x: event.x, y: event.y }, actions, character.name);
  }

  openController(): void {
    const option: PanelOption = {
      title: '戦闘コントローラー',
      width: 400,
      height: 500,
    };
    this.pluginUiService.open(CombatFlowControllerComponent, option);
  }

  getCombinedCardNgStyle(combatant: Combatant): { [key: string]: any } {
    if (!combatant) return {};

    // Get status effects directly from the combatant object
    const combinedEffects = combatant.statusEffectIds
      .map(id => ObjectStore.instance.get<StatusEffect>(id))
      .filter(effect => effect && !this.isEffectExpired(effect))
      .flatMap(effect => effect.visualEffects);

    const styleObject: { [key: string]: any } = {};

    for (const effect of combinedEffects) {
      switch (effect.type) {
        case 'filter':
          styleObject['filter'] = (styleObject['filter'] || '') + ` ${effect.value}`;
          break;
        case 'aura':
          const newShadow = `0 0 8px 3px ${effect.value}`;
          styleObject['box-shadow'] = (styleObject['box-shadow'] ? styleObject['box-shadow'] + ', ' : '') + newShadow;
          break;
        case 'backgroundColor':
          styleObject['background-color'] = effect.value;
          break;
        default:
          styleObject[effect.type] = effect.value;
          break;
      }
    }
    if (styleObject['filter']) {
      styleObject['filter'] = styleObject['filter'].trim();
    }

    return styleObject;
  }

  isEffectExpired(effect: StatusEffect): boolean {
    if (effect.remainingRounds === -1) { // -1 を永続とみなす
      return false;
    }
    return effect.remainingRounds <= 0;
  }

  getRemainingRounds(effect: StatusEffect): string {
    // 戦闘中でなければ表示しない、というチェックはコンポーネントの表示/非表示がisCombat$に依存するため不要になった
    if (effect.remainingRounds === -1) {
      return ''; // 永続効果の場合は表示しない
    }
    if (effect.remainingRounds <= 0) {
      return ''; // 残りラウンドが0以下の場合は表示しない
    }
    return effect.remainingRounds.toString().padStart(2, '0'); // 2桁表示
  }

  getCharacterParameters(character: GameCharacter, tags: string): DataElement[] {
    return this.characterDataService.getParameters(character, tags);
  }

  getParameterType(param: DataElement): string {
    return (param as any).attributes['type'] || '';
  }

  getResourcePercentage(param: DataElement): number {
    const currentValue = +param.currentValue;
    const maxValue = +param.value;
    if (maxValue === 0 || isNaN(currentValue) || isNaN(maxValue)) {
      return 0;
    }
    return (currentValue / maxValue) * 100;
  }
}

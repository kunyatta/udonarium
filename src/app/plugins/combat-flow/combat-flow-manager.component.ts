import { Component, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CombatStateService } from './combat-state.service';
import { Observable, combineLatest, of } from 'rxjs';
import { map, shareReplay, startWith } from 'rxjs/operators';
import { CharacterDataService } from '../service/character-data.service';
import { PluginUiService } from '../service/plugin-ui.service';
import { BattleActionComponent } from './battle-action.component';
import { CombatFlowManagerHelpComponent } from './combat-flow-manager-help.component';
import { COMBAT_FLOW_UI_DEFAULTS } from './combat-flow.plugin';

interface UnifiedListItem {
  type: 'participant' | 'separator' | 'standby';
  characterId?: string;
  name?: string;
  isParticipating?: boolean;
}

@Component({
  selector: 'app-combat-flow-manager',
  templateUrl: './combat-flow-manager.component.html',
  styleUrls: ['./combat-flow-manager.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CombatFlowManagerComponent {

  // CombatStateServiceのpublicなObservableやメソッドをテンプレートに公開
  readonly charactersForSelection$ = this.combatStateService.charactersForSelection$;
  readonly selection$ = this.combatStateService.selection$;
  readonly isAllSelected$ = this.combatStateService.isAllSelected$;
  readonly selectedCharacterCount$ = this.combatStateService.selectedCharacterCount$;
  readonly isCombat$ = this.combatStateService.isCombat$;
  readonly round$ = this.combatStateService.round$;
  readonly combatants$ = this.combatStateService.combatants$;
  readonly selectedParticipantIdForReorder$ = this.combatStateService.selectedParticipantIdForReorder$;
  readonly currentCharacterId$ = this.combatStateService.currentCharacterId$;
  
  // 戦闘前状態
  readonly preCombatRound$ = this.combatStateService.preCombatRound$;
  readonly scheduledParticipantIds$ = this.combatStateService.scheduledParticipantIds$;

  // 途中参加関連
  readonly addableCharacters$ = this.combatStateService.addableCharacters$;

  // 表示用コンバタントリスト (名前解決済み)
  readonly combatantsWithDetails$ = combineLatest([
    this.combatants$,
    this.charactersForSelection$.pipe(startWith([]))
  ]).pipe(
    map(([combatants, _]) => {
      return combatants.map(c => {
        const char = this.characterDataService.getGameCharacter(c.characterId);
        return {
          ...c,
          name: char ? char.name : '不明なキャラクター'
        };
      });
    }),
    shareReplay(1)
  );

  // 表示用参加予定者リスト (名前解決済み)
  readonly scheduledParticipantIdsWithDetails$ = combineLatest([
    this.scheduledParticipantIds$,
    this.charactersForSelection$.pipe(startWith([]))
  ]).pipe(
    map(([ids, _]) => {
      return ids.map(id => {
        const char = this.characterDataService.resolveCharacter(id);
        return {
          characterId: id,
          name: char ? char.name : '不明なキャラクター'
        };
      });
    }),
    shareReplay(1)
  );

  // 統合リスト
  readonly unifiedParticipantList$: Observable<UnifiedListItem[]>;

  constructor(
    private combatStateService: CombatStateService,
    private characterDataService: CharacterDataService,
    private pluginUiService: PluginUiService,
    private changeDetectorRef: ChangeDetectorRef
  ) {
    // 統合リストの構築
    this.unifiedParticipantList$ = combineLatest([
      this.isCombat$,
      this.combatantsWithDetails$,            // 戦闘中の参加者
      this.scheduledParticipantIdsWithDetails$, // 戦闘前の参加予定者
      this.addableCharacters$,                // 戦闘中の待機者 (途中参加候補)
      this.charactersForSelection$            // 戦闘前の全キャラ (ここから待機者を計算)
    ]).pipe(
      map(([isCombat, combatants, scheduled, addable, allChars]) => {
        const list: UnifiedListItem[] = [];

        if (isCombat) {
          // --- 戦闘中 ---
          // 1. 参加者
          combatants.forEach(c => {
            list.push({ type: 'participant', characterId: c.characterId, name: c.name, isParticipating: true });
          });
          
          // 2. セパレータ
          list.push({ type: 'separator' });

          // 3. 待機者 (途中参加候補)
          addable.forEach(c => {
            list.push({ type: 'standby', characterId: c.identifier, name: c.name, isParticipating: false });
          });

        } else {
          // --- 戦闘前 ---
          // 1. 参加予定者 (順序付き)
          scheduled.forEach(c => {
            list.push({ type: 'participant', characterId: c.characterId, name: c.name, isParticipating: true });
          });

          // 2. セパレータ
          list.push({ type: 'separator' });

          // 3. 待機者 (全キャラ - 参加予定者)
          const scheduledIds = new Set(scheduled.map(c => c.characterId));
          allChars.forEach(c => {
            if (!scheduledIds.has(c.identifier)) {
               list.push({ type: 'standby', characterId: c.identifier, name: c.name, isParticipating: false });
            }
          });
        }
        return list;
      }),
      shareReplay(1)
    );
  }

  // CombatStateServiceへの委譲メソッド群

  startCombat(): void {
    this.combatStateService.startCombat();
  }

  endCombat(): void {
    this.combatStateService.endCombat();
  }

  toggleAllCharacters(): void {
    this.combatStateService.toggleAllCharacters();
  }

  nextTurn(): void {
    this.combatStateService.nextTurn();
  }

  prevTurn(): void {
    this.combatStateService.prevTurn();
  }

  nextRound(): void {
    this.combatStateService.nextRound();
  }

  resetRound(): void {
    this.combatStateService.resetRound();
  }

  selectParticipantForReorder(characterId: string): void {
    this.combatStateService.selectParticipantForReorder(characterId);
  }

  moveParticipantUp(): void {
    this.combatStateService.moveParticipantUp();
  }

  moveParticipantDown(): void {
    this.combatStateService.moveParticipantDown();
  }

  toggleParticipantStatus(item: UnifiedListItem, event: MouseEvent): void {
    event.preventDefault(); 
    
    if (item.type === 'separator' || !item.characterId) return;

    if (item.isParticipating) {
      if (this.combatStateService.isCombat) {
        if (confirm(`${item.name} を戦闘から除外しますか？`)) {
          this.combatStateService.removeParticipant(item.characterId);
        }
      } else {
        this.combatStateService.toggleCharacterSelection(item.characterId);
      }
    } else {
      if (this.combatStateService.isCombat) {
        this.combatStateService.addParticipants([item.characterId]);
      } else {
        this.combatStateService.toggleCharacterSelection(item.characterId);
      }
    }
  }

  getCharacterName(characterId: string | null): string {
    if (!characterId) return 'なし';
    const char = this.characterDataService.resolveCharacter(characterId);
    return char ? char.name : '不明なキャラクター';
  }

  openBattleAction(characterId: string | null): void {
    this.pluginUiService.open(BattleActionComponent, {
      title: COMBAT_FLOW_UI_DEFAULTS.CONTROLLER.title,
      width: COMBAT_FLOW_UI_DEFAULTS.CONTROLLER.width,
      height: COMBAT_FLOW_UI_DEFAULTS.CONTROLLER.height,
      isSingleton: false,
      inputs: { initialCasterIdentifier: characterId }
    });
  }

  openHelp(event: MouseEvent): void {
    event.stopPropagation();
    this.pluginUiService.openAtCursor(CombatFlowManagerHelpComponent, {
      title: '戦況マネージャの操作ヘルプ',
      width: 320,
      height: 350,
      isSingleton: true
    });
  }
}
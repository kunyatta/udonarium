import { Component, OnInit, OnDestroy, NgZone, ChangeDetectorRef, ChangeDetectionStrategy, Input } from '@angular/core';
import { Subject, combineLatest, Observable } from 'rxjs';
import { take, filter, takeUntil, map, startWith, shareReplay } from 'rxjs/operators';
import { PluginUiService } from '../service/plugin-ui.service';
import { PluginHelperService } from '../service/plugin-helper.service';
import { PluginDataObserverService } from '../service/plugin-data-observer.service';
import { CombatStateService } from './combat-state.service';
import { CharacterDataService } from '../service/character-data.service';
import { CombatLogService } from './combat-log.service';
import { StatusEffectDictionaryService } from './status-effect-dictionary.service';
import { PluginDataContainer } from '../../class/plugin-data-container';
import { StatusEffect, ActiveStatusEffect } from './status-effect.model';
import { DICTIONARY_FILE_NAME_HINT, PLUGIN_ID } from './combat-flow.constants';
import { GameCharacter } from '@udonarium/game-character';
import { ChatTab } from '@udonarium/chat-tab';
import { ChatTabList } from '@udonarium/chat-tab-list';
import { DamageCheckPanelComponent } from './damage-check-panel.component';
import { CombatFlowControllerHelpComponent } from './combat-flow-controller-help.component';

@Component({
  selector: 'app-battle-action',
  templateUrl: './battle-action.component.html',
  styleUrls: ['./battle-action.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BattleActionComponent implements OnInit, OnDestroy {
  private _initialCasterIdentifier: string | null = null;
  @Input()
  set initialCasterIdentifier(value: string | null) {
    this._initialCasterIdentifier = value;
    this.applyInitialCaster();
  }
  get initialCasterIdentifier(): string | null {
    return this._initialCasterIdentifier;
  }

  // UI状態
  operationMode: 'statusEffect' | 'parameter' = 'parameter';
  selectedCasterId: string | null = null;
  selectedTargetIds: Set<string> = new Set();
  selectedParameterName: string | null = null;
  parameterValue: number = 0;
  selectedStatusEffectId: string | null = null;
  
  // データソース
  availableParameters: { key: string, name: string }[] = []; 
  statusEffectTemplates: StatusEffect[] = [];

  // ハイライト制御
  highlightCaster = false;
  highlightTarget = false;
  highlightAction = false;
  highlightValue = false;

  private readonly PLUGIN_ID = PLUGIN_ID;
  private readonly FILE_NAME_HINT = 'default'; // DictionaryService用
  private observer: { unsubscribe: () => void };
  private dictionaryContainer: PluginDataContainer | null = null;
  private unsubscribe$ = new Subject<void>();

  // ServiceからのObservable
  readonly isCombat$ = this.combatStateService.isCombat$;
  readonly combatants$ = this.combatStateService.combatants$;
  readonly scheduledParticipantIds$ = this.combatStateService.scheduledParticipantIds$;
  readonly charactersForSelection$ = this.combatStateService.charactersForSelection$;

  // 表示用データ生成
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

  readonly activeCasterCandidates$ = combineLatest([
    this.isCombat$,
    this.combatantsWithDetails$,
    this.scheduledParticipantIdsWithDetails$
  ]).pipe(
    map(([isCombat, combatants, scheduled]) => {
      return isCombat ? combatants : scheduled;
    }),
    shareReplay(1)
  );

  get availableChatTabs(): ChatTab[] {
    return ChatTabList.instance.chatTabs;
  }

  constructor(
    private combatStateService: CombatStateService,
    private pluginUiService: PluginUiService,
    private pluginHelper: PluginHelperService,
    private observerService: PluginDataObserverService,
    private dictionaryService: StatusEffectDictionaryService,
    private characterDataService: CharacterDataService,
    private combatLogService: CombatLogService,
    private ngZone: NgZone,
    private changeDetectorRef: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // 辞書読み込み
    this.dictionaryContainer = this.pluginHelper.getOrCreateContainer(this.PLUGIN_ID, DICTIONARY_FILE_NAME_HINT);
    this.observer = this.observerService.observe(
      this,
      this.PLUGIN_ID,
      DICTIONARY_FILE_NAME_HINT,
      container => {
        this.dictionaryContainer = container;
        this.updateTemplates();
        this.dictionaryService.loadDefaultDictionary(this.dictionaryContainer).then(() => {
          this.updateTemplates();
        });
      }
    );

    // 初期化時にも適用を試みる
    this.applyInitialCaster();

    // 戦闘開始時の術者自動選択
    this.combatStateService.isCombat$.pipe(
      filter(isCombat => isCombat),
      takeUntil(this.unsubscribe$)
    ).subscribe(() => {
      this.ngZone.run(() => {
        const combatants = this.combatStateService.combatants;
        const isSelectedValid = this.selectedCasterId && combatants.some(c => c.characterId === this.selectedCasterId);

        if (!isSelectedValid) {
          const currentId = this.combatStateService.currentCharacterId;
          const firstId = combatants.length > 0 ? combatants[0].characterId : null;
          const targetId = currentId || firstId;
          if (targetId) {
            this.selectedCasterId = targetId;
            this.onCasterChange();
          }
        }
        this.changeDetectorRef.markForCheck();
      });
    });
  }

  ngOnDestroy(): void {
    if (this.observer) this.observer.unsubscribe();
    this.unsubscribe$.next();
    this.unsubscribe$.complete();
  }

  // --- ロジック ---

  private updateTemplates(): void {
    if (!this.dictionaryContainer) return;
    this.statusEffectTemplates = this.dictionaryService.getTemplates(this.dictionaryContainer);
    this.changeDetectorRef.markForCheck();
  }

  private applyInitialCaster(): void {
    if (this.initialCasterIdentifier) {
      const char = this.characterDataService.resolveCharacter(this.initialCasterIdentifier);
      if (char) {
        const persistentId = this.characterDataService.ensurePersistentId(char);
        
        if (this.combatStateService.isCombat) {
          const combatants = this.combatStateService.combatants;
          if (combatants.some(c => c.characterId === persistentId)) {
            this.selectedCasterId = persistentId;
            this.onCasterChange(); 
            this.changeDetectorRef.markForCheck();
            return;
          }
        } else {
          this.scheduledParticipantIds$.pipe(take(1)).subscribe(ids => {
            if (ids.includes(persistentId)) {
              this.selectedCasterId = persistentId;
              this.onCasterChange();
              this.changeDetectorRef.markForCheck();
            } else {
              this.applyDefaultCaster();
            }
          });
          return;
        }
      }
    }
    this.applyDefaultCaster();
  }

  private applyDefaultCaster(): void {
    if (this.combatStateService.isCombat) {
      const currentId = this.combatStateService.currentCharacterId;
      if (currentId) {
        this.selectedCasterId = currentId;
        this.onCasterChange();
        this.changeDetectorRef.markForCheck();
      }
    } else {
      this.scheduledParticipantIds$.pipe(take(1)).subscribe(ids => {
        if (ids.length > 0) {
          this.selectedCasterId = ids[0];
          this.onCasterChange();
          this.changeDetectorRef.markForCheck();
        }
      });
    }
  }

  onCasterChange(): void {
    this.selectedTargetIds = new Set();
    this.selectedParameterName = null;
    this.parameterValue = 0;
    this.selectedStatusEffectId = null;
    this.updateAvailableParameters();
  }

  toggleTarget(characterId: string): void {
    if (this.selectedTargetIds.has(characterId)) {
      this.selectedTargetIds.delete(characterId);
    } else {
      this.selectedTargetIds.add(characterId);
    }
    this.selectedTargetIds = new Set(this.selectedTargetIds);
    this.updateAvailableParameters();
  }

  private updateAvailableParameters(): void {
    if (this.selectedTargetIds.size === 0) {
      this.availableParameters = [];
      this.selectedParameterName = null;
      return;
    }

    const targets: GameCharacter[] = [];
    this.selectedTargetIds.forEach(id => {
      const char = this.characterDataService.getGameCharacter(id);
      if (char) targets.push(char);
    });

    if (targets.length === 0) {
      this.availableParameters = [];
      this.selectedParameterName = null;
      return;
    }

    let commonParamList = this.characterDataService.getParameterList(targets[0]);
    for (let i = 1; i < targets.length; i++) {
      const targetParamList = this.characterDataService.getParameterList(targets[i]);
      const targetParamKeys = new Set(targetParamList.map(p => p.key));
      commonParamList = commonParamList.filter(p => targetParamKeys.has(p.key));
    }

    this.availableParameters = commonParamList.sort((a, b) => a.name.localeCompare(b.name, 'ja'));

    if (this.selectedParameterName && !this.availableParameters.some(p => p.key === this.selectedParameterName)) {
      this.selectedParameterName = null;
    }
  }

  applyParameterChange(): void {
    if (!this.selectedCasterId || this.selectedTargetIds.size === 0 || !this.selectedParameterName || this.parameterValue === 0) {
      return;
    }

    const targets = Array.from(this.selectedTargetIds).map(id => this.characterDataService.getGameCharacter(id)).filter(c => c !== null) as GameCharacter[];
    if (targets.length === 0) return;

    const elementName = this.selectedParameterName.split('.')[0];
    const config = this.combatStateService.getDamageCheckConfig();

    if (config.showDamageCheckPanel) {
      this.pluginUiService.openAtCursor(DamageCheckPanelComponent, {
        title: 'ダメージ・回復適用確認',
        width: 450,
        height: 300,
        layout: 'full-auto',
        isSingleton: true,
        inputs: {
          casterId: this.selectedCasterId,
          targets: targets,
          baseValue: this.parameterValue,
          targetParamName: elementName,
          config: config
        }
      });
    } else {
      const targetIds = Array.from(this.selectedTargetIds);
      this.combatStateService.applyParameterChange(
        this.selectedCasterId,
        targetIds,
        elementName,
        this.parameterValue
      );
    }
  }

  applyStatusEffect(): void {
    if (!this.selectedStatusEffectId || this.selectedTargetIds.size === 0) return;

    const effectTemplate = this.statusEffectTemplates.find(e => e.id === this.selectedStatusEffectId);
    if (!effectTemplate) return;

    const targets = Array.from(this.selectedTargetIds);
    targets.forEach(targetId => {
      this.combatStateService.addStatusEffect(targetId, effectTemplate);
    });

    const caster = this.selectedCasterId ? this.characterDataService.resolveCharacter(this.selectedCasterId) : null;
    const targetObjects = targets.map(id => this.characterDataService.resolveCharacter(id)).filter(c => c !== null) as GameCharacter[];
    if (targetObjects.length > 0) {
      this.combatLogService.logStatusEffectApply(caster, targetObjects, effectTemplate.name);
    }
  }

  // --- 表示用ヘルパー ---

  get selectedParameterDisplayName(): string {
    if (!this.selectedParameterName) return '';
    const param = this.availableParameters.find(p => p.key === this.selectedParameterName);
    return param ? param.name : this.selectedParameterName;
  }

  get selectedStatusEffectName(): string {
    if (!this.selectedStatusEffectId) return '';
    const effect = this.statusEffectTemplates.find(e => e.id === this.selectedStatusEffectId);
    return effect ? effect.name : '';
  }

  getCharacterName(characterId: string): string {
    const char = this.characterDataService.resolveCharacter(characterId);
    return char ? char.name : '不明なキャラクター';
  }

  getTargetNames(targetIds: Set<string>): string {
    if (targetIds.size === 0) return '[誰に]';
    if (targetIds.size === 1) {
      const id = targetIds.values().next().value;
      return this.getCharacterName(id);
    }
    return `${targetIds.size}体`;
  }

  get singleSelectedTargetId(): string | null {
    return this.selectedTargetIds.size === 1 ? this.selectedTargetIds.values().next().value : null;
  }

  getActiveStatusEffects(characterId: string | null): ActiveStatusEffect[] {
    if (!characterId) return [];
    return this.combatStateService.getActiveStatusEffects(characterId);
  }

  // --- ボタンアクション ---

  openHelp(event: MouseEvent): void {
    event.stopPropagation();
    this.pluginUiService.openAtCursor(CombatFlowControllerHelpComponent, {
      title: '戦闘操作クイックガイド',
      width: 340,
      height: 380,
      isSingleton: true
    });
  }

  onTargetSelectButtonClick(): void {
    if (!this.selectedCasterId) return;
    const caster = this.characterDataService.resolveCharacter(this.selectedCasterId);
    if (!caster) return;

    const targets = this.combatStateService.findTargetsFromChat(caster, this.availableChatTabs);
    if (targets.length > 0) {
      const targetIds = new Set<string>();
      targets.forEach(t => {
        const pid = t.detailDataElement.getFirstElementByName('_combat_flow_persistent_id')?.value.toString();
        if (pid) targetIds.add(pid);
      });
      if (targetIds.size > 0) {
        this.selectedTargetIds = targetIds;
        this.updateAvailableParameters();
        this.changeDetectorRef.markForCheck();
      }
    }
  }

  onDiceCopyButtonClick(): void {
    if (!this.selectedCasterId) return;
    const caster = this.characterDataService.resolveCharacter(this.selectedCasterId);
    if (!caster) return;

    const result = this.combatStateService.findDiceResultFromChat(caster, this.availableChatTabs);
    if (result !== null) {
      this.parameterValue = -result;
      this.changeDetectorRef.markForCheck();
    }
  }

  toggleParameterSign(): void {
    this.parameterValue = -this.parameterValue;
  }

  onAppliedEffectClick(effect: ActiveStatusEffect): void {
    const targetId = this.singleSelectedTargetId;
    if (!targetId) return;
    this.combatStateService.updateStatusEffectRound(targetId, effect.id, -1);
  }

  onAppliedEffectRightClick(event: MouseEvent, effect: ActiveStatusEffect): void {
    event.preventDefault();
    const targetId = this.singleSelectedTargetId;
    if (!targetId) return;
    this.combatStateService.updateStatusEffectRound(targetId, effect.id, 1);
  }
}
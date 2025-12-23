import { Component, OnInit, OnDestroy, ChangeDetectorRef, NgZone, Input, ViewChild, ElementRef } from '@angular/core';
import { GameCharacter } from '@udonarium/game-character';
import { ObjectStore } from '@udonarium/core/synchronize-object/object-store';
import { EventSystem, Network } from '@udonarium/core/system';
import { DataElement } from '@udonarium/data-element';
import { GameObjectInventoryService } from 'service/game-object-inventory.service';
import { ChatTab } from '@udonarium/chat-tab';
import { ChatTabList } from '@udonarium/chat-tab-list';
import { PeerCursor } from '@udonarium/peer-cursor';
import { ChatMessageService } from 'service/chat-message.service';
import { Observable, Subject, combineLatest, BehaviorSubject, of } from 'rxjs';
import { takeUntil, take, map, switchMap, distinctUntilChanged, filter } from 'rxjs/operators';

// 新しいデータモデルをインポート
import { CombatState } from './models/combat-state';
import { Combatant } from './models/combatant';
import { StatusEffect } from './models/status-effect';
import { StatusEffectDictionary } from './models/status-effect-dictionary';
import { StatusEffectEditorComponent } from './status-effect-editor.component';
import { COMBAT_FLOW_UI_DEFAULTS } from './combat-flow.plugin';
import { CombatFlowPanelComponent } from './combat-flow-panel.component';
import { PluginUiService, PluginPanelOption } from '../plugin-ui.service';
import { environment } from '../../../environments/environment';
import { PluginDataService } from '../plugin-data.service';
import { CombatLogService } from './combat-log.service';
import { ParticipantManager } from './participant-manager';
import { CombatStateService, CombatantViewModel } from './combat-state.service';
import { UiDependencyResolverService } from '../common/ui-dependency-resolver.service';
import { CharacterDataService } from '../common/character-data.service';
import { ReactiveDataService } from '../common/reactive-data.service';

import { PluginDataContainer } from '../../class/plugin-data-container';

// 保存するデータの全体像を示すインターフェース
export interface CombatFlowSaveData {
  // 戦闘のコア状態
  combatState: {
    isCombat: boolean;
    round: number;
    currentIndex: number;
    combatantPersistentIds: string[];
  };
  // 戦闘参加者の詳細リスト
  combatants: {
    characterPersistentId: string;
    initiative: number;
    hasActed: boolean;
    statusEffectPersistentIds: string[];
  }[];
  // ステータス効果の詳細リスト
  statusEffects?: {
    persistentId: string;
    identifier: string;
    name: string;
    emoji: string;
    icon?: string; // 後方互換性のためオプショナルで追加
    color: string;
    initialRounds: number; // ★ 追加
    remainingRounds: number;
    startRound: number;
    description: string;
    visualEffects: any;
    effects: any;
  }[];
  // ステータス効果の定義
  statusEffectDictionary?: {
    identifier: string;
    templates: string[];
  } | null;
  // 戦闘コントローラーのUI設定
  controllerSettings: {
    displayParameter: string;
    chatTabName: string;
  };
}

@Component({
  selector: 'app-combat-flow-controller',
  templateUrl: './combat-flow-controller.component.html',
  styleUrls: ['./combat-flow-controller.component.css']
})
export class CombatFlowControllerComponent implements OnInit, OnDestroy {

  @ViewChild('fileInput') fileInput: ElementRef;
  @Input() initialCasterId: string | null = null;

  isProduction: boolean = environment.production;
  activeTab: 'combat' | 'list' | 'settings' = 'combat'; // アクティブなタブを管理
  selectedCharacter: GameCharacter | null = null; // For order change

  get participantManager(): ParticipantManager { return this.combatStateService.participantManager; }
  get preCombatRound(): number { return this.combatStateService.preCombatRound; }
  set preCombatRound(value: number) { this.combatStateService.preCombatRound = value; }

  // --- 操作モード ---
  operationMode: 'statusEffect' | 'parameter' = 'parameter';

  // --- 行動宣言型UIのためのプロパティ ---

  // --- パラメータ操作UIのためのプロパティ ---
  availableParameters: { key: string, name: string }[] = [];
  selectedParameterName: string = '';
  parameterValue: number = 0;

  // --- チャット送信設定 ---
  get availableChatTabs(): ChatTab[] { return ChatTabList.instance.chatTabs; }

  // --- UIハイライト用 ---
  highlightCaster = false;
  highlightTarget = false;
  highlightAction = false;
  highlightValue = false;

  // --- For Add Participant UI ---
  isAddingParticipant: boolean = false;

  // --- Caster Selection State ---
  selectedCaster: GameCharacter | null = null;

  // --- Controller-Local State ---
  // MODIFICATION START (kunyatta) - State management refactoring
  private readonly selectedTargetIdsSubject = new BehaviorSubject<Set<string>>(new Set());
  readonly selectedTargetIds$ = this.selectedTargetIdsSubject.asObservable();

  private readonly selectedEffectIdSubject = new BehaviorSubject<string | null>(null);
  readonly selectedEffect$: Observable<StatusEffect | null>;

  messageTargetTabId: string = '';
  displayDataTags: string = '';
  // MODIFICATION END (kunyatta) - State management refactoring

  selectedTargets$: Observable<GameCharacter[]>;
  selectedTarget$: Observable<GameCharacter | null>;

  // --- テンプレート用統合データ ---
  viewData$: Observable<{
    viewModels: CombatantViewModel[]
  }>;

  get selectedParameterDisplayName(): string {
    const selectedParam = this.availableParameters.find(p => p.key === this.selectedParameterName);
    return selectedParam ? selectedParam.name : '[どのパラメータ]';
  }




  private readonly PLUGIN_ID = 'combat-flow-plugin';
  private readonly SAVE_DATA_KEY = 'combat-flow-data';

  private unsubscribe$ = new Subject<void>();

  constructor(
    private changeDetector: ChangeDetectorRef,
    private ngZone: NgZone,
    private inventoryService: GameObjectInventoryService,
    private pluginUiService: PluginUiService,
    private chatMessageService: ChatMessageService,
    private pluginDataService: PluginDataService,
    private combatLogService: CombatLogService,
    public combatStateService: CombatStateService,
    private uiResolver: UiDependencyResolverService,
    private characterDataService: CharacterDataService,
    private reactiveDataService: ReactiveDataService
    ) {
      // MODIFICATION START (kunyatta) - State management refactoring
      this.selectedEffect$ = this.selectedEffectIdSubject.pipe(
        switchMap(id => id ? this.reactiveDataService.observeObject<StatusEffect>(id) : of(null)),
        distinctUntilChanged()
      );
      // MODIFICATION END (kunyatta) - State management refactoring
     }

  ngOnInit(): void {
    // テンプレートで利用するデータをUIリゾルバで解決・統合
    this.viewData$ = this.uiResolver.resolve({
      viewModels: this.combatStateService.viewModels$
    });

    // チャット送信先の初期値を設定
    if (this.availableChatTabs.length > 0) {
      this.messageTargetTabId = this.availableChatTabs[0].identifier;
    }

    // Serviceに初期データの読み込みを依頼
    // ----- MODIFICATION START (Gemini) for PluginDataIndependence - MoveInitialize -----
    // this.combatStateService.initialize(); // プラグイン本体のinitializeメソッドに移管
    // ----- MODIFICATION END (Gemini) for PluginDataIndependence - MoveInitialize -----

    // 全キャラクターリストの変更を監視し、関連する状態をクリーンアップする
    this.combatStateService.charactersForParameter$.pipe(
      takeUntil(this.unsubscribe$)
    ).subscribe(allCharacters => {
      this.ngZone.run(() => {
        const characterIdentifiers = new Set(allCharacters.map(c => c.identifier));
        if (this.selectedCharacter && !characterIdentifiers.has(this.selectedCharacter.identifier)) {
          this.selectedCharacter = null;
        }
        this.changeDetector.markForCheck();
      });
    });

    // ChatTabの変更のみを監視
    EventSystem.register(this)
      .on('UPDATE_GAME_OBJECT', event => {
        this.ngZone.run(() => {
          const obj = ObjectStore.instance.get(event.data.identifier);
          if (obj instanceof ChatTab) {
            this.changeDetector.markForCheck();
          }
        });
      })
      .on('ADD_GAME_OBJECT', event => {
        this.ngZone.run(() => {
          const obj = ObjectStore.instance.get(event.data.identifier);
          if (obj instanceof ChatTab) {
            this.changeDetector.markForCheck();
          }
        });
      })
      .on('DELETE_GAME_OBJECT', event => {
        const className = (event.data as any).className;
        if (className === 'ChatTab') {
          this.ngZone.run(() => {
            if (this.messageTargetTabId === event.data.identifier && this.availableChatTabs.length > 0) {
              this.messageTargetTabId = this.availableChatTabs[0].identifier;
            }
            this.changeDetector.markForCheck();
          });
        }
      });

    // 初期術者を設定
    if (this.initialCasterId) {
      this.selectedCaster = ObjectStore.instance.get<GameCharacter>(this.initialCasterId);
    } else {
      this.autoSelectCaster();
    }

    // MODIFICATION START (kunyatta) - State management refactoring
    this.selectedTargets$ = this.selectedTargetIds$.pipe(
      map(ids => Array.from(ids).map(id => ObjectStore.instance.get<GameCharacter>(id)).filter(c => c))
    );

    this.selectedTarget$ = this.selectedTargetIds$.pipe(
      map(ids => ids.size === 1 ? ObjectStore.instance.get<GameCharacter>(Array.from(ids)[0]) : null)
    );
    // MODIFICATION END (kunyatta) - State management refactoring


    // 選択されたターゲットに応じて、利用可能なパラメータを更新する
    this.selectedTargets$.pipe(
      takeUntil(this.unsubscribe$)
    ).subscribe(targets => {
      this.selectedParameterName = '';
      if (targets.length === 0) {
        this.availableParameters = [];
        return;
      }

      // 共通パラメータをサービスから取得
      const commonParams = this.characterDataService.getCommonParameters(targets);

      // UI表示用に整形
      const uniqueParams = new Map<string, { key: string, name: string }>();
      for (const param of commonParams) {
        if (param.isNumberResource) {
          const keyCurrent = `${param.name}.currentValue`;
          if (!uniqueParams.has(keyCurrent)) {
            uniqueParams.set(keyCurrent, { key: keyCurrent, name: `${param.name} (現在値)` });
          }
          const keyMax = `${param.name}.value`;
          if (!uniqueParams.has(keyMax)) {
            uniqueParams.set(keyMax, { key: keyMax, name: `${param.name} (最大値)` });
          }
        } else if (param.isAbilityScore || param.isSimpleNumber) {
          const key = `${param.name}.value`;
          if (!uniqueParams.has(key)) {
            uniqueParams.set(key, { key: key, name: param.name });
          }
        }
      }

      this.availableParameters = Array.from(uniqueParams.values());

      if (this.availableParameters.length > 0) {
        this.selectedParameterName = this.availableParameters[0].key;
      }
      this.changeDetector.markForCheck();
    });
  }

  ngOnDestroy(): void {
    EventSystem.unregister(this);
    this.unsubscribe$.next();
    this.unsubscribe$.complete();
  }

  onTargetSelectButtonClick(): void {
    const caster = this.selectedCaster;
    if (!caster) {
      // 必要であればユーザーに通知
      return;
    }
    const foundTargets = this.combatStateService.findTargetsFromChat(caster, this.availableChatTabs);
    if (foundTargets.length > 0) {
      const targetIds = foundTargets.map(t => t.identifier);
      // MODIFICATION START (kunyatta) - State management refactoring
      this.selectedTargetIdsSubject.next(new Set(targetIds));
      // MODIFICATION END (kunyatta) - State management refactoring
      this.changeDetector.markForCheck();
    }
  }

  onDiceCopyButtonClick(): void {
    const caster = this.selectedCaster;
    if (!caster) {
      // 必要であればユーザーに通知
      return;
    }
    const result = this.combatStateService.findDiceResultFromChat(caster, this.availableChatTabs);
    if (result !== null) {
      this.parameterValue = -result;
      this.changeDetector.markForCheck();
    }
  }

  toggleParameterSign(): void {
    this.parameterValue = -this.parameterValue;
  }
  
  // --- (The rest of the methods remain unchanged) ---
  
  selectTargetForParam(character: GameCharacter): void {
    this.selectTarget(character);
    // TODO: パラメータ更新ロジックもServiceに移譲し、リアクティブに処理する必要がある
  }

  selectParameter(paramKey: string): void {
    if (this.selectedParameterName === paramKey) {
      this.selectedParameterName = '';
    } else {
      this.selectedParameterName = paramKey;
    }
  }

  applyParameterChange(): void {
    // selectedCaster$ の代わりに selectedCaster を直接参照
    const caster = this.selectedCaster;
    this.selectedTargets$.pipe(take(1)).subscribe(targets => {
      if (!caster || targets.length === 0 || !this.selectedParameterName || this.parameterValue === 0) {
        return;
      }
      this.combatStateService.applyParameterChange(
        caster,
        targets,
        this.selectedParameterName,
        this.parameterValue,
        this.selectedParameterDisplayName,
        {
          displayParameter: this.displayDataTags,
          chatTabName: ObjectStore.instance.get<ChatTab>(this.messageTargetTabId)?.name || ''
        }
      );

      // パラメータ選択をリセット
      this.selectedParameterName = '';
    });
  }

  // MODIFICATION START (kunyatta) - State management refactoring
  selectTarget(character: GameCharacter): void {
    const newSet = new Set(this.selectedTargetIdsSubject.value);
    if (newSet.has(character.identifier)) {
      newSet.delete(character.identifier);
    } else {
      newSet.add(character.identifier);
    }
    this.selectedTargetIdsSubject.next(newSet);
  }

  toggleSelectedEffect(effect: StatusEffect): void {
    const currentEffectId = this.selectedEffectIdSubject.value;
    if (currentEffectId === effect.identifier) {
      this.selectedEffectIdSubject.next(null); // 同じIDなら選択解除
    } else {
      this.selectedEffectIdSubject.next(effect.identifier);
    }
  }
  // MODIFICATION END (kunyatta) - State management refactoring

  applyStatusEffect(): void {
    // selectedCaster$ の代わりに selectedCaster を直接参照
    const caster = this.selectedCaster;
    combineLatest([
      // MODIFICATION START (kunyatta) - State management refactoring
      this.selectedEffect$,
      // MODIFICATION END (kunyatta) - State management refactoring
      this.selectedTargets$
    ]).pipe(take(1)).subscribe(([effect, targets]) => {
      console.log('[Controller] applyStatusEffect received:', { effect, caster, targets }); // デバッグログ
      if (!caster || targets.length === 0 || !effect) {
        return;
      }
      this.combatStateService.applyStatusEffect(
        caster,
        targets,
        effect,
        {
          displayParameter: this.displayDataTags,
          chatTabName: ObjectStore.instance.get<ChatTab>(this.messageTargetTabId)?.name || ''
        }
      );

      // MODIFICATION START (kunyatta) - State management refactoring
      this.selectedEffectIdSubject.next(null);
      // MODIFICATION END (kunyatta) - State management refactoring
    });
  }

  getStatusEffects(character: GameCharacter): StatusEffect[] {
    if (!character) return [];
    const combatant = this.combatStateService.findCombatantByCharacterId(character.identifier);
    if (!combatant) return [];
    return combatant.statusEffectIds
      .map(id => ObjectStore.instance.get<StatusEffect>(id))
      .filter(effect => effect);
  }


  // MODIFICATION START (kunyatta) - State management refactoring
  onCasterChange(): void {
    this.resetActionState();
  }

  private resetActionState(): void {
    this.selectedTargetIdsSubject.next(new Set());
    this.selectedEffectIdSubject.next(null);
    this.selectedParameterName = '';
    this.parameterValue = 0;
  }
  // MODIFICATION END (kunyatta) - State management refactoring

  private autoSelectCaster(): void {
    this.combatStateService.viewModels$.pipe(
      filter(viewModels => viewModels.length > 0), // viewModelsが空でないことを保証
      take(1)
    ).subscribe(viewModels => {
      const state = this.combatStateService.getState();
      if (state?.isCombat) {
        const activeCombatantId = state.combatantIds[state.currentIndex];
        if (activeCombatantId) {
          const activeCombatant = ObjectStore.instance.get<Combatant>(activeCombatantId);
          if (activeCombatant) {
            this.selectedCaster = ObjectStore.instance.get<GameCharacter>(activeCombatant.characterId);
          }
        }
      } else if (viewModels.length > 0) {
        this.selectedCaster = viewModels[0].character;
      }
    });
  }

  apply(): void {
    console.log(`[DEBUG ${new Date().toISOString()}] Controller.apply START`);
        const participants = this.participantManager.participants;
        this.combatStateService.apply(
          participants,
          this.preCombatRound,
          {
            displayParameter: this.displayDataTags,
            chatTabName: ObjectStore.instance.get<ChatTab>(this.messageTargetTabId)?.name || ''
          }
        );
    
        this.selectedParameterName = '';
        // MODIFICATION START (kunyatta) - State management refactoring
        this.selectedEffectIdSubject.next(null);
        // MODIFICATION END (kunyatta) - State management refactoring
      }
  selectCharacter(identifier: string): void {
    this.selectedCharacter = ObjectStore.instance.get<GameCharacter>(identifier);
  }

  upTabIndex(): void {
    if (!this.selectedCharacter) return;
    this.combatStateService.upTabIndex(
      this.selectedCharacter.identifier,
      {
        displayParameter: this.displayDataTags,
        chatTabName: ObjectStore.instance.get<ChatTab>(this.messageTargetTabId)?.name || ''
      }
    );
  }

  downTabIndex(): void {
    if (!this.selectedCharacter) return;
    this.combatStateService.downTabIndex(
      this.selectedCharacter.identifier,
      {
        displayParameter: this.displayDataTags,
        chatTabName: ObjectStore.instance.get<ChatTab>(this.messageTargetTabId)?.name || ''
      }
    );
  }

  prevTurn(): void {
    this.combatStateService.prevTurn({ 
      displayParameter: this.displayDataTags, 
      chatTabName: ObjectStore.instance.get<ChatTab>(this.messageTargetTabId)?.name || '' 
    });
  }

  /**
   * ラウンド数を1にリセットします。
   * 戦闘前は準備中のラウンド数を、戦闘中は現在のラウンド数をリセットします。
   */
  resetRound(): void {
    this.combatStateService.resetRound({ 
      displayParameter: this.displayDataTags, 
      chatTabName: ObjectStore.instance.get<ChatTab>(this.messageTargetTabId)?.name || '' 
    });
  }

  nextTurn(): void {
    this.combatStateService.nextTurn({ 
      displayParameter: this.displayDataTags, 
      chatTabName: ObjectStore.instance.get<ChatTab>(this.messageTargetTabId)?.name || '' 
    });
  }

  nextRound(): void {
    this.combatStateService.nextRound({ 
      displayParameter: this.displayDataTags, 
      chatTabName: ObjectStore.instance.get<ChatTab>(this.messageTargetTabId)?.name || '' 
    });
    // Service側でpreCombatRoundが変更されたことをUIに反映させる
    if (!this.combatStateService.getState()?.isCombat) {
      this.changeDetector.markForCheck();
    }
  }

  showPanelToAll(): void {
    EventSystem.call('SHOW_COMBAT_FLOW_PANEL', {});
  }

  closePanelForAll(): void {
    EventSystem.call('CLOSE_COMBAT_FLOW_PANEL', {});
  }

  endCombat(): void {
    this.combatStateService.endCombat({ 
      displayParameter: this.displayDataTags, 
      chatTabName: ObjectStore.instance.get<ChatTab>(this.messageTargetTabId)?.name || '' 
    });

    this.preCombatRound = 1; // 次の戦闘準備のためにリセット
    this.selectedParameterName = '';
    // MODIFICATION START (kunyatta) - State management refactoring
    this.selectedEffectIdSubject.next(null);
    // MODIFICATION END (kunyatta) - State management refactoring
  }

  openStatusEffectEditor(event: MouseEvent, effect?: StatusEffect): void {
    event.stopPropagation();
    this.combatStateService.openStatusEffectEditor(effect);
  }

  deleteStatusEffect(effect: StatusEffect): void {
    if (!effect) return;
    const confirmed = window.confirm(
      `ステータス効果「${effect.name}」を削除します。この操作は元に戻せません。よろしいですか？`
    );
    if (confirmed) {
      this.combatStateService.deleteStatusEffectTemplate(effect);
    }
  }

  exportDictionary(): void {
    const exportData = this.combatStateService.getExportableDictionary();
    if (!exportData) return;

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'status-effect-dictionary.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }


  onAppliedEffectClick(effect: StatusEffect): void {
    this.selectedTarget$.pipe(take(1)).subscribe(target => {
      if (!target) return;
      this.combatStateService.handleAppliedEffectClick(
        target,
        effect,
        {
          displayParameter: this.displayDataTags,
          chatTabName: ObjectStore.instance.get<ChatTab>(this.messageTargetTabId)?.name || ''
        }
      );
    });
  }

  /**
   * 付与済み効果が右クリックされたときの処理をハンドリングします。
   * 効果の持続時間を1増やします。永続効果の場合は何もしません。
   * @param event マウスイベント
   * @param effect 右クリックされた効果オブジェクト
   */
  onAppliedEffectRightClick(event: MouseEvent, effect: StatusEffect): void {
    event.preventDefault(); // コンテキストメニューの表示を抑制
    this.selectedTarget$.pipe(take(1)).subscribe(target => {
      if (!target) return;
      this.combatStateService.handleAppliedEffectRightClick(
        target,
        effect,
        {
          displayParameter: this.displayDataTags,
          chatTabName: ObjectStore.instance.get<ChatTab>(this.messageTargetTabId)?.name || ''
        }
      );
    });
  }

  /**
   * 指定された送信者情報でチャットメッセージを送信します。
   * @param message 送信するメッセージ本文
   * @param sender 送信者 (GameCharacter または PeerCursor)
   */

  /**
   * *ngForでViewModelのリストを効率的に描画するためのtrackBy関数です。
   * @param index インデックス
   * @param vm CombatantViewModelオブジェクト
   * @returns Combatantの一意な識別子
   */
  public trackByViewModel(index: number, vm: CombatantViewModel): string {
    return vm.combatant.identifier;
  }

  toggleAddParticipantMode(): void {
    // 「追加を実行する」ボタンが押された時の処理
    if (this.isAddingParticipant) {
      this.combatStateService.selectedParticipantIdsToAdd$.pipe(take(1)).subscribe(ids => {
        if (ids.size > 0) {
          this.combatStateService.addParticipants(
            Array.from(ids),
            {
              displayParameter: this.displayDataTags,
              chatTabName: ObjectStore.instance.get<ChatTab>(this.messageTargetTabId)?.name || ''
            }
          );
        }
      });
    }

    this.isAddingParticipant = !this.isAddingParticipant;

    // UIを閉じる際には、選択状態をクリアする
    if (!this.isAddingParticipant) {
      this.combatStateService.clearParticipantSelectionToAdd();
    }
  }

  importDictionaryClick(): void {
    this.fileInput.nativeElement.click();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) {
      return;
    }

    const file = input.files[0];
    const reader = new FileReader();

    reader.onload = () => {
      try {
        const json = JSON.parse(reader.result as string);
        if (!json.effects || !Array.isArray(json.effects)) {
          throw new Error('JSONの形式が正しくありません。"effects" 配列が含まれていません。');
        }

        const dictionary = ObjectStore.instance.get<StatusEffectDictionary>('StatusEffectDictionary');
        if (!dictionary) {
          throw new Error('ステータス効果辞書が見つかりません。');
        }

        const importedIds = new Set(json.effects.map(effectData => effectData.persistentId || effectData.identifier).filter(id => id));
        const currentTemplateIds = [...dictionary.templates];
        let deletedCount = 0;

        for (const templateId of currentTemplateIds) {
          const effect = ObjectStore.instance.get<StatusEffect>(templateId);
          if (effect && !importedIds.has(effect.persistentId)) {
            dictionary.templates = dictionary.templates.filter(id => id !== templateId);
            effect.destroy();
            deletedCount++;
          }
        }

        const createdEffects: StatusEffect[] = [];
        let addedCount = 0;
        let updatedCount = 0;
        let skippedCount = 0;

        for (const effectData of json.effects) {
          const persistentId = effectData.persistentId || effectData.identifier;
          const existingEffect = ObjectStore.instance.getObjects(StatusEffect).find(e => e.persistentId === persistentId);
          if (existingEffect) {
            updatedCount++;
          } else {
            addedCount++;
          }
          
          const createdEffect = StatusEffect.create(effectData);
          if (createdEffect) {
            createdEffects.push(createdEffect);
          } else {
            skippedCount++;
            if (existingEffect) updatedCount--; else addedCount--;
          }
        }

        dictionary.syncTemplates(createdEffects);

        alert(`辞書のインポートが完了しました。\n\n新規追加: ${addedCount}件\n更新: ${updatedCount}件\n削除: ${deletedCount}件\nスキップ: ${skippedCount}件`);
        this.combatStateService.saveDictionary();
      } catch (e) {
        console.error('JSONのパースに失敗しました。', e);
        alert('JSONファイルの読み込みに失敗しました。ファイルが壊れているか、形式が正しくありません。');
      }
    };

    reader.readAsText(file);
    // 同じファイルを連続で選択した場合にもchangeイベントを発火させるためのリセット
    input.value = '';
  }
}
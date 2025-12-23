import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, combineLatest, of, Subject } from 'rxjs';
import { map, switchMap, distinctUntilChanged, filter, take, startWith, pairwise, tap } from 'rxjs/operators';
import { GameCharacter } from '@udonarium/game-character';
import { ImageFile } from '@udonarium/core/file-storage/image-file';
import { StatusEffect } from './models/status-effect';
import { CombatState } from './models/combat-state';
import { Combatant } from './models/combatant';
import { StatusEffectDictionary } from './models/status-effect-dictionary';
import { ReactiveDataService } from '../common/reactive-data.service';
import { ReactiveImageService } from '../common/reactive-image.service';
import { PluginDataService } from '../plugin-data.service';
import { CombatFlowSaveData } from './combat-flow-controller.component';
import { CombatLogService } from './combat-log.service';
import { CombatFlowPanelComponent } from './combat-flow-panel.component';
import { PluginUiService, PluginPanelOption } from '../plugin-ui.service';
import { StatusEffectEditorComponent } from './status-effect-editor.component';
import { COMBAT_FLOW_UI_DEFAULTS } from './combat-flow.plugin';
import { CharacterDataService } from '../common/character-data.service';

export interface CombatantViewModel {
  combatant: Combatant;
  character: GameCharacter;
  image$: Observable<ImageFile>;
  statusEffects$: Observable<StatusEffect[]>;
}

import { ObjectStore } from '@udonarium/core/synchronize-object/object-store';
import { DataElement } from '@udonarium/data-element';
import { EventSystem } from '@udonarium/core/system';
import { PeerCursor } from '@udonarium/peer-cursor';
import { ChatMessageService } from 'service/chat-message.service';
import { GameObjectInventoryService } from 'service/game-object-inventory.service';
import { ChatTab } from '@udonarium/chat-tab';
import { ChatTabList } from '@udonarium/chat-tab-list';
import { ParticipantManager } from './participant-manager';



@Injectable()

export class CombatStateService {

  readonly state$: Observable<CombatState | null>;
  readonly isCombat$: Observable<boolean>;
  readonly round$: Observable<number>;
  readonly displayDataTags$: Observable<string>;
  readonly combatants$: Observable<Combatant[]>;
  readonly viewModels$: Observable<CombatantViewModel[]>;
  readonly activeViewModel$: Observable<CombatantViewModel | null>;
  readonly statusEffectTemplates$: Observable<StatusEffect[]>;
  readonly charactersForSelection$: Observable<GameCharacter[]>;
  readonly charactersForParameter$: Observable<GameCharacter[]>;
  readonly addableCharacters$: Observable<GameCharacter[]>;

  // --- Pre-Combat Selection State ---
  private readonly selectionSubject = new BehaviorSubject<{[key: string]: boolean}>({});
  readonly selection$ = this.selectionSubject.asObservable();
  readonly isAllSelected$: Observable<boolean>;
  readonly selectedCharacterCount$: Observable<number>;

  // --- Action Declaration State ---
  private readonly selectedEffectIdSubject = new BehaviorSubject<string | null>(null);
  readonly selectedEffect$: Observable<StatusEffect | null>;

  // --- UI Selection State ---
  private readonly selectedTargetIdsSubject = new BehaviorSubject<Set<string>>(new Set());
  readonly selectedTargetIds$ = this.selectedTargetIdsSubject.asObservable();

  // --- Add Participant State ---
  private readonly selectedParticipantIdsToAddSubject = new BehaviorSubject<Set<string>>(new Set());
  readonly selectedParticipantIdsToAdd$ = this.selectedParticipantIdsToAddSubject.asObservable();

  // --- Participant Manager ---
  participantManager: ParticipantManager = new ParticipantManager();

  private openPanelTrigger = new Subject<void>();
  public openPanel$ = this.openPanelTrigger.asObservable();

  preCombatRound: number = 1; // 戦闘前のラウンド数を管理

  messageTargetTabId: string = '';

  private readonly PLUGIN_ID = 'combat-flow-plugin';
  private readonly SAVE_DATA_KEY = 'combat-flow-data';
  private readonly DICTIONARY_SAVE_DATA_KEY = 'combat-flow-dictionary';


  constructor(

    private reactiveDataService: ReactiveDataService,
    private reactiveImageService: ReactiveImageService,
    private pluginDataService: PluginDataService,
    private combatLogService: CombatLogService,
    private chatMessageService: ChatMessageService,
    private inventoryService: GameObjectInventoryService,
    private pluginUiService: PluginUiService,
    private characterDataService: CharacterDataService

  ) {

        this.state$ = this.reactiveDataService.observeObject<CombatState>('CombatState');

    

        this.state$.subscribe(s => {

          console.log(`[DEBUG] state$ emitted: ${s ? `identifier=${s.identifier}, isCombat=${s.isCombat}` : 'null'}`)

        });

    

        this.isCombat$ = this.state$.pipe(

      map(state => state?.isCombat ?? false),

      distinctUntilChanged()

    );



    this.round$ = this.state$.pipe(
      map(state => state?.round ?? 1),
      distinctUntilChanged()
    );

    this.displayDataTags$ = this.state$.pipe(
      map(state => state?.displayDataTags ?? ''),
      distinctUntilChanged()
    );

    this.combatants$ = this.state$.pipe(
      switchMap(state => 
        !state || state.combatantIds.length === 0
          ? of([])
          : combineLatest(state.combatantIds.map(id => this.reactiveDataService.observeObject<Combatant>(id)))
      ),

      map(combatants => combatants.filter(c => c)), // filter out nulls

    );



    this.viewModels$ = this.combatants$.pipe(
      switchMap(combatants =>
        combatants.length === 0
          ? of([])
          : combineLatest(combatants.map(combatant => this.createViewModel(combatant)))
      )
    );



    this.activeViewModel$ = combineLatest([this.viewModels$, this.state$]).pipe(

      map(([viewModels, state]) => {

        if (!state || state.currentIndex < 0 || viewModels.length <= state.currentIndex) {

          return null;

        }

        return viewModels[state.currentIndex];

      })

    );

    this.statusEffectTemplates$ = this.reactiveDataService.observeObject<StatusEffectDictionary>('StatusEffectDictionary').pipe(
      switchMap(dictionary => 
        !dictionary || dictionary.templates.length === 0
          ? of([])
          : combineLatest(dictionary.templates.map(id => this.reactiveDataService.observeObject<StatusEffect>(id)))
      ),
      map(effects => effects.filter(e => e))
    );

    // 全キャラクターのリストをリアクティブに取得
    const allCharacters$ = this.reactiveDataService.observeObjects(GameCharacter);

    // 戦闘参加者選択用のキャラクターリスト (テーブル上にいるキャラクター)
    this.charactersForSelection$ = allCharacters$.pipe(
      map(characters => characters.filter(c => c.location.name === 'table'))
    );

    // パラメータ参照用のキャラクターリスト (墓場にいないキャラクター)
    this.charactersForParameter$ = allCharacters$.pipe(
      map(characters => characters.filter(c => c.location.name !== 'graveyard'))
    );

    // 途中参加可能なキャラクターリスト (テーブル上にいて、戦闘に参加していない)
    this.addableCharacters$ = combineLatest([this.charactersForSelection$, this.combatants$]).pipe(
      map(([charactersOnTable, combatants]) => {
        const combatantCharIds = new Set(combatants.map(c => c.characterId));
        return charactersOnTable.filter(char => !combatantCharIds.has(char.identifier));
      })
    );

    // isAllSelected$ の初期化
    this.isAllSelected$ = combineLatest([this.charactersForSelection$, this.selection$]).pipe(
      map(([chars, selection]) => chars.length > 0 && chars.every(char => selection[char.identifier]))
    );

    // selectedCharacterCount$ の初期化
    this.selectedCharacterCount$ = this.selection$.pipe(
      map(selection => Object.values(selection).filter(isSelected => isSelected).length),
      distinctUntilChanged()
    );

    // テーブル上のキャラクターリストが変更されたら、selectionマップをクリーンアップする
    this.charactersForSelection$.subscribe(charactersOnTable => {
      const currentSelection = this.selectionSubject.value;
      const newSelection = {};
      for (const character of charactersOnTable) {
        newSelection[character.identifier] = currentSelection[character.identifier] || false;
      }
      this.selectionSubject.next(newSelection);
    });

    // selection$ または charactersForSelection$ が変更されたら、participantManagerを自動で更新する
    combineLatest([this.charactersForSelection$, this.selection$]).subscribe(([characters, selection]) => {
      const selectedIds = new Set(Object.keys(selection).filter(id => selection[id]));
      this.updateParticipantSelection(characters, selectedIds);
    });

    // selectedEffect$ の初期化
    this.selectedEffect$ = this.selectedEffectIdSubject.pipe(
      switchMap(id => id ? this.reactiveDataService.observeObject<StatusEffect>(id) : of(null)),
      distinctUntilChanged()
    );

    // activeViewModel$ の変化を監視し、副作用（オーラとハイライト）をトリガーする
    this.activeViewModel$.pipe(
      startWith(null as CombatantViewModel | null), // 初回起動時にも対応
      pairwise(), // [previous, current] のペアを流す
      // takeUntil(this.unsubscribe$) // TODO: あとで有効化
    ).subscribe(([prevActiveVM, currActiveVM]) => {
      const prevCharacterId = prevActiveVM?.character.identifier;
      const currCharacterId = currActiveVM?.character.identifier;

      // 同一キャラクターへの変更でなければオーラを更新
      if (prevCharacterId !== currCharacterId) {
        this.updateTurnCharacterAura(currCharacterId, prevCharacterId);
      }
      
      // 現在のキャラクターをハイライト（同じキャラクリックでも再ハイライト）
      this.highlightCurrentCharacter(currCharacterId);
    });
      
          // CombatStateオブジェクトの存在を保証する
          this.state$.pipe(take(1)).subscribe(state => {
            if (!state) {
              const newState = new CombatState('CombatState');
              newState.initialize();
              ObjectStore.instance.add(newState);
            }
          });
        }

  /**
   * 選択されているステータス効果をトグルします。
   * @param effectId トグルする効果のID
   */
  public toggleSelectedEffect(effectId: string): void {
    const currentEffectId = this.selectedEffectIdSubject.value;
    if (currentEffectId === effectId) {
      this.selectedEffectIdSubject.next(null); // 同じIDなら選択解除
    } else {
      this.selectedEffectIdSubject.next(effectId);
    }
  }

  /**
   * 選択されているステータス効果を直接設定します。
   * @param effectId 設定する効果のID。選択を解除する場合はnull。
   */
  public setSelectedEffect(effectId: string | null): void {
    this.selectedEffectIdSubject.next(effectId);
  }

  /**
   * 選択された対象をトグルします。
   * @param characterId 対象として選択/選択解除されたキャラクターのID
   */
  public toggleTarget(characterId: string): void {
    const newSet = new Set(this.selectedTargetIdsSubject.value);
    if (newSet.has(characterId)) {
      newSet.delete(characterId);
    } else {
      newSet.add(characterId);
    }
    this.selectedTargetIdsSubject.next(newSet);
  }

  /**
   * 選択された対象を一度に設定します。
   * @param characterIds 対象として選択するキャラクターのID配列
   */
  public selectTargets(characterIds: string[]): void {
    this.selectedTargetIdsSubject.next(new Set(characterIds));
  }

  /**
   * 術者変更などに伴い、選択中の対象や効果をリセットします。
   */
  public resetActionState(): void {
    this.selectedTargetIdsSubject.next(new Set());
    this.selectedEffectIdSubject.next(null);
    // パラメータ関連のリセットもここに含まれるべきだが、それは後のリファクタリングで対応
  }

  /**
   * 指定されたキャラクターの選択状態を反転させます。
   * @param characterId 選択状態を反転させるキャラクターのID
   */
  public toggleCharacterSelection(characterId: string): void {
    const newSelection = { ...this.selectionSubject.value };
    newSelection[characterId] = !newSelection[characterId];
    this.selectionSubject.next(newSelection);
  }

  /**
   * 全キャラクターの選択状態を現在の逆の状態に設定します。
   * （全員選択されていれば全員解除、そうでなければ全員選択）
   */
  public toggleAllCharacters(): void {
    this.isAllSelected$.pipe(take(1)).subscribe(isAllSelected => {
      const selectAll = !isAllSelected;
      this.charactersForSelection$.pipe(take(1)).subscribe(chars => {
        const newSelection = {};
        for (const char of chars) {
          newSelection[char.identifier] = selectAll;
        }
        this.selectionSubject.next(newSelection);
      });
    });
  }

  public async restoreDictionary(): Promise<void> {
    const data = await this.pluginDataService.loadDataOnceAsync<any>(this.PLUGIN_ID, this.DICTIONARY_SAVE_DATA_KEY);
    if (!data) {
      return;
    }

    // =================================================================
    // フェーズ1：オブジェクトのプロパティ同期
    // =================================================================

    // 1-1. StatusEffect オブジェクトの同期
    const existingEffects = new Map(ObjectStore.instance.getObjects(StatusEffect).map(e => [e.persistentId, e]));

    if (data.statusEffects) {
      for (const effectData of data.statusEffects) {
        StatusEffect.create(effectData);
      }
    }

    // 1-2. StatusEffectDictionary オブジェクトの存在を保証
    if (data.statusEffectDictionary && !ObjectStore.instance.get('StatusEffectDictionary')) {
      const dict = new StatusEffectDictionary('StatusEffectDictionary');
      dict.initialize();
      ObjectStore.instance.add(dict);
    }

    // =================================================================
    // フェーズ2：リレーション（紐付け）の同期
    // =================================================================

    // 2-1. 最新の効果IDマップを作成
    const allEffects = ObjectStore.instance.getObjects(StatusEffect);
    const allEffectsMap = new Map(allEffects.map(e => [e.persistentId, e.identifier]));

    // 2-2. StatusEffectDictionary のリレーションを更新
    if (data.statusEffectDictionary) {
      const dict = ObjectStore.instance.get<StatusEffectDictionary>('StatusEffectDictionary');
      if (dict) {
        dict.templates = data.statusEffectDictionary.templates.map(pid => allEffectsMap.get(pid)).filter(id => id);
      }
    }
  }

  public async initialize(): Promise<void> {
    // ----- MODIFICATION START (Gemini) for PluginDataIndependence - UseLoadDataOnceAsync -----
    const saveData = await this.pluginDataService.loadDataOnceAsync<CombatFlowSaveData>(this.PLUGIN_ID, this.SAVE_DATA_KEY);
    if (saveData) {
      this._restoreFromData(saveData);
    }
    // ----- MODIFICATION END (Gemini) for PluginDataIndependence - UseLoadDataOnceAsync -----
  }

  /**
   * アクティブな戦闘参加者を設定します（手番の変更）。
   * @param combatantId クリックされた戦闘参加者のID
   */
  public setActiveCombatant(combatantId: string): void {
    const state = this.getState();
    if (!state || !state.isCombat || !combatantId) return;

    const combatants = state.combatantIds.map(id => ObjectStore.instance.get<Combatant>(id)).filter(c => c);
    const oldCharacterId = combatants[state.currentIndex]?.characterId;

    const index = combatants.findIndex(c => c.identifier === combatantId);
    if (index >= 0 && index !== state.currentIndex) {
      state.currentIndex = index;
      // オーラとハイライトはactiveViewModel$の購読側で自動的に処理される
    }
  }

  /**
   * 戦闘参加者の行動済みフラグをトグルします。
   * @param combatantId ダブルクリックされた戦闘参加者のID
   */
  public toggleActed(combatantId: string): void {
    const combatant = ObjectStore.instance.get<Combatant>(combatantId);
    if (combatant) {
      combatant.hasActed = !combatant.hasActed;
      // Note: hasActedの変更もリアルタイム同期されるため、saveData()は呼ばない。
    }
  }

  /**
   * UIから渡された選択状態に基づき、戦闘準備リスト（ParticipantManager）を更新します。
   * @param allCharacters テーブル上に存在するすべてのキャラクターのリスト
   * @param selectedIds UI上で選択されているキャラクターのIDのセット
   */
  public updateParticipantSelection(allCharacters: GameCharacter[], selectedIds: Set<string>): void {
    const managedIds = new Set(this.participantManager.getParticipantIds());

    // 選択解除されたキャラクターをParticipantManagerから削除
    for (const id of managedIds) {
      if (!selectedIds.has(id)) {
        this.participantManager.remove(id);
      }
    }

    // 新しく選択されたキャラクターをParticipantManagerに追加
    // allCharactersから完全なGameCharacterオブジェクトを検索して追加する
    const charsToAdd = allCharacters.filter(char => selectedIds.has(char.identifier) && !managedIds.has(char.identifier));
    for (const char of charsToAdd) {
      this.participantManager.add(char);
    }
  }



  private createViewModel(combatant: Combatant): Observable<CombatantViewModel> {

    const character$ = this.reactiveDataService.observeObject<GameCharacter>(combatant.characterId);



    const image$ = character$.pipe(

      switchMap(char => 
        char ? this.reactiveDataService.observeDataElement(char, 'image') : of(null)
      ),

      map(imageElement => imageElement ? imageElement.getFirstElementByName('imageIdentifier') : null),

      switchMap(imageIdentifierElement => 
        imageIdentifierElement?.value 
          ? this.reactiveImageService.observe(String(imageIdentifierElement.value))
          : of(null)
      )

    );



    const statusEffects$ = this.reactiveDataService.observeObject<Combatant>(combatant.identifier).pipe(

      switchMap(c => 
        !c || c.statusEffectIds.length === 0
          ? of([])
          : combineLatest(c.statusEffectIds.map(id => this.reactiveDataService.observeObject<StatusEffect>(id)))
      ),

      map(effects => effects.filter(e => e))

    );



    return character$.pipe(

      filter((char): char is GameCharacter => char != null),

      map(char => ({

        combatant: combatant,

        character: char,

        image$: image$,

        statusEffects$: statusEffects$

      }))

    );

  }

  private saveData(controllerSettings: { displayParameter: string, chatTabName: string }): void {
    const saveData = this.gatherSaveData(controllerSettings);
    this.pluginDataService.updateData(this.PLUGIN_ID, this.SAVE_DATA_KEY, saveData);
  }

  private gatherDictionarySaveData(): object | null {
    const dictionary = ObjectStore.instance.get<StatusEffectDictionary>('StatusEffectDictionary');
    if (!dictionary) return null;

    const templateEffectIds = new Set<string>(dictionary.templates);
    const allStatusEffects = Array.from(templateEffectIds)
      .map(id => ObjectStore.instance.get<StatusEffect>(id))
      .filter(effect => effect);

    return {
      statusEffects: allStatusEffects.map(e => ({
        persistentId: e.persistentId,
        identifier: e.identifier,
        name: e.name,
        emoji: e.emoji,
        color: e.color,
        initialRounds: e.initialRounds,
        description: e.description,
        visualEffects: e.visualEffects,
        effects: e.effects
      })),
      statusEffectDictionary: {
        identifier: dictionary.identifier,
        templates: dictionary.templates
          .map(id => ObjectStore.instance.get<StatusEffect>(id)?.persistentId)
          .filter(pid => pid)
      }
    };
  }

  public saveDictionary(): void {
    const dictionarySaveData = this.gatherDictionarySaveData();
    if (dictionarySaveData) {
      this.pluginDataService.updateData(this.PLUGIN_ID, this.DICTIONARY_SAVE_DATA_KEY, dictionarySaveData);
    }
  }

  private gatherSaveData(controllerSettings: { displayParameter: string, chatTabName: string }): CombatFlowSaveData | null {
    const state = this.getState();
    if (!state || !state.isCombat) return null; // Do not save if not in combat

    const combatantObjects = state.combatantIds
      .map(id => ObjectStore.instance.get<Combatant>(id))
      .filter(c => c);

    // 全ての戦闘参加者が持つStatusEffectのIDを重複なく収集
    const appliedEffectIds = new Set<string>();
    combatantObjects.forEach(c => {
      c.statusEffectIds.forEach(id => appliedEffectIds.add(id));
    });

    // 戦闘中に付与されている効果オブジェクトのみを収集
    const appliedStatusEffects = Array.from(appliedEffectIds)
      .map(id => ObjectStore.instance.get<StatusEffect>(id))
      .filter(effect => effect);
    
    const saveData: CombatFlowSaveData = {
      combatState: {
        isCombat: state.isCombat,
        round: state.round,
        currentIndex: state.currentIndex,
        combatantPersistentIds: combatantObjects.map(c => {
          const char = ObjectStore.instance.get<GameCharacter>(c.characterId);
          return char ? char.detailDataElement.getFirstElementByName('_combat_flow_persistent_id')?.value.toString() : '';
        }).filter(id => id)
      },
      combatants: combatantObjects.map(c => {
        const char = ObjectStore.instance.get<GameCharacter>(c.characterId);
        const persistentId = char ? char.detailDataElement.getFirstElementByName('_combat_flow_persistent_id')?.value.toString() : '';
        

        const mappedPersistentIds = c.statusEffectIds
            .map(id => {
                const effect = ObjectStore.instance.get<StatusEffect>(id);
                return effect?.persistentId;
            })
            .filter(pid => pid);

        return {
          characterPersistentId: persistentId,
          initiative: c.initiative,
          hasActed: c.hasActed,
          statusEffectPersistentIds: mappedPersistentIds
        };
      }),
      // 戦闘中に付与されている効果のデータのみを保存
      statusEffects: appliedStatusEffects.map(e => ({
        persistentId: e.persistentId,
        identifier: e.identifier,
        name: e.name,
        emoji: e.emoji,
        color: e.color,
        initialRounds: e.initialRounds,
        remainingRounds: e.remainingRounds,
        startRound: e.startRound,
        description: e.description,
        visualEffects: e.visualEffects,
        effects: e.effects
      })),
      controllerSettings: controllerSettings
    };

    return saveData;
  }



  // Public methods for state manipulation

  apply(participants: GameCharacter[], preCombatRound: number, controllerSettings: { displayParameter: string, chatTabName: string }): void {
    let combatState = ObjectStore.instance.get<CombatState>('CombatState');
    if (!combatState) {
      combatState = new CombatState('CombatState');
      combatState.initialize();
      ObjectStore.instance.add(combatState);
    }
    // 既存の戦闘参加者を全て削除
    combatState.combatantIds.forEach(id => {
      const combatant = ObjectStore.instance.get(id);
      if (combatant) combatant.destroy();
    });

    // 参加者がいない場合は戦闘を終了
    if (participants.length === 0) {
      combatState.isCombat = false;
      combatState.round = preCombatRound;
      combatState.currentIndex = -1;
      combatState.combatantIds = [];
      this.saveData(controllerSettings);
      return;
    }

    // 新しい戦闘参加者を作成
    const newCombatants: Combatant[] = [];
    for (const char of participants) {
      const persistentIdName = '_combat_flow_persistent_id';
      let idElement = char.detailDataElement.getFirstElementByName(persistentIdName);
      if (!idElement) {
        const newId = crypto.randomUUID();
        idElement = DataElement.create(persistentIdName, newId, { type: 'string' });
        char.detailDataElement.appendChild(idElement);
      }
      const combatant = new Combatant();
      combatant.characterId = char.identifier;
      // イニシアチブは手動または別の方法で設定されることを想定し、ここでは単純な値を入れる
      combatant.initiative = 0;
      combatant.initialize();
      ObjectStore.instance.add(combatant);
      newCombatants.push(combatant);
    }

    // 戦闘状態を更新
    combatState.isCombat = true;
    combatState.round = preCombatRound;
    combatState.currentIndex = 0;
    // ParticipantManagerの順序をそのまま採用する
    combatState.combatantIds = newCombatants.map(c => c.identifier);

    // チャットに戦闘開始を通知
    this.sendChatMessage('戦闘が開始されました。', PeerCursor.myCursor, controllerSettings.chatTabName);
    // データを保存
    this.saveData(controllerSettings);
    // パネルのリサイズを要求
    EventSystem.call('REQUEST_COMBAT_PANEL_RESIZE', {});
  }

  prevTurn(controllerSettings: { displayParameter: string, chatTabName: string }): void {
    const state = this.getState();
    if (!state || !state.isCombat) return;

    const oldCharacterId = state.combatantIds[state.currentIndex] ? ObjectStore.instance.get<Combatant>(state.combatantIds[state.currentIndex])?.characterId : null;

    state.currentIndex--;
    if (state.currentIndex < 0) {
      if (state.round > 1) {
        state.currentIndex = state.combatantIds.length - 1;
        state.round--;
      } else {
        state.currentIndex = 0;
      }
    }

    // オーラとハイライトはactiveViewModel$の購読側で自動的に処理される
    this.saveData(controllerSettings);
  }

  public resetRound(controllerSettings: { displayParameter: string, chatTabName: string }): void {
    const state = this.getState();
    if (state?.isCombat) {
      state.round = 1;
      this.saveData(controllerSettings);
    } else {
      this.preCombatRound = 1;
    }
  }

  nextTurn(controllerSettings: { displayParameter: string, chatTabName: string }): void {
    const state = this.getState();
    if (!state || !state.isCombat) return;

    const oldCharacterId = state.combatantIds[state.currentIndex] ? ObjectStore.instance.get<Combatant>(state.combatantIds[state.currentIndex])?.characterId : null;

    state.currentIndex++;
    if (state.currentIndex >= state.combatantIds.length) {
      this.nextRound(controllerSettings);
    } else {
      // オーラとハイライトはactiveViewModel$の購読側で自動的に処理される
      this.saveData(controllerSettings);
    }
  }

  nextRound(controllerSettings: { displayParameter: string, chatTabName: string }): void {
    const state = this.getState();
    if (state?.isCombat) {
      this.advanceRound(controllerSettings);
    } else {
      this.preCombatRound++;
    }
  }

  public advanceRound(controllerSettings: { displayParameter: string, chatTabName: string }): void {
    const state = this.getState();
    if (!state || !state.isCombat) return;

    const nextRound = state.round + 1;

    // ラウンド進行時に全効果のdurationを減らす
    for (const combatantId of state.combatantIds) {
      const combatant = ObjectStore.instance.get<Combatant>(combatantId);
      if (!combatant) continue;
      const currentEffects = combatant.statusEffectIds
        .map(id => ObjectStore.instance.get<StatusEffect>(id))
        .filter(effect => effect && effect.remainingRounds !== -1);
      for (const effect of currentEffects) {
        effect.remainingRounds -= 1;
      }
    }

    // ラウンド経過による効果消滅をチェックし、ログを送信
    for (const combatantId of state.combatantIds) {
      const combatant = ObjectStore.instance.get<Combatant>(combatantId);
      if (!combatant) continue;
      const character = ObjectStore.instance.get<GameCharacter>(combatant.characterId);
      if (!character) continue;
      const expiredEffects = this.getExpiredEffectsForRound(character, nextRound);
      for (const effect of expiredEffects) {
        this.sendEffectEndMessage(character, effect.name, controllerSettings.chatTabName);
      }
    }

    this.applyMechanicalEffects(nextRound);
    state.round = nextRound;

    state.currentIndex = 0;
    this.resetAllHasActed();
    // ----- MODIFICATION START (Gemini) for CombatTurnHighlight -----
    // オーラとハイライトはactiveViewModel$の購読側で自動的に処理される
    // ----- MODIFICATION END (Gemini) -----
    // ----- MODIFICATION START (Gemini) for RoundProgressionSave -----
    this.saveData(controllerSettings); // ラウンド進行の変更を保存
    // ----- MODIFICATION END (Gemini) for RoundProgressionSave -----
    const message = `ラウンド ${state.round} を開始します。`;
    this.sendChatMessage(message, PeerCursor.myCursor, controllerSettings.chatTabName);
  }

  private sendEffectEndMessage(target: GameCharacter, effectName: string, chatTabName: string): void {
    const messageText = this.combatLogService.buildEffectEndMessage(target, effectName);
    this.sendChatMessage(messageText, target, chatTabName); // 送信者を効果が切れたキャラクター自身にする
  }

  private applyMechanicalEffects(currentRound: number): void {
    const combatants = ObjectStore.instance.getObjects<Combatant>(Combatant);
    for (const combatant of combatants) {
      const character = ObjectStore.instance.get<GameCharacter>(combatant.characterId);
      if (!character || !character.detailDataElement) continue;
      const effectsToRemove: string[] = [];
      const activeEffects = combatant.statusEffectIds
        .map(id => ObjectStore.instance.get<StatusEffect>(id))
        .filter(effect => effect);
      for (const effect of activeEffects) {
        const isEffectActive = currentRound >= effect.startRound;
        const isEffectExpired = effect.remainingRounds !== -1 && effect.remainingRounds <= 0;
        if (isEffectActive && !isEffectExpired) {
          for (const mechanicalEffect of effect.effects) {
            if (mechanicalEffect.type === 'buffDebuff') continue;
            if (mechanicalEffect.type === 'attributeChange' && (mechanicalEffect.timing === 'everyRound' || mechanicalEffect.timing === undefined)) {
              const [paramName, property] = mechanicalEffect.target.split('.');
              const targetElement = character.detailDataElement.getFirstElementByName(paramName);
              if (targetElement && (property === 'currentValue' || property === 'value')) {
                const oldValue = Number(targetElement[property] || 0);
                const changeValue = mechanicalEffect.value;
                targetElement[property] = oldValue + changeValue;
              }
            }
          }
        }
        if (isEffectExpired) {
          for (const mechanicalEffect of effect.effects) {
            if (mechanicalEffect.type === 'buffDebuff') {
              const [paramName, property] = mechanicalEffect.target.split('.');
              const targetElement = character.detailDataElement.getFirstElementByName(paramName);
              if (targetElement && (property === 'currentValue' || property === 'value')) {
                const oldValue = Number(targetElement[property] || 0);
                const changeValue = mechanicalEffect.value;
                targetElement[property] = oldValue - changeValue;
              }
            }
          }
          effectsToRemove.push(effect.identifier);
        }
      }
      if (effectsToRemove.length > 0) {
        combatant.statusEffectIds = combatant.statusEffectIds.filter(id => !effectsToRemove.includes(id));
      }
    }
  }

  private sendChatMessage(message: string, sender: GameCharacter | PeerCursor, chatTabName: string): void {
    // const targetTab = ObjectStore.instance.get<ChatTab>(chatTabName);
    const targetTab = ChatTabList.instance.chatTabs.find(tab => tab.name === chatTabName);
    if (!targetTab) return;

    let color = PeerCursor.CHAT_DEFAULT_COLOR;
    let gameType = '';
    let isInverse = false;
    let isHollow = false;
    let isBlackPaint = false;
    const senderIdentifier = sender.identifier;

    if (sender instanceof GameCharacter) {
      const chatPalette = sender.chatPalette;
      color = (chatPalette && chatPalette.paletteColor) ? chatPalette.paletteColor : PeerCursor.CHAT_DEFAULT_COLOR;
      gameType = sender.detailDataElement.getFirstElementByName('dicebot')?.value.toString() || '';
      isInverse = sender.isInverse;
      isHollow = sender.isHollow;
      isBlackPaint = sender.isBlackPaint;
    } else if (sender instanceof PeerCursor) {
      color = sender.color;
    }

    this.chatMessageService.sendMessage(
      targetTab, message, gameType, senderIdentifier, undefined, color, isInverse, isHollow, isBlackPaint
    );
  }

  public downTabIndex(characterIdentifier: string, controllerSettings: { displayParameter: string, chatTabName: string }): void {
    const state = this.getState();
    // 戦闘前はParticipantManagerを直接操作する
    if (!state || !state.isCombat) {
      this.participantManager.moveDown(characterIdentifier);
      return;
    }

    const ids = [...state.combatantIds];
    const combatant = this.findCombatantByCharacterId(characterIdentifier);
    if (!combatant) return;
    const index = ids.indexOf(combatant.identifier);
    if (index >= 0 && index < ids.length - 1) {
      [ids[index], ids[index + 1]] = [ids[index + 1], ids[index]];
      state.combatantIds = ids;
      this.saveData(controllerSettings);
    }
  }

  public upTabIndex(characterIdentifier: string, controllerSettings: { displayParameter: string, chatTabName: string }): void {
    const state = this.getState();
    // 戦闘前はParticipantManagerを直接操作する
    if (!state || !state.isCombat) {
      this.participantManager.moveUp(characterIdentifier);
      return;
    }

    const ids = [...state.combatantIds];
    const combatant = this.findCombatantByCharacterId(characterIdentifier);
    if (!combatant) return;
    const index = ids.indexOf(combatant.identifier);
    if (index > 0) {
      [ids[index - 1], ids[index]] = [ids[index], ids[index - 1]];
      state.combatantIds = ids;
      this.saveData(controllerSettings);
    }
  }

  public removeStatusEffect(
    target: GameCharacter,
    effectToRemove: StatusEffect,
    controllerSettings: { displayParameter: string, chatTabName: string }
  ): void {
    if (!target || !effectToRemove) return;

    // 持続時間のある効果が手動で解除された場合のみログを送信する
    if (!this.isPermanentEffect(effectToRemove)) {
      this.sendEffectEndMessage(target, effectToRemove.name, controllerSettings.chatTabName);
    }

    const targetCombatant = this.findCombatantByCharacterId(target.identifier);
    if (!targetCombatant) return;

    // 効果によるパラメータ変更を元に戻す
    for (const mechanicalEffect of effectToRemove.effects) {
      if (mechanicalEffect.type === 'buffDebuff') {
        const [paramName, property] = mechanicalEffect.target.split('.');
        const targetElement = target.detailDataElement.getFirstElementByName(paramName);
        if (targetElement && (property === 'currentValue' || property === 'value')) {
          const oldValue = Number(targetElement[property] || 0);
          const changeValue = mechanicalEffect.value;
          targetElement[property] = oldValue - changeValue;
        }
      }
    }

    // 戦闘参加者から効果IDを削除
    targetCombatant.statusEffectIds = targetCombatant.statusEffectIds
      .filter(id => id !== effectToRemove.identifier);
    
    // 効果オブジェクト自体を破棄
    effectToRemove.destroy();

    // データを保存
    this.saveData(controllerSettings);
  }

  /**
   * 付与されたステータス効果がクリックされた際のロジックを処理します。
   * @param target 効果が付与されているキャラクター
   * @param effect クリックされた効果
   * @param controllerSettings 保存に必要なUI設定
   */
  public handleAppliedEffectClick(target: GameCharacter, effect: StatusEffect, controllerSettings: { displayParameter: string, chatTabName: string }): void {
    if (!target || !effect) return;
  
    // 永続効果または残り時間が1ラウンドの場合は、効果を削除します。
    if (this.isPermanentEffect(effect) || effect.remainingRounds === 1) {
      this.removeStatusEffect(target, effect, controllerSettings);
    }
    // 残り時間が2ラウンド以上ある場合は、持続時間を1減らします。
    else if (effect.remainingRounds > 1) {
      effect.remainingRounds -= 1;
      this.saveData(controllerSettings);
    }
  }

  /**
   * 付与されたステータス効果が右クリックされた際のロジックを処理します。
   * @param target 効果が付与されているキャラクター
   * @param effect 右クリックされた効果
   * @param controllerSettings 保存に必要なUI設定
   */
  public handleAppliedEffectRightClick(target: GameCharacter, effect: StatusEffect, controllerSettings: { displayParameter: string, chatTabName: string }): void {
    if (!target || !effect) return;

    // 永続効果でなければ持続時間を1増やす
    if (!this.isPermanentEffect(effect)) {
      effect.remainingRounds += 1;
      this.saveData(controllerSettings);
    }
  }

  public applyStatusEffect(
    caster: GameCharacter,
    targets: GameCharacter[],
    effect: StatusEffect,
    controllerSettings: { displayParameter: string, chatTabName: string }
  ): void {
    console.log('[Service] applyStatusEffect received:', { caster, targets, effect }); // デバッグログ
    if (!caster || targets.length === 0 || !effect) {
      return;
    }

    for (const target of targets) {
      console.log(`[Service] Processing target: ${target.name}`); // デバッグログ
      const targetCombatant = this.findCombatantByCharacterId(target.identifier);
      console.log(`[Service] Found combatant for ${target.name}:`, targetCombatant); // デバッグログ

      if (!targetCombatant) {
        console.error(`Target combatant not found for character: ${target.name}`);
        continue;
      }
      // Create a new StatusEffect instance from the template for each target
      const newEffect = new StatusEffect();
      newEffect.name = effect.name;
      newEffect.emoji = effect.emoji; // ★ emojiをコピー
      newEffect.icon = ''; // 古いプロパティはクリア
      newEffect.color = effect.color;
      newEffect.initialRounds = effect.initialRounds; // ★ 初期値をコピー
      newEffect.remainingRounds = effect.initialRounds; // ★ 残り時間も初期値で設定
      newEffect.description = effect.description;
      newEffect.visualEffects = JSON.parse(JSON.stringify(effect.visualEffects));
      newEffect.effects = JSON.parse(JSON.stringify(effect.effects));
      if (this.getState()) {
        newEffect.startRound = this.getState().round;
      }
      newEffect.initialize();
      console.log(`[Service] Created new effect for ${target.name}:`, newEffect); // デバッグログ
      ObjectStore.instance.add(newEffect);
      const newStatusEffectIds = [...targetCombatant.statusEffectIds, newEffect.identifier];
      targetCombatant.statusEffectIds = newStatusEffectIds;
      for (const mechanicalEffect of newEffect.effects) {
        if (mechanicalEffect.type === 'buffDebuff') {
          const [paramName, property] = mechanicalEffect.target.split('.');
          const targetElement = target.detailDataElement.getFirstElementByName(paramName);
          if (targetElement && (property === 'currentValue' || property === 'value')) {
            const oldValue = Number(targetElement[property] || 0);
            const changeValue = mechanicalEffect.value;
            targetElement[property] = oldValue + changeValue;
          }
        }
      }
    }

    const messageText = this.combatLogService.buildStatusEffectMessage(caster, targets, effect);
    this.sendChatMessage(messageText, caster, controllerSettings.chatTabName);

    this.saveData(controllerSettings);
  }

  public applyParameterChange(
    caster: GameCharacter,
    targets: GameCharacter[],
    parameterName: string,
    parameterValue: number,
    parameterDisplayName: string,
    controllerSettings: { displayParameter: string, chatTabName: string }
  ): void {
    if (!caster || targets.length === 0 || !parameterName || parameterValue === 0) {
      return;
    }

    // ロジックをCharacterDataServiceに委譲
    for (const target of targets) {
      this.characterDataService.applyParameterChange(target, parameterName, parameterValue);
    }

    // チャット送信処理
    const messageText = this.combatLogService.buildParameterChangeMessage(
      caster,
      targets,
      parameterDisplayName,
      parameterValue
    );
    this.sendChatMessage(messageText, caster, controllerSettings.chatTabName);

    // データを保存
    this.saveData(controllerSettings);
  }

  public endCombat(controllerSettings: { displayParameter: string, chatTabName: string }): void {
    const state = this.getState();
    if (!state || !state.isCombat) return; // 戦闘中でなければ何もしない

    // 戦闘終了時の並び順を次回の戦闘準備リストに反映させる
    const finalOrderedCharacters = state.combatantIds
      .map(combatantId => {
        const combatant = ObjectStore.instance.get<Combatant>(combatantId);
        return combatant ? ObjectStore.instance.get<GameCharacter>(combatant.characterId) : null;
      })
      .filter(character => character); // nullを除外

    // ParticipantManagerを新しいインスタンスで再構築
    const newParticipantManager = new ParticipantManager();
    for (const char of finalOrderedCharacters) {
      newParticipantManager.add(char);
    }
    this.participantManager = newParticipantManager;

    // 戦闘終了時に現在の手番キャラクターのオーラを元に戻す
    const currentCharacterId = state.combatantIds[state.currentIndex] ? ObjectStore.instance.get<Combatant>(state.combatantIds[state.currentIndex])?.characterId : null;
    this.updateTurnCharacterAura(null, currentCharacterId);

    const persistentIdName = '_combat_flow_persistent_id';
    state.combatantIds.forEach(id => {
      const combatant = ObjectStore.instance.get<Combatant>(id);
      if (combatant) {
        const character = ObjectStore.instance.get<GameCharacter>(combatant.characterId);
        if (character) {
          // キャラクターに付与した永続IDを削除
          const idElement = character.detailDataElement.getFirstElementByName(persistentIdName);
          if (idElement) {
            character.detailDataElement.removeChild(idElement);
          }
        }
        // 付与されていたステータス効果を全て削除
        combatant.statusEffectIds.forEach(effectId => {
          const effect = ObjectStore.instance.get(effectId);
          if (effect) effect.destroy();
        });
        combatant.destroy();
      }
    });

    // 戦闘状態をリセット
    state.isCombat = false;
    state.currentIndex = -1;
    state.combatantIds = [];
    state.round = 1; // ラウンド数を1にリセット

    // チャットに戦闘終了を通知
    this.sendChatMessage('戦闘は終了しました。', PeerCursor.myCursor, controllerSettings.chatTabName);
    // データを保存
    this.saveData(controllerSettings);
    // パネルを閉じるよう要求
    EventSystem.call('CLOSE_COMBAT_FLOW_PANEL', {});
  }

  /**
   * 指定された効果が永続効果（持続時間が-1）かどうかを判定します。
   * @param effect 判定する効果オブジェクト
   */
  public isPermanentEffect(effect: { initialRounds: number }): boolean {
    return effect.initialRounds === -1;
  }

  private _restoreFromData(data: CombatFlowSaveData): void {
    if (!data) {
      return;
    }
  
    // =================================================================
    // フェーズ1：オブジェクトのプロパティ同期
    // =================================================================
  
    // 1-1. StatusEffect オブジェクトの同期 (戦闘データに含まれるもののみ)
    const existingEffects = new Map(ObjectStore.instance.getObjects(StatusEffect).map(e => [e.persistentId, e]));
    if (data.statusEffects) {
      for (const effectData of data.statusEffects) {
        StatusEffect.create(effectData);
      }
    }
  
    // 1-2. Combatant オブジェクトの同期
    const characterIdMap = new Map<string, string>();
    for (const char of ObjectStore.instance.getObjects(GameCharacter)) {
      const pidElement = char.detailDataElement.getFirstElementByName('_combat_flow_persistent_id');
      if (pidElement) { characterIdMap.set(pidElement.value.toString(), char.identifier); }
    }
  
    if (data.combatants) {
      for (const combatantData of data.combatants) {
        const characterId = characterIdMap.get(combatantData.characterPersistentId);
        if (!characterId) continue;
        let combatant = ObjectStore.instance.getObjects(Combatant).find(c => c.characterId === characterId);
        if (!combatant) {
          combatant = new Combatant();
          ObjectStore.instance.add(combatant);
        }
        combatant.characterId = characterId;
        combatant.initiative = combatantData.initiative;
        combatant.hasActed = combatantData.hasActed;
        // ここでは statusEffectIds は更新しない
      }
    }
  
    // 1-3. CombatState オブジェクトのプロパティ同期
    let state = ObjectStore.instance.get<CombatState>('CombatState');
    if (!state) {
      state = new CombatState('CombatState');
      state.initialize();
      ObjectStore.instance.add(state);
    }
    if (data.combatState) {
      state.isCombat = data.combatState.isCombat;
      state.round = data.combatState.round;
      // ここでは combatantIds と currentIndex は更新しない
    }
  
    // =================================================================
    // フェーズ2：リレーション（紐付け）の同期
    // =================================================================
    // 全てのオブジェクトのプロパティが更新された後で、IDの関連付けを行う
  
    // 2-1. 最新の効果IDマップを作成
    const allEffectsMap = new Map(ObjectStore.instance.getObjects(StatusEffect).map(e => [e.persistentId, e.identifier]));
  
    // 2-2. Combatant のリレーションを更新
    if (data.combatants) {
      for (const combatantData of data.combatants) {
        const characterId = characterIdMap.get(combatantData.characterPersistentId);
        if (!characterId) continue;
        const combatant = ObjectStore.instance.getObjects(Combatant).find(c => c.characterId === characterId);
        if (combatant) {
          const newEffectIds = combatantData.statusEffectPersistentIds
            .map(pid => allEffectsMap.get(pid))
            .filter(id => id); // undefinedを除外
          combatant.statusEffectIds = newEffectIds;
        }
      }
    }
  
    // 2-3. CombatState のリレーションとプロパティを更新
    if (data.combatState) {
      const persistentIdToCombatantIdMap = new Map<string, string>();
      for (const combatant of ObjectStore.instance.getObjects(Combatant)) {
        const character = ObjectStore.instance.get<GameCharacter>(combatant.characterId);
        const persistentId = character?.detailDataElement.getFirstElementByName('_combat_flow_persistent_id')?.value as string;
        if (persistentId) { persistentIdToCombatantIdMap.set(persistentId, combatant.identifier); }
      }
      
      state.combatantIds = data.combatState.combatantPersistentIds
        .map(pid => persistentIdToCombatantIdMap.get(pid))
        .filter(id => id); // undefinedを除外
  
      state.currentIndex = data.combatState.currentIndex < state.combatantIds.length ? data.combatState.currentIndex : -1;
  
      if (state.isCombat) {
        setTimeout(() => this.openPanelTrigger.next(), 0);
      }
    }
  }

  public findCombatantByCharacterId(characterId: string): Combatant | null {
    const combatants = ObjectStore.instance.getObjects<Combatant>(Combatant);
    return combatants.find(c => c.characterId === characterId) || null;
  }

  private getExpiredEffectsForRound(character: GameCharacter, currentRound: number): StatusEffect[] {
    const combatant = this.findCombatantByCharacterId(character.identifier);
    if (!combatant) return [];
    return combatant.statusEffectIds
      .map(id => ObjectStore.instance.get<StatusEffect>(id))
      .filter(effect => effect && effect.remainingRounds !== -1 && effect.remainingRounds <= 0);
  }

  public getState(): CombatState | null {
    return ObjectStore.instance.get<CombatState>('CombatState');
  }

  private updateTurnCharacterAura(newCharacterId: string, oldCharacterId: string = null): void {
    // Restore aura of the previous character
    if (oldCharacterId && oldCharacterId !== newCharacterId) {
      const oldCharacter = ObjectStore.instance.get<GameCharacter>(oldCharacterId);
      if (oldCharacter) {
        const backupAuraElement = oldCharacter.detailDataElement.getFirstElementByName('turnAuraBackup');
        if (backupAuraElement) {
          oldCharacter.aura = Number(backupAuraElement.value) || -1;
          oldCharacter.detailDataElement.removeChild(backupAuraElement);
        } else {
          oldCharacter.aura = -1;
        }
      }
    }

    // Highlight aura of the new character
    if (newCharacterId) {
      const newCharacter = ObjectStore.instance.get<GameCharacter>(newCharacterId);
      if (newCharacter) {
        if (newCharacter.detailDataElement.getFirstElementByName('turnAuraBackup')) return;

        const currentAura = newCharacter.aura;
        const backupElement = DataElement.create('turnAuraBackup', currentAura.toString(), {});
        newCharacter.detailDataElement.appendChild(backupElement);

        const HIGHLIGHT_AURA_YELLOW = 6;
        const HIGHLIGHT_AURA_ALT = 7;

        if (currentAura === HIGHLIGHT_AURA_YELLOW) {
          newCharacter.aura = HIGHLIGHT_AURA_ALT;
        } else {
          newCharacter.aura = HIGHLIGHT_AURA_YELLOW;
        }
      }
    }
  }

  private highlightCurrentCharacter(characterId: string): void {
    if (!characterId) return;
    const character = ObjectStore.instance.get<GameCharacter>(characterId);
    if (character) {
      EventSystem.trigger('SELECT_TABLETOP_OBJECT', {
        identifier: character.identifier,
        className: character.aliasName,
        highlighting: false
      });
    }
  }

  private resetAllHasActed(): void {
    const state = this.getState();
    if (!state) return;
    for (const combatantId of state.combatantIds) {
      const combatant = ObjectStore.instance.get<Combatant>(combatantId);
      if (combatant) {
        combatant.hasActed = false;
      }
    }
  }

  /**
   * チャットログを解析し、指定された術者の直近の発言に含まれるキャラクターをターゲットとして返します。
   * @param caster 術者となるキャラクター
   * @param availableChatTabs 解析対象のチャットタブ
   * @returns ターゲット候補のキャラクター配列
   */
  public findTargetsFromChat(caster: GameCharacter, availableChatTabs: ChatTab[]): GameCharacter[] {
    if (!caster) return [];

    const combatantCharacters = this.getState()?.combatantIds.map(id => 
      ObjectStore.instance.get<Combatant>(id)?.characterId
    ).map(charId => 
      ObjectStore.instance.get<GameCharacter>(charId)
    ).filter(char => char) ?? [];

    if (combatantCharacters.length === 0) return [];

    const casterMessages = availableChatTabs
      .flatMap(tab => tab.chatMessages.slice(-50))
      .filter(msg => msg.name === caster.name)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 10);

    for (const msg of casterMessages) {
      const messageValue = msg.value;
      if (typeof messageValue === 'string') {
        const foundTargets = combatantCharacters.filter(character => messageValue.includes(character.name));
        if (foundTargets.length > 0) {
          return foundTargets; // 最初に見つかったメッセージのターゲットを返す
        }
      }
    }

    return []; // 見つからなかった場合は空配列を返す
  }

  /**
   * チャットログを解析し、指定された術者の直近のダイスロール結果を数値として返します。
   * @param caster 術者となるキャラクター
   * @param availableChatTabs 解析対象のチャットタブ
   * @returns ダイス結果の合計値。見つからなければnull。
   */
  public findDiceResultFromChat(caster: GameCharacter, availableChatTabs: ChatTab[]): number | null {
    if (!caster) return null;

    const allMessages = availableChatTabs.flatMap(tab => tab.chatMessages.slice(-50));
    allMessages.sort((a, b) => b.timestamp - a.timestamp);

    const bcdiceMessage = allMessages.find(msg => 
      msg.from === 'System-BCDice' && msg.name.includes(caster.name)
    );

    if (bcdiceMessage && typeof bcdiceMessage.value === 'string') {
      const match = bcdiceMessage.value.match(/→\s*(\d+)$/);
      if (match && match[1]) {
        return parseInt(match[1], 10);
      }
    }

    return null;
  }

  /**
   * 指定されたステータス効果テンプレートを辞書から削除し、オブジェクトを破棄します。
   * @param effect 削除するステータス効果オブジェクト
   */
  public deleteStatusEffectTemplate(effect: StatusEffect): void {
    if (!effect) return;

    const dictionary = ObjectStore.instance.get<StatusEffectDictionary>('StatusEffectDictionary');
    if (dictionary) {
      dictionary.templates = dictionary.templates.filter(id => id !== effect.identifier);
    }
    effect.destroy();
    this.saveDictionary();
  }

  /**
   * エクスポート用のステータス効果辞書データを生成します。
   * @returns エクスポート用のデータオブジェクト。辞書が存在しない場合はnull。
   */
  public getExportableDictionary(): object | null {
    const dictionary = ObjectStore.instance.get<StatusEffectDictionary>('StatusEffectDictionary');
    if (!dictionary) {
      console.warn('ステータス効果辞書が見つからないため、エクスポートできませんでした。');
      return null;
    }

    const effects = dictionary.templates
      .map(id => ObjectStore.instance.get<StatusEffect>(id))
      .filter(effect => effect)
      .map(effect => ({
        persistentId: effect.persistentId,
        identifier: effect.identifier,
        name: effect.name,
        emoji: effect.emoji,
        initialRounds: effect.initialRounds,
        description: effect.description,
        visualEffects: effect.visualEffects,
        effects: effect.effects
      }));

    return {
      effects: effects,
      dictionary: {
        identifier: dictionary.identifier,
        templates: dictionary.templates
      }
    };
  }

  public openStatusEffectEditor(effect?: StatusEffect): void {
    const title = effect ? 'ステータス効果の編集' : 'ステータス効果の新規作成';
    const option: PluginPanelOption = {
      title: title,
      width: COMBAT_FLOW_UI_DEFAULTS.STATUS_EFFECT_EDITOR.width,
      height: COMBAT_FLOW_UI_DEFAULTS.STATUS_EFFECT_EDITOR.height,
      panelType: 'child'
    };
    // pluginUiService.open は子コンポーネントのインスタンス (T型) を直接返すため、そのように受け取ります。
    const editor = this.pluginUiService.open(StatusEffectEditorComponent, option); // MODIFICATION (Gemini) - pluginUiService.openの戻り値に合わせる
    editor.statusEffect = effect ? effect : null; // MODIFICATION (Gemini) - instanceに直接設定
    this.charactersForParameter$.pipe(take(1)).subscribe(chars => {
      editor.characterSource = chars; // MODIFICATION (Gemini) - instanceに直接設定
    });
  }

  // --- Methods for Add Participant State ---
  public toggleParticipantSelectionToAdd(characterId: string): void {
    const newSet = new Set(this.selectedParticipantIdsToAddSubject.value);
    if (newSet.has(characterId)) {
      newSet.delete(characterId);
    } else {
      newSet.add(characterId);
    }
    this.selectedParticipantIdsToAddSubject.next(newSet);
  }

  public clearParticipantSelectionToAdd(): void {
    this.selectedParticipantIdsToAddSubject.next(new Set());
  }

  public addParticipants(characterIds: string[], controllerSettings: { displayParameter: string, chatTabName: string }): void {
    const state = this.getState();
    if (!state || !state.isCombat || characterIds.length === 0) return;

    const newCombatants: Combatant[] = [];
    const newCharacters: GameCharacter[] = [];

    for (const charId of characterIds) {
      const char = ObjectStore.instance.get<GameCharacter>(charId);
      if (!char) continue;

      newCharacters.push(char);

      // 永続IDを付与
      const persistentIdName = '_combat_flow_persistent_id';
      let idElement = char.detailDataElement.getFirstElementByName(persistentIdName);
      if (!idElement) {
        const newId = crypto.randomUUID();
        idElement = DataElement.create(persistentIdName, newId, { type: 'string' });
        char.detailDataElement.appendChild(idElement);
      }

      // 新しいCombatantオブジェクトを生成
      const combatant = new Combatant();
      combatant.characterId = char.identifier;
      combatant.initiative = 0; // イニシアチブは一旦0で追加
      combatant.initialize();
      ObjectStore.instance.add(combatant);
      newCombatants.push(combatant);
    }

    if (newCombatants.length === 0) return;

    // CombatStateを更新
    state.combatantIds = [...state.combatantIds, ...newCombatants.map(c => c.identifier)];

    // チャットに通知
    const characterNames = newCharacters.map(c => c.name).join('、');
    this.sendChatMessage(`キャラクター「${characterNames}」が戦闘に参加しました。`, PeerCursor.myCursor, controllerSettings.chatTabName);

    // データを保存
    this.saveData(controllerSettings);

    // パネルのリサイズを要求
    EventSystem.call('REQUEST_COMBAT_PANEL_RESIZE', {});
  }
}

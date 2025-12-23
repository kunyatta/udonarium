import { Injectable, NgZone } from '@angular/core';
import { Observable, BehaviorSubject, combineLatest, of } from 'rxjs';
import { map, distinctUntilChanged, switchMap, startWith, take } from 'rxjs/operators';

import { ObjectStore } from '@udonarium/core/synchronize-object/object-store';
import { GameCharacter } from '@udonarium/game-character';
import { EventSystem } from '@udonarium/core/system';

import { PluginDataContainer } from '../../class/plugin-data-container';
import { PluginHelperService } from '../service/plugin-helper.service';
import { PluginDataObserverService } from '../service/plugin-data-observer.service';
import { TurnBasedEngineService } from '../service/turn-based-engine.service';
import { Combatant } from './combatant.model';
import { DataElement } from '@udonarium/data-element';
import { CharacterDataService } from '../service/character-data.service';
import { ActiveStatusEffect, StatusEffect } from './status-effect.model';
import { StatusEffectDictionaryService } from './status-effect-dictionary.service';
import { CombatLogService } from './combat-log.service';
import { ChatTab } from '@udonarium/chat-tab';
import { ChatTabList } from '@udonarium/chat-tab-list';
import { PLUGIN_ID, FILE_NAME_HINT, PERSISTENT_ID_TAG, DEFAULT_DAMAGE_CHECK_CONFIG } from './combat-flow.constants';

@Injectable({
  providedIn: 'root'
})
export class CombatStateService {
  // コンテナへの参照（Observerによって更新される）
  private container: PluginDataContainer | null = null;

  // --- State Observables ---
  // コンテナの状態を反映するBehaviorSubject
  private _isCombat$ = new BehaviorSubject<boolean>(false);
  private _round$ = new BehaviorSubject<number>(1);
  private _currentIndex$ = new BehaviorSubject<number>(0);
  private _combatants$ = new BehaviorSubject<Combatant[]>([]);
  private _displayDataTags$ = new BehaviorSubject<string>('HP MP'); // 初期値を'HP MP'に変更

  readonly isCombat$ = this._isCombat$.asObservable();
  readonly round$ = this._round$.asObservable();
  readonly currentIndex$ = this._currentIndex$.asObservable();
  readonly combatants$ = this._combatants$.asObservable();
  readonly displayDataTags$ = this._displayDataTags$.asObservable(); // 追加

  private _systemLogSenderName = new BehaviorSubject<string>('');
  readonly systemLogSenderName$ = this._systemLogSenderName.asObservable();

  // 派生データ: 現在の手番のキャラクターID
  readonly currentCharacterId$ = combineLatest([this._currentIndex$, this._combatants$]).pipe(
    map(([index, combatants]) => {
      if (combatants.length === 0 || index < 0 || index >= combatants.length) return null;
      return combatants[index].characterId;
    }),
    distinctUntilChanged()
  );

  // --- Synchronous State Accessors ---
  get isCombat(): boolean { return this._isCombat$.value; }
  get round(): number { return this._round$.value; }
  get currentIndex(): number { return this._currentIndex$.value; }
  get combatants(): Combatant[] { return this._combatants$.value; }

  // 同期的に現在の手番キャラクターIDを取得する
  get currentCharacterId(): string | null {
    const combatants = this.combatants;
    const index = this.currentIndex;
    if (combatants.length === 0 || index < 0 || index >= combatants.length) return null;
    return combatants[index].characterId;
  }

  // --- Synchronous System Log Sender Accessor ---
  get systemLogSenderName(): string { return this._systemLogSenderName.value; }
  setSystemLogSenderName(name: string): void { this.saveSystemLogSenderName(name); }

  // --- Pre-Combat Selection State ---
  private readonly _selectionSubject = new BehaviorSubject<{[key: string]: boolean}>({});
  readonly selection$: Observable<{[key: string]: boolean}> = this._selectionSubject.asObservable();
  readonly isAllSelected$: Observable<boolean>;
  readonly selectedCharacterCount$: Observable<number>;
  readonly charactersForSelection$: Observable<GameCharacter[]>; // All characters on table

  // --- Participant Reordering State ---
  private readonly _selectedParticipantIdForReorderSubject = new BehaviorSubject<string | null>(null);
  readonly selectedParticipantIdForReorder$: Observable<string | null> = this._selectedParticipantIdForReorderSubject.asObservable();
  
  // --- Scheduled Participants State (Pre-Combat) ---
  private readonly _scheduledParticipantIdsSubject = new BehaviorSubject<string[]>([]);
  readonly scheduledParticipantIds$: Observable<string[]> = this._scheduledParticipantIdsSubject.asObservable();

  // --- Pre-Combat Round State ---
  private readonly _preCombatRound$ = new BehaviorSubject<number>(1);
  readonly preCombatRound$ = this._preCombatRound$.asObservable();

  // --- Add Participant State (途中参加) ---
  private readonly _selectedParticipantIdsToAddSubject = new BehaviorSubject<Set<string>>(new Set());
  readonly selectedParticipantIdsToAdd$: Observable<Set<string>> = this._selectedParticipantIdsToAddSubject.asObservable();
  readonly addableCharacters$: Observable<GameCharacter[]>; // 戦闘に参加していないテーブル上のキャラクター

  constructor(
    private pluginHelper: PluginHelperService,
    private observerService: PluginDataObserverService,
    private turnEngine: TurnBasedEngineService,
    private characterDataService: CharacterDataService,
    private dictionaryService: StatusEffectDictionaryService,
    private combatLogService: CombatLogService,
    private ngZone: NgZone
  ) {
    this.initialize();

    // --- キャラクター選択関連の初期化 ---
    const characterUpdateTrigger$ = new BehaviorSubject<void>(undefined);

    // GameCharacterの追加/削除、XMLロード時にトリガーを発火
    EventSystem.register(this)
      .on('ADD_GAME_OBJECT', event => {
        if (event.data.aliasName === GameCharacter.aliasName) {
          characterUpdateTrigger$.next();
        }
      })
      .on('DELETE_GAME_OBJECT', event => {
        if (event.data.aliasName === GameCharacter.aliasName) {
          characterUpdateTrigger$.next();
        }
      })
      .on('XML_LOADED', () => characterUpdateTrigger$.next());

    // テーブル上に存在するキャラクターのリスト
    const allTabletopCharacters$ = characterUpdateTrigger$.pipe(
      startWith(null), // 初期ロードをトリガー
      map(() => ObjectStore.instance.getObjects<GameCharacter>(GameCharacter)),
      map(characters => characters.filter(char => char.location.name === 'table')),
      distinctUntilChanged((prev, curr) => JSON.stringify(prev.map(c => c.identifier)) === JSON.stringify(curr.map(c => c.identifier))),
    );
    this.charactersForSelection$ = allTabletopCharacters$; // 戦闘開始前の選択リスト

    // 選択中のキャラクターがテーブルからいなくなったら、選択解除する
    this.charactersForSelection$.subscribe(charsOnTable => {
      const currentSelection = this._selectionSubject.value;
      const newSelection: {[key: string]: boolean} = {};
      const charIdsOnTable = new Set(charsOnTable.map(c => c.identifier));
      
      for (const charId in currentSelection) {
        if (charIdsOnTable.has(charId)) {
          newSelection[charId] = currentSelection[charId];
        }
      }
      this._selectionSubject.next(newSelection);
    });

    // 全選択されているかどうかのフラグ
    this.isAllSelected$ = combineLatest([this.charactersForSelection$, this.selection$]).pipe(
      map(([chars, selection]) => chars.length > 0 && chars.every(char => selection[char.identifier] === true)),
      distinctUntilChanged()
    );

    // 選択状態の変更を監視し、参加予定者リスト(scheduledParticipantIds)を更新する
    this.selection$.subscribe(selection => {
      const currentScheduledIds = this._scheduledParticipantIdsSubject.value;
      const selectedIdsSet = new Set(Object.keys(selection).filter(id => selection[id]));

      // 1. 選択解除されたものをリストから削除 (順序維持)
      let newScheduledIds = currentScheduledIds.filter(id => selectedIdsSet.has(id));

      // 2. 新しく選択されたものをリストの末尾に追加
      const newIdsToAdd = Array.from(selectedIdsSet).filter(id => !newScheduledIds.includes(id));
      newScheduledIds = [...newScheduledIds, ...newIdsToAdd];

      // 変更があれば通知
      if (newScheduledIds.length !== currentScheduledIds.length || newScheduledIds.some((id, i) => id !== currentScheduledIds[i])) {
        this._scheduledParticipantIdsSubject.next(newScheduledIds);
      }
    });

    // 選択されているキャラクターの数
    this.selectedCharacterCount$ = this.selection$.pipe(
      map(selection => Object.values(selection).filter(isSelected => isSelected).length),
      distinctUntilChanged()
    );

    // --- 途中参加関連の初期化 ---
    this.addableCharacters$ = combineLatest([
      allTabletopCharacters$, // 全てのテーブル上のキャラクター
      this._combatants$       // 現在戦闘中の参加者
    ]).pipe(
      map(([allChars, combatants]) => {
        const combatantPersistentIds = new Set(combatants.map(c => c.characterId));
        return allChars.filter(char => {
          const charPersistentId = char.detailDataElement?.getFirstElementByName(PERSISTENT_ID_TAG)?.value.toString();
          // 永続IDがない場合は、まだ戦闘に参加していないキャラクターなので、参加可能とする
          if (!charPersistentId) return true;
          // 永続IDがある場合は、その永続IDが戦闘参加者リストに含まれていなければ参加可能
          return !combatantPersistentIds.has(charPersistentId);
        });
      }),
      distinctUntilChanged((prev, curr) => JSON.stringify(prev.map(c => c.identifier)) === JSON.stringify(curr.map(c => c.identifier))),
    );

    // 途中参加候補のキャラクターがテーブルからいなくなったら、選択解除する
    this.addableCharacters$.subscribe(addableChars => {
      const currentSelection = this._selectedParticipantIdsToAddSubject.value;
      const newSelection = new Set<string>();
      const addableCharIds = new Set(addableChars.map(c => c.identifier));

      currentSelection.forEach(id => {
        if (addableCharIds.has(id)) {
          newSelection.add(id);
        }
      });
      this._selectedParticipantIdsToAddSubject.next(newSelection);
    });
  }

  private initialize(): void {
    // コンテナの監視を開始
    this.observerService.observe(
      this,
      PLUGIN_ID,
      FILE_NAME_HINT,
      container => {
        this.container = container;
        this.updateStateFromContainer();
      }
    );
  }

  /**
   * コンテナのDataElementから最新の状態を読み取り、Subjectを更新する
   */
  private updateStateFromContainer(): void {
    if (!this.container) {
      return;
    }

    // container.state プロパティ（ゲッター）にアクセスすると、
    // 存在しない場合に勝手に作成されてしまう副作用があるため、
    // children から直接 'state' DataElement を探し、なければ何もしない。
    const stateElement = this.container.children.find(child => child instanceof DataElement && child.name === 'state') as DataElement;

    if (!stateElement) {
      // まだstate要素がロードされていない、または存在しない場合は何もしない
      // (最後の状態を維持し、不必要な状態リセットを防ぐ)
      return;
    }

    const engineRoot = stateElement.getFirstElementByName('engine-state');
    
    if (engineRoot) {
      const isPlaying = engineRoot.getFirstElementByName('isPlaying')?.value === 'true';
      const round = Number(engineRoot.getFirstElementByName('round')?.value) || 1;
      const currentIndex = Number(engineRoot.getFirstElementByName('currentIndex')?.value) || 0;
      const displayDataTags = engineRoot.getFirstElementByName('displayDataTags')?.value.toString() || 'HP MP'; // デフォルト値を設定
      
      this._isCombat$.next(isPlaying);
      this._round$.next(round);
      this._currentIndex$.next(currentIndex);
      this._displayDataTags$.next(displayDataTags);

      const idsRoot = engineRoot.getFirstElementByName('participantIds');
      if (idsRoot) {
        const combatants: Combatant[] = idsRoot.children.map(el => ({
          characterId: (el as DataElement).getFirstElementByName('id')?.value.toString() || (el as DataElement).value.toString(), // 後方互換: 新構造なら子要素、旧構造ならvalue
          initiative: 0,
          hasActed: (el as DataElement).getFirstElementByName('hasActed')?.value === 'true'
        }));
        this._combatants$.next(combatants);
      } else {
        this._combatants$.next([]);
      }
    } else {
      // engine-state要素がまだ作られていない（またはロード中）場合は、状態を更新しない
      // (CombatStateServiceはTurnBasedEngineServiceの初期化に責任を持たないため)
      // ただし、明示的に戦闘を終了する場合は、endCombat()でisCombat=falseをセットする
      return;
    }
    
    const systemLogSenderName = stateElement.getFirstElementByName('systemLogSenderName')?.value.toString() || '';
    this._systemLogSenderName.next(systemLogSenderName);
  }

  // --- Public Actions ---

  startCombat(): void {
    if (!this.container) {
      this.container = this.pluginHelper.getOrCreateContainer(PLUGIN_ID, FILE_NAME_HINT);
    }
    // 参加予定者リスト（順序付き）を使用して戦闘を開始
    const scheduledIds = this._scheduledParticipantIdsSubject.value;
    if (scheduledIds.length === 0) return;

    scheduledIds.forEach(id => this.addParticipant(id));
    this.turnEngine.start(this.container!);
    // 開始ラウンドを設定
    this.turnEngine.setRound(this.container!, this._preCombatRound$.value);
    this.combatLogService.logCombatStart();
  }

  endCombat(): void {
    if (!this.container) return;
    this.turnEngine.stop(this.container);
    this.turnEngine.reset(this.container);
    this.cleanupCharacterData(); // キャラクターデータのクリーンアップ
    this._preCombatRound$.next(1); // 戦闘終了時にプレラウンドをリセット
    this.combatLogService.logCombatEnd();
  }

  // --- キャラクターデータのクリーンアップ ---
  private cleanupCharacterData(): void {
    const allCharacters = ObjectStore.instance.getObjects<GameCharacter>(GameCharacter); // 全てのキャラクターを対象とする

    for (const character of allCharacters) {
      if (!character.detailDataElement) continue;

      // 手番ハイライトの解除 (機能保留のためコメントアウト)
      // this.removeTurnHighlightFromCharacter(character);

      // status_effects の削除
      const statusEffectsRoot = character.detailDataElement.getFirstElementByName('status_effects');
      if (statusEffectsRoot) {
        character.detailDataElement.removeChild(statusEffectsRoot);
      }

      // _combat_flow_persistent_id の削除
      const idElement = character.detailDataElement.getFirstElementByName(PERSISTENT_ID_TAG);
      if (idElement) {
        character.detailDataElement.removeChild(idElement);
      }
    }
  }

  nextTurn(): void {
    if (!this.container) return;
    // 戦闘中のみ有効
    if (this.isCombat) {
      const previousRound = this.round;
      this.turnEngine.nextTurn(this.container);
      this.updateStateFromContainer(); // 状態を即時更新して最新のラウンド数を取得
      
      if (this.round > previousRound) {
        this.processStatusEffectsOnRoundChange();
      }
    }
  }

  prevTurn(): void {
    if (!this.container) return;
    // 戦闘中のみ有効
    if (this.isCombat) {
      const previousRound = this.round;
      this.turnEngine.prevTurn(this.container);
      this.updateStateFromContainer(); // 状態を即時更新して最新のラウンド数を取得

      if (this.round < previousRound) {
        this.processStatusEffectsOnRoundDecrease();
      }
    }
  }

  nextRound(): void {
    if (this.isCombat) {
      if (!this.container) return;
      this.turnEngine.nextRound(this.container);
      this.updateStateFromContainer(); // 最新のラウンドを取得
      this.combatLogService.logRoundChange(this.round);
      this.processStatusEffectsOnRoundChange(); // ステータス効果の経過処理を追加
    } else {
      // 戦闘前: プレラウンドを増加
      this._preCombatRound$.next(this._preCombatRound$.value + 1);
    }
  }

  resetRound(): void {
    if (this.isCombat) {
      if (!this.container) return;
      this.turnEngine.setRound(this.container, 1);
    } else {
      // 戦闘前: プレラウンドをリセット
      this._preCombatRound$.next(1);
    }
  }

  // --- ステータス効果の経過処理 (ラウンド進行時) ---
  private processStatusEffectsOnRoundChange(): void {
    const allCharacters = this.characterDataService.getAllTabletopCharacters();

    for (const character of allCharacters) {
      if (!character.detailDataElement) continue;

      const statusEffectsRoot = character.detailDataElement.getFirstElementByName('status_effects');
      if (!statusEffectsRoot) continue;

      const childrenToRemove: DataElement[] = [];

      // effect.remainingRounds を1減らす
      for (const child of statusEffectsRoot.children) {
        if (!(child instanceof DataElement) || child.getAttribute('name') !== 'active-effect') continue;
        
        const activeEffectElement = child as DataElement;
        const activeEffect = this.dictionaryService.toActiveStatusEffect(activeEffectElement); // ActiveStatusEffectオブジェクトを取得

        const isPermanentElem = activeEffectElement.getFirstElementByName('isPermanent');
        const remainingRoundsElem = activeEffectElement.getFirstElementByName('remainingRounds');
        
        if (isPermanentElem && isPermanentElem.value === 'true') {
           // 永続効果: 継続処理 (attributeChangeの再適用など) を行う
           this.applyEffectBody(character, activeEffect, true);
           continue; 
        }
        
        if (!remainingRoundsElem) continue;

        let remainingRounds = Number(remainingRoundsElem.value);
        if (isNaN(remainingRounds) || remainingRounds <= 0) continue; // 既に期限切れか無効な値はスキップ

        remainingRounds--;
        remainingRoundsElem.value = remainingRounds;
        remainingRoundsElem.update(); // 値の更新を通知

        if (remainingRounds <= 0) {
          childrenToRemove.push(activeEffectElement);
        } else {
          // 継続中: attributeChange (毒など) を再適用
          this.applyEffectBody(character, activeEffect, true);
        }
      }

      // 期限切れの効果を削除
      for (const expiredEffectElement of childrenToRemove) {
        const activeEffect = this.dictionaryService.toActiveStatusEffect(expiredEffectElement);
        
        // 効果解除 (パラメータを戻す)
        this.revertEffectBody(character, activeEffect);

        const name = expiredEffectElement.getFirstElementByName('name')?.value.toString() || '不明な効果';
        this.combatLogService.logEffectExpiration(character, name);
        statusEffectsRoot.removeChild(expiredEffectElement);
      }

      // 変更を通知 (子要素の削除も含むため)
      if (childrenToRemove.length > 0) {
        statusEffectsRoot.update();
      }
    }
  }

  // --- ステータス効果の逆行処理 (ラウンド戻り時) ---
  private processStatusEffectsOnRoundDecrease(): void {
    const allCharacters = this.characterDataService.getAllTabletopCharacters();

    for (const character of allCharacters) {
      if (!character.detailDataElement) continue;

      const statusEffectsRoot = character.detailDataElement.getFirstElementByName('status_effects');
      if (!statusEffectsRoot) continue;

      const childrenToRemove: DataElement[] = [];

      // effect.remainingRounds を1増やす
      for (const child of statusEffectsRoot.children) {
        if (!(child instanceof DataElement) || child.getAttribute('name') !== 'active-effect') continue;
        
        const activeEffectElement = child as DataElement;
        const isPermanentElem = activeEffectElement.getFirstElementByName('isPermanent');
        const remainingRoundsElem = activeEffectElement.getFirstElementByName('remainingRounds');
        const durationElem = activeEffectElement.getFirstElementByName('duration');
        
        if (!remainingRoundsElem || (isPermanentElem && isPermanentElem.value === 'true')) continue; // 永続効果はスキップ
        
        let remainingRounds = Number(remainingRoundsElem.value);
        let duration = Number(durationElem?.value);

        if (isNaN(remainingRounds)) continue;

        remainingRounds++;
        
        // duration (初期値) を超えたら削除 (付与前まで戻ったとみなす)
        if (!isNaN(duration) && remainingRounds > duration) {
          childrenToRemove.push(activeEffectElement);
        } else {
          remainingRoundsElem.value = remainingRounds;
          remainingRoundsElem.update();
        }
      }

      // 付与前に戻った効果を削除
      for (const expiredEffect of childrenToRemove) {
        const name = expiredEffect.getFirstElementByName('name')?.value.toString() || '不明な効果';
        // 時間逆行による消滅も、ログとしては「効果が切れた（消えた）」で表現する
        // あるいは「時間が戻ったため消滅」と明記するか？ シンプルにExpirationと同じにする
        this.combatLogService.logEffectExpiration(character, name);
        statusEffectsRoot.removeChild(expiredEffect);
      }

      if (childrenToRemove.length > 0) {
        statusEffectsRoot.update();
      }
    }
  }

  addParticipant(characterIdentifier: string): void {
    if (!this.container) {
      this.container = this.pluginHelper.getOrCreateContainer(PLUGIN_ID, FILE_NAME_HINT);
    }

    const character = ObjectStore.instance.get<GameCharacter>(characterIdentifier);
    if (!character || !character.detailDataElement) return;

    const persistentId = this.characterDataService.ensurePersistentId(character);
    this.turnEngine.addParticipant(this.container, persistentId);
  }

  removeParticipant(characterId: string): void {
    if (!this.container) return;
    this.turnEngine.removeParticipant(this.container, characterId);
  }

  updateDisplayDataTags(tags: string): void {
    if (!this.container) {
      this.container = this.pluginHelper.getOrCreateContainer(PLUGIN_ID, FILE_NAME_HINT);
    }
    
    // TODO: TurnBasedEngineServiceに委譲すべきだが、一旦ここに書く
    // findOrCreateEngineRootはprivateなので、同様のロジックが必要
    // 今回は簡易的に実装
    let engineRoot = this.container.state.getFirstElementByName('engine-state');
    if (!engineRoot) {
      // 通常startCombat経由で作られるが、設定先行の場合はここでも作る必要がある
      // しかしTurnBasedEngineServiceのprivateメソッドにはアクセスできない
      // startCombatを呼んで初期化するか、TurnBasedEngineServiceにpublicなensureInitializedを追加するのが良い
      // ここでは暫定的にTurnBasedEngineService.start()を呼ぶわけにはいかないので、
      // 既存のengineRootがある場合のみ更新する（なければ何もしない、あるいは保存されない）
      return; 
    }

    let tagsElement = engineRoot.getFirstElementByName('displayDataTags');
    if (!tagsElement) {
      tagsElement = DataElement.create('displayDataTags', tags, {});
      engineRoot.appendChild(tagsElement);
    } else {
      tagsElement.value = tags;
    }
  }
  
  // --- 状態操作 ---
  
  toggleHasActed(characterId: string): void {
    if (!this.container) return;
    this.turnEngine.toggleHasActed(this.container, characterId);
  }

  setTurnToCharacter(characterId: string): void {
    if (!this.container) return;
    this.turnEngine.setTurnToCharacter(this.container, characterId);
  }
  
  // --- ステータス効果操作 ---

  /**
   * ステータス効果の実体（パラメータ変動）を適用する
   * @param character 対象キャラクター
   * @param effect 適用する効果（ActiveStatusEffectまたはStatusEffect）
   * @param isRecurring 毎ラウンドの適用かどうか（trueならattributeChangeのみ適用）
   */
  private applyEffectBody(character: GameCharacter, effect: StatusEffect | ActiveStatusEffect, isRecurring: boolean = false): void {
    if (!effect.effects || effect.effects.length === 0) return;

    effect.effects.forEach(e => {
      // isRecurring=true (ラウンド経過時) は attributeChange (毒など) のみ適用
      // isRecurring=false (付与時) は 全て適用
      if (isRecurring && e.type !== 'attributeChange') return;

      if (e.target && e.value !== 0) {
        this.characterDataService.applyParameterChange(character, e.target, e.value);
      }
    });
  }

  /**
   * ステータス効果の実体（パラメータ変動）を解除（反転適用）する
   * @param character 対象キャラクター
   * @param effect 解除する効果（ActiveStatusEffect）
   */
  private revertEffectBody(character: GameCharacter, effect: ActiveStatusEffect): void {
    if (!effect.effects || effect.effects.length === 0) return;

    effect.effects.forEach(e => {
      // buffDebuff (能力値修正) のみ解除時に値を戻す
      // attributeChange (HPダメージなど) は戻さない
      if (e.type === 'buffDebuff' && e.target && e.value !== 0) {
        this.characterDataService.applyParameterChange(character, e.target, -e.value);
      }
    });
  }

  addStatusEffect(targetPersistentId: string, effect: StatusEffect): void {
    const character = this.characterDataService.getGameCharacter(targetPersistentId);
    if (!character || !character.detailDataElement) return;

    let statusEffectsRoot = character.detailDataElement.getFirstElementByName('status_effects');
    if (!statusEffectsRoot) {
      statusEffectsRoot = DataElement.create('status_effects', '', {});
      character.detailDataElement.appendChild(statusEffectsRoot);
    }

    const currentRound = this.round;
    const effectElement = this.dictionaryService.createActiveEffectElement(effect, currentRound);
    statusEffectsRoot.appendChild(effectElement);
    statusEffectsRoot.update(); // 明示的に更新を通知

    // パラメータ変動の適用
    this.applyEffectBody(character, effect, false);
  }

  removeStatusEffect(targetPersistentId: string, effectInstanceId: string): void {
    const character = this.characterDataService.getGameCharacter(targetPersistentId);
    if (!character || !character.detailDataElement) return;

    const statusEffectsRoot = character.detailDataElement.getFirstElementByName('status_effects');
    if (!statusEffectsRoot) return;

    const targetElement = statusEffectsRoot.children.find(child => child.identifier === effectInstanceId);
    if (targetElement) {
      const activeEffect = this.dictionaryService.toActiveStatusEffect(targetElement as DataElement);
      
      // 効果解除 (パラメータを戻す)
      this.revertEffectBody(character, activeEffect);

      const name = (targetElement as DataElement).getFirstElementByName('name')?.value.toString() || '不明な効果';
      this.combatLogService.logEffectRemove(character, name);
      statusEffectsRoot.removeChild(targetElement);
      statusEffectsRoot.update(); // 明示的に更新を通知
    }
  }

  updateStatusEffectRound(targetPersistentId: string, effectInstanceId: string, delta: number): void {
    const character = this.characterDataService.getGameCharacter(targetPersistentId);
    if (!character || !character.detailDataElement) return;

    const statusEffectsRoot = character.detailDataElement.getFirstElementByName('status_effects');
    if (!statusEffectsRoot) return;

    const targetElement = statusEffectsRoot.children.find(child => child.identifier === effectInstanceId);
    if (!targetElement || !(targetElement instanceof DataElement)) return;

    const isPermanentElem = targetElement.getFirstElementByName('isPermanent');
    const isPermanent = isPermanentElem && isPermanentElem.value === 'true';

    // 永続(永遠)効果の場合
    if (isPermanent) {
      if (delta < 0) {
        const activeEffect = this.dictionaryService.toActiveStatusEffect(targetElement as DataElement);
        // 効果解除 (パラメータを戻す)
        this.revertEffectBody(character, activeEffect);

        const name = targetElement.getFirstElementByName('name')?.value.toString() || '不明な効果';
        this.combatLogService.logEffectRemove(character, name);
        statusEffectsRoot.removeChild(targetElement);
        statusEffectsRoot.update(); // 明示的に更新を通知
      }
      return;
    }

    const remainingRoundsElem = targetElement.getFirstElementByName('remainingRounds');
    if (!remainingRoundsElem) return;

    let current = Number(remainingRoundsElem.value);
    if (isNaN(current)) return;

    current += delta;
    const name = targetElement.getFirstElementByName('name')?.value.toString() || '不明な効果';

    if (current <= 0) {
      const activeEffect = this.dictionaryService.toActiveStatusEffect(targetElement as DataElement);
      // 効果解除 (パラメータを戻す)
      this.revertEffectBody(character, activeEffect);

      this.combatLogService.logEffectExpiration(character, name);
      statusEffectsRoot.removeChild(targetElement);
      statusEffectsRoot.update(); // 明示的に更新を通知
    } else {
      remainingRoundsElem.value = current;
      remainingRoundsElem.update();
      this.combatLogService.logEffectUpdate(character, name, current);
    }
  }

  getActiveStatusEffects(characterIdentifier: string): ActiveStatusEffect[] {
    const character = this.characterDataService.resolveCharacter(characterIdentifier);
    if (!character || !character.detailDataElement) {
      return [];
    }

    const statusEffectsRoot = character.detailDataElement.getFirstElementByName('status_effects');
    if (!statusEffectsRoot) {
      return [];
    }

    const activeEffects = statusEffectsRoot.children.map(el => 
      this.dictionaryService.toActiveStatusEffect(el as DataElement)
    );
    return activeEffects;
  }

  // --- Helpers ---

  toggleCharacterSelection(characterId: string): void {
    const currentSelection = this._selectionSubject.value;
    const newSelection = { ...currentSelection };
    newSelection[characterId] = !newSelection[characterId];
    this._selectionSubject.next(newSelection);
  }

  toggleAllCharacters(): void {
    combineLatest([this.charactersForSelection$, this.isAllSelected$]).pipe(take(1)).subscribe(([chars, isAllSelected]) => {
      const selectAll = !isAllSelected;
      const newSelection: {[key: string]: boolean} = {};
      for (const char of chars) {
        newSelection[char.identifier] = selectAll;
      }
      this._selectionSubject.next(newSelection);
    });
  }

  selectParticipantForReorder(characterId: string): void {
    if (this._selectedParticipantIdForReorderSubject.value === characterId) {
      this._selectedParticipantIdForReorderSubject.next(null); // Deselect if already selected
    } else {
      this._selectedParticipantIdForReorderSubject.next(characterId);
    }
  }

  moveParticipantUp(): void {
    const characterId = this._selectedParticipantIdForReorderSubject.value;
    if (!characterId) return;

    if (this.isCombat) {
      if (!this.container) return;
      this.turnEngine.moveParticipantUp(this.container, characterId);
    } else {
      const currentList = [...this._scheduledParticipantIdsSubject.value];
      const index = currentList.indexOf(characterId);
      if (index > 0) {
        [currentList[index - 1], currentList[index]] = [currentList[index], currentList[index - 1]];
        this._scheduledParticipantIdsSubject.next(currentList);
      }
    }
  }

  moveParticipantDown(): void {
    const characterId = this._selectedParticipantIdForReorderSubject.value;
    if (!characterId) return;

    if (this.isCombat) {
      if (!this.container) return;
      this.turnEngine.moveParticipantDown(this.container, characterId);
    } else {
      const currentList = [...this._scheduledParticipantIdsSubject.value];
      const index = currentList.indexOf(characterId);
      if (index >= 0 && index < currentList.length - 1) {
        [currentList[index], currentList[index + 1]] = [currentList[index + 1], currentList[index]];
        this._scheduledParticipantIdsSubject.next(currentList);
      }
    }
  }

  toggleParticipantSelectionToAdd(characterId: string): void {
    const newSet = new Set(this._selectedParticipantIdsToAddSubject.value);
    if (newSet.has(characterId)) {
      newSet.delete(characterId);
    } else {
      newSet.add(characterId);
    }
    this._selectedParticipantIdsToAddSubject.next(newSet);
  }

  clearParticipantSelectionToAdd(): void {
    this._selectedParticipantIdsToAddSubject.next(new Set());
  }

  addParticipants(characterIds: string[]): void {
    if (!this.container || characterIds.length === 0) return;
    characterIds.forEach(id => this.addParticipant(id));
    this.clearParticipantSelectionToAdd();
  }

  applyParameterChange(
    casterPersistentId: string,
    targetPersistentIds: string[],
    paramName: string,
    value: number
  ): void {
    if (!this.container || !casterPersistentId || targetPersistentIds.length === 0 || !paramName || value === 0) {
      console.warn('Parameter change: Missing essential data', { casterPersistentId, targetPersistentIds, paramName, value });
      return;
    }

    const caster = this.characterDataService.getGameCharacter(casterPersistentId);
    const targets = targetPersistentIds.map(id => this.characterDataService.getGameCharacter(id)).filter((char): char is GameCharacter => char !== null);

    if (!caster || targets.length === 0) {
      console.warn('Parameter change: Caster or targets not found', { caster, targets });
      return;
    }
    
    targets.forEach(targetChar => {
      this.characterDataService.applyParameterChange(targetChar, paramName, value);
    });

    console.log(`[CombatStateService] ${caster.name} が ${targets.map(c => c.name).join(', ')} の ${paramName} を ${value > 0 ? '+' : ''}${value} した！`);
  }

  getDamageCheckConfig(): { referenceParams: string, buttonConfig: { showAsIs: boolean, showReduce: boolean, showHalve: boolean, showZero: boolean, showCustom: boolean } } {
    if (!this.container) {
      return { ...DEFAULT_DAMAGE_CHECK_CONFIG };
    }

    const configRoot = this.container.state.getFirstElementByName('damage-check-config');
    if (!configRoot) {
      return { ...DEFAULT_DAMAGE_CHECK_CONFIG };
    }

    const referenceParams = configRoot.getFirstElementByName('referenceParams')?.value.toString() || DEFAULT_DAMAGE_CHECK_CONFIG.referenceParams;
    const buttonConfigRoot = configRoot.getFirstElementByName('buttonConfig');
    
    const buttonConfig = {
      showAsIs: buttonConfigRoot?.getFirstElementByName('showAsIs')?.value === 'true',
      showReduce: buttonConfigRoot?.getFirstElementByName('showReduce')?.value === 'true',
      showHalve: buttonConfigRoot?.getFirstElementByName('showHalve')?.value === 'true',
      showZero: buttonConfigRoot?.getFirstElementByName('showZero')?.value === 'true',
      showCustom: buttonConfigRoot?.getFirstElementByName('showCustom')?.value === 'true'
    };

    if (!buttonConfigRoot) {
      Object.assign(buttonConfig, DEFAULT_DAMAGE_CHECK_CONFIG.buttonConfig);
    }

    return { referenceParams, buttonConfig };
  }

  saveDamageCheckConfig(config: { referenceParams: string, buttonConfig: { [key: string]: boolean } }): void {
    if (!this.container) {
      this.container = this.pluginHelper.getOrCreateContainer(PLUGIN_ID, FILE_NAME_HINT);
    }

    let configRoot = this.container.state.getFirstElementByName('damage-check-config');
    if (!configRoot) {
      configRoot = DataElement.create('damage-check-config', '', {});
      this.container.state.appendChild(configRoot);
    }

    let refParamsElem = configRoot.getFirstElementByName('referenceParams');
    if (!refParamsElem) {
      refParamsElem = DataElement.create('referenceParams', config.referenceParams, {});
      configRoot.appendChild(refParamsElem);
    } else {
      refParamsElem.value = config.referenceParams;
    }

    let buttonConfigRoot = configRoot.getFirstElementByName('buttonConfig');
    if (!buttonConfigRoot) {
      buttonConfigRoot = DataElement.create('buttonConfig', '', {});
      configRoot.appendChild(buttonConfigRoot);
    }

    const updateButtonConfig = (key: string, value: boolean) => {
      let elem = buttonConfigRoot.getFirstElementByName(key);
      if (!elem) {
        elem = DataElement.create(key, String(value), {});
        buttonConfigRoot.appendChild(elem);
      } else {
        elem.value = String(value);
      }
    };

    updateButtonConfig('showAsIs', config.buttonConfig.showAsIs);
    updateButtonConfig('showReduce', config.buttonConfig.showReduce);
    updateButtonConfig('showHalve', config.buttonConfig.showHalve);
    updateButtonConfig('showZero', config.buttonConfig.showZero);
    updateButtonConfig('showCustom', config.buttonConfig.showCustom);
  }
  
  /**
   * システムログの送信元キャラクター名を設定として保存します。
   * @param name 送信元として設定するキャラクター名
   */
  saveSystemLogSenderName(name: string): void {
    if (!this.container) {
      this.container = this.pluginHelper.getOrCreateContainer(PLUGIN_ID, FILE_NAME_HINT);
    }

    let stateElement = this.container.state.getFirstElementByName('state');
    if (!stateElement) {
      stateElement = DataElement.create('state', '', {});
      this.container.state.appendChild(stateElement);
    }

    let nameElement = stateElement.getFirstElementByName('systemLogSenderName');
    if (!nameElement) {
      nameElement = DataElement.create('systemLogSenderName', name, {});
      stateElement.appendChild(nameElement);
    } else {
      nameElement.value = name;
    }
    stateElement.update(); // 変更を通知
    this._systemLogSenderName.next(name); // BehaviorSubjectも更新
    EventSystem.trigger('SYSTEM_LOG_SENDER_NAME_CHANGED', name);
  }

  /**
   * チャットログを解析し、指定された術者の直近の発言に含まれるキャラクターをターゲットとして返します。
   * @param caster 術者となるキャラクター
   * @param availableChatTabs 解析対象のチャットタブ
   * @returns ターゲット候補のキャラクター配列
   */
  findTargetsFromChat(caster: GameCharacter, availableChatTabs: ChatTab[]): GameCharacter[] {
    if (!caster) return [];

    // 戦闘参加者（候補）のリストを取得 (術者自身は除外する)
    const combatantCharacters = this.combatants
      .map(c => this.characterDataService.getGameCharacter(c.characterId))
      .filter(c => c !== null && c.identifier !== caster.identifier) as GameCharacter[];
      
    if (combatantCharacters.length === 0) return [];

    // 直近のメッセージを検索
    const casterMessages = availableChatTabs
      .flatMap(tab => tab.chatMessages.slice(-50))
      .filter(msg => msg.name === caster.name)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 10);

    for (const msg of casterMessages) {
      const messageValue = msg.value.toString(); // valueはnumberの可能性もあるためtoString
      const foundTargets = combatantCharacters.filter(character => messageValue.includes(character.name));
      if (foundTargets.length > 0) {
        return foundTargets; // 最初に見つかったメッセージのターゲットを返す
      }
    }

    return [];
  }

  /**
   * チャットログを解析し、指定された術者の直近のダイスロール結果を数値として返します。
   * @param caster 術者となるキャラクター
   * @param availableChatTabs 解析対象のチャットタブ
   * @returns ダイス結果の合計値。見つからなければnull。
   */
  findDiceResultFromChat(caster: GameCharacter, availableChatTabs: ChatTab[]): number | null {
    if (!caster) return null;

    const allMessages = availableChatTabs.flatMap(tab => tab.chatMessages.slice(-50));
    allMessages.sort((a, b) => b.timestamp - a.timestamp);

    // BCDiceの結果は通常 System-BCDice から送信されるが、Udonariumの実装によっては
    // キャラクター名が含まれるメッセージとして扱われる場合もある。
    // ここでは name にキャラクター名が含まれているシステムメッセージを探す。
    const bcdiceMessage = allMessages.find(msg => 
      msg.from === 'System-BCDice' && msg.name.includes(caster.name)
    );

    if (bcdiceMessage) {
      const match = bcdiceMessage.value.toString().match(/→\s*(\d+)$/);
      if (match && match[1]) {
        return parseInt(match[1], 10);
      }
    }

    return null;
  }

}

import { Component, OnInit, OnDestroy, NgZone, ChangeDetectorRef, ChangeDetectionStrategy, Input } from '@angular/core';
import { take, map, startWith, shareReplay, filter, takeUntil } from 'rxjs/operators';
import { combineLatest, Observable, Subject } from 'rxjs';
import { PluginUiService, PluginPanelOption } from '../service/plugin-ui.service';
import { PluginHelperService } from '../service/plugin-helper.service';
import { PluginDataObserverService } from '../service/plugin-data-observer.service';
import { CombatFlowPanelComponent } from './combat-flow-panel.component';
import { PluginDataContainer } from '../../class/plugin-data-container';
import { EventSystem } from '@udonarium/core/system';
import { StatusEffectDictionaryService } from './status-effect-dictionary.service';
import { StatusEffect, ActiveStatusEffect } from './status-effect.model';
import { StatusEffectEditorComponent } from './status-effect-editor.component';
import { CombatStateService } from './combat-state.service';
import { CharacterDataService } from '../service/character-data.service';
import { CombatLogService } from './combat-log.service';
import { environment } from '../../../environments/environment';
import { saveAs } from 'file-saver';
import { GameCharacter } from '@udonarium/game-character';
import { ObjectStore } from '@udonarium/core/synchronize-object/object-store';
import { Network } from '@udonarium/core/system';
import { ChatTab } from '@udonarium/chat-tab';
import { ChatTabList } from '@udonarium/chat-tab-list';
import { DamageCheckPanelComponent } from './damage-check-panel.component';

@Component({
  selector: 'app-combat-flow-controller',
  templateUrl: './combat-flow-controller.component.html',
  styleUrls: ['./combat-flow-controller.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CombatFlowControllerComponent implements OnInit, OnDestroy {
  private _initialCasterIdentifier: string | null = null;
  @Input()
  set initialCasterIdentifier(value: string | null) {
    this._initialCasterIdentifier = value;
    this.applyInitialCaster();
  }
  get initialCasterIdentifier(): string | null {
    return this._initialCasterIdentifier;
  }

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

  activeTab: string = 'combat';
  displayDataTags: string = 'HP MP'; // デフォルト値を設定
  messageTargetTabId: string = ''; // チャット送信先タブID

  get availableChatTabs(): ChatTab[] {
    return ChatTabList.instance.chatTabs;
  }

  statusEffectTemplates: StatusEffect[] = [];
  
  // 開発環境判定
  get isProduction(): boolean {
    return environment.production;
  }

  private readonly PLUGIN_ID = 'combat-flow';
  private readonly FILE_NAME_HINT = 'default';
  private observer: { unsubscribe: () => void };
  private dictionaryContainer: PluginDataContainer | null = null; // DictionaryService用コンテナ
  private unsubscribe$ = new Subject<void>();

  // CombatStateServiceのpublicなObservableやメソッドをテンプレートに公開
  readonly charactersForSelection$ = this.combatStateService.charactersForSelection$;
  readonly selection$ = this.combatStateService.selection$;
  readonly isAllSelected$ = this.combatStateService.isAllSelected$;
  readonly selectedCharacterCount$ = this.combatStateService.selectedCharacterCount$;
  readonly isCombat$ = this.combatStateService.isCombat$;
  readonly round$ = this.combatStateService.round$;
  readonly currentIndex$ = this.combatStateService.currentIndex$;
  readonly combatants$ = this.combatStateService.combatants$;
  readonly selectedParticipantIdForReorder$ = this.combatStateService.selectedParticipantIdForReorder$;
  
  // 戦闘前状態
  readonly preCombatRound$ = this.combatStateService.preCombatRound$;
  readonly scheduledParticipantIds$ = this.combatStateService.scheduledParticipantIds$;

  // 途中参加関連
  readonly addableCharacters$ = this.combatStateService.addableCharacters$;
  readonly selectedParticipantIdsToAdd$ = this.combatStateService.selectedParticipantIdsToAdd$;

  // システムログ送信元関連
  availableLogSenders$: Observable<GameCharacter[]>;
  selectedLogSenderName: string = '';

  // UIハイライト用
  highlightCaster = false;
  highlightTarget = false;
  highlightAction = false;
  highlightValue = false;

  // 表示用コンバタントリスト (名前解決済み)
  // combatants$だけではキャラクターデータのロード完了(XML_LOADED)に反応できないため、
  // charactersForSelection$ (XML_LOADEDで発火) をトリガーとして組み合わせる。
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

  isAddingParticipant: boolean = false; // 途中参加UIの表示フラグ
  
  // --- 戦闘操作UI用プロパティ ---
  operationMode: 'statusEffect' | 'parameter' = 'parameter';
  selectedCasterId: string | null = null;
  selectedTargetIds: Set<string> = new Set();
  selectedParameterName: string | null = null; // keyを格納するが、変数名は維持
  parameterValue: number = 0;
  selectedStatusEffectId: string | null = null; // 追加

  availableParameters: { key: string, name: string }[] = []; 

  // ダメージ適用確認パネル設定
  damageCheckConfig = {
    referenceParams: '防護点',
    buttonConfig: {
      showAsIs: true,
      showReduce: true,
      showHalve: true,
      showZero: true,
      showCustom: true
    }
  };

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
  ) {
    this.combatStateService.displayDataTags$.subscribe(tags => {
      this.displayDataTags = tags;
      this.changeDetectorRef.markForCheck();
    });
  }

  ngOnInit(): void {
    // チャット送信先の初期値を設定
    if (this.availableChatTabs.length > 0) {
      this.messageTargetTabId = this.availableChatTabs[0].identifier;
      this.combatLogService.setTargetTabIdentifier(this.messageTargetTabId);
    }

    // 辞書用コンテナの取得（なければ作成）
    this.dictionaryContainer = this.pluginHelper.getOrCreateContainer(this.PLUGIN_ID, 'status-effect-dictionary');
    
    // 辞書コンテナの更新監視を開始
    this.observer = this.observerService.observe(
      this,
      this.PLUGIN_ID,
      'status-effect-dictionary', // fileNameHintも指定
      container => {
        this.dictionaryContainer = container; // コンテナがルームロードで入れ替わる可能性があるので参照を更新
        this.updateTemplates();
        this.loadDamageCheckConfig(); // 設定もリロード
        // 初期データをロード（初回のみ）
        this.dictionaryService.loadDefaultDictionary(this.dictionaryContainer).then(() => {
          this.updateTemplates();
        });
      }
    );

    // 初期術者の適用（Inputsがない場合もデフォルト選択を走らせる）
    this.applyInitialCaster();

    // 設定の読み込み
    this.loadDamageCheckConfig();

    // システムログ送信元キャラクターの監視と初期化
    this.availableLogSenders$ = this.combatStateService.charactersForSelection$.pipe( // charactersForSelection$ はトリガーとして使用
      map(() => {
        const allCharacters = ObjectStore.instance.getObjects<GameCharacter>(GameCharacter);
        
        // テーブル上、またはインベントリにある全てのキャラクターを対象とする
        const relevantCharacters = allCharacters.filter(char => 
          char.location.name !== 'graveyard' // 墓場以外
        );

        // 名前でユニーク化し、ソートする
        const uniqueCharsByName = new Map<string, GameCharacter>();
        relevantCharacters.forEach(char => {
          if (!uniqueCharsByName.has(char.name)) { // 同名キャラは最初の1つを採用
            uniqueCharsByName.set(char.name, char);
          }
        });

        return Array.from(uniqueCharsByName.values()).sort((a, b) => a.name.localeCompare(b.name, 'ja'));
      }),
      shareReplay(1)
    );

    this.combatStateService.systemLogSenderName$.pipe(
      takeUntil(this.unsubscribe$)
    ).subscribe(name => {
      this.selectedLogSenderName = name;
      this.changeDetectorRef.markForCheck();
    });

    // 戦闘開始時に術者を自動選択する（維持できるなら維持する）
    this.combatStateService.isCombat$.pipe(
      filter(isCombat => isCombat), // 戦闘開始時のみ
      takeUntil(this.unsubscribe$) // コンポーネント破棄まで監視
    ).subscribe(() => {
      // 状態更新を少し待つ必要があるかもしれないが、まずは同期的に試す
      this.ngZone.run(() => {
        const combatants = this.combatStateService.combatants;
        
        // 1. 現在選択中の術者が、新しい参加者リストに含まれているか確認
        // (selectedCasterId が null でない、かつリストに存在する)
        const isSelectedValid = this.selectedCasterId && combatants.some(c => c.characterId === this.selectedCasterId);

        if (!isSelectedValid) {
          // 2. 含まれていない（または未選択）なら、自動選択ロジックを実行
          const currentId = this.combatStateService.currentCharacterId;
          const firstId = combatants.length > 0 ? combatants[0].characterId : null;
          
          const targetId = currentId || firstId;
          if (targetId) {
            this.selectedCasterId = targetId;
            this.onCasterChange();
          }
        }
        // 3. 含まれているなら、何もしない（選択を維持する）

        this.changeDetectorRef.markForCheck();
      });
    });
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
            this.changeDetectorRef.markForCheck(); // 変更をビューに通知
            return;
          }
        } else {
          // 戦闘前: 参加予定リストに含まれているか確認
          this.scheduledParticipantIds$.pipe(take(1)).subscribe(ids => {
            if (ids.includes(persistentId)) {
              this.selectedCasterId = persistentId;
              this.onCasterChange();
              this.changeDetectorRef.markForCheck(); // 変更をビューに通知
            } else {
              // 含まれていない場合、デフォルト選択へフォールバック
              this.applyDefaultCaster();
            }
          });
          return; // subscribe内で処理またはフォールバックするので、ここで抜ける
        }
      }
    }

    // 指定がない、または見つからなかった場合のデフォルト選択ロジック
    this.applyDefaultCaster();
  }

  private applyDefaultCaster(): void {
    if (this.combatStateService.isCombat) {
      // 戦闘中: 現在の手番キャラクター
      const currentId = this.combatStateService.currentCharacterId;
      if (currentId) {
        this.selectedCasterId = currentId;
        this.onCasterChange();
        this.changeDetectorRef.markForCheck(); // 変更をビューに通知
      }
    } else {
      // 戦闘前: 参加予定リストの先頭
      this.scheduledParticipantIds$.pipe(take(1)).subscribe(ids => {
        if (ids.length > 0) {
          this.selectedCasterId = ids[0];
          this.onCasterChange();
          this.changeDetectorRef.markForCheck(); // 変更をビューに通知
        }
      });
    }
  }

  ngOnDestroy(): void {
    if (this.observer) this.observer.unsubscribe();
    this.unsubscribe$.next();
    this.unsubscribe$.complete();
  }

  private updateTemplates(): void {
    if (!this.dictionaryContainer) return;
    this.statusEffectTemplates = this.dictionaryService.getTemplates(this.dictionaryContainer);
    this.changeDetectorRef.markForCheck();
  }

  // --- 辞書インポート/エクスポート ---

  onImportStatusEffectDictionary(input: HTMLInputElement): void {
    if (!this.dictionaryContainer || !input.files || input.files.length === 0) return;
    const file = input.files[0];
    const reader = new FileReader();

    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (!content) return;

      try {
        if (file.name.endsWith('.json')) {
          this.dictionaryService.importFromJson(this.dictionaryContainer, content);
        } else if (file.name.endsWith('.xml')) {
          this.dictionaryService.importFromXml(this.dictionaryContainer, content);
        } else {
          alert('対応していないファイル形式です (.json, .xml)');
          return;
        }
        this.updateTemplates();
        alert('インポートが完了しました');
      } catch (error) {
        console.error('Import failed:', error);
        alert('インポートに失敗しました');
      }
    };

    reader.readAsText(file);
    input.value = ''; // Reset input
  }

  exportStatusEffectDictionary(): void {
    if (!this.dictionaryContainer) return;
    const xml = this.dictionaryService.exportToXml(this.dictionaryContainer);
    const blob = new Blob([xml], { type: 'text/xml' });
    saveAs(blob, 'status-effect-dictionary.xml');
  }

  // CombatStateServiceのstartCombatを呼び出す
  startCombat(): void {
    this.combatStateService.startCombat();
  }

  // CombatStateServiceのendCombatを呼び出す
  endCombat(): void {
    this.combatStateService.endCombat();
  }

  // CombatStateServiceのtoggleCharacterSelectionを呼び出す
  toggleCharacterSelection(characterId: string): void {
    this.combatStateService.toggleCharacterSelection(characterId);
  }

  // CombatStateServiceのtoggleAllCharactersを呼び出す
  toggleAllCharacters(): void {
    this.combatStateService.toggleAllCharacters();
  }

  // CombatStateServiceのnextTurnを呼び出す
  nextTurn(): void {
    this.combatStateService.nextTurn();
  }

  // CombatStateServiceのprevTurnを呼び出す
  prevTurn(): void {
    this.combatStateService.prevTurn();
  }

  // CombatStateServiceのnextRoundを呼び出す
  nextRound(): void {
    this.combatStateService.nextRound();
  }

  // CombatStateServiceのresetRoundを呼び出す
  resetRound(): void {
    this.combatStateService.resetRound();
  }

  openStatusEffectEditor(effect?: StatusEffect): void {
    const title = effect ? 'ステータス効果の編集' : 'ステータス効果の新規作成';
    this.pluginUiService.openAtCursor(StatusEffectEditorComponent, {
      title: title,
      width: 480, // 旧実装の値を使用
      height: 640, // 旧実装の値を使用
      isSingleton: false, // 複数開けるようにする
      // layout: 'full-auto', // 自動レイアウトを無効にする
      inputs: { // エディタコンポーネントにデータを渡す
        effect: effect,
        pluginId: this.PLUGIN_ID,
        fileNameHint: 'status-effect-dictionary'
      }
    });
  }

  deleteStatusEffect(effect: StatusEffect): void {
    if (!this.dictionaryContainer || !confirm(`「${effect.name}」を削除しますか？`)) return;
    this.dictionaryService.removeTemplate(this.dictionaryContainer, effect.id);
    this.updateTemplates();
  }

  toggleCombatPanel(): void {
    const panel = this.pluginUiService.find(CombatFlowPanelComponent);
    if (panel) {
      this.pluginUiService.close(CombatFlowPanelComponent);
    } else {
      this.pluginUiService.open(CombatFlowPanelComponent, {
        title: '戦闘パネル',
        width: 800,
        height: 300,
        isSingleton: true,
        layout: 'full-auto'
      });
    }
  }

  getCharacterName(characterId: string): string {
    const char = this.characterDataService.resolveCharacter(characterId);
    return char ? char.name : '不明なキャラクター';
  }

  getTargetNames(targetIds: Set<string>): string {
    if (targetIds.size === 0) {
      return '[誰に]';
    } else if (targetIds.size === 1) {
      const id = targetIds.values().next().value;
      return this.getCharacterName(id);
    } else {
      return `${targetIds.size}体`;
    }
  }

  selectParticipantForReorder(characterId: string): void {
    this.combatStateService.selectParticipantForReorder(characterId);
  }

  moveParticipantUp(): void {
    this.selectedParticipantIdForReorder$.pipe(take(1)).subscribe(id => {
      if (id) this.combatStateService.moveParticipantUp();
    });
  }

  moveParticipantDown(): void {
    this.selectedParticipantIdForReorder$.pipe(take(1)).subscribe(id => {
      if (id) this.combatStateService.moveParticipantDown();
    });
  }

  toggleAddParticipantMode(): void {
    this.isAddingParticipant = !this.isAddingParticipant;
    if (!this.isAddingParticipant) {
      // 追加モードを終了する際に、選択状態をクリア
      this.combatStateService.clearParticipantSelectionToAdd();
    }
  }

  toggleParticipantSelectionToAdd(characterId: string): void {
    this.combatStateService.toggleParticipantSelectionToAdd(characterId);
  }

  addSelectedParticipants(): void {
    this.selectedParticipantIdsToAdd$.pipe(take(1)).subscribe((selectedIds: Set<string>) => {
      this.combatStateService.addParticipants(Array.from(selectedIds));
      this.isAddingParticipant = false; // 追加後にモードを終了
    });
  }

  onDisplayDataTagsChange(tags: string): void {
    this.combatStateService.updateDisplayDataTags(tags);
  }

  onMessageTargetTabChange(tabIdentifier: string): void {
    this.messageTargetTabId = tabIdentifier;
    this.combatLogService.setTargetTabIdentifier(tabIdentifier);
  }

  onSystemLogSenderNameChange(name: string): void {
    this.combatStateService.setSystemLogSenderName(name);
  }

  // --- ダメージ適用確認パネル設定 ---

  loadDamageCheckConfig(): void {
    this.damageCheckConfig = this.combatStateService.getDamageCheckConfig();
    this.changeDetectorRef.markForCheck();
  }

  saveDamageCheckConfig(): void {
    this.combatStateService.saveDamageCheckConfig(this.damageCheckConfig);
  }

  toggleDamageCheckButton(key: string): void {
    this.damageCheckConfig.buttonConfig[key] = !this.damageCheckConfig.buttonConfig[key];
    this.saveDamageCheckConfig();
  }

  // --- 戦闘操作UI用メソッド ---

  toggleTarget(characterId: string): void {
    if (this.selectedTargetIds.has(characterId)) {
      this.selectedTargetIds.delete(characterId);
    } else {
      this.selectedTargetIds.add(characterId);
    }
    // Setの変更を検知させるため、新しいSetを代入する
    this.selectedTargetIds = new Set(this.selectedTargetIds);
    this.updateAvailableParameters(); // パラメータリストを更新
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

    // 共通パラメータを取得
    const commonParams = this.characterDataService.getCommonParameters(targets);
    
    // CharacterDataService.getCommonParameters は DataElement[] を返すため、
    // { key, name } 形式に変換する必要がある。
    // しかし、getCommonParameters は DataElement のリストを返すだけで、
    // numberResource の .currentValue / .value の展開は行っていない。
    // なので、ここでは getParameterList を使って自分で共通部分を抽出するロジックを実装するか、
    // あるいは CharacterDataService に「複数のキャラクターから共通のパラメータリスト（{key, name}）を取得する」メソッドを追加するのがベストだが、
    // 今回はここでロジックを組む。
    // (StatusEffectEditorComponentと同じロジック)

    // 最初のキャラクターを基準にする
    let commonParamList = this.characterDataService.getParameterList(targets[0]);

    for (let i = 1; i < targets.length; i++) {
      const targetParamList = this.characterDataService.getParameterList(targets[i]);
      const targetParamKeys = new Set(targetParamList.map(p => p.key));
      commonParamList = commonParamList.filter(p => targetParamKeys.has(p.key));
    }

    this.availableParameters = commonParamList.sort((a, b) => a.name.localeCompare(b.name, 'ja'));

    // 選択中のパラメータがなくなっていたらリセット
    if (this.selectedParameterName && !this.availableParameters.some(p => p.key === this.selectedParameterName)) {
      this.selectedParameterName = null;
    }
  }

  applyParameterChange(): void {
    if (!this.selectedCasterId || this.selectedTargetIds.size === 0 || !this.selectedParameterName || this.parameterValue === 0) {
      console.warn('Parameter change: Missing essential data for execution');
      return;
    }

    const targets = Array.from(this.selectedTargetIds).map(id => this.characterDataService.getGameCharacter(id)).filter(c => c !== null) as GameCharacter[];
    if (targets.length === 0) {
      console.warn('Parameter change: No valid targets found.');
      return;
    }

    // キーから要素名を抽出 (例: "HP.currentValue" -> "HP")
    const elementName = this.selectedParameterName.split('.')[0];

    // ダメージ適用確認パネルを開く
    this.pluginUiService.openAtCursor(DamageCheckPanelComponent, {
      title: 'ダメージ・回復適用確認',
      width: 450, // 適当な初期値、AutoLayoutPanelが調整
      height: 300, // 適当な初期値
      layout: 'full-auto',
      isSingleton: true, // ★追加
      inputs: {
        casterId: this.selectedCasterId,
        targets: targets,
        baseValue: this.parameterValue,
        targetParamName: elementName,
        config: this.damageCheckConfig
      }
    });
  }

  onCasterChange(): void {
    // 術者が変更されたら、他の入力項目をリセットする
    this.selectedTargetIds = new Set();
    this.selectedParameterName = null;
    this.parameterValue = 0;
    this.selectedStatusEffectId = null; // リセット
    this.updateAvailableParameters(); // パラメータリストもリセット
  }

  // --- ステータス効果付与 ---
  applyStatusEffect(): void {
    if (!this.selectedStatusEffectId || this.selectedTargetIds.size === 0) {
      console.warn('Status effect apply: Missing essential data', { effectId: this.selectedStatusEffectId, targets: this.selectedTargetIds });
      return;
    }

    const effectTemplate = this.statusEffectTemplates.find(e => e.id === this.selectedStatusEffectId);
    if (!effectTemplate) {
      console.warn('Status effect apply: Template not found');
      return;
    }

    const targets = Array.from(this.selectedTargetIds);
    // 術者IDは、ログ出力などに使う場合に備えて渡すが、addStatusEffect自体は術者を必須としない設計
    // CombatStateService.addStatusEffect は現状 targetPersistentId と effect を取る
    
    targets.forEach(targetId => {
      this.combatStateService.addStatusEffect(targetId, effectTemplate);
    });

    // ログ出力
    const caster = this.selectedCasterId ? this.characterDataService.resolveCharacter(this.selectedCasterId) : null;

    const targetObjects = targets.map(id => this.characterDataService.resolveCharacter(id)).filter(c => c !== null) as GameCharacter[];
    if (targetObjects.length > 0) {
      this.combatLogService.logStatusEffectApply(
        caster,
        targetObjects,
        effectTemplate.name
      );
    }
    // 連続付与のため、選択状態は維持する
  }

  // --- 付与済み効果の操作 ---

  get singleSelectedTargetId(): string | null {
    return this.selectedTargetIds.size === 1 ? this.selectedTargetIds.values().next().value : null;
  }

  getActiveStatusEffects(characterId: string | null): ActiveStatusEffect[] {
    if (!characterId) return [];
    return this.combatStateService.getActiveStatusEffects(characterId);
  }

  // --- ログ連携機能 ---

  onTargetSelectButtonClick(): void {
    if (!this.selectedCasterId) return;
    const caster = this.characterDataService.resolveCharacter(this.selectedCasterId);
    if (!caster) return;

    const targets = this.combatStateService.findTargetsFromChat(caster, this.availableChatTabs);
    if (targets.length > 0) {
      // 永続IDを抽出
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
      this.parameterValue = -result; // ダメージ適用を想定して負の値にするのがデフォルト
      this.changeDetectorRef.markForCheck();
    }
  }

  toggleParameterSign(): void {
    this.parameterValue = -this.parameterValue;
  }

  /**
   * 付与済み効果をクリックしたときの処理。残り時間を1減らす（0以下で削除）。
   */
  onAppliedEffectClick(effect: ActiveStatusEffect): void {
    const targetId = this.singleSelectedTargetId;
    if (!targetId) return;
    
    // ID(DataElementのidentifier) を使って更新
    this.combatStateService.updateStatusEffectRound(targetId, effect.id, -1);
  }

  /**
   * 付与済み効果を右クリックしたときの処理。残り時間を1増やす。
   */
  onAppliedEffectRightClick(event: MouseEvent, effect: ActiveStatusEffect): void {
    event.preventDefault(); // コンテキストメニュー抑制
    const targetId = this.singleSelectedTargetId;
    if (!targetId) return;

    this.combatStateService.updateStatusEffectRound(targetId, effect.id, 1);
  }
}
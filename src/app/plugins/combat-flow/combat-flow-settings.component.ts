import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { PanelService } from '../../service/panel.service';
import { PluginUiService, PluginPanelOption } from '../service/plugin-ui.service';
import { CombatStateService } from './combat-state.service';
import { CombatLogService } from './combat-log.service';
import { ChatTabList } from '@udonarium/chat-tab-list';
import { ChatTab } from '@udonarium/chat-tab';
import { GameCharacter } from '@udonarium/game-character';
import { ObjectStore } from '@udonarium/core/synchronize-object/object-store';
import { Observable, Subject } from 'rxjs';
import { map, shareReplay, takeUntil } from 'rxjs/operators';
import { CombatFlowPanelComponent } from './combat-flow-panel.component';
import { StatusEffect, VisualEffect } from './status-effect.model';
import { StatusEffectDictionaryService } from './status-effect-dictionary.service';
import { PluginHelperService } from '../service/plugin-helper.service';
import { PluginDataObserverService } from '../service/plugin-data-observer.service';
import { PluginDataContainer } from '../../class/plugin-data-container';
import { CharacterDataService } from '../service/character-data.service';
import { SaveDataService } from '../../service/save-data.service';
import { DataElement } from '@udonarium/data-element';

@Component({
  selector: 'app-combat-flow-settings',
  templateUrl: './combat-flow-settings.component.html',
  styleUrls: ['./combat-flow-settings.component.css']
})
export class CombatFlowSettingsComponent implements OnInit, OnDestroy {
  activeTab: 'status-effects' | 'settings' = 'status-effects';
  private unsubscribe$ = new Subject<void>();

  // --- ステータス効果管理用 ---
  private readonly PLUGIN_ID = 'combat-flow';
  private dictionaryContainer: PluginDataContainer | null = null;
  statusEffectTemplates: StatusEffect[] = [];
  selectedEffectIndex: number = -1;
  editingEffect: StatusEffect | null = null; // 編集中のモデル（ディープコピー）

  // UIモデル（エディタ用）
  uiModel = {
    filters: { inverse: false, hollow: false, blackPaint: false, grayscale: false },
    aura: { enabled: false, color: '#ff0000' },
    backgroundColor: { enabled: false, color: '#cccccc' },
    effectType: 'attributeChange' as 'attributeChange' | 'buffDebuff',
    targetParam: '',
    value: 0
  };

  availableParameters: { key: string, name: string }[] = [];
  showAllParameters: boolean = false;
  private characterSource: GameCharacter[] = [];

  // --- チャット設定 ---
  messageTargetTabId: string = '';
  selectedLogSenderName: string = '';
  availableLogSenders$: Observable<GameCharacter[]>;

  get availableChatTabs(): ChatTab[] {
    return ChatTabList.instance.chatTabs;
  }

  // --- 表示設定 ---
  displayDataTags: string = 'HP MP';

  // --- ダメージ適用確認設定 ---
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
    private panelService: PanelService,
    private pluginUiService: PluginUiService,
    private pluginHelper: PluginHelperService,
    private observerService: PluginDataObserverService,
    private dictionaryService: StatusEffectDictionaryService,
    private combatStateService: CombatStateService,
    private combatLogService: CombatLogService,
    private characterDataService: CharacterDataService,
    private saveDataService: SaveDataService,
    private changeDetectorRef: ChangeDetectorRef
  ) { 
    this.combatStateService.displayDataTags$.pipe(takeUntil(this.unsubscribe$)).subscribe(tags => {
      this.displayDataTags = tags;
      this.changeDetectorRef.markForCheck();
    });
  }

  ngOnInit(): void {
    // ステータス効果辞書の初期化
    this.dictionaryContainer = this.pluginHelper.getOrCreateContainer(this.PLUGIN_ID, 'status-effect-dictionary');
    
    // 辞書更新の監視
    this.observerService.observe(this, this.PLUGIN_ID, 'status-effect-dictionary', container => {
      this.dictionaryContainer = container;
      this.updateTemplates();
      // 初回ロード
      this.dictionaryService.loadDefaultDictionary(this.dictionaryContainer).then(() => {
        this.updateTemplates();
      });
    });
    this.updateTemplates();

    // パラメータリスト用のキャラソース取得
    this.characterSource = this.characterDataService.getAllTabletopCharacters();
    this.updateAvailableParameters();

    // チャットタブの初期化
    if (this.availableChatTabs.length > 0 && !this.messageTargetTabId) {
      this.messageTargetTabId = this.availableChatTabs[0].identifier;
      this.combatLogService.setTargetTabIdentifier(this.messageTargetTabId);
    }

    // ログ送信元リストの構築
    this.availableLogSenders$ = this.combatStateService.charactersForSelection$.pipe(
      map(() => {
        const allCharacters = ObjectStore.instance.getObjects<GameCharacter>(GameCharacter);
        const relevantCharacters = allCharacters.filter(char => char.location.name !== 'graveyard');
        
        const uniqueCharsByName = new Map<string, GameCharacter>();
        relevantCharacters.forEach(char => {
          if (!uniqueCharsByName.has(char.name)) {
            uniqueCharsByName.set(char.name, char);
          }
        });

        return Array.from(uniqueCharsByName.values()).sort((a, b) => a.name.localeCompare(b.name, 'ja'));
      }),
      shareReplay(1)
    );

    this.combatStateService.systemLogSenderName$.pipe(takeUntil(this.unsubscribe$)).subscribe(name => {
      this.selectedLogSenderName = name;
      this.changeDetectorRef.markForCheck();
    });

    // ダメージチェック設定のロード
    this.loadDamageCheckConfig();
  }

  ngOnDestroy(): void {
    this.unsubscribe$.next();
    this.unsubscribe$.complete();
  }

  // --- ステータス効果管理 ---

  private updateTemplates(): void {
    if (!this.dictionaryContainer) return;
    const currentList = this.dictionaryService.getTemplates(this.dictionaryContainer);
    // リストが更新された場合、選択状態を維持できるか確認
    // IDベースで追跡するのが理想だが、簡易的にインデックスで管理
    // (外部からの変更でインデックスがズレるリスクはあるが、個人利用範囲内として許容)
    this.statusEffectTemplates = currentList;
    
    // 選択中のエフェクトが削除されていたら選択解除
    if (this.selectedEffectIndex >= this.statusEffectTemplates.length) {
      this.selectedEffectIndex = -1;
      this.editingEffect = null;
    }
    this.changeDetectorRef.markForCheck();
  }

  selectEffect(index: number): void {
    if (index < 0 || index >= this.statusEffectTemplates.length) {
      this.selectedEffectIndex = -1;
      this.editingEffect = null;
      return;
    }
    
    this.selectedEffectIndex = index;
    // 編集用にディープコピーを作成
    this.editingEffect = JSON.parse(JSON.stringify(this.statusEffectTemplates[index]));
    this.initializeUiModel();
    this.updateAvailableParameters();
  }

  createNewEffect(): void {
    const newEffect: StatusEffect = {
      id: '', // 新規作成時は空
      name: '新しい効果',
      emoji: '✨',
      description: '',
      duration: 3,
      isPermanent: false,
      visualEffects: [],
      effects: []
    };
    
    // リストにはまだ追加せず、エディタに表示
    this.selectedEffectIndex = -1; // リスト選択なし
    this.editingEffect = newEffect;
    this.initializeUiModel();
    this.updateAvailableParameters();
  }

  saveEffect(): void {
    if (!this.dictionaryContainer || !this.editingEffect) return;

    this.syncFormModelWithUi();

    if (this.editingEffect.id) {
      // 更新
      this.dictionaryService.updateTemplate(this.dictionaryContainer, this.editingEffect);
    } else {
      // 新規作成 (IDはサービス内で生成される)
      const { id, ...data } = this.editingEffect;
      const newId = this.dictionaryService.addTemplate(this.dictionaryContainer, data);
      
      // 作成されたエフェクトを選択状態にするためにリストを更新し、IDで検索
      this.updateTemplates();
      // ID検索は非同期更新のタイミング問題があるため、簡易的に末尾を選択
      // (通常は同期的に更新されるはず)
      // 正確には updateTemplates 内で detector を呼んでいるので、次のサイクルで反映される
    }
    
    // リストを再取得して反映
    this.updateTemplates();
    
    // 保存したエフェクトを選択状態にする（新規作成の場合も考慮）
    if (!this.editingEffect.id) {
       // 新規追加されたものは末尾にあるはず
       this.selectedEffectIndex = this.statusEffectTemplates.length - 1;
       this.selectEffect(this.selectedEffectIndex);
    }
  }

  deleteEffect(): void {
    if (!this.dictionaryContainer || this.selectedEffectIndex < 0) return;
    const effect = this.statusEffectTemplates[this.selectedEffectIndex];
    if (!confirm(`「${effect.name}」を削除しますか？`)) return;

    this.dictionaryService.removeTemplate(this.dictionaryContainer, effect.id);
    this.updateTemplates();
    this.selectedEffectIndex = -1;
    this.editingEffect = null;
  }

  exportSingleEffectAsZip(): void {
    if (!this.editingEffect) return;
    this.syncFormModelWithUi();

    const effectElement = this.dictionaryService.exportEffectToElement(this.editingEffect);
    const rootElement = DataElement.create('status-effect-data', '', {}, '');
    rootElement.appendChild(effectElement);

    this.saveDataService.saveDataElementAsync(rootElement, 'status-effect', `ステータス効果_${this.editingEffect.name}`);
  }

  exportStatusEffectDictionaryAsZip(): void {
    if (!this.dictionaryContainer) return;
    this.saveDataService.saveGameObjectAsync(this.dictionaryContainer, 'plugin_combat-flow_status-effect-dictionary');
  }

  // --- UIモデル/フォーム同期ロジック (旧StatusEffectEditorから移植) ---

  private initializeUiModel(): void {
    if (!this.editingEffect) return;

    // リセット
    this.uiModel = {
      filters: { inverse: false, hollow: false, blackPaint: false, grayscale: false },
      aura: { enabled: false, color: '#ff0000' },
      backgroundColor: { enabled: false, color: '#cccccc' },
      effectType: 'attributeChange',
      targetParam: '',
      value: 0
    };

    // visualEffects 復元
    if (this.editingEffect.visualEffects) {
      for (const ve of this.editingEffect.visualEffects) {
        if (ve.type === 'filter') {
          if (ve.value.includes('invert')) this.uiModel.filters.inverse = true;
          if (ve.value.includes('blur')) this.uiModel.filters.hollow = true;
          if (ve.value.includes('brightness(0)')) this.uiModel.filters.blackPaint = true;
          if (ve.value.includes('grayscale')) this.uiModel.filters.grayscale = true;
        } else if (ve.type === 'aura') {
          this.uiModel.aura.enabled = true;
          this.uiModel.aura.color = ve.value;
        } else if (ve.type === 'backgroundColor') {
          this.uiModel.backgroundColor.enabled = true;
          this.uiModel.backgroundColor.color = ve.value;
        }
      }
    }

    // effects 復元 (最初の1つだけ)
    if (this.editingEffect.effects && this.editingEffect.effects.length > 0) {
      const firstEffect = this.editingEffect.effects[0];
      this.uiModel.effectType = firstEffect.type;
      this.uiModel.targetParam = firstEffect.target;
      this.uiModel.value = firstEffect.value;
    }
  }

  private syncFormModelWithUi(): void {
    if (!this.editingEffect) return;

    const newVisualEffects: VisualEffect[] = [];
    let filterValue = '';
    if (this.uiModel.filters.inverse) filterValue += ' invert(100%)';
    if (this.uiModel.filters.hollow) filterValue += ' blur(3px)';
    if (this.uiModel.filters.blackPaint) filterValue += ' brightness(0)';
    if (this.uiModel.filters.grayscale) filterValue += ' grayscale(100%)';
    
    if (filterValue) {
      newVisualEffects.push({ type: 'filter', value: filterValue.trim() });
    }
    if (this.uiModel.aura.enabled) {
      newVisualEffects.push({ type: 'aura', value: this.uiModel.aura.color });
    }
    if (this.uiModel.backgroundColor.enabled) {
      newVisualEffects.push({ type: 'backgroundColor', value: this.uiModel.backgroundColor.color });
    }
    this.editingEffect.visualEffects = newVisualEffects;

    this.editingEffect.effects = [];
    if (this.uiModel.targetParam && this.uiModel.value !== 0) {
      this.editingEffect.effects.push({
        type: this.uiModel.effectType,
        target: this.uiModel.targetParam,
        value: this.uiModel.value
      });
    }
  }

  toggleShowAllParameters(): void {
    this.showAllParameters = !this.showAllParameters;
    this.updateAvailableParameters();
  }

  private updateAvailableParameters(): void {
    if (!this.characterSource || this.characterSource.length === 0) {
      this.availableParameters = [];
      return;
    }

    // 1. 共通パラメータ確認
    if (!this.showAllParameters && this.uiModel.targetParam) {
      let commonParams = this.characterDataService.getParameterList(this.characterSource[0]);
      for (let i = 1; i < this.characterSource.length; i++) {
        const targetParams = this.characterDataService.getParameterList(this.characterSource[i]);
        const targetParamKeys = new Set(targetParams.map(p => p.key));
        commonParams = commonParams.filter(p => targetParamKeys.has(p.key));
      }
      const commonParamKeys = new Set(commonParams.map(p => p.key));
      if (!commonParamKeys.has(this.uiModel.targetParam)) {
        this.showAllParameters = true;
      }
    }

    // 2. リスト構築
    let calculatedParams: { key: string, name: string }[] = [];
    if (this.showAllParameters) {
      const allParams = new Map<string, { key: string, name: string }>();
      for (const character of this.characterSource) {
        const combatantParams = this.characterDataService.getParameterList(character);
        for (const param of combatantParams) {
          if (!allParams.has(param.key)) {
            allParams.set(param.key, param);
          }
        }
      }
      calculatedParams = Array.from(allParams.values());
    } else {
      let commonParams = this.characterDataService.getParameterList(this.characterSource[0]);
      for (let i = 1; i < this.characterSource.length; i++) {
        const targetParams = this.characterDataService.getParameterList(this.characterSource[i]);
        const targetParamKeys = new Set(targetParams.map(p => p.key));
        commonParams = commonParams.filter(p => targetParamKeys.has(p.key));
      }
      calculatedParams = commonParams;
    }

    // 3. 未検出パラメータの保護
    const existingParamKeys = new Set(calculatedParams.map(p => p.key));
    if (this.uiModel.targetParam && !existingParamKeys.has(this.uiModel.targetParam)) {
      calculatedParams.push({ key: this.uiModel.targetParam, name: `(未検出: ${this.uiModel.targetParam})` });
    }

    this.availableParameters = calculatedParams.sort((a, b) => a.name.localeCompare(b.name, 'ja'));
    this.changeDetectorRef.markForCheck();
  }

  // --- イベントハンドラ (Settings) ---

  onMessageTargetTabChange(tabIdentifier: string): void {
    this.messageTargetTabId = tabIdentifier;
    this.combatLogService.setTargetTabIdentifier(tabIdentifier);
  }

  onSystemLogSenderNameChange(name: string): void {
    this.combatStateService.setSystemLogSenderName(name);
  }

  onDisplayDataTagsChange(tags: string): void {
    this.combatStateService.updateDisplayDataTags(tags);
  }

  // --- パネル操作 ---
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

  // --- ダメージ適用確認設定 ---
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

  close(): void {
    this.panelService.close();
  }
}

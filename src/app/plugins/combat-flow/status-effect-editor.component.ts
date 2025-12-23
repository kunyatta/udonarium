import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy, Input } from '@angular/core';
import { PanelService } from '../../service/panel.service';
import { PluginHelperService } from '../service/plugin-helper.service';
import { StatusEffectDictionaryService } from './status-effect-dictionary.service';
import { StatusEffect, Effect, VisualEffect } from './status-effect.model';
import { PluginDataContainer } from '../../class/plugin-data-container';
import { CharacterDataService } from '../service/character-data.service';
import { CombatStateService } from './combat-state.service';
import { GameCharacter } from '@udonarium/game-character';

@Component({
  selector: 'app-status-effect-editor',
  templateUrl: './status-effect-editor.component.html',
  styleUrls: ['./status-effect-editor.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StatusEffectEditorComponent implements OnInit, OnDestroy {

  private _effect: StatusEffect | null = null;
  @Input()
  set effect(value: StatusEffect | null) {
    this._effect = value;
    this.initializeFormModel();
    this.updateAvailableParameters();
    this.changeDetectorRef.markForCheck();
  }
  get effect(): StatusEffect | null { return this._effect; }

  private _pluginId: string = 'combat-flow';
  @Input()
  set pluginId(value: string) {
    this._pluginId = value;
    this.initializeContainer();
    this.changeDetectorRef.markForCheck();
  }
  get pluginId(): string { return this._pluginId; }

  private _fileNameHint: string = 'default';
  @Input()
  set fileNameHint(value: string) {
    this._fileNameHint = value;
    this.initializeContainer();
    this.changeDetectorRef.markForCheck();
  }
  get fileNameHint(): string { return this._fileNameHint; }

  // フォームモデル
  formModel: StatusEffect;

  // 利用可能なパラメータ
  availableParameters: { key: string, name: string }[] = [];
  showAllParameters: boolean = false;
  private characterSource: GameCharacter[] = [];

  private container: PluginDataContainer | null = null;

  constructor(
    private panelService: PanelService,
    private changeDetectorRef: ChangeDetectorRef,
    private pluginHelper: PluginHelperService,
    private dictionaryService: StatusEffectDictionaryService,
    private characterDataService: CharacterDataService,
    private combatStateService: CombatStateService
  ) { }

  ngOnInit(): void {
    // キャラクター情報の取得は一度だけ
    this.characterSource = this.characterDataService.getAllTabletopCharacters();

    // 初期化処理を明示的に呼び出し、安全な初期状態を作る
    this.initializeContainer();
    this.initializeFormModel();
    this.updateAvailableParameters();
  }

  private initializeContainer(): void {
    this.container = this.pluginHelper.getOrCreateContainer(this._pluginId, this._fileNameHint);
    this.initializeFormModel();
    this.updateAvailableParameters();
  }

  private initializeFormModel(): void {
    if (this._effect) {
      this.formModel = JSON.parse(JSON.stringify(this._effect));
    } else {
      this.formModel = {
        id: '', // 新規作成時は空
        name: '新しい効果',
        emoji: '✨',
        description: '',
        duration: 3,
        isPermanent: false,
        visualEffects: [],
        effects: []
      };
    }
    // formModelが初期化されてからUIモデルを復元
    this.initializeUiModelFromFormModel();
  }

  // UI制御用の中間モデル (初期化はここに集約)
  uiModel: {
    filters: {
      inverse: boolean;
      hollow: boolean;
      blackPaint: boolean;
      grayscale: boolean;
    };
    aura: {
      enabled: boolean;
      color: string;
    };
    backgroundColor: {
      enabled: boolean;
      color: string;
    };
    effectType: 'attributeChange' | 'buffDebuff';
    targetParam: string;
    value: number;
  } = {
    filters: {
      inverse: false,
      hollow: false,
      blackPaint: false,
      grayscale: false
    },
    aura: {
      enabled: false,
      color: '#ff0000'
    },
    backgroundColor: {
      enabled: false,
      color: '#cccccc'
    },
    // 機械的効果の簡易編集用
    effectType: 'attributeChange',
    targetParam: '',
    value: 0
  };

  private initializeUiModelFromFormModel(): void {
    // UIモデルの初期状態をリセット
    this.uiModel = {
      filters: {
        inverse: false,
        hollow: false,
        blackPaint: false,
        grayscale: false
      },
      aura: {
        enabled: false,
        color: '#ff0000'
      },
      backgroundColor: {
        enabled: false,
        color: '#cccccc'
      },
      effectType: 'attributeChange',
      targetParam: '',
      value: 0
    };

    // visualEffects から UIフラグを復元
    if (this.formModel.visualEffects) {
      for (const ve of this.formModel.visualEffects) {
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

    // effects から簡易編集用プロパティを復元（最初の1つだけを対象とする）
    if (this.formModel.effects && this.formModel.effects.length > 0) {
      const firstEffect = this.formModel.effects[0];
      this.uiModel.effectType = firstEffect.type;
      this.uiModel.targetParam = firstEffect.target;
      this.uiModel.value = firstEffect.value;
    }
  }

  ngOnDestroy(): void {
  }

  onShowAllParametersChange(): void {
    this.updateAvailableParameters();
  }

  private updateAvailableParameters(): void {
    if (!this.characterSource || this.characterSource.length === 0) {
      this.availableParameters = [];
      return;
    }

    // 1. まず共通パラメータリストを取得し、現在の設定値が含まれているか確認する
    if (!this.showAllParameters && this.uiModel.targetParam) {
      let commonParams = this.characterDataService.getParameterList(this.characterSource[0]);
      for (let i = 1; i < this.characterSource.length; i++) {
        const targetParams = this.characterDataService.getParameterList(this.characterSource[i]);
        const targetParamKeys = new Set(targetParams.map(p => p.key));
        commonParams = commonParams.filter(p => targetParamKeys.has(p.key));
      }
      
      const commonParamKeys = new Set(commonParams.map(p => p.key));
      if (!commonParamKeys.has(this.uiModel.targetParam)) {
        // 共通パラメータに含まれていないターゲットがあるため、全表示モードに切り替える
        this.showAllParameters = true;
        this.changeDetectorRef.markForCheck();
      }
    }

    // 2. 決定された showAllParameters に基づいてリストを構築
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

    // 3. それでもリストに含まれていないtarget（盤上に全く存在しないパラメータ）を追加
    const existingParamKeys = new Set(calculatedParams.map(p => p.key));
    if (this.uiModel.targetParam && !existingParamKeys.has(this.uiModel.targetParam)) {
      calculatedParams.push({ key: this.uiModel.targetParam, name: `(未検出: ${this.uiModel.targetParam})` });
    }

    this.availableParameters = calculatedParams.sort((a, b) => a.name.localeCompare(b.name, 'ja'));
  }


  // --- 保存・キャンセル ---

  save(): void {
    if (!this.container) return;

    // UIモデルから visualEffects を再構築
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
    this.formModel.visualEffects = newVisualEffects;

    // UIモデルから effects を再構築 (単一効果のみサポート)
    this.formModel.effects = [];
    if (this.uiModel.targetParam && this.uiModel.value !== 0) {
      this.formModel.effects.push({
        type: this.uiModel.effectType,
        target: this.uiModel.targetParam,
        value: this.uiModel.value
      });
    }

    if (this.formModel.id) {
      // 更新
      this.dictionaryService.updateTemplate(this.container, this.formModel);
    } else {
      // 新規作成 (IDはサービス内で生成されるため除外)
      const { id, ...data } = this.formModel;
      this.dictionaryService.addTemplate(this.container, data);
    }
    this.panelService.close();
  }

  cancel(): void {
    this.panelService.close();
  }
}

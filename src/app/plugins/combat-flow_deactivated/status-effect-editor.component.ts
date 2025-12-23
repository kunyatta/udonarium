import { Component, OnInit, Input } from '@angular/core';
import { ObjectStore } from '@udonarium/core/synchronize-object/object-store';
import { PanelService } from 'service/panel.service';
import { GameCharacter } from '@udonarium/game-character';

import { DataElement } from '@udonarium/data-element';
import { StatusEffect } from './models/status-effect';
import { StatusEffectDictionary } from './models/status-effect-dictionary';
import { Effect } from './models/status-effect'; // Effect インターフェースをインポート
import { CombatStateService } from './combat-state.service';

@Component({
  selector: 'app-status-effect-editor',
  templateUrl: './status-effect-editor.component.html',
  styleUrls: ['./status-effect-editor.component.css']
})
export class StatusEffectEditorComponent implements OnInit {
  // PanelServiceから開かれる場合、プロパティはpublicである必要がある
  public statusEffect: StatusEffect | null = null;
  @Input() public characterSource: GameCharacter[] = [];

  isNew: boolean = false;
  availableParameters: { key: string, name: string }[] = [];

  formModel = {
    name: '',
    emoji: '', // 絵文字アイコン
    initialRounds: 0, // ★ 初期持続時間
    isPermanent: true, // 永続フラグ
    description: '',
    effectType: 'attributeChange' as 'attributeChange' | 'buffDebuff', // 追加
    targetParam: '', // 追加
    value: 0, // 追加
    showAllParameters: false,
    filters: {
      inverse: false,
      hollow: false,
      blackPaint: false,
      grayscale: false
    },
    aura: {
      enabled: false,
      color: '#ff0000' // デフォルトは赤
    },
    backgroundColor: {
      enabled: false,
      color: '#cccccc' // デフォルトはライトグレー
    }
  };

  constructor(private panelService: PanelService, private combatStateService: CombatStateService) { }

  ngOnInit(): void {
    if (this.statusEffect) {
      this.isNew = false;
      this.initializeFormModel(this.statusEffect);
    } else {
      this.isNew = true;
    }
    this.updateAvailableParameters();
  }

  private initializeFormModel(effect: StatusEffect): void {
    this.formModel.name = effect.name;
    this.formModel.emoji = effect.emoji || effect.icon; // iconは後方互換性のため
    this.formModel.description = effect.description;

    if (effect.initialRounds === -1) { // -1 を永続とみなす
      this.formModel.isPermanent = true;
      this.formModel.initialRounds = 0; // UI表示用
    } else {
      this.formModel.isPermanent = false;
      this.formModel.initialRounds = effect.initialRounds;
    }

    // Reset color effects before initializing
    this.formModel.aura.enabled = false;
    this.formModel.backgroundColor.enabled = false;

    for (const ve of effect.visualEffects) {
      if (ve.type === 'filter') {
        if (ve.value.includes('invert')) this.formModel.filters.inverse = true;
        if (ve.value.includes('blur')) this.formModel.filters.hollow = true;
        if (ve.value.includes('brightness(0)')) this.formModel.filters.blackPaint = true;
        if (ve.value.includes('grayscale')) this.formModel.filters.grayscale = true;
      } else if (ve.type === 'aura') {
        this.formModel.aura.enabled = true;
        this.formModel.aura.color = ve.value;
      } else if (ve.type === 'backgroundColor') {
        this.formModel.backgroundColor.enabled = true;
        this.formModel.backgroundColor.color = ve.value;
      }
    }

    // 機械的な効果の初期化
    if (effect.effects && effect.effects.length > 0) {
      const mechanicalEffect = effect.effects[0]; // 現時点では1つだけを想定
      if (mechanicalEffect.type === 'attributeChange') {
        this.formModel.effectType = 'attributeChange';
        this.formModel.targetParam = mechanicalEffect.target;
        this.formModel.value = mechanicalEffect.value;
      } else if (mechanicalEffect.type === 'buffDebuff') { // 未実装だが設定だけは可能
        this.formModel.effectType = 'buffDebuff';
        this.formModel.targetParam = mechanicalEffect.target;
        this.formModel.value = mechanicalEffect.value;
      }
    }
  }

  save(): void {
    let targetEffect: StatusEffect;
    if (this.isNew) {
      targetEffect = new StatusEffect();
      targetEffect.persistentId = crypto.randomUUID(); // ★ Add persistent ID
      targetEffect.initialize();
    } else {
      targetEffect = this.statusEffect;
    }

    targetEffect.name = this.formModel.name;
    targetEffect.emoji = this.formModel.emoji;
    targetEffect.icon = ''; // 古いプロパティをクリア
    targetEffect.description = this.formModel.description;
    // ★ テンプレートの初期持続時間のみを設定する
    targetEffect.initialRounds = this.formModel.isPermanent ? -1 : this.formModel.initialRounds;

    const newVisualEffects: { type: string, value: string }[] = [];
    let filterValue = '';
    if (this.formModel.filters.inverse) filterValue += ' invert(100%)';
    if (this.formModel.filters.hollow) filterValue += ' blur(3px)';
    if (this.formModel.filters.blackPaint) filterValue += ' brightness(0)';
    if (this.formModel.filters.grayscale) filterValue += ' grayscale(100%)';
    
    if (filterValue) {
      newVisualEffects.push({ type: 'filter', value: filterValue.trim() });
    }

    if (this.formModel.aura.enabled) {
      newVisualEffects.push({ type: 'aura', value: this.formModel.aura.color });
    }

    if (this.formModel.backgroundColor.enabled) {
      newVisualEffects.push({ type: 'backgroundColor', value: this.formModel.backgroundColor.color });
    }

    targetEffect.visualEffects = newVisualEffects;

    // 機械的な効果の保存
    const newMechanicalEffects: Effect[] = [];
    if (this.formModel.effectType === 'attributeChange' && this.formModel.targetParam && this.formModel.value !== 0) {
      newMechanicalEffects.push({
        type: 'attributeChange',
        target: this.formModel.targetParam,
        value: this.formModel.value
      });
    } else if (this.formModel.effectType === 'buffDebuff' && this.formModel.targetParam && this.formModel.value !== 0) {
      // 未実装だが、設定だけは保存
      newMechanicalEffects.push({
        type: 'buffDebuff',
        target: this.formModel.targetParam,
        value: this.formModel.value
      });
    }
    targetEffect.effects = newMechanicalEffects;

    if (this.isNew) {
      ObjectStore.instance.add(targetEffect);
      const dictionary = ObjectStore.instance.get<StatusEffectDictionary>('StatusEffectDictionary');
      if (dictionary) {
        dictionary.templates.push(targetEffect.identifier);
      }
    }
    this.combatStateService.saveDictionary();
    this.panelService.close();
  }

  onPermanentChange(): void {
    if (!this.formModel.isPermanent && this.formModel.initialRounds === 0) {
      this.formModel.initialRounds = 1; // Set a default value when permanent is unchecked and initialRounds is 0
    }
  }

  onShowAllParametersChange(): void {
    this.updateAvailableParameters();
  }

  cancel(): void {
    this.panelService.close();
  }

  private getCharacterParameters(character: GameCharacter): { key: string, name: string }[] {
    const params: { key: string, name: string }[] = [];
    if (!character || !character.detailDataElement) return params;

    const numberResources = character.detailDataElement.getElementsByType('numberResource');
    const simpleNumbers = character.detailDataElement.getElementsByType('simpleNumber');

    const allRelevantElements = [...numberResources, ...simpleNumbers];

    for (const element of allRelevantElements) {
      if (element.isNumberResource) {
        params.push({ key: `${element.name}.currentValue`, name: `${element.name} (現在値)` });
        params.push({ key: `${element.name}.value`, name: `${element.name} (最大値)` });
      } else if (element.isSimpleNumber) {
        params.push({ key: `${element.name}.value`, name: element.name });
      }
    }
    return params;
  }

  private updateAvailableParameters() {
    if (!this.characterSource || this.characterSource.length === 0) {
      this.availableParameters = [];
      return;
    }

    let calculatedParams: { key: string, name: string }[] = [];

    if (this.formModel.showAllParameters) {
      // 全てのパラメータを重複なく収集
      const allParams = new Map<string, { key: string, name: string }>();
      for (const character of this.characterSource) {
        const combatantParams = this.getCharacterParameters(character);
        for (const param of combatantParams) {
          if (!allParams.has(param.key)) {
            allParams.set(param.key, param);
          }
        }
      }
      calculatedParams = Array.from(allParams.values());
    } else {
      // 共通のパラメータのみを収集 (従来のロジック)
      let commonParams = this.getCharacterParameters(this.characterSource[0]);
      for (let i = 1; i < this.characterSource.length; i++) {
        const targetParams = this.getCharacterParameters(this.characterSource[i]);
        const targetParamKeys = new Set(targetParams.map(p => p.key));
        commonParams = commonParams.filter(p => targetParamKeys.has(p.key));
      }
      calculatedParams = commonParams;
    }

    this.availableParameters = calculatedParams.sort((a, b) => a.name.localeCompare(b.name, 'ja'));

    // 保存済みのパラメータが現在のリストにない場合の処理
    if (this.formModel.targetParam) {
      const isCurrentParamAvailable = this.availableParameters.some(p => p.key === this.formModel.targetParam);
      if (!isCurrentParamAvailable && !this.formModel.showAllParameters) {
        // 「全パラメータ表示」に切り替えて、リストを再計算・再設定する
        this.formModel.showAllParameters = true;
        this.updateAvailableParameters(); // 再帰的に呼び出してリストを更新
        return; // この後の処理は再帰呼び出し先で行う
      } else if (!isCurrentParamAvailable && this.formModel.showAllParameters) {
        // 全パラメータ表示でも見つからない場合はリセット
        this.formModel.targetParam = '';
      }
    }
  }
}

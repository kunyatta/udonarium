import { Injectable, OnDestroy } from '@angular/core';
import { PluginDataContainer } from '../../class/plugin-data-container';
import { DataElement } from '@udonarium/data-element';
import { StatusEffect, Effect, VisualEffect } from './status-effect.model';
import { PluginHelperService } from '../service/plugin-helper.service';
import { PluginDataTransferService } from '../service/plugin-data-transfer.service';
import { DICTIONARY_FILE_NAME_HINT, PLUGIN_ID } from './combat-flow.constants';

@Injectable({
  providedIn: 'root'
})
export class StatusEffectDictionaryService {

  private readonly PLUGIN_ID = PLUGIN_ID;
  private loadingDefaultDictionary = false; // フラグを追加

  constructor(
    private pluginHelper: PluginHelperService,
    private pluginDataTransfer: PluginDataTransferService
  ) {
    this.registerImportHandler();
  }

  /**
   * PluginDataTransferService にインポート時の処理を登録します。
   */
  private registerImportHandler() {
    this.pluginDataTransfer.register(this.PLUGIN_ID, async (data: DataElement) => {
      console.log('[StatusEffectDictionary] Data received from PluginDataTransferService.');
      await this.importFromDataElement(data);
    });
  }

  /**
   * インポートされた DataElement からステータス効果を取り込み、辞書に追加します。
   */
  private async importFromDataElement(dataElement: DataElement) {
    let container = this.pluginHelper.getOrCreateContainer(this.PLUGIN_ID, DICTIONARY_FILE_NAME_HINT);

    // インポート前にデフォルトをロード（空の場合のみ）
    await this.loadDefaultDictionary(container);

    // 受信したデータが <template> か、あるいは複数の <template> を含む親要素かを確認
    
    // 一括エクスポートされた辞書データ (<dictionary>) の場合
    if (dataElement.name === 'dictionary') {
       dataElement.children.forEach(child => {
         if (child instanceof DataElement && child.name === 'template') {
           this.importTemplate(container, child);
         }
       });
       return;
    }

    // 単体または複数テンプレートのリストの場合
    const templates: DataElement[] = [];
    if (dataElement.name === 'template') {
      templates.push(dataElement);
    } else {
      dataElement.children.forEach(child => {
        if (child instanceof DataElement && child.name === 'template') {
          templates.push(child);
        }
      });
    }

    templates.forEach(template => {
      this.importTemplate(container, template);
    });
  }

  private importTemplate(container: PluginDataContainer, templateElement: DataElement) {
    try {
      const effect = this.toStatusEffect(templateElement);
      // IDをリセットして新規追加
      const { id, ...effectData } = effect;
      this.addTemplate(container, effectData);
      console.log(`[StatusEffectDictionary] Imported: ${effect.name}`);
    } catch (e) {
      console.error('[StatusEffectDictionary] Failed to import effect:', e);
    }
  }

  // --- 読み取りメソッド ---
  
  /**
   * コンテナからステータス効果のテンプレート一覧を取得します。
   */
  getTemplates(container: PluginDataContainer): StatusEffect[] {
    const dictionaryRoot = container.state.getFirstElementByName('dictionary');
    if (!dictionaryRoot) return [];

    return dictionaryRoot.children.map(elem => this.toStatusEffect(elem as DataElement));
  }

  // --- CRUD（作成・更新・削除）メソッド ---

  /**
   * 新しいステータス効果テンプレートを辞書に追加します。
   * 同名の効果が既に存在する場合は、追加せずにスキップします。
   */
  addTemplate(container: PluginDataContainer, newEffectData: Omit<StatusEffect, 'id'>): void {
    const dictionaryRoot = this.findOrCreateDictionaryRoot(container);

    // 名前での重複チェック
    // child は ObjectNode なので DataElement にキャストしてからチェック
    const exists = dictionaryRoot.children.some(child => {
      if (!(child instanceof DataElement)) return false;
      const nameElement = child.getFirstElementByName('name');
      return nameElement && nameElement.value === newEffectData.name;
    });

    if (exists) {
      console.log(`[StatusEffectDictionary] Skipped duplicate effect: ${newEffectData.name}`);
      return;
    }

    const newEffect: StatusEffect = {
      id: crypto.randomUUID(), // 新しいIDを生成
      ...newEffectData
    };
    
    const templateElement = this.createTemplateElement(newEffect);
    dictionaryRoot.appendChild(templateElement);
    dictionaryRoot.update(); // 変更を通知
  }

  /**
   * 既存のステータス効果テンプレートを更新します。
   */
  updateTemplate(container: PluginDataContainer, updatedEffect: StatusEffect): void {
    const dictionaryRoot = this.findOrCreateDictionaryRoot(container);
    const targetElement = dictionaryRoot.children.find(elem => elem.identifier === updatedEffect.id);
    
    if (targetElement) {
      const newElement = this.createTemplateElement(updatedEffect);
      const index = dictionaryRoot.children.indexOf(targetElement);
      dictionaryRoot.removeChild(targetElement);
      dictionaryRoot.insertBefore(newElement, dictionaryRoot.children[index]);
      dictionaryRoot.update();
    }
  }

  /**
   * 指定されたIDのステータス効果テンプレートを削除します。
   */
  removeTemplate(container: PluginDataContainer, effectId: string): void {
    const dictionaryRoot = this.findOrCreateDictionaryRoot(container);
    const targetElement = dictionaryRoot.children.find(elem => elem.identifier === effectId);

    if (targetElement) {
      dictionaryRoot.removeChild(targetElement);
      dictionaryRoot.update();
    }
  }

  // --- インポート / エクスポート ---

  /**
   * assets/status-effect-dictionary.xml から初期データを読み込みます。
   * 既にデータが存在する場合は何もしません。
   */
  async loadDefaultDictionary(container: PluginDataContainer): Promise<void> {
    if (this.loadingDefaultDictionary) return;

    const dictionaryRoot = container.state.getFirstElementByName('dictionary');
    // 既にデータがあればロードしない
    if (dictionaryRoot && dictionaryRoot.children.length > 0) {
      return;
    }

    this.loadingDefaultDictionary = true;
    try {
      // 共通サービス経由でロード
      await this.pluginDataTransfer.loadDefaultData(this.PLUGIN_ID, 'assets/status-effect-dictionary.xml');
    } finally {
      this.loadingDefaultDictionary = false;
    }
  }

  /**
   * ステータス効果オブジェクトをエクスポート用の DataElement に変換します。
   */
  exportEffectToElement(effect: StatusEffect): DataElement {
    return this.createTemplateElement(effect);
  }

  /**
   * StatusEffect オブジェクトから ActiveStatusEffect 用の DataElement ツリーを生成します。
   */
  createActiveEffectElement(effect: StatusEffect, currentRound: number = 1): DataElement {
    const instanceId = crypto.randomUUID();
    const root = DataElement.create('active-effect', '', {}, instanceId);

    root.appendChild(DataElement.create('name', effect.name, {}));
    root.appendChild(DataElement.create('emoji', effect.emoji, {}));
    root.appendChild(DataElement.create('description', effect.description, {}));
    root.appendChild(DataElement.create('duration', effect.duration, {}));
    root.appendChild(DataElement.create('isPermanent', String(effect.isPermanent), {}));

    const initialRemaining = effect.isPermanent ? -1 : effect.duration;
    root.appendChild(DataElement.create('remainingRounds', initialRemaining, {}));
    root.appendChild(DataElement.create('startRound', currentRound, {}));

    const visualEffectsRoot = DataElement.create('visualEffects', '', {});
    effect.visualEffects.forEach(v => {
      const vElem = DataElement.create('visualEffect', '', { type: v.type, value: v.value });
      visualEffectsRoot.appendChild(vElem);
    });
    root.appendChild(visualEffectsRoot);

    const effectsRoot = DataElement.create('effects', '', {});
    effect.effects.forEach(e => {
      const eElem = DataElement.create('effect', '', { 
        type: e.type, 
        target: e.target, 
        value: e.value,
      });
      effectsRoot.appendChild(eElem);
    });
    root.appendChild(effectsRoot);

    return root;
  }

  /**
   * DataElement ツリーから ActiveStatusEffect オブジェクトを復元します。
   */
  toActiveStatusEffect(element: DataElement): any {
    const statusEffect = this.toStatusEffect(element);
    
    const remainingRounds = Number(element.getFirstElementByName('remainingRounds')?.value) || 0;
    const startRound = Number(element.getFirstElementByName('startRound')?.value) || 0;

    return {
      ...statusEffect,
      remainingRounds,
      startRound
    };
  }

  // --- ヘルパーメソッド ---

  private findOrCreateDictionaryRoot(container: PluginDataContainer): DataElement {
    let dictionaryRoot = container.state.getFirstElementByName('dictionary');
    if (!dictionaryRoot) {
      dictionaryRoot = DataElement.create('dictionary', '', {});
      container.state.appendChild(dictionaryRoot);
    }
    return dictionaryRoot;
  }
  
  private createTemplateElement(effect: StatusEffect): DataElement {
    const templateRoot = DataElement.create('template', '', {}, effect.id);

    templateRoot.appendChild(DataElement.create('name', effect.name, {}));
    templateRoot.appendChild(DataElement.create('emoji', effect.emoji, {}));
    templateRoot.appendChild(DataElement.create('description', effect.description, {}));
    templateRoot.appendChild(DataElement.create('duration', effect.duration, {}));
    templateRoot.appendChild(DataElement.create('isPermanent', String(effect.isPermanent), {}));

    const visualEffectsRoot = DataElement.create('visualEffects', '', {});
    effect.visualEffects.forEach(v => {
      const vElem = DataElement.create('visualEffect', '', { type: v.type, value: v.value });
      visualEffectsRoot.appendChild(vElem);
    });
    templateRoot.appendChild(visualEffectsRoot);

    const effectsRoot = DataElement.create('effects', '', {});
    effect.effects.forEach(e => {
      const eElem = DataElement.create('effect', '', { 
        type: e.type, 
        target: e.target, 
        value: e.value,
      });
      effectsRoot.appendChild(eElem);
    });
    templateRoot.appendChild(effectsRoot);

    return templateRoot;
  }
  
  private toStatusEffect(element: DataElement): StatusEffect {
    const visualEffects: VisualEffect[] = [];
    const visualEffectsRoot = element.getFirstElementByName('visualEffects');
    if (visualEffectsRoot) {
      visualEffectsRoot.children.forEach(child => {
        visualEffects.push({
          type: child.getAttribute('type'),
          value: child.getAttribute('value')
        });
      });
    }

    const effects: Effect[] = [];
    const effectsRoot = element.getFirstElementByName('effects');
    if (effectsRoot) {
      effectsRoot.children.forEach(child => {
        effects.push({
          type: child.getAttribute('type') as 'attributeChange' | 'buffDebuff',
          target: child.getAttribute('target'),
          value: Number(child.getAttribute('value'))
        });
      });
    }

    const duration = Number(element.getFirstElementByName('duration')?.value) || 0;
    const isPermanentElem = element.getFirstElementByName('isPermanent');
    const isPermanent = isPermanentElem 
      ? (isPermanentElem.value === 'true')
      : (duration === -1);

    return {
      id: element.identifier,
      name: element.getFirstElementByName('name')?.value.toString() || '新しい効果',
      emoji: element.getFirstElementByName('emoji')?.value.toString() || '✨',
      description: element.getFirstElementByName('description')?.value.toString() || '',
      duration: duration,
      isPermanent: isPermanent,
      visualEffects: visualEffects,
      effects: effects
    };
  }
}
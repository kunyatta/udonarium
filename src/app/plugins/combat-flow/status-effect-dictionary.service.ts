import { Injectable, OnDestroy } from '@angular/core';
import { PluginDataContainer } from '../../class/plugin-data-container';
import { DataElement } from '@udonarium/data-element';
import { XmlUtil } from '@udonarium/core/system/util/xml-util';
import { StatusEffect, Effect, VisualEffect } from './status-effect.model';
import { EventSystem } from '@udonarium/core/system';
import { PluginHelperService } from '../service/plugin-helper.service';
import { DICTIONARY_FILE_NAME_HINT, PLUGIN_ID, DATA_TAG_STATUS_EFFECT_DATA } from './combat-flow.constants';

@Injectable({
  providedIn: 'root'
})
export class StatusEffectDictionaryService implements OnDestroy {

  private readonly PLUGIN_ID = PLUGIN_ID;

  constructor(
    private pluginHelper: PluginHelperService
  ) {
    this.registerEvents();
  }

  ngOnDestroy() {
    EventSystem.unregister(this);
  }

  private registerEvents() {
    EventSystem.register(this)
      .on('XML_LOADED', event => {
        const xmlElement: Element = event.data.xmlElement;
        if (!xmlElement) return;

        // エクスポート機能で保存されたステータス効果データ（<data name="status-effect-data">）を検知
        if (xmlElement.tagName === 'data' && xmlElement.getAttribute('name') === DATA_TAG_STATUS_EFFECT_DATA) {
          console.log('[StatusEffectDictionary] Importing status effect data...');
          this.importStatusEffectData(xmlElement);
        }
      });
  }

  /**
   * インポートされたXML要素からステータス効果を取り込み、辞書に追加します。
   */
  private importStatusEffectData(rootElement: Element) {
    // 1. まず既存のコンテナを探す (優先度: status-effect-dictionary > default)
    let container = this.pluginHelper.findContainer(this.PLUGIN_ID, DICTIONARY_FILE_NAME_HINT) 
                 || this.pluginHelper.findContainer(this.PLUGIN_ID, 'default');

    // 2. 見つからなければ、正規のヒントで新規作成する
    if (!container) {
      console.log(`[StatusEffectDictionary] Container not found. Creating new one with hint "${DICTIONARY_FILE_NAME_HINT}"...`);
      container = this.pluginHelper.getOrCreateContainer(this.PLUGIN_ID, DICTIONARY_FILE_NAME_HINT);
    }

    // 子要素の <template> を探して取り込む
    Array.from(rootElement.children).forEach(child => {
      if (child.tagName === 'data' && child.getAttribute('name') === 'template') {
        // DataElementに変換してから StatusEffect オブジェクトに戻す
        // ここでは簡易的に、parseXmlToContainer で使っているパーサーロジックを再利用したいが、
        // privateメソッド内にあるため、似た処理を記述する。
        // 本当は toStatusEffect(DataElement) を使いたいが、Element -> DataElement 変換が必要。
        // 面倒なので Element から直接 StatusEffect をパースするヘルパーを作るか、
        // 既存の toStatusEffect を使うために一回 DataElement 化するか。
        // DataElement.create などの静的メソッドはないので、XML文字列からパースさせるのが手っ取り早いか？
        // いや、既に Element があるので、それを走査する。

        try {
          // 1. Element -> StatusEffect
          const effect = this.parseEffectElement(child);
          // 2. IDをリセット（新規コピーとして扱う）
          const { id, ...effectData } = effect;
          // 3. 辞書に追加
          this.addTemplate(container, effectData);
          console.log(`[StatusEffectDictionary] Imported: ${effect.name}`);
        } catch (e) {
          console.error('[StatusEffectDictionary] Failed to import effect:', e);
        }
      }
    });
  }

  /**
   * DOM Element から StatusEffect オブジェクトを復元します。
   * parseXmlToContainer 内のロジックを抽出・共通化したもの。
   */
  private parseEffectElement(element: Element): StatusEffect {
    const getChildVal = (parent: Element, name: string) => {
      const el = Array.from(parent.children).find(child => child.tagName === 'data' && child.getAttribute('name') === name);
      return el ? XmlUtil.decodeEntityReference(el.textContent || '') : null;
    };

    const visualEffects: VisualEffect[] = [];
    const visualEffectsRoot = Array.from(element.children).find(child => child.tagName === 'data' && child.getAttribute('name') === 'visualEffects');
    if (visualEffectsRoot) {
      Array.from(visualEffectsRoot.children).forEach(child => {
        if (child.tagName === 'data' && child.getAttribute('name') === 'visualEffect') {
          visualEffects.push({
            type: child.getAttribute('type') || '',
            value: child.getAttribute('value') || ''
          });
        }
      });
    }

    const effects: Effect[] = [];
    const effectsRoot = Array.from(element.children).find(child => child.tagName === 'data' && child.getAttribute('name') === 'effects');
    if (effectsRoot) {
      Array.from(effectsRoot.children).forEach(child => {
        if (child.tagName === 'data' && child.getAttribute('name') === 'effect') {
          effects.push({
            type: child.getAttribute('type') as any,
            target: child.getAttribute('target') || '',
            value: Number(child.getAttribute('value')) || 0
          });
        }
      });
    }

    const duration = Number(getChildVal(element, 'duration') || 0);
    const isPermanentVal = getChildVal(element, 'isPermanent');
    const isPermanent = isPermanentVal !== null
      ? (isPermanentVal === 'true')
      : (duration === -1);

    return {
      id: element.getAttribute('identifier') || crypto.randomUUID(),
      name: getChildVal(element, 'name') || '',
      emoji: getChildVal(element, 'emoji') || '',
      description: getChildVal(element, 'description') || '',
      duration: duration,
      isPermanent: isPermanent,
      visualEffects: visualEffects,
      effects: effects
    };
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
   */
  addTemplate(container: PluginDataContainer, newEffectData: Omit<StatusEffect, 'id'>): void {
    const dictionaryRoot = this.findOrCreateDictionaryRoot(container);

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
      // 既存の要素を削除し、新しいデータで再作成して追加（DataElementの構造更新が複雑なため）
      // ※ identifier (ID) は維持する必要があるため、createTemplateElement で id を渡す
      const newElement = this.createTemplateElement(updatedEffect);
      // insertBeforeなどで位置を維持する処理を入れるとより親切だが、今回はシンプルに置換
      const index = dictionaryRoot.children.indexOf(targetElement);
      dictionaryRoot.removeChild(targetElement);
      dictionaryRoot.insertBefore(newElement, dictionaryRoot.children[index]);
      dictionaryRoot.update(); // 変更を通知
    } else {
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
      dictionaryRoot.update(); // 変更を通知
    }
  }

  // --- インポート / エクスポート ---

  /**
   * assets/status-effect-dictionary.xml から初期データを読み込みます。
   * 既にデータが存在する場合は何もしません。
   */
  async loadDefaultDictionary(container: PluginDataContainer): Promise<void> {
    const dictionaryRoot = container.state.getFirstElementByName('dictionary');
    // 既にデータがあればロードしない
    if (dictionaryRoot && dictionaryRoot.children.length > 0) {
      return;
    }

    // XMLの読み込みを試行
    try {
      const response = await fetch('assets/status-effect-dictionary.xml');
      if (response.ok) {
        const xmlText = await response.text();
        this.parseXmlToContainer(container, xmlText);
      }
    } catch (e) {
      console.error('Failed to load default dictionary:', e);
    }
  }

  /**
   * XML文字列から辞書データを解析してコンテナに展開します（全置換）。
   * 主に初期データロード用。
   */
  private parseXmlToContainer(container: PluginDataContainer, xmlString: string): void {
    const xmlElement = XmlUtil.xml2element(xmlString);
    if (!xmlElement) {
      throw new Error('Invalid XML');
    }

    // ルート要素が <data name="dictionary"> であることを期待
    if (xmlElement.tagName !== 'data' || xmlElement.getAttribute('name') !== 'dictionary') {
       throw new Error('Root element must be <data name="dictionary">');
    }

    const dictionaryRoot = this.findOrCreateDictionaryRoot(container);
    // 全削除
    const childrenToRemove = [...dictionaryRoot.children];
    childrenToRemove.forEach(child => dictionaryRoot.removeChild(child));

    // <data name="template"> の子要素を走査して StatusEffect に変換し、再構築
    Array.from(xmlElement.children).forEach(child => {
      if (child.tagName === 'data' && child.getAttribute('name') === 'template') {
        const statusEffect = this.parseEffectElement(child);
        const newElement = this.createTemplateElement(statusEffect);
        dictionaryRoot.appendChild(newElement);
      }
    });
  }

  /**
   * 現在の辞書データをXML文字列としてエクスポートします。
   */
  exportToXml(container: PluginDataContainer): string {
    const dictionaryRoot = this.findOrCreateDictionaryRoot(container);
    // <dictionary>...</dictionary> の形式で出力
    return dictionaryRoot.toXml();
  }

  /**
   * ステータス効果オブジェクトをエクスポート用の DataElement に変換します。
   */
  exportEffectToElement(effect: StatusEffect): DataElement {
    return this.createTemplateElement(effect);
  }

  /**
   * StatusEffect オブジェクトから ActiveStatusEffect 用の DataElement ツリーを生成します。
   * @param effect 元となるステータス効果テンプレート
   * @param currentRound 現在のラウンド（開始ラウンドとして記録）
   */
  createActiveEffectElement(effect: StatusEffect, currentRound: number = 1): DataElement {
    // テンプレート作成ロジックを再利用したいが、タグ名や一部構造が異なるため、新規作成する
    // IDはテンプレートのIDではなく、個別のインスタンスIDを新規発行すべきか？
    // -> ActiveStatusEffectとして管理するなら、インスタンスごとにユニークIDが必要。
    //    ただし、元テンプレートのIDも保持しておくと便利かもしれない（が、必須ではない）。
    //    ここではシンプルに新しいIDを発行する。
    const instanceId = crypto.randomUUID();
    const root = DataElement.create('active-effect', '', {}, instanceId);

    // 基本プロパティ (テンプレートの内容をコピー)
    root.appendChild(DataElement.create('name', effect.name, {}));
    root.appendChild(DataElement.create('emoji', effect.emoji, {}));
    root.appendChild(DataElement.create('description', effect.description, {}));
    root.appendChild(DataElement.create('duration', effect.duration, {}));
    root.appendChild(DataElement.create('isPermanent', String(effect.isPermanent), {}));

    // アクティブ状態のプロパティ
    // remainingRounds の初期値は duration。永続(-1)なら-1のまま。
    const initialRemaining = effect.isPermanent ? -1 : effect.duration;
    root.appendChild(DataElement.create('remainingRounds', initialRemaining, {}));
    root.appendChild(DataElement.create('startRound', currentRound, {}));

    // 視覚効果リスト
    const visualEffectsRoot = DataElement.create('visualEffects', '', {});
    effect.visualEffects.forEach(v => {
      const vElem = DataElement.create('visualEffect', '', { type: v.type, value: v.value });
      visualEffectsRoot.appendChild(vElem);
    });
    root.appendChild(visualEffectsRoot);

    // 操作パラメータリスト
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
  toActiveStatusEffect(element: DataElement): any { // 型定義の循環参照を避けるため any または import ActiveStatusEffect
    // toStatusEffect のロジックを包含する
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
  
  /**
   * StatusEffect オブジェクトから DataElement ツリーを生成します。
   * XML構造:
   * <template identifier="uuid">
   *   <data name="name">毒</data>
   *   <data name="emoji">💀</data>
   *   ...
   *   <data name="effects">
   *     <data name="effect">...</data>
   *   </data>
   * </template>
   */
  private createTemplateElement(effect: StatusEffect): DataElement {
    // ルート要素を作成（identifierをIDとして使用）
    const templateRoot = DataElement.create('template', '', {}, effect.id);

    // 基本プロパティ
    templateRoot.appendChild(DataElement.create('name', effect.name, {}));
    templateRoot.appendChild(DataElement.create('emoji', effect.emoji, {}));
    templateRoot.appendChild(DataElement.create('description', effect.description, {}));
    templateRoot.appendChild(DataElement.create('duration', effect.duration, {}));
    templateRoot.appendChild(DataElement.create('isPermanent', String(effect.isPermanent), {}));

    // 視覚効果リスト
    const visualEffectsRoot = DataElement.create('visualEffects', '', {});
    effect.visualEffects.forEach(v => {
      const vElem = DataElement.create('visualEffect', '', { type: v.type, value: v.value });
      visualEffectsRoot.appendChild(vElem);
    });
    templateRoot.appendChild(visualEffectsRoot);

    // 操作パラメータ（機械的な効果）リスト
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
  
  /**
   * DataElement ツリーから StatusEffect オブジェクトを復元します。
   */
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
    // isPermanentタグがない場合、durationが-1なら永続とする（後方互換性）
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

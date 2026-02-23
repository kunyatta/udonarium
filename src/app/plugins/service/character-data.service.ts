import { Injectable } from '@angular/core';
import { DataElement } from '@udonarium/data-element';
import { GameCharacter } from '@udonarium/game-character';
import { StringUtil } from '@udonarium/core/system/util/string-util';
import { ObjectStore } from '@udonarium/core/synchronize-object/object-store';
import { Network } from '@udonarium/core/system';

const PERSISTENT_ID_TAG = '_combat_flow_persistent_id';

@Injectable({
  providedIn: 'root'
})
export class CharacterDataService {

  constructor() { }

  /**
   * 指定されたキャラクターから、タグ文字列に基づいてデータ要素のリストを取得します。
   * @param character 対象のゲームキャラクター
   * @param tags スペース区切りのタグ（表示名）文字列
   * @returns 見つかったデータ要素の配列
   */
  getParameters(character: GameCharacter, tags: string): DataElement[] {
    if (!character || !character.detailDataElement || !tags) {
      return [];
    }

    const tagArray = tags.split(/\s+/).filter(tag => tag);
    if (tagArray.length === 0) {
      return [];
    }

    // GameObjectInventoryServiceのロジックを参考に、表示名で検索する
    const elements = tagArray.map(tag => {
      // '/' は改行コードとして扱う
      if ('/' === StringUtil.toHalfWidth(tag)) {
        // 改行用のダミー要素を返す（今回は単純にnullでフィルタリング）
        return null;
      }
      return character.detailDataElement.getFirstElementByNameUnsensitive(tag);
    });

    return elements.filter(el => el);
  }

  /**
   * 指定されたキャラクターから、操作可能な全ての数値系パラメータを取得します。
   * @param character 対象のゲームキャラクター
   * @returns 数値系データ要素の配列
   */
  getAllNumericParameters(character: GameCharacter): DataElement[] {
    if (!character || !character.detailDataElement) {
      return [];
    }

    const numberResources = character.detailDataElement.getElementsByType('numberResource');
    const simpleNumbers = character.detailDataElement.getElementsByType('simpleNumber');
    const abilityScores = character.detailDataElement.getElementsByType('abilityScore');

    return [...numberResources, ...simpleNumbers, ...abilityScores];
  }

  /**
   * 複数のキャラクターに共通して存在する数値系パラメータを取得します。
   * @param characters 対象のゲームキャラクターの配列
   * @returns 共通するデータ要素の配列
   */
  getCommonParameters(characters: GameCharacter[]): DataElement[] {
    if (!characters || characters.length === 0) {
      return [];
    }

    // 最初のキャラクターを基準に、共通パラメータのリストを初期化
    let commonParams = this.getAllNumericParameters(characters[0]);

    // 2人目以降のキャラクターでリストを絞り込んでいく
    for (let i = 1; i < characters.length; i++) {
      const targetParams = this.getAllNumericParameters(characters[i]);
      const targetParamNames = new Set(targetParams.map(p => p.name));
      commonParams = commonParams.filter(p => targetParamNames.has(p.name));
    }

    return commonParams;
  }

  /**
   * 指定されたキャラクターのパラメータを安全に変更します。
   * @param character 対象のゲームキャラクター
   * @param key 操作対象のパラメータキー (例: 'HP.currentValue')
   * @param value 加算または減算する値
   */
  applyParameterChange(character: GameCharacter, key: string, value: number): void {
    if (!character || !key || value === 0) return;

    let paramName: string;
    let property: string;

    if (key.includes('.')) {
      [paramName, property] = key.split('.');
    } else {
      paramName = key;
      // パラメータ名のみが指定された場合、DataElementのタイプに基づいてプロパティを推測
      const tempElement = character.detailDataElement.getFirstElementByNameUnsensitive(paramName);
      if (tempElement) {
        // numberResourceの場合はcurrentValue、それ以外はvalueをデフォルトとする
        property = tempElement.getAttribute('type') === 'numberResource' ? 'currentValue' : 'value';
      } else {
        return; // 対象のパラメータが見つからない場合は処理しない
      }
    }
    
    if (!paramName || !property) return;

    const targetElement = character.detailDataElement.getFirstElementByNameUnsensitive(paramName);

    if (targetElement && (property === 'currentValue' || property === 'value')) {
      // DataElementのプロパティとして直接アクセスして値を更新
      // TypeScriptの型チェックを回避するため any にキャスト
      const currentValue = Number((targetElement as any)[property] || 0);
      (targetElement as any)[property] = currentValue + value;
      
      // 変更を通知
      if (typeof (targetElement as any).update === 'function') {
        (targetElement as any).update();
      }
    }
  }

  /**
   * キャラクターから操作可能なパラメータのキーと表示名のリストを取得します。
   * @param character 対象のゲームキャラクター
   * @returns パラメータ情報の配列
   */
  getParameterList(character: GameCharacter): { key: string, name: string }[] {
    const params: { key: string, name: string }[] = [];
    if (!character || !character.detailDataElement) return params;

    const numberResources = character.detailDataElement.getElementsByType('numberResource');
    const simpleNumbers = character.detailDataElement.getElementsByType('simpleNumber');
    const abilityScores = character.detailDataElement.getElementsByType('abilityScore');

    const allRelevantElements = [...numberResources, ...simpleNumbers, ...abilityScores];

    for (const element of allRelevantElements) {
      if (element.getAttribute('type') === 'numberResource') {
        params.push({ key: `${element.name}.currentValue`, name: `${element.name} (現在値)` });
        params.push({ key: `${element.name}.value`, name: `${element.name} (最大値)` });
      } else {
        // simpleNumber, abilityScore
        params.push({ key: `${element.name}.value`, name: element.name });
      }
    }
    return params;
  }

  /**
   * 指定されたキャラクターのDataElementを取得します。
   * keyが'paramName.property'の形式の場合、paramNameで要素を検索します。
   * @param character 対象のゲームキャラクター
   * @param key 検索するパラメータのキー（例: 'HP', 'HP.currentValue'）
   * @returns 見つかったDataElement、またはnull
   */
  getParamElement(character: GameCharacter, key: string): DataElement | null {
    if (!character || !character.detailDataElement) return null;

    let paramName: string;
    if (key.includes('.')) {
      paramName = key.split('.')[0];
    } else {
      paramName = key;
    }
    return character.detailDataElement.getFirstElementByNameUnsensitive(paramName);
  }

  /**
   * 指定されたキャラクターのパラメータの数値を取得します。
   * keyが'paramName.property'の形式の場合、対応するプロパティの値を返します。
   * @param character 対象のゲームキャラクター
   * @param key 検索するパラメータのキー（例: 'HP', 'HP.currentValue'）
   * @returns パラメータの数値、または0
   */
  getParamValue(character: GameCharacter, key: string): number {
    const element = this.getParamElement(character, key);
    if (!element) return 0;

    let property: string;
    if (key.includes('.')) {
      property = key.split('.')[1];
    } else {
      // プロパティが指定されない場合、numberResourceならcurrentValue、それ以外ならvalueを推測
      property = element.getAttribute('type') === 'numberResource' ? 'currentValue' : 'value';
    }

    if (property === 'currentValue' || property === 'value') {
      return Number((element as any)[property] || 0);
    }
    return 0;
  }

  /**
   * 指定された永続IDを持つキャラクターオブジェクトを取得する。
   * IDが変わってしまっても、detailDataElement内のタグを頼りに追跡する。
   * @param persistentId 検索する永続ID (_combat_flow_persistent_id)
   */
  getGameCharacter(persistentId: string): GameCharacter | null {
    const characters = ObjectStore.instance.getObjects<GameCharacter>(GameCharacter);
    return characters.find(char => {
      const idElement = char.detailDataElement?.getFirstElementByName(PERSISTENT_ID_TAG);
      return idElement && idElement.value.toString() === persistentId;
    }) || null;
  }
  
  /**
   * テーブル上に存在する全キャラクターを取得する
   */
  getAllTabletopCharacters(): GameCharacter[] {
    return ObjectStore.instance.getObjects<GameCharacter>(GameCharacter)
      .filter(char => char.location.name === 'table');
  }

  /**
   * ID（標準IDまたは永続ID）からキャラクターを解決して返す。
   * IDの種類を意識せずに使用できる。
   * @param identifier Udonarium標準ID または 永続ID
   */
  resolveCharacter(identifier: string): GameCharacter | null {
    if (!identifier) return null;

    // 1. 標準IDとして検索
    const charById = ObjectStore.instance.get<GameCharacter>(identifier);
    if (charById) {
      return charById;
    }

    // 2. 永続IDとして検索
    return this.getGameCharacter(identifier);
  }

  /**
   * 名前でキャラクターを解決して返す。
   * 全てのキャラクターの中から名前が一致する最初のキャラクターを返す。
   * @param name 検索するキャラクター名
   */
  resolveCharacterByName(name: string): GameCharacter | null {
    if (!name) return null;

    const allCharacters = ObjectStore.instance.getObjects<GameCharacter>(GameCharacter);

    // 全てのキャラクターの中から名前が一致するものを検索
    const foundCharacter = allCharacters.find(char => char.name === name);
    if (foundCharacter) {
      return foundCharacter;
    }

    return null;
  }

  /**
   * キャラクターの永続IDを取得する。存在しない場合は新規発行して付与する。
   * @param character 対象のキャラクター
   */
  ensurePersistentId(character: GameCharacter): string {
    if (!character || !character.detailDataElement) return '';

    let idElement = character.detailDataElement.getFirstElementByName(PERSISTENT_ID_TAG);
    if (!idElement) {
      // 永続IDがなければ新規発行して埋め込む
      const newId = crypto.randomUUID();
      idElement = DataElement.create(PERSISTENT_ID_TAG, newId, { type: 'string' });
      character.detailDataElement.appendChild(idElement);
    }

    return idElement.value.toString();
  }

  /**
   * キャラクターのチャット用画像IDを解決して返します。
   * 「チャット設定」セクションにアイコン画像が設定されていればそれを、
   * なければキャラクターのメイン画像IDを返します。
   * @param character 対象のキャラクター
   */
  getChatImageIdentifier(character: GameCharacter): string {
    if (!character) return '';

    // 1. チャット設定セクション内の「アイコン画像」を探す
    let chatIcon = '';
    const chatSettings = character.detailDataElement?.children.find(
      c => c instanceof DataElement && c.name === 'チャット設定'
    ) as DataElement;

    if (chatSettings) {
      const iconElement = chatSettings.children.find(
        c => c instanceof DataElement && c.name === 'アイコン画像'
      ) as DataElement;
      
      if (iconElement) {
        chatIcon = iconElement.value as string;
      }
    }

    if (chatIcon && typeof chatIcon === 'string' && chatIcon.length > 0 && chatIcon !== 'null') {
      return chatIcon;
    }

    // 2. なければメイン画像を返す
    return character.imageFile ? character.imageFile.identifier : '';
  }
}

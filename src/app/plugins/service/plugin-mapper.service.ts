import { Injectable } from '@angular/core';
import { DataElement } from '@udonarium/data-element';

export interface MappingOptions {
  /** プロパティ名から要素名への変換マップ */
  tagMap?: { [key: string]: string };
  /** 配列要素に使用するタグ名 (配列のプロパティ名をキーにする) */
  arrayItemNames?: { [key: string]: string };
  /** 子要素ではなく属性 (Attribute) として保持したいプロパティ名 */
  attrProps?: string[];
}

@Injectable({
  providedIn: 'root'
})
export class PluginMapperService {

  /**
   * オブジェクトを DataElement ツリーに変換します。
   */
  toElement(name: string, obj: any, options: MappingOptions = {}): DataElement {
    const tagName = (options.tagMap && options.tagMap[name]) || name;
    
    // 属性として扱う値を抽出
    const attrs: { [key: string]: string | number } = {};
    if (options.attrProps && typeof obj === 'object' && obj !== null) {
      for (const prop of options.attrProps) {
        if (obj[prop] !== undefined) {
          attrs[prop] = obj[prop];
        }
      }
    }

    // Udonarium の DataElement.create は第1引数が name 属性になる
    const element = DataElement.create(tagName, '', attrs);

    if (obj === null || obj === undefined) return element;

    if (Array.isArray(obj)) {
      const itemName = (options.arrayItemNames && options.arrayItemNames[name]) || 'item';
      for (const item of obj) {
        element.appendChild(this.toElement(itemName, item, options));
      }
    } else if (typeof obj === 'object') {
      for (const key in obj) {
        // 属性として処理済みのものはスキップ
        if (options.attrProps?.includes(key)) continue;
        
        const value = obj[key];
        if (value === undefined) continue;

        if (typeof value === 'object' && value !== null) {
          element.appendChild(this.toElement(key, value, options));
        } else {
          // プリミティブ型
          const childTagName = (options.tagMap && options.tagMap[key]) || key;
          // 子要素を作成。DataElement.create(名前, 値) とすることで <data name="名前">値</data> になる
          element.appendChild(DataElement.create(childTagName, value.toString(), {}));
        }
      }
    } else {
      // 単一のプリミティブ値（再帰用）
      element.value = obj.toString();
    }

    return element;
  }

  /**
   * DataElement ツリーをプレーンなオブジェクトに復元します。
   */
  fromElement<T>(element: DataElement, options: MappingOptions = {}): T {
    if (!element) return null as any;

    const attributes = element.toAttributes();
    
    // Udonarium の DataElement が内部で使用する属性 (name, type) 以外の属性を抽出
    const userAttributes: { [key: string]: any } = {};
    for (const [key, value] of Object.entries(attributes)) {
      if (key === 'name' || key === 'type') continue;
      userAttributes[key] = this.parseValue(value);
    }

    const hasChildren = element.children.length > 0;
    const hasUserAttributes = Object.keys(userAttributes).length > 0;

    // 子要素も（name以外の）属性もない場合は、純粋な値として返す
    if (!hasChildren && !hasUserAttributes) {
      return this.parseValue(element.value) as any;
    }

    const obj: any = {};

    // ユーザー定義の属性をプロパティとして復元
    Object.assign(obj, userAttributes);

    // 子要素をプロパティとして復元
    for (const child of element.children) {
      if (!(child instanceof DataElement)) continue;

      const propName = this.getPropNameFromTag(child.getAttribute('name'), options);
      const val = this.fromElement(child, options);

      if (obj[propName] !== undefined) {
        // 重複する場合は配列化
        if (!Array.isArray(obj[propName])) {
          obj[propName] = [obj[propName]];
        }
        obj[propName].push(val);
      } else {
        // 配列として期待されているタグ名なら、最初から配列として格納
        const isArrayItem = this.isArrayItemTag(child.getAttribute('name'), options);
        obj[propName] = isArrayItem ? [val] : val;
      }
    }

    return obj as T;
  }

  private parseValue(val: any): any {
    if (val === 'true') return true;
    if (val === 'false') return false;
    if (val !== '' && !isNaN(Number(val))) return Number(val);
    return val;
  }

  private getPropNameFromTag(tagName: string, options: MappingOptions): string {
    if (options.tagMap) {
      for (const prop in options.tagMap) {
        if (options.tagMap[prop] === tagName) return prop;
      }
    }
    if (options.arrayItemNames) {
      for (const prop in options.arrayItemNames) {
        if (options.arrayItemNames[prop] === tagName) return prop;
      }
    }
    return tagName;
  }

  private isArrayItemTag(tagName: string, options: MappingOptions): boolean {
    if (!options.arrayItemNames) return false;
    return Object.values(options.arrayItemNames).includes(tagName);
  }
}
import { Injectable, OnDestroy } from '@angular/core';
import { DataElement } from '@udonarium/data-element';
import { GameCharacter } from '@udonarium/game-character';
import { ObjectStore } from '@udonarium/core/synchronize-object/object-store';
import { EventSystem } from '@udonarium/core/system';

export interface CharacterDataExtensionItem {
  name: string;
  label: string;
  type?: string;
  defaultValue?: any;
}

export interface CharacterDataExtension {
  pluginId: string;
  sectionName: string; // 表示上のセクション名 (e.g. 'チャット設定')
  internalSectionName?: string; // 内部的なDataElementのname (省略時はsectionName)
  items: CharacterDataExtensionItem[];
}

@Injectable({
  providedIn: 'root'
})
export class CharacterDataExtensionService implements OnDestroy {
  private extensions: Map<string, CharacterDataExtension> = new Map();

  constructor() {
    this.initialize();
  }

  ngOnDestroy() {
    EventSystem.unregister(this);
  }

  private initialize() {
    EventSystem.register(this)
      .on('XML_LOADED', () => {
        // 全キャラクターに一括適用
        setTimeout(() => {
          const characters = ObjectStore.instance.getObjects<GameCharacter>(GameCharacter);
          characters.forEach(c => this.applyAllExtensions(c));
        }, 1500);
      });
  }

  /**
   * プラグインが必要とするキャラクターデータの拡張を登録します。
   * @param extension 拡張設定
   */
  register(extension: CharacterDataExtension) {
    this.extensions.set(extension.pluginId, extension);
    // 既存のキャラクターに即座に適用
    setTimeout(() => {
      const characters = ObjectStore.instance.getObjects<GameCharacter>(GameCharacter);
      characters.forEach(c => this.applyAllExtensions(c));
    }, 100);
  }

  /**
   * 指定されたキャラクターに対し、登録されている全ての拡張を適用（不足項目の追加）します。
   * @param character 対象のキャラクター
   */
  applyAllExtensions(character: GameCharacter) {
    if (!character || !character.detailDataElement) return;

    let changed = false;
    for (const extension of this.extensions.values()) {
      if (this.applyExtension(character, extension)) {
        changed = true;
      }
    }

    if (changed) {
      character.detailDataElement.update();
      character.update();
    }
  }

  private applyExtension(character: GameCharacter, extension: CharacterDataExtension): boolean {
    const sectionName = extension.internalSectionName || extension.sectionName;
    let section = character.detailDataElement.children.find(
      c => c instanceof DataElement && c.name === sectionName
    ) as DataElement;

    let changed = false;

    // セクションがなければ作成
    if (!section) {
      section = DataElement.create(sectionName, '', {}, sectionName + '_' + character.identifier);
      character.detailDataElement.appendChild(section);
      changed = true;
    }

    // 項目をチェックして不足があれば追加
    for (const item of extension.items) {
      let element = section.children.find(
        c => c instanceof DataElement && c.name === item.name
      ) as DataElement;

      if (!element) {
        element = DataElement.create(
          item.name, 
          item.defaultValue !== undefined ? item.defaultValue : '', 
          { type: item.type || 'string' }, 
          item.name + '_' + section.identifier
        );
        section.appendChild(element);
        changed = true;
      }
    }

    if (changed) {
      section.update();
    }

    return changed;
  }
}

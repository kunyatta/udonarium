import { Injectable, OnDestroy } from '@angular/core';
import { DataElement } from '@udonarium/data-element';
import { GameCharacter } from '@udonarium/game-character';
import { ObjectStore } from '@udonarium/core/synchronize-object/object-store';
import { EventSystem } from '@udonarium/core/system';
import { UIExtensionService } from './ui-extension.service';

export interface CharacterDataExtensionItem {
  name: string;
  label: string;
  type?: string;
  defaultValue?: any | ((character: GameCharacter) => any);
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

  constructor(private uiExtensionService: UIExtensionService) {
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

    // 共通の演出設定追加ボタンを登録
    this.uiExtensionService.registerAction('character-sheet', {
      name: '演出設定追加',
      icon: 'add_to_photos',
      action: (context: GameCharacter) => {
        this.applyAllExtensions(context);
      },
      condition: (context) => {
        if (!(context instanceof GameCharacter)) return false;
        // 登録されている拡張のうち、一つでも未適用のものがあれば表示
        return Array.from(this.extensions.values()).some(ext => {
          const sectionName = ext.internalSectionName || ext.sectionName;
          const section = context.detailDataElement?.children.find(
            c => c instanceof DataElement && c.name === sectionName
          ) as DataElement;
          
          if (!section) return true;
          return ext.items.some(item => !section.children.find(c => c instanceof DataElement && c.name === item.name));
        });
      },
      priority: 100
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
      console.log(`[CharacterDataExtension] Applied extensions to ${character.name}`);
      character.detailDataElement.update();
      character.update();
    }
    
    // 拡張が完了したことを通知（中身を埋める担当プラグインへの合図）
    EventSystem.call('CHARACTER_EXTENSIONS_APPLIED', { identifier: character.identifier });
  }

  private applyExtension(character: GameCharacter, extension: CharacterDataExtension): boolean {
    try {
      const sectionName = extension.internalSectionName || extension.sectionName;

      // セクションを名前で検索
      let section = character.detailDataElement.children.find(
        c => c instanceof DataElement && c.name === sectionName
      ) as DataElement;

      let changed = false;

      // セクションがない場合
      if (!section) {
        // 項目が一つも予約されていない場合は、枠作りも担当プラグイン（DynamicStand等）に委ねるため、
        // サービス側では勝手に作成しない。
        if (extension.items.length === 0) {
          return false;
        }

        // 大項目（セクション）として認識させるため、valueは空、attributesは空にする
        section = DataElement.create(sectionName, '', {}, sectionName + '_' + character.identifier);
        character.detailDataElement.appendChild(section);
        changed = true;
        console.log(`[CharacterDataExtension] Created section: ${sectionName}`);
      }

      // 項目をチェックして不足があれば追加
      for (const item of extension.items) {
        const itemName = item.name;

        let element = section.children.find(
          c => c instanceof DataElement && c.name === itemName
        ) as DataElement;

        if (!element) {
          let resolvedValue = item.defaultValue;
          if (typeof item.defaultValue === 'function') {
            try {
              resolvedValue = item.defaultValue(character);
            } catch (e) {
              console.error('[CharacterDataExtension] Error resolving defaultValue:', item.name, e);
              resolvedValue = '';
            }
          }

          element = DataElement.create(
            itemName, 
            resolvedValue !== undefined ? resolvedValue : '', 
            { type: item.type || 'string' }, 
            itemName + '_' + section.identifier
          );
          section.appendChild(element);
          changed = true;
          console.log(`[CharacterDataExtension] Created item: ${itemName} in ${sectionName}`);
        }
      }

      if (changed) {
        section.update();
      }

      return changed;
    } catch (e) {
      console.error('[CharacterDataExtension] Error:', extension.pluginId, e);
      return false;
    }
  }
}

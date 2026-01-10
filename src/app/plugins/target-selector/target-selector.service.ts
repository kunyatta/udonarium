import { Injectable } from '@angular/core';
import { UIExtensionService } from '../service/ui-extension.service';
import { TabletopSelectionService } from 'service/tabletop-selection.service';
import { GameCharacter } from '@udonarium/game-character';
import { ChatInputComponent } from 'component/chat-input/chat-input.component';

@Injectable({
  providedIn: 'root'
})
export class TargetSelectorService {
  constructor(
    private uiExtension: UIExtensionService,
    private selectionService: TabletopSelectionService
  ) {}

  initialize() {
    this.registerAction();
  }

  private registerAction() {
    this.uiExtension.registerAction('chat-input', {
      name: 'Target',
      icon: 'location_searching',
      description: 'Ctrl+クリックでコマを選択状態にした後、このボタンで名前をチャットに挿入します',
      priority: 5, // 立ち絵(10)の左側に配置
      action: (context) => {
        const component = context.component as ChatInputComponent;
        const myChar = context.character as GameCharacter;
        
        // 1. 現在盤面で選択されているオブジェクトを取得
        const objects = this.selectionService.objects;
        
        // 2. キャラクターのみを抽出し、自分自身を除外
        let targets = objects
          .filter(obj => obj instanceof GameCharacter)
          .map(obj => obj as GameCharacter);
          
        if (myChar) {
          targets = targets.filter(t => t.identifier !== myChar.identifier);
        }

        // 3. 名前をカンマ区切りで結合してチャット欄に挿入
        if (targets.length > 0) {
          const names = targets.map(t => t.name).join(', ');
          if (component && component.insertEmote) {
            component.insertEmote(names);
          }
        }
      }
    });
  }
}
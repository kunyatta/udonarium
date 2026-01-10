import { Injectable, OnDestroy, NgZone } from '@angular/core';
import { EventSystem } from '@udonarium/core/system';
import { TabletopSelectionService } from 'service/tabletop-selection.service';
import { UIExtensionService, ExtensionAction } from '../service/ui-extension.service';
import { GameCharacter } from '@udonarium/game-character';
import { ChatInputComponent } from 'component/chat-input/chat-input.component';

interface TargetState {
  isModeOn: boolean;
  targets: GameCharacter[];
}

@Injectable({
  providedIn: 'root'
})
export class TargetSelectorService implements OnDestroy {
  private stateMap = new Map<string, TargetState>();
  private readonly ACTION_ID = 'target-selector-btn';

  constructor(
    private uiExtension: UIExtensionService,
    private selectionService: TabletopSelectionService,
    private ngZone: NgZone
  ) {
    this.initialRegisterAction(); // 初期登録のみ行う
    this.registerEvents();
  }

  ngOnDestroy() {
    EventSystem.unregister(this);
    this.uiExtension.unregisterActions('chat-input');
  }

  private getState(contextId: string): TargetState {
    if (!this.stateMap.has(contextId)) {
      this.stateMap.set(contextId, { isModeOn: false, targets: [] });
    }
    return this.stateMap.get(contextId);
  }

  private registerEvents() {
    EventSystem.register(this)
      .on('UPDATE_SELECTION', event => {
        const activeContexts = Array.from(this.stateMap.entries())
          .filter(([_, state]) => state.isModeOn);

        if (activeContexts.length === 0) return;

        const objects = this.selectionService.objects;
        const newTargets = objects
          .filter(obj => obj instanceof GameCharacter)
          .map(obj => obj as GameCharacter);

        activeContexts.forEach(([contextId, state]) => {
          state.targets = [...newTargets];
        });
        // refreshAction は呼ばない
      })
      .on('DELETE_GAME_OBJECT', event => {
        if (this.stateMap.has(event.data.identifier)) {
          this.stateMap.delete(event.data.identifier);
        }
        this.stateMap.forEach(state => {
            state.targets = state.targets.filter(t => t.identifier !== event.data.identifier);
        });
      });
  }

  // 初期化時に一度だけ呼ぶ
  private initialRegisterAction() {
    this.uiExtension.registerAction('chat-input', this.createAction());
  }

  private getContextId(context: any): string {
    if (context && context.character && context.character instanceof GameCharacter) {
      return context.character.identifier;
    }
    if (context && context.character && context.character.identifier) {
        return context.character.identifier;
    }
    return 'default';
  }

  private createAction(): ExtensionAction {
    return {
      id: this.ACTION_ID,
      name: 'Target', // 名前は固定（動的に変更しない）
      priority: 5,
      // アイコンを関数で指定し、状態に応じて変更する (DynamicStandPluginと同様)
      icon: (context) => {
        const id = this.getContextId(context);
        const state = this.getState(id);
        return state.isModeOn ? 'check_circle' : 'location_searching';
      },
      // 説明文も関数で変更可能
      description: (context) => {
        const id = this.getContextId(context);
        const state = this.getState(id);
        if (state.isModeOn) return `選択中: ${state.targets.length}体 (クリックで決定)`;
        return 'クリックしてターゲット収集モードを開始';
      },
      action: (context) => {
        const id = this.getContextId(context);
        const state = this.getState(id);
        const component = context.component as ChatInputComponent;
        const myChar = context.character as GameCharacter;
        
        if (state.isModeOn) {
            // 決定処理
            let finalTargets = state.targets;
            if (myChar) {
                finalTargets = finalTargets.filter(t => t.identifier !== myChar.identifier);
            }

            if (finalTargets.length > 0) {
                const names = finalTargets.map(t => t.name).join(' ');
                if (component && component.insertEmote) {
                  component.insertEmote(names);
                }
            }
            
            // モード終了
            state.isModeOn = false;
            state.targets = [];
            
        } else {
            // モード開始
            state.isModeOn = true;
            state.targets = []; 
            this.selectionService.clear(); 
        }
        
        // registerAction は呼ばない。
        // AngularのChangeDetectionが走れば、icon()関数が再評価されて見た目が変わるはず。
      }
    };
  }
}

import { Injectable } from '@angular/core';
import { Subject, Observable } from 'rxjs';

export type ExtensionLocation = 'main-menu' | 'context-menu' | 'chat-window' | 'character-sheet' | 'chat-input';

export interface ExtensionAction {
  name: string;
  icon?: string | ((context?: any) => string);
  action: (context?: any, pointer?: { x: number, y: number }) => void;
  condition?: (context?: any) => boolean;
  separator?: boolean;
  priority?: number; // 小さいほど前（左/上）に表示
}

@Injectable({
  providedIn: 'root'
})
export class UIExtensionService {

  private actions: Map<ExtensionLocation, ExtensionAction[]> = new Map();
  private _updateSource = new Subject<void>();
  readonly onUpdate$: Observable<void> = this._updateSource.asObservable();

  constructor() { }

  registerAction(location: ExtensionLocation, action: ExtensionAction) {
    console.log(`UIExtensionService: Registering action "${action.name}" to ${location}`);
    if (!this.actions.has(location)) {
      this.actions.set(location, []);
    }
    const actions = this.actions.get(location);
    
    // 同名のアクションがあれば上書き（既存を削除）
    const index = actions.findIndex(a => a.name === action.name);
    if (index !== -1) {
      actions.splice(index, 1, action);
    } else {
      actions.push(action);
    }
    this._updateSource.next();
  }

  getActions(location: ExtensionLocation, context?: any): ExtensionAction[] {
    const actions = this.actions.get(location) || [];
    const sortedActions = actions.slice().sort((a, b) => (a.priority || 0) - (b.priority || 0));

    if (!context) {
      return sortedActions;
    }
    return sortedActions.filter(action => {
      return action.condition ? action.condition(context) : true;
    });
  }
}
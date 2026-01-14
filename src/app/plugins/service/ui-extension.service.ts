import { Injectable } from '@angular/core';
import { Subject, Observable } from 'rxjs';

export type ExtensionLocation = 'main-menu' | 'main-menu-bottom' | 'settings' | 'context-menu' | 'chat-window' | 'character-sheet' | 'chat-input' | 'chat-input-quick' | 'chat-send';

export interface ExtensionAction {
  name: string | ((context?: any) => string); // ----- MODIFICATION (Gemini) for TargetSelectorPlugin -----
  icon?: string | ((context?: any) => string);
  iconClass?: string; // ----- MODIFICATION (kunyatta) -----
  color?: string | ((context?: any) => string); // ----- MODIFICATION (Gemini) for StyleSupport -----
  description?: string | ((context?: any) => string);
  action: (context?: any, pointer?: { x: number, y: number }) => void;
  condition?: (context?: any) => boolean;
  separator?: boolean;
  priority?: number; // 小さいほど前（左/上）に表示
  /** 何番目のセパレーターの直前に挿入するか (コンテキストメニュー用) */
  insertBeforeSeparator?: number;
}

export type ExtensionFilter = (input: any, context?: any) => any;

@Injectable({
  providedIn: 'root'
})
export class UIExtensionService {

  private actions: Map<ExtensionLocation, ExtensionAction[]> = new Map();
  private filters: Map<ExtensionLocation, ExtensionFilter[]> = new Map();
  private _updateSource = new Subject<void>();
  readonly onUpdate$: Observable<void> = this._updateSource.asObservable();

  // ----- MODIFICATION START (kunyatta) for Dynamic UI Slot -----
  activeComponent: any = null;
  activeContext: any = null;

  toggleCustomUI(component: any, context?: any) {
    if (this.activeComponent === component) {
      this.activeComponent = null;
      this.activeContext = null;
    } else {
      this.activeComponent = component;
      this.activeContext = context;
    }
    this._updateSource.next();
  }

  closeCustomUI() {
    if (this.activeComponent) {
      this.activeComponent = null;
      this.activeContext = null;
      this._updateSource.next();
    }
  }
  // ----- MODIFICATION END (kunyatta) for Dynamic UI Slot -----

  constructor() { }

  registerAction(location: ExtensionLocation, action: ExtensionAction) {
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

  unregisterActions(location: ExtensionLocation) {
    if (this.actions.has(location)) {
      this.actions.delete(location);
      this._updateSource.next();
    }
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
    
      registerFilter(location: ExtensionLocation, filter: ExtensionFilter) {
        if (!this.filters.has(location)) {
          this.filters.set(location, []);
        }
        this.filters.get(location).push(filter);
      }
    
      applyFilters(location: ExtensionLocation, input: any, context?: any): any {
        const filters = this.filters.get(location);
        if (!filters) return input;
        let result = input;
        for (const filter of filters) {
          result = filter(result, context);
        }
        return result;
      }
    }
    
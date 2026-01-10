import { ComponentRef, Injectable, ViewContainerRef } from '@angular/core';
// ----- MODIFICATION START (kunyatta) for PluginSystem -----
import { UIExtensionService, ExtensionAction } from '../plugins/service/ui-extension.service';
// ----- MODIFICATION END (kunyatta) for PluginSystem -----

interface ContextMenuPoint {
  x: number,
  y: number
}

export enum ContextMenuType {
  ACTION = 'action',
  SEPARATOR = 'separator',
}

export const ContextMenuSeparator: ContextMenuAction = {
  name: '',
  enabled: true,
  type: ContextMenuType.SEPARATOR
}

export interface ContextMenuAction {
  name: string,
  action?: Function,
  enabled?: boolean,
  type?: ContextMenuType,
  subActions?: ContextMenuAction[]
}

@Injectable()
export class ContextMenuService {
  /* Todo */
  static defaultParentViewContainerRef: ViewContainerRef;
  static ContextMenuComponentClass: { new(...args: any[]): any } = null;

  private panelComponentRef: ComponentRef<any>

  title: string = '';
  actions: ContextMenuAction[] = [];
  position: ContextMenuPoint = { x: 0, y: 0 };

  get isShow(): boolean {
    return this.panelComponentRef ? true : false;
  }

  // ----- MODIFICATION START (kunyatta) for PluginSystem -----
  constructor(
    private uiExtensionService: UIExtensionService
  ) { }
  // ----- MODIFICATION END (kunyatta) for PluginSystem -----

  open(position: ContextMenuPoint, actions: ContextMenuAction[], title?: string, parentViewContainerRef?: ViewContainerRef, context?: any) { // ----- MODIFICATION (kunyatta) for PluginSystem -----
    this.close();
    if (!parentViewContainerRef) {
      parentViewContainerRef = ContextMenuService.defaultParentViewContainerRef;
    }

    const injector = parentViewContainerRef.injector;
    let panelComponentRef: ComponentRef<any> = parentViewContainerRef.createComponent(ContextMenuService.ContextMenuComponentClass, { index: parentViewContainerRef.length, injector: injector });

    const childPanelService: ContextMenuService = panelComponentRef.injector.get(ContextMenuService);

    childPanelService.panelComponentRef = panelComponentRef;
    if (actions) {
      childPanelService.actions = actions;
      // ----- MODIFICATION START (kunyatta) for PluginSystem -----
      if (context) {
        const extensions = this.uiExtensionService.getActions('context-menu', context);
        if (extensions && extensions.length > 0) {
          // 挿入場所ごとにグループ化
          const insertionMap: Map<number | 'end', ExtensionAction[]> = new Map();
          extensions.forEach(ext => {
            const key = ext.insertBeforeSeparator != null ? ext.insertBeforeSeparator : 'end';
            if (!insertionMap.has(key)) insertionMap.set(key, []);
            insertionMap.get(key).push(ext);
          });

          // 指定位置（セパレーターの直前）に挿入
          for (const [separatorCount, group] of insertionMap.entries()) {
            if (separatorCount === 'end') continue;

            let currentSeparatorCount = 0;
            let targetIndex = -1;
            for (let i = 0; i < childPanelService.actions.length; i++) {
              if (childPanelService.actions[i].type === ContextMenuType.SEPARATOR) {
                currentSeparatorCount++;
                if (currentSeparatorCount === separatorCount) {
                  targetIndex = i;
                  break;
                }
              }
            }

            if (targetIndex !== -1) {
              const items = group.map(ext => ({
                name: typeof ext.name === 'function' ? ext.name(context) : ext.name,
                action: () => ext.action(context, position)
              }));
              // セクションの終わりに入れるため、項目の前に区切り線を入れたい場合はext.separatorで対応
              childPanelService.actions.splice(targetIndex, 0, ...items);
            } else {
              // 指定のセパレーターが見つからなければ末尾グループへ合流
              if (!insertionMap.has('end')) insertionMap.set('end', []);
              insertionMap.get('end').push(...group);
            }
          }

          // 指定なし、またはフォールバック分を末尾に追加
          const trailing = insertionMap.get('end');
          if (trailing && trailing.length > 0) {
            childPanelService.actions.push(ContextMenuSeparator);
            trailing.forEach(ext => {
              childPanelService.actions.push({
                name: typeof ext.name === 'function' ? ext.name(context) : ext.name,
                action: () => ext.action(context, position)
              });
            });
          }
        }
      }
      // ----- MODIFICATION END (kunyatta) for PluginSystem -----
    }
    if (position) {
      childPanelService.position.x = position.x;
      childPanelService.position.y = position.y;
    }

    childPanelService.title = title != null ? title : '';

    panelComponentRef.onDestroy(() => {
      childPanelService.panelComponentRef = null;
    });
  }

  close() {
    if (this.panelComponentRef) {
      this.panelComponentRef.destroy();
      this.panelComponentRef = null;
    }
  }
}
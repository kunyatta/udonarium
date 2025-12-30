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
          childPanelService.actions.push(ContextMenuSeparator);
          extensions.forEach(ext => {
            childPanelService.actions.push({
              name: ext.name,
              action: () => ext.action(context, position)
            });
          });
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
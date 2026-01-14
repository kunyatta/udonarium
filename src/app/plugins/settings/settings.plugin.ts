import { Injectable } from '@angular/core';
import { IPlugin } from '../i-plugin';
import { UIExtensionService } from '../service/ui-extension.service';
import { ContextMenuService, ContextMenuSeparator, ContextMenuType } from '../../service/context-menu.service';

@Injectable()
export class SettingsPlugin implements IPlugin {
  readonly pluginName: string = 'settings';

  constructor(
    private uiExtensionService: UIExtensionService,
    private contextMenuService: ContextMenuService
  ) {}

  initialize(): void {
    this.uiExtensionService.registerAction('main-menu', {
      name: '設定',
      icon: 'settings',
      priority: 200, // ダイスロール表(120)より後ろにする
      action: (context, pointer) => {
        const actions = this.uiExtensionService.getActions('settings');
        if (actions.length === 0) return;

        const contextMenuActions = [];
        for (const ext of actions) {
          if (ext.separator) {
            contextMenuActions.push(ContextMenuSeparator);
          }
          contextMenuActions.push({
            name: typeof ext.name === 'function' ? ext.name() : ext.name,
            action: () => ext.action(),
            type: ContextMenuType.ACTION
          });
        }

        this.contextMenuService.open(pointer, contextMenuActions, '設定');
      }
    });
  }
}

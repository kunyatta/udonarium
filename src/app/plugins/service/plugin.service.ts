import { Inject, Injectable, Injector } from '@angular/core';
import { IPlugin, IPluginWithUI, PLUGIN_TOKEN } from '../i-plugin';

@Injectable({
  providedIn: 'root'
})
export class PluginService {

  constructor(
    @Inject(PLUGIN_TOKEN) private plugins: IPlugin[],
    private injector: Injector
  ) { }

  /**
   * APP_INITIALIZERから呼び出されます。
   * UIを持たないプラグインを初期化します。
   */
  initialize() {
    console.log('PluginService: Initializing non-UI plugins...');
    for (const plugin of this.plugins) {
      if (plugin.initialize) {
        try {
          plugin.initialize();
        } catch (error) {
          console.error(`Error initializing plugin: ${plugin.pluginName}`, error);
        }
      }
    }
  }

  /**
   * 登録されているすべてのプラグインのリストを返します。
   */
  getPlugins(): readonly IPlugin[] {
    return this.plugins;
  }

  /**
   * AppComponentからビューの初期化後に呼び出されます。
   * UIを持つプラグインを初期化します。
   */
  initializeUiPlugins() {
    console.log('PluginService: Initializing UI plugins...');
    for (const plugin of this.plugins) {
      // 型ガードでプラグインがinitializeUIメソッドを持つかチェック
      if ('initializeUI' in plugin) {
        try {
          (plugin as IPluginWithUI).initializeUI(this.injector);
        } catch (error) {
          console.error(`Error initializing UI plugin: ${plugin.pluginName}`, error);
        }
      }
    }
  }

  /**
   * ユニークなpluginNameでUIプラグインを検索して返します。
   * @param pluginName プラグインのユニークな名前。
   * @returns UIプラグインのインスタンス。見つからない場合はundefined。
   */
  getUIPlugin(pluginName: string): IPluginWithUI | undefined {
    // 型ガードでUIプラグインをフィルタリング
    const uiPlugins = this.plugins.filter(p => 'initializeUI' in p) as IPluginWithUI[];
    return uiPlugins.find(p => p.pluginName === pluginName);
  }
}

import { Inject, Injectable, Injector } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { IPlugin, IPluginWithUI, PLUGIN_TOKEN } from '../i-plugin';

import { PluginOverlayService } from './plugin-overlay.service';
import { AudioStorage } from '../../class/core/file-storage/audio-storage';
import { MOD_SYSTEM_MANIFEST } from '../mod-manifest';

@Injectable({
  providedIn: 'root'
})
export class PluginService {

  constructor(
    @Inject(PLUGIN_TOKEN) private plugins: IPlugin[],
    private injector: Injector,
    private pluginOverlayService: PluginOverlayService,
    private titleService: Title
  ) { }

  /**
   * APP_INITIALIZERから呼び出されます。
   * UIを持たないプラグインを初期化します。
   */
  initialize() {
    // Modの情報をタイトルに追加
    const currentTitle = this.titleService.getTitle();
    this.titleService.setTitle(`${currentTitle} [${MOD_SYSTEM_MANIFEST.name} v${MOD_SYSTEM_MANIFEST.version}]`);

    console.log('PluginService: Initializing non-UI plugins...');
    // オーバーレイ基盤の初期化
    this.pluginOverlayService.initialize();

    for (const plugin of this.plugins) {
      // マニフェストに基づいたリソースの自動登録
      this.registerPluginResources(plugin);

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
   * マニフェストに定義されたリソース（音声など）をシステムに登録します。
   */
  private registerPluginResources(plugin: IPlugin) {
    const manifest = plugin.manifest;
    if (!manifest) return;

    // 音声リソースの登録
    if (manifest.sounds && manifest.sounds.length > 0) {
      const pluginPath = manifest.path || manifest.id;
      for (const soundFile of manifest.sounds) {
        const soundUrl = `./assets/plugins/${pluginPath}/${soundFile}`;
        console.log(`PluginService: Registering sound resource for ${manifest.id}: ${soundUrl}`);
        // 登録した音源を取得し、ジュークボックスに表示されないよう非表示設定にする
        const audio = AudioStorage.instance.add(soundUrl);
        if (audio) {
          audio.isHidden = true;
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

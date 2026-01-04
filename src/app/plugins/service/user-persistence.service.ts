import { Injectable } from '@angular/core';
import { PeerCursor } from '@udonarium/peer-cursor';
import { ImageStorage } from '@udonarium/core/file-storage/image-storage';
import { ImageFile, ImageState } from '@udonarium/core/file-storage/image-file';
import { EventSystem } from '@udonarium/core/system';
import * as localForage from 'localforage';

const STORE_KEYS = {
  NAME: 'udonarium_user_name',
  COLOR: 'udonarium_user_color',
  ICON_BLOB: 'udonarium_user_icon_blob',
  ICON_ID: 'udonarium_user_icon_id',
  PLUGINS: 'udonarium_plugins_data'
};

export interface PluginPersistenceHooks {
  save: () => any;
  load: (data: any) => void;
}

@Injectable({
  providedIn: 'root'
})
export class UserPersistenceService {
  private isInitialized = false;
  private pluginRegistry: Map<string, PluginPersistenceHooks> = new Map();
  private restoredPluginsData: { [id: string]: any } = {};

  constructor() {
    // IndexedDBの設定
    localForage.config({
      name: 'Udonarium_UserPersistence',
      storeName: 'user_settings'
    });
  }

  /**
   * 永続化機能を開始する
   * PeerCursor.myCursor が作成された後に呼び出すこと
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    // 復元
    await this.restoreIdentity();

    // 変更監視の開始
    this.startObserving();
    
    this.isInitialized = true;
    console.log('UserPersistenceService: Initialized.');
  }

  /**
   * プラグインのデータを永続化対象として登録する
   */
  registerPlugin(id: string, hooks: PluginPersistenceHooks) {
    this.pluginRegistry.set(id, hooks);
    
    // すでにデータが復元されている場合は、即座にロードを実行
    if (this.restoredPluginsData[id] !== undefined) {
      try {
        hooks.load(this.restoredPluginsData[id]);
      } catch (e) {
        console.error(`UserPersistenceService: Failed to load data for plugin "${id}"`, e);
      }
    }
  }

  /**
   * 明示的にプラグインデータを保存する
   */
  async savePluginData() {
    if (!this.isInitialized) return;
    const myCursor = PeerCursor.myCursor;
    if (myCursor) await this.saveIdentity(myCursor);
  }

  private async restoreIdentity(): Promise<void> {
    const myCursor = PeerCursor.myCursor;
    if (!myCursor) return;

    try {
      // 名前と色の復元
      const savedName = await localForage.getItem<string>(STORE_KEYS.NAME);
      const savedColor = await localForage.getItem<string>(STORE_KEYS.COLOR);

      myCursor.name = savedName ? savedName : 'プレイヤー';
      if (savedColor) myCursor.color = savedColor;

      // アイコンの復元
      const iconBlob = await localForage.getItem<Blob>(STORE_KEYS.ICON_BLOB);
      const iconId = await localForage.getItem<string>(STORE_KEYS.ICON_ID);

      if (iconBlob && iconId) {
        console.log('UserPersistenceService: Restoring user icon...', iconId);
        const imageFile = ImageStorage.instance.add({
          identifier: iconId,
          name: iconId,
          type: iconBlob.type,
          blob: iconBlob,
          url: '',
          thumbnail: { blob: iconBlob, type: iconBlob.type, url: '' }
        });
        if (imageFile) myCursor.imageIdentifier = imageFile.identifier;
      }

      // プラグインデータの復元
      const pluginsData = await localForage.getItem<{ [id: string]: any }>(STORE_KEYS.PLUGINS);
      if (pluginsData) {
        this.restoredPluginsData = pluginsData;
        for (const [id, hooks] of this.pluginRegistry.entries()) {
          if (this.restoredPluginsData[id] !== undefined) {
            hooks.load(this.restoredPluginsData[id]);
          }
        }
      }
    } catch (e) {
      console.error('UserPersistenceService: Failed to restore identity.', e);
    }
  }

  private startObserving(): void {
    EventSystem.register(this)
      .on('UPDATE_GAME_OBJECT', async (event) => {
        const myCursor = PeerCursor.myCursor;
        if (!myCursor || event.data.identifier !== myCursor.identifier) return;
        await this.saveIdentity(myCursor);
      });
  }

  private async saveIdentity(myCursor: PeerCursor): Promise<void> {
    try {
      await localForage.setItem(STORE_KEYS.NAME, myCursor.name);
      await localForage.setItem(STORE_KEYS.COLOR, myCursor.color);

      // アイコンの保存
      const image = myCursor.image;
      if (image && image.identifier !== 'none_icon' && image.state === ImageState.COMPLETE && image.blob) {
        await localForage.setItem(STORE_KEYS.ICON_BLOB, image.blob);
        await localForage.setItem(STORE_KEYS.ICON_ID, image.identifier);
      } else if (myCursor.imageIdentifier === 'none_icon') {
        await localForage.removeItem(STORE_KEYS.ICON_BLOB);
        await localForage.removeItem(STORE_KEYS.ICON_ID);
      }

      // プラグインデータの保存
      const pluginsData: { [id: string]: any } = {};
      for (const [id, hooks] of this.pluginRegistry.entries()) {
        try {
          pluginsData[id] = hooks.save();
        } catch (e) {
          console.error(`UserPersistenceService: Failed to save data for plugin "${id}"`, e);
        }
      }
      await localForage.setItem(STORE_KEYS.PLUGINS, pluginsData);
    } catch (e) {
      console.error('UserPersistenceService: Failed to save identity.', e);
    }
  }
}

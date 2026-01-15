import { Injectable, NgZone } from '@angular/core';

import { ChatTabList } from '@udonarium/chat-tab-list';
import { FileArchiver } from '@udonarium/core/file-storage/file-archiver';
import { ImageFile, ImageState } from '@udonarium/core/file-storage/image-file';
import { ImageStorage } from '@udonarium/core/file-storage/image-storage';
import { MimeType } from '@udonarium/core/file-storage/mime-type';
import { GameObject } from '@udonarium/core/synchronize-object/game-object';
import { PromiseQueue } from '@udonarium/core/system/util/promise-queue';
import { XmlUtil } from '@udonarium/core/system/util/xml-util';
import { DataSummarySetting } from '@udonarium/data-summary-setting';
import { Room } from '@udonarium/room';
import { ObjectStore } from '@udonarium/core/synchronize-object/object-store'; // ----- MODIFICATION (kunyatta) for PluginSystem -----
import { PluginDataContainer } from '../class/plugin-data-container'; // ----- MODIFICATION (kunyatta) for PluginSystem -----
import { DataElement } from '@udonarium/data-element'; // ----- MODIFICATION (kunyatta) for PluginSystem -----

import Beautify from 'vkbeautify';

type UpdateCallback = (percent: number) => void;

@Injectable({
  providedIn: 'root'
})
export class SaveDataService {
  private static queue: PromiseQueue = new PromiseQueue('SaveDataServiceQueue');

  constructor(
    private ngZone: NgZone
  ) { }

  saveRoomAsync(fileName: string = 'ルームデータ', updateCallback?: UpdateCallback): Promise<void> {
    return SaveDataService.queue.add((resolve, reject) => resolve(this._saveRoomAsync(fileName, updateCallback)));
  }

  private _saveRoomAsync(fileName: string = 'ルームデータ', updateCallback?: UpdateCallback): Promise<void> {
    let files: File[] = [];
    let roomXml = this.convertToXml(new Room());
    let chatXml = this.convertToXml(ChatTabList.instance);
    let summarySetting = this.convertToXml(DataSummarySetting.instance);
    files.push(new File([roomXml], 'data.xml', { type: 'text/plain' }));
    files.push(new File([chatXml], 'chat.xml', { type: 'text/plain' }));
    files.push(new File([summarySetting], 'summary.xml', { type: 'text/plain' }));

    // ----- MODIFICATION START (kunyatta) for PluginSystem -----
    // PluginDataContainerをpluginIdとfileNameHintの組み合わせでグループ化
    const pluginDataMap = new Map<string, PluginDataContainer[]>();
    for (const container of ObjectStore.instance.getObjects(PluginDataContainer)) {
      let groupKey = container.pluginId;
      if (container.fileNameHint) {
        groupKey += `#${container.fileNameHint}`;
      }

      if (!pluginDataMap.has(groupKey)) {
        pluginDataMap.set(groupKey, []);
      }
      pluginDataMap.get(groupKey).push(container);
    }

    // グループごとにXMLファイルを作成
    for (const [groupKey, containers] of pluginDataMap.entries()) {
      if (!groupKey) continue;

      const [pluginId, fileNameHint] = groupKey.split('#');

      let pluginXml = '';
      for (const container of containers) {
        pluginXml += container.toXml();
      }

      const finalXml = this.convertToXml(pluginXml, 'data');
      const xmlFileName = fileNameHint ? `plugin_${pluginId}_${fileNameHint}.xml` : `plugin_${pluginId}.xml`;
      files.push(new File([finalXml], xmlFileName, { type: 'text/plain' }));

      // プラグインデータ内で使用されている画像も収集する
      files = files.concat(this.searchImageFiles(finalXml));
    }
    // ----- MODIFICATION END (kunyatta) for PluginSystem -----

    files = files.concat(this.searchImageFiles(roomXml));
    files = files.concat(this.searchImageFiles(chatXml));

    return this.saveAsync(files, this.appendTimestamp(fileName), updateCallback);
  }

  saveGameObjectAsync(gameObject: GameObject, fileName: string = 'xml_data', updateCallback?: UpdateCallback): Promise<void> {
    return SaveDataService.queue.add((resolve, reject) => resolve(this._saveGameObjectAsync(gameObject, fileName, updateCallback)));
  }

  // ----- MODIFICATION START (kunyatta) for PluginSystem -----
  /**
   * 任意の DataElement を単一のXMLファイルとして保存します。
   * ZIP圧縮するかどうかを選択可能です。
   *
   * @param element 保存対象の DataElement
   * @param xmlFileName 保存されるXMLファイル名（拡張子なし）
   * @param zipFileName ZIP保存時のファイル名（拡張子なし）。ZIP圧縮しない場合は無視されます。
   * @param isZip ZIP圧縮して保存するかどうか。デフォルトは true。
   */
  saveDataElementAsync(element: DataElement, xmlFileName: string = 'data', zipFileName: string = 'data', isZip: boolean = true): Promise<void> {
    return SaveDataService.queue.add((resolve, reject) => resolve(this._saveDataElementAsync(element, xmlFileName, zipFileName, isZip)));
  }

  private _saveDataElementAsync(element: DataElement, xmlFileName: string, zipFileName: string, isZip: boolean): Promise<void> {
    // DataElementは既にXML構造を持っているので、そのまま文字列化する
    let xml: string = this.convertToXml(element.toXml());
    return isZip ? this._saveXmlAsZipAsync(xml, xmlFileName, zipFileName) : this._saveXmlAsync(xml, xmlFileName);
  }

  /**
   * 任意の XML 文字列を単一のXMLファイルとして保存します。
   */
  saveXmlAsZipAsync(xml: string, xmlFileName: string = 'data', zipFileName: string = 'data'): Promise<void> {
    return SaveDataService.queue.add((resolve, reject) => resolve(this._saveXmlAsZipAsync(this.convertToXml(xml), xmlFileName, zipFileName)));
  }

  private _saveXmlAsZipAsync(xml: string, xmlFileName: string, zipFileName: string): Promise<void> {
    let files: File[] = [];
    files.push(new File([xml], xmlFileName + '.xml', { type: 'text/plain' }));
    files = files.concat(this.searchImageFiles(xml));

    return this.saveAsync(files, this.appendTimestamp(zipFileName));
  }

  /**
   * 任意の XML 文字列をZIP圧縮せずに単一のXMLファイルとして保存（ダウンロード）します。
   * 主に開発者が初期データを作成するために使用します。
   */
  saveXmlAsync(xml: string, fileName: string = 'data'): Promise<void> {
    return SaveDataService.queue.add((resolve, reject) => resolve(this._saveXmlAsync(this.convertToXml(xml), fileName)));
  }

  private _saveXmlAsync(xml: string, fileName: string): Promise<void> {
    let blob = new Blob([xml], { type: 'text/xml' });
    let link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = this.appendTimestamp(fileName) + '.xml';
    link.click();
    return Promise.resolve();
  }
  // ----- MODIFICATION END (kunyatta) for PluginSystem -----

  private _saveGameObjectAsync(gameObject: GameObject, fileName: string = 'xml_data', updateCallback?: UpdateCallback): Promise<void> {
    let files: File[] = [];
    let xml: string = this.convertToXml(gameObject);

    files.push(new File([xml], 'data.xml', { type: 'text/plain' }));
    files = files.concat(this.searchImageFiles(xml));

    return this.saveAsync(files, this.appendTimestamp(fileName), updateCallback);
  }

  private saveAsync(files: File[], zipName: string, updateCallback?: UpdateCallback): Promise<void> {
    let progresPercent = -1;
    return FileArchiver.instance.saveAsync(files, zipName, meta => {
      let percent = meta.percent | 0;
      if (percent <= progresPercent) return;
      progresPercent = percent;
      this.ngZone.run(() => updateCallback(progresPercent));
    });
  }

  // ----- MODIFICATION START (kunyatta) for PluginSystem -----
  /*
  private convertToXml(gameObject: GameObject): string {
    let xmlDeclaration = '<?xml version="1.0" encoding="UTF-8"?>';
    return xmlDeclaration + '\n' + Beautify.xml(gameObject.toXml(), 2);
  }
  */
  private convertToXml(target: GameObject | string, rootName?: string): string {
    let xmlDeclaration = '<?xml version="1.0" encoding="UTF-8"?>';
    let contentXml = '';
    if (typeof target === 'string') {
      contentXml = rootName ? `<${rootName}>${target}</${rootName}>` : target;
    } else {
      contentXml = target.toXml();
    }
    return xmlDeclaration + '\n' + Beautify.xml(contentXml, 2);
  }
  // ----- MODIFICATION END (kunyatta) for PluginSystem -----

  private searchImageFiles(xml: string): File[] {
    let xmlElement: Element = XmlUtil.xml2element(xml);
    let files: File[] = [];
    if (!xmlElement) return files;

    let images: { [identifier: string]: ImageFile } = {};
    let imageElements = xmlElement.ownerDocument.querySelectorAll('*[type="image"]');

    for (let i = 0; i < imageElements.length; i++) {
      let identifier = imageElements[i].innerHTML;
      images[identifier] = ImageStorage.instance.get(identifier);
    }

    imageElements = xmlElement.ownerDocument.querySelectorAll('*[imageIdentifier], *[backgroundImageIdentifier]');

    for (let i = 0; i < imageElements.length; i++) {
      let identifier = imageElements[i].getAttribute('imageIdentifier');
      if (identifier) images[identifier] = ImageStorage.instance.get(identifier);

      let backgroundImageIdentifier = imageElements[i].getAttribute('backgroundImageIdentifier');
      if (backgroundImageIdentifier) images[backgroundImageIdentifier] = ImageStorage.instance.get(backgroundImageIdentifier);
    }
    for (let identifier in images) {
      let image = images[identifier];
      if (image && image.state === ImageState.COMPLETE) {
        files.push(new File([image.blob], image.identifier + '.' + MimeType.extension(image.blob.type), { type: image.blob.type }));
      }
    }
    return files;
  }

  private appendTimestamp(fileName: string): string {
    let date = new Date();
    let year = date.getFullYear();
    let month = ('00' + (date.getMonth() + 1)).slice(-2);
    let day = ('00' + date.getDate()).slice(-2);
    let hours = ('00' + date.getHours()).slice(-2);
    let minutes = ('00' + date.getMinutes()).slice(-2);

    return fileName + `_${year}-${month}-${day}_${hours}${minutes}`;
  }
}

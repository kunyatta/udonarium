import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { ConfigPanelTestService } from './config-panel-test.service';
import { ConfigItem, DEFAULT_CONFIG_ITEM } from './config-panel-test.model';
import { PluginUiService } from '../service/plugin-ui.service';
import { PluginDataTransferService } from '../service/plugin-data-transfer.service';
import { FileSelecterComponent } from '../../component/file-selecter/file-selecter.component';
import { ImageStorage } from '@udonarium/core/file-storage/image-storage';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-config-panel-test',
  templateUrl: './config-panel-test.component.html',
  styleUrls: ['./config-panel-test.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ConfigPanelTestComponent implements OnInit, OnDestroy {
  selectedIdentifier: string | null = null;
  editingItem: ConfigItem | null = null;
  activeTab: 'basic' | 'advanced' = 'basic'; // タブ状態管理
  private onDestroy$ = new Subject<void>();

  constructor(
    public service: ConfigPanelTestService,
    private pluginUiService: PluginUiService,
    private pluginDataTransfer: PluginDataTransferService,
    private changeDetector: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    if (this.items.length > 0) {
      this.select(this.items[0].identifier);
    }

    this.service.update$
      .pipe(takeUntil(this.onDestroy$))
      .subscribe(() => {
        // データ更新があったら再描画マーク
        // 選択中のアイテムが削除されていた場合のケア
        if (this.selectedIdentifier && !this.service.getItem(this.selectedIdentifier)) {
          this.selectedIdentifier = null;
          this.editingItem = null;
        }
        this.changeDetector.markForCheck();
      });
  }

  ngOnDestroy(): void {
    this.onDestroy$.next();
    this.onDestroy$.complete();
  }

  get items(): ConfigItem[] {
    return this.service.items;
  }

  select(identifier: string) {
    this.selectedIdentifier = identifier;
    this.editingItem = this.service.getItem(identifier) || null;
    this.changeDetector.markForCheck();
  }

  createNew() {
    const newItem = this.service.add(DEFAULT_CONFIG_ITEM);
    this.select(newItem.identifier);
  }

  delete() {
    if (!this.selectedIdentifier) return;
    if (confirm('この項目を削除しますか？')) {
      this.service.delete(this.selectedIdentifier);
      this.selectedIdentifier = null;
      this.editingItem = null;
      if (this.items.length > 0) {
        this.select(this.items[0].identifier);
      }
    }
  }

  save() {
    if (this.editingItem) {
      this.service.update(this.editingItem);
    }
  }

  openImageSelecter() {
    if (!this.editingItem) return;
    this.pluginUiService.openAsModal(FileSelecterComponent, { title: '画像を選択' }).then(identifier => {
      if (typeof identifier === 'string' && this.editingItem) {
        this.editingItem.imageIdentifier = identifier;
        this.save();
        this.changeDetector.markForCheck();
      }
    });
  }

  getImageUrl(identifier: string): string {
    const file = ImageStorage.instance.get(identifier);
    return file ? file.url : '';
  }

  exportItem() {
    if (!this.editingItem) return;
    const element = this.service.getExportDataElement(this.editingItem.identifier);
    if (element) {
      this.pluginDataTransfer.export(this.service.PLUGIN_ID, `config_test_${this.editingItem.name}`, element);
    }
  }

  exportAll() {
    if (this.items.length === 0) return;
    const element = this.service.getAllExportDataElement();
    this.pluginDataTransfer.export(this.service.PLUGIN_ID, 'config_test_all', element);
  }
}

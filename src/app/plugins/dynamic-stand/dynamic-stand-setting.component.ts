import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { DynamicStandPluginService } from './dynamic-stand.service';
import { StandGlobalConfig } from './dynamic-stand.model';
import { EmoteManagerService, EmoteData } from './emote-manager.service';
import { UUID } from '@udonarium/core/system/util/uuid';
import { AudioStorage } from '@udonarium/core/file-storage/audio-storage';
import { AudioFile } from '@udonarium/core/file-storage/audio-file';
import { PluginDataTransferService } from '../service/plugin-data-transfer.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'dynamic-stand-setting',
  templateUrl: './dynamic-stand-setting.component.html',
  styleUrls: ['./dynamic-stand-setting.component.css']
})
export class DynamicStandSettingComponent implements OnInit, OnDestroy {
  selectedTab: 'global' | 'emotes' = 'global';
  selectedEmote: EmoteData = null;
  private onDestroy$ = new Subject<void>();

  get config(): StandGlobalConfig {
    return this.service.config;
  }

  get emotes(): EmoteData[] {
    return this.emoteManager.getEmotes();
  }

  get audios(): AudioFile[] {
    return AudioStorage.instance.audios.filter(audio => !audio.isHidden);
  }

  constructor(
    private service: DynamicStandPluginService,
    private emoteManager: EmoteManagerService,
    private pluginDataTransfer: PluginDataTransferService,
    private changeDetector: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.emoteManager.update$
      .pipe(takeUntil(this.onDestroy$))
      .subscribe(() => {
        this.changeDetector.detectChanges();
      });
  }

  ngOnDestroy(): void {
    this.onDestroy$.next();
    this.onDestroy$.complete();
  }

  updateConfig() {
    this.service.saveConfig();
  }

  selectTab(tab: 'global' | 'emotes') {
    this.selectedTab = tab;
  }

  selectEmote(emote: EmoteData) {
    this.selectedEmote = emote;
  }

  createNewEmote() {
    const newEmote: EmoteData = {
      identifier: UUID.generateUuid(),
      icon: '✨',
      label: '新規エモート'
    };
    this.emoteManager.addEmote(newEmote);
    this.selectEmote(newEmote);
  }

  onEmoteChange() {
    this.emoteManager.saveConfig();
  }

  exportEmote() {
    if (!this.selectedEmote) return;
    const element = this.emoteManager.getExportDataElement(this.selectedEmote);
    this.pluginDataTransfer.export(this.emoteManager.PLUGIN_ID, `エモート_${this.selectedEmote.label}`, element);
  }

  exportAllEmotes() {
    if (this.emotes.length === 0) return;
    const element = this.emoteManager.getAllExportDataElement();
    this.pluginDataTransfer.export(this.emoteManager.PLUGIN_ID, 'plugin_dynamic-stand-emotes', element);
  }

  deleteEmote() {
    if (!this.selectedEmote || !this.selectedEmote.identifier) return;
    if (!confirm(`エモート「${this.selectedEmote.label}」を削除しますか？`)) return;

    this.emoteManager.deleteEmote(this.selectedEmote.identifier);
    this.selectedEmote = null;
  }

  moveEmote(event: Event, emote: EmoteData, direction: number) {
    event.stopPropagation();
    this.emoteManager.moveEmote(emote.identifier, direction);
  }

  cancelEdit() {
    this.selectedEmote = null;
  }
}

import { Component, OnInit } from '@angular/core';
import { DynamicStandPluginService } from './dynamic-stand.service';
import { StandGlobalConfig } from './dynamic-stand.model';
import { EmoteManagerService, EmoteData } from './emote-manager.service';
import { UUID } from '@udonarium/core/system/util/uuid';
import { AudioStorage } from '@udonarium/core/file-storage/audio-storage';
import { AudioFile } from '@udonarium/core/file-storage/audio-file';

@Component({
  selector: 'dynamic-stand-setting',
  templateUrl: './dynamic-stand-setting.component.html',
  styleUrls: ['./dynamic-stand-setting.component.css']
})
export class DynamicStandSettingComponent implements OnInit {
  selectedTab: 'global' | 'emotes' = 'global';
  selectedEmote: EmoteData = null;

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
    private emoteManager: EmoteManagerService
  ) {}

  ngOnInit(): void {}

  selectTab(tab: 'global' | 'emotes') {
    this.selectedTab = tab;
  }

  selectEmote(emote: EmoteData) {
    // 編集用にコピーを作成
    this.selectedEmote = { ...emote };
  }

  createNewEmote() {
    this.selectedEmote = {
      identifier: '', // 新規作成時は空
      icon: '',
      label: '新規エモート'
    };
  }

  saveEmote() {
    if (!this.selectedEmote) return;

    if (!this.selectedEmote.identifier) {
      // 新規追加
      this.emoteManager.addEmote(this.selectedEmote);
    } else {
      // 更新
      this.emoteManager.updateEmote(this.selectedEmote);
    }
    // 選択状態を解除（あるいは更新後のデータを再選択）
    this.selectedEmote = null;
  }

  deleteEmote() {
    if (!this.selectedEmote || !this.selectedEmote.identifier) return;
    if (!confirm(`エモート「${this.selectedEmote.label}」を削除しますか？`)) return;

    this.emoteManager.deleteEmote(this.selectedEmote.identifier);
    this.selectedEmote = null;
  }

  cancelEdit() {
    this.selectedEmote = null;
  }
}

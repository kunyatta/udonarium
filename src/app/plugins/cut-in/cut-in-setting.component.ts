import { Component, OnInit, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { CutInService } from './cut-in.service';
import { CutIn } from './cut-in.model';
import { PluginUiService } from '../service/plugin-ui.service';
import { FileSelecterComponent } from '../../component/file-selecter/file-selecter.component';
import { ImageStorage } from '@udonarium/core/file-storage/image-storage';
import { AudioStorage } from '@udonarium/core/file-storage/audio-storage';
import { CutInPlaybackService } from './cut-in-playback.service';

@Component({
  selector: 'app-cut-in-setting',
  templateUrl: './cut-in-setting.component.html',
  styleUrls: ['./cut-in-setting.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CutInSettingComponent implements OnInit {
  selectedIdentifier: string | null = null;
  editingCutIn: CutIn | null = null;
  
  get sizeMode(): 'ratio' | 'scale' {
    if (!this.editingCutIn) return 'scale';
    return this.editingCutIn.width > 0 ? 'ratio' : 'scale';
  }

  set sizeMode(value: 'ratio' | 'scale') {
    if (!this.editingCutIn) return;
    if (value === 'ratio') {
      this.editingCutIn.scale = 1.0;
      if (this.editingCutIn.width === 0) this.editingCutIn.width = 30; // デフォルト
    } else {
      this.editingCutIn.width = 0;
    }
    this.changeDetector.markForCheck();
  }

  constructor(
    public cutInService: CutInService,
    private playbackService: CutInPlaybackService,
    private pluginUiService: PluginUiService,
    private changeDetector: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // 最初の項目があれば選択する
    if (this.cutIns.length > 0) {
      this.select(this.cutIns[0].identifier);
    }
  }

  get cutIns(): CutIn[] {
    return this.cutInService.cutIns;
  }

  select(identifier: string) {
    this.selectedIdentifier = identifier;
    const found = this.cutInService.getCutInById(identifier);
    this.editingCutIn = found ? { ...found } : null;
    this.changeDetector.markForCheck();
  }

  createNew() {
    this.selectedIdentifier = null;
    this.editingCutIn = {
      identifier: '',
      name: '新規カットイン',
      imageIdentifier: '',
      duration: 5,
      left: 50,
      top: 50,
      width: 30,
      height: 0,
      opacity: 1.0,
      scale: 1.0,
      keyword: '',
      audioIdentifier: ''
    };
    this.changeDetector.markForCheck();
  }

  save() {
    if (!this.editingCutIn) return;
    
    // モードに合わせて値を最終調整
    if (this.sizeMode === 'ratio') {
      this.editingCutIn.scale = 1.0;
    } else {
      this.editingCutIn.width = 0;
    }

    if (this.editingCutIn.identifier) {
      this.cutInService.updateCutIn(this.editingCutIn);
    } else {
      const newCutIn = { ...this.editingCutIn, identifier: crypto.randomUUID() };
      this.cutInService.addCutIn(newCutIn);
      this.selectedIdentifier = newCutIn.identifier;
    }
    this.changeDetector.markForCheck();
  }

  delete() {
    if (!this.selectedIdentifier) return;
    const cutIn = this.cutInService.getCutInById(this.selectedIdentifier);
    if (cutIn && confirm(`カットイン「${cutIn.name}」を削除しますか？`)) {
      this.cutInService.deleteCutIn(this.selectedIdentifier);
      this.selectedIdentifier = null;
      this.editingCutIn = null;
      if (this.cutIns.length > 0) {
        this.select(this.cutIns[0].identifier);
      }
      this.changeDetector.markForCheck();
    }
  }

  play() {
    if (this.editingCutIn) this.playbackService.play(this.editingCutIn);
  }

  playLocal() {
    if (this.editingCutIn) this.playbackService.playLocal(this.editingCutIn);
  }

  openImageSelecter() {
    if (!this.editingCutIn) return;
    this.pluginUiService.openAsModal(FileSelecterComponent, { title: '画像を選択' }).then(fileIdentifier => {
      if (typeof fileIdentifier === 'string' && this.editingCutIn) {
        this.editingCutIn.imageIdentifier = fileIdentifier;
        this.changeDetector.markForCheck();
      }
    });
  }

  getImageUrl(identifier: string): string {
    const file = ImageStorage.instance.get(identifier);
    return file ? file.url : '';
  }
}

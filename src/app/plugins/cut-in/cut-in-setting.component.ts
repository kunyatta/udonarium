import { Component, OnInit, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { CutInService } from './cut-in.service';
import { CutIn, DEFAULT_CUT_IN } from './cut-in.model';
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
      if (this.editingCutIn.width === 0) this.editingCutIn.width = DEFAULT_CUT_IN.width;
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

  readonly easings = [
    'linear', 'ease', 'ease-in', 'ease-out', 'ease-in-out',
    'cubic-bezier(0.175, 0.885, 0.32, 1.275)', // backOut
    'cubic-bezier(0.6, -0.28, 0.735, 0.045)', // backIn
  ];

  setQuickInEffect(effect: string) {
    if (!this.editingCutIn) return;
    
    // 現在の目標状態をベースにする
    this.editingCutIn.startLeft = this.editingCutIn.left;
    this.editingCutIn.startTop = this.editingCutIn.top;
    this.editingCutIn.startOpacity = this.editingCutIn.opacity;
    this.editingCutIn.startScale = this.editingCutIn.scale;

    switch (effect) {
      case 'fade':
        this.editingCutIn.startOpacity = 0;
        break;
      case 'slide-left':
        this.editingCutIn.startLeft = this.editingCutIn.left - 20;
        this.editingCutIn.startOpacity = 0;
        break;
      case 'slide-right':
        this.editingCutIn.startLeft = this.editingCutIn.left + 20;
        this.editingCutIn.startOpacity = 0;
        break;
      case 'slide-up':
        this.editingCutIn.startTop = this.editingCutIn.top + 20;
        this.editingCutIn.startOpacity = 0;
        break;
      case 'slide-down':
        this.editingCutIn.startTop = this.editingCutIn.top - 20;
        this.editingCutIn.startOpacity = 0;
        break;
      case 'zoom-in':
        this.editingCutIn.startScale = 0;
        this.editingCutIn.startOpacity = 0;
        break;
      case 'zoom-out':
        this.editingCutIn.startScale = 2.0;
        this.editingCutIn.startOpacity = 0;
        break;
    }
    this.changeDetector.markForCheck();
  }

  setQuickOutEffect(effect: string) {
    if (!this.editingCutIn) return;
    
    // 現在の目標状態（登場後の状態）をベースにする
    this.editingCutIn.endLeft = this.editingCutIn.left;
    this.editingCutIn.endTop = this.editingCutIn.top;
    this.editingCutIn.endOpacity = this.editingCutIn.opacity;
    this.editingCutIn.endScale = this.editingCutIn.scale;

    switch (effect) {
      case 'fade':
        this.editingCutIn.endOpacity = 0;
        break;
      case 'slide-left':
        this.editingCutIn.endLeft = this.editingCutIn.left - 20;
        this.editingCutIn.endOpacity = 0;
        break;
      case 'slide-right':
        this.editingCutIn.endLeft = this.editingCutIn.left + 20;
        this.editingCutIn.endOpacity = 0;
        break;
      case 'slide-up':
        this.editingCutIn.endTop = this.editingCutIn.top - 20;
        this.editingCutIn.endOpacity = 0;
        break;
      case 'slide-down':
        this.editingCutIn.endTop = this.editingCutIn.top + 20;
        this.editingCutIn.endOpacity = 0;
        break;
      case 'zoom-in':
        this.editingCutIn.endScale = 2.0;
        this.editingCutIn.endOpacity = 0;
        break;
      case 'zoom-out':
        this.editingCutIn.endScale = 0;
        this.editingCutIn.endOpacity = 0;
        break;
    }
    this.changeDetector.markForCheck();
  }

  ngOnInit(): void {
    // 最初の項目があれば選択する
    if (this.cutIns.length > 0) {
      this.select(this.cutIns[0].identifier);
    }
  }

  get cutIns(): CutIn[] {
    return this.cutInService.cutIns;
  }

  get audios() {
    return AudioStorage.instance.audios.filter(audio => !audio.isHidden);
  }

  select(identifier: string) {
    this.selectedIdentifier = identifier;
    const found = this.cutInService.getCutInById(identifier);
    this.editingCutIn = found ? { ...found } : null;
    
    // Restore video URL for display
    if (this.editingCutIn?.type === 'video' && this.editingCutIn.videoIdentifier) {
      this._videoUrl = `https://www.youtube.com/watch?v=${this.editingCutIn.videoIdentifier}`;
    } else {
      this._videoUrl = '';
    }

    this.changeDetector.markForCheck();
  }

  createNew() {
    this.selectedIdentifier = null;
    this.editingCutIn = {
      ...DEFAULT_CUT_IN,
      identifier: ''
    };
    this.videoUrl = ''; // Reset video URL
    this.changeDetector.markForCheck();
  }

  // Helper property for UI binding
  get cutInType(): 'image' | 'video' {
    return this.editingCutIn?.type || 'image';
  }
  
  set cutInType(type: 'image' | 'video') {
    if (this.editingCutIn) {
      this.editingCutIn.type = type;
      this.changeDetector.markForCheck();
    }
  }

  // YouTube URL Management
  _videoUrl: string = '';
  get videoUrl(): string {
    return this._videoUrl;
  }
  set videoUrl(url: string) {
    this._videoUrl = url;
    if (this.editingCutIn) {
      const videoId = this.extractYouTubeId(url);
      console.log('[CutInSetting] URL Input:', url, '-> ID:', videoId);
      if (videoId) {
        this.editingCutIn.videoIdentifier = videoId;
      }
      this.changeDetector.markForCheck(); // Force UI update
    }
  }

  private extractYouTubeId(url: string): string | null {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  }

  getVideoThumbnailUrl(): string {
    if (this.editingCutIn?.videoIdentifier) {
      return `https://img.youtube.com/vi/${this.editingCutIn.videoIdentifier}/hqdefault.jpg`;
    }
    return '';
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
      this.select(this.editingCutIn.identifier); // Reload to ensure consistency
    } else {
      const newCutIn = { ...this.editingCutIn, identifier: crypto.randomUUID() };
      this.cutInService.addCutIn(newCutIn);
      this.select(newCutIn.identifier); // Switch to edit mode
    }
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

  stopAll() {
    this.playbackService.stopAll();
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

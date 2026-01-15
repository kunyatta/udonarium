import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { CutInService } from './cut-in.service';
import { CutIn, DEFAULT_CUT_IN } from './cut-in.model';
import { PluginUiService } from '../service/plugin-ui.service';
import { FileSelecterComponent } from '../../component/file-selecter/file-selecter.component';
import { ImageStorage } from '@udonarium/core/file-storage/image-storage';
import { AudioStorage } from '@udonarium/core/file-storage/audio-storage';
import { CutInPlaybackService } from './cut-in-playback.service';
import { PluginDataTransferService } from '../service/plugin-data-transfer.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-cut-in-setting',
  templateUrl: './cut-in-setting.component.html',
  styleUrls: ['./cut-in-setting.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CutInSettingComponent implements OnInit, OnDestroy {
  selectedIdentifier: string | null = null;
  editingCutIn: CutIn | null = null;
  private onDestroy$ = new Subject<void>();
  
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
    this.update();
  }

  constructor(
    public cutInService: CutInService,
    private playbackService: CutInPlaybackService,
    private pluginUiService: PluginUiService,
    private changeDetector: ChangeDetectorRef,
    private pluginDataTransfer: PluginDataTransferService
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
    this.update();
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
    this.update();
  }

  ngOnInit(): void {
    // 最初の項目があれば選択する
    if (this.cutIns.length > 0) {
      this.select(this.cutIns[0].identifier);
    }

    this.cutInService.update$
      .pipe(takeUntil(this.onDestroy$))
      .subscribe(() => {
        this.changeDetector.markForCheck();
      });
  }

  ngOnDestroy(): void {
    this.onDestroy$.next();
    this.onDestroy$.complete();
  }

  get cutIns(): CutIn[] {
    return this.cutInService.cutIns;
  }

  get audios() {
    return AudioStorage.instance.audios.filter(audio => !audio.isHidden);
  }

  select(identifier: string) {
    this.selectedIdentifier = identifier;
    // 参照渡しに変更（リアルタイム更新のため）
    const found = this.cutInService.getCutInById(identifier);
    this.editingCutIn = found ? found : null;
    
    // Restore video URL for display
    if (this.editingCutIn?.type === 'video' && this.editingCutIn.videoIdentifier) {
      this._videoUrl = `https://www.youtube.com/watch?v=${this.editingCutIn.videoIdentifier}`;
    } else {
      this._videoUrl = '';
    }

    this.changeDetector.markForCheck();
  }

  createNew() {
    const newCutIn = {
      ...DEFAULT_CUT_IN,
      identifier: '' // service.addCutInでID生成される
    };
    this.cutInService.addCutIn(newCutIn);
    // 生成されたIDで選択（リストの末尾に追加されているはず）
    const added = this.cutIns[this.cutIns.length - 1];
    this.select(added.identifier);
  }

  // Helper property for UI binding
  get cutInType(): 'image' | 'video' {
    return this.editingCutIn?.type || 'image';
  }
  
  set cutInType(type: 'image' | 'video') {
    if (this.editingCutIn) {
      this.editingCutIn.type = type;
      this.update();
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
      this.update();
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

  update() {
    if (!this.editingCutIn) return;
    this.cutInService.save();
    this.changeDetector.markForCheck();
  }

  // 個別エクスポート
  export() {
    if (!this.editingCutIn) return;
    const element = this.cutInService.getExportDataElement(this.editingCutIn);
    this.pluginDataTransfer.export(this.cutInService.PLUGIN_ID, `カットイン_${this.editingCutIn.name}`, element);
  }

  // 一括エクスポート
  exportAll() {
    if (this.cutIns.length === 0) return;
    const element = this.cutInService.getAllExportDataElement();
    this.pluginDataTransfer.export(this.cutInService.PLUGIN_ID, 'plugin_cut-in_list', element);
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
        this.update();
      }
    });
  }

  getImageUrl(identifier: string): string {
    const file = ImageStorage.instance.get(identifier);
    return file ? file.url : '';
  }
}

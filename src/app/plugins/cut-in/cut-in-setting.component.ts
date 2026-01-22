import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { CutInService } from './cut-in.service';
import { CutIn, DEFAULT_CUT_IN } from './cut-in.model';
import { PluginUiService } from '../service/plugin-ui.service';
import { FileSelecterComponent } from '../../component/file-selecter/file-selecter.component';
import { ImageStorage } from '@udonarium/core/file-storage/image-storage';
import { AudioStorage } from '@udonarium/core/file-storage/audio-storage';
import { CutInPlaybackService } from './cut-in-playback.service';
import { PluginDataTransferService } from '../service/plugin-data-transfer.service';
import { PluginOverlayService } from '../service/plugin-overlay.service';
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
  activeInEffect: string | null = null;
  activeOutEffect: string | null = null;
  
  showGuide: boolean = false;
  showInGuide: boolean = false;
  showOutGuide: boolean = false;

  private guideOverlay: any | null = null;
  private inGuideOverlay: any | null = null;
  private outGuideOverlay: any | null = null;

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
    private overlayService: PluginOverlayService,
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
    this.activeInEffect = effect;
    
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
    this.activeOutEffect = effect;
    
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

  onInDetailChange() {
    this.activeInEffect = null;
    this.update();
  }

  onOutDetailChange() {
    this.activeOutEffect = null;
    this.update();
  }

  private detectPresets() {
    if (!this.editingCutIn) return;

    // 登場演出の判定
    const inMatch = (effect: string) => {
      const c = this.editingCutIn;
      switch (effect) {
        case 'fade': return c.startOpacity === 0 && c.startLeft === c.left && c.startTop === c.top && c.startScale === c.scale;
        case 'slide-left': return c.startOpacity === 0 && c.startLeft === c.left - 20 && c.startTop === c.top && c.startScale === c.scale;
        case 'slide-right': return c.startOpacity === 0 && c.startLeft === c.left + 20 && c.startTop === c.top && c.startScale === c.scale;
        case 'slide-up': return c.startOpacity === 0 && c.startTop === c.top + 20 && c.startLeft === c.left && c.startScale === c.scale;
        case 'slide-down': return c.startOpacity === 0 && c.startTop === c.top - 20 && c.startLeft === c.left && c.startScale === c.scale;
        case 'zoom-in': return c.startOpacity === 0 && c.startScale === 0 && c.startLeft === c.left && c.startTop === c.top;
        case 'zoom-out': return c.startOpacity === 0 && c.startScale === 2.0 && c.startLeft === c.left && c.startTop === c.top;
        default: return false;
      }
    };

    // 退場演出の判定
    const outMatch = (effect: string) => {
      const c = this.editingCutIn;
      switch (effect) {
        case 'fade': return c.endOpacity === 0 && c.endLeft === c.left && c.endTop === c.top && c.endScale === c.scale;
        case 'slide-left': return c.endOpacity === 0 && c.endLeft === c.left - 20 && c.endTop === c.top && c.endScale === c.scale;
        case 'slide-right': return c.endOpacity === 0 && c.endLeft === c.left + 20 && c.endTop === c.top && c.endScale === c.scale;
        case 'slide-up': return c.endOpacity === 0 && c.endTop === c.top - 20 && c.endLeft === c.left && c.endScale === c.scale;
        case 'slide-down': return c.endOpacity === 0 && c.endTop === c.top + 20 && c.endLeft === c.left && c.endScale === c.scale;
        case 'zoom-in': return c.endOpacity === 0 && c.endScale === 2.0 && c.endLeft === c.left && c.endTop === c.top;
        case 'zoom-out': return c.endOpacity === 0 && c.endScale === 0 && c.endLeft === c.left && c.endTop === c.top;
        default: return false;
      }
    };

    const effects = ['fade', 'slide-left', 'slide-right', 'slide-up', 'slide-down', 'zoom-in', 'zoom-out'];
    this.activeInEffect = effects.find(e => inMatch(e)) || null;
    this.activeOutEffect = effects.find(e => outMatch(e)) || null;
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
    this.destroyGuide('main');
    this.destroyGuide('in');
    this.destroyGuide('out');
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
    this.destroyGuide('main');
    this.destroyGuide('in');
    this.destroyGuide('out');
    this.showGuide = false;
    this.showInGuide = false;
    this.showOutGuide = false;
    this.selectedIdentifier = identifier;
    this.activeInEffect = null;
    this.activeOutEffect = null;
    // 参照渡しに変更（リアルタイム更新のため）
    const found = this.cutInService.getCutInById(identifier);
    this.editingCutIn = found ? found : null;
    
    if (this.editingCutIn) {
      this.detectPresets();
    }

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
        // Shorts判定: URLに 'shorts/' が含まれているかチェック
        this.editingCutIn.isShorts = url.toLowerCase().includes('shorts/');
      }
      this.update();
    }
  }

  private extractYouTubeId(url: string): string | null {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|shorts\/|watch\?v=|\&v=)([^#\&\?]*).*/;
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
    this.updateAllGuides();
    this.changeDetector.markForCheck();
  }

  updateAllGuides() {
    if (this.showGuide) this.updateGuide(this.guideOverlay, 'main');
    if (this.showInGuide) this.updateGuide(this.inGuideOverlay, 'in');
    if (this.showOutGuide) this.updateGuide(this.outGuideOverlay, 'out');
  }

  onGuideToggle() {
    if (this.showGuide) {
      this.guideOverlay = this.createGuide('rect-guide');
      this.updateGuide(this.guideOverlay, 'main');
    } else {
      this.destroyGuide('main');
    }
  }

  onInGuideToggle() {
    if (this.showInGuide) {
      this.inGuideOverlay = this.createGuide('rect-guide-in');
      this.updateGuide(this.inGuideOverlay, 'in');
    } else {
      this.destroyGuide('in');
    }
  }

  onOutGuideToggle() {
    if (this.showOutGuide) {
      this.outGuideOverlay = this.createGuide('rect-guide-out');
      this.updateGuide(this.outGuideOverlay, 'out');
    } else {
      this.destroyGuide('out');
    }
  }

  private createGuide(type: string) {
    return this.overlayService.createLocalOverlay(type);
  }

  private updateGuide(overlay: any, mode: 'main' | 'in' | 'out') {
    if (!overlay || !this.editingCutIn) return;
    const c = this.editingCutIn;
    
    if (mode === 'main') {
      overlay.left = c.left;
      overlay.top = c.top;
      overlay.scale = c.scale;
    } else if (mode === 'in') {
      overlay.left = c.startLeft;
      overlay.top = c.startTop;
      overlay.scale = c.startScale;
    } else if (mode === 'out') {
      overlay.left = c.endLeft;
      overlay.top = c.endTop;
      overlay.scale = c.endScale;
    }

    overlay.width = c.width > 0 ? c.width : 0; 
    overlay.height = c.height > 0 ? c.height : 0; 
    overlay.imageIdentifier = c.imageIdentifier;
    overlay.videoIdentifier = c.videoIdentifier;
    overlay.updateContent('isShorts', c.isShorts ? 1 : 0);
    overlay.update(); 
  }

  private destroyGuide(mode: 'main' | 'in' | 'out') {
    let overlay: any = null;
    if (mode === 'main') { overlay = this.guideOverlay; this.guideOverlay = null; }
    if (mode === 'in') { overlay = this.inGuideOverlay; this.inGuideOverlay = null; }
    if (mode === 'out') { overlay = this.outGuideOverlay; this.outGuideOverlay = null; }

    if (overlay) {
      this.overlayService.destroyLocalOverlay(overlay.identifier);
    }
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

import { Component, AfterViewInit, OnDestroy, ElementRef, ViewChild, NgZone, Input, Type, ViewContainerRef, Injector, OnInit, ComponentRef } from '@angular/core';
import { PluginUiService } from '../../service/plugin-ui.service';

@Component({
  selector: 'app-auto-layout-panel',
  templateUrl: './auto-layout-panel.component.html',
  styleUrls: ['./auto-layout-panel.component.css']
})
export class AutoLayoutPanelComponent implements OnInit, AfterViewInit, OnDestroy {

  private _panelId: string;
  @Input() set panelId(value: string) {
    this._panelId = value;
    this.tryLoadComponent();
  }
  get panelId(): string { return this._panelId; }

  private _componentToHost: Type<any>;
  @Input() set componentToHost(value: Type<any>) {
    this._componentToHost = value;
    this.tryLoadComponent();
  }
  get componentToHost(): Type<any> { return this._componentToHost; }

  private _componentInputs: { [key: string]: any };
  @Input() set componentInputs(value: { [key: string]: any }) {
    this._componentInputs = value;
    this.updateComponentInputs();
  }
  get componentInputs(): { [key: string]: any } { return this._componentInputs; }

  @Input() hostInjector: Injector;

  @ViewChild('contentSizer') private contentSizer: ElementRef<HTMLDivElement>;
  @ViewChild('dynamicContentHost', { read: ViewContainerRef, static: true }) dynamicContentHost: ViewContainerRef;

  private resizeObserver: ResizeObserver;
  private isResizing = false;
  private pluginUiService: PluginUiService;
  private loadedComponentRef: ComponentRef<any> | null = null;

  constructor(
    private el: ElementRef<HTMLElement>,
    private ngZone: NgZone,
    private injector: Injector
  ) { }

  ngOnInit(): void {
    // 循環参照回避のためInjector経由で取得
    this.pluginUiService = this.injector.get(PluginUiService);
  }

  ngAfterViewInit(): void {
    this.tryLoadComponent();
  }

  ngOnDestroy(): void {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    if (this.loadedComponentRef) {
      this.loadedComponentRef.destroy();
    }
  }

  private tryLoadComponent(): void {
    if (!this.componentToHost || !this.dynamicContentHost || this.loadedComponentRef) {
      return;
    }

    // ラップするコンポーネントを動的に生成
    const injectorToUse = this.hostInjector || this.injector;
    this.loadedComponentRef = this.dynamicContentHost.createComponent(this.componentToHost, { injector: injectorToUse });
    
    this.updateComponentInputs();
    
    // ExpressionChangedAfterItHasBeenCheckedError を回避しつつ監視開始
    setTimeout(() => this.startObserver(), 0);
  }

  private updateComponentInputs(): void {
    if (!this.loadedComponentRef || !this.componentInputs) return;

    for (const key in this.componentInputs) {
      if (this.componentInputs.hasOwnProperty(key)) {
        this.loadedComponentRef.instance[key] = this.componentInputs[key];
      }
    }
    this.loadedComponentRef.changeDetectorRef.markForCheck();
  }

  private startObserver(): void {
    if (!this.contentSizer || !this.contentSizer.nativeElement || !this.panelId) {
      return;
    }

    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }

    this.resizeObserver = new ResizeObserver(entries => {
      if (!entries[0] || this.isResizing) return;

      this.ngZone.run(() => {
        const contentRect = entries[0].contentRect;
        
        // 純粋なコンテンツサイズ
        const contentWidth = Math.ceil(contentRect.width);
        const contentHeight = Math.ceil(contentRect.height);

        // 現在のパネル位置情報を取得
        const rect = this.el.nativeElement.getBoundingClientRect();
        
        // PluginUiService側で加算されるクロームサイズ (同期が必要)
        const PANEL_CHROME_WIDTH = 36;
        
        // 予測されるパネルの右端位置
        const projectedRightEdge = rect.left + contentWidth + PANEL_CHROME_WIDTH;
        const windowWidth = window.innerWidth;
        
        let newLeft: number | undefined = undefined;

        // 画面右端からはみ出る場合、左にずらす
        if (projectedRightEdge > windowWidth) {
          newLeft = Math.max(0, windowWidth - (contentWidth + PANEL_CHROME_WIDTH) - 20);
        }

        this.isResizing = true;
        this.pluginUiService.updatePanel(this.panelId, { 
          width: contentWidth, 
          height: contentHeight,
          left: newLeft 
        });
        
        setTimeout(() => {
          this.isResizing = false;
        }, 50);
      });
    });

    this.resizeObserver.observe(this.contentSizer.nativeElement);
  }
}

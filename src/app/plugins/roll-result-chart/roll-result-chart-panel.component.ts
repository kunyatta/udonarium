import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { DataElement } from '@udonarium/data-element';
import { PluginHelperService } from '../service/plugin-helper.service';
import { PluginMapperService } from '../service/plugin-mapper.service';
import { RollResultChart, ROLL_RESULT_CHART_MAPPING_OPTIONS, ROLL_RESULT_CHART_TAG_NAME } from './roll-result-chart.model';
import { RollResultChartService } from './roll-result-chart.service';
import { PluginDataTransferService } from '../service/plugin-data-transfer.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'roll-result-chart-panel',
  templateUrl: './roll-result-chart-panel.component.html',
  styleUrls: ['./roll-result-chart-panel.component.css']
})
export class RollResultChartPanelComponent implements OnInit, OnDestroy {
  // サービス側のデータを直接参照（またはコピー）
  get charts(): RollResultChart[] {
    return this.chartService.charts;
  }
  
  selectedChartIndex: number = -1;
  editingChart: RollResultChart | null = null;
  private onDestroy$ = new Subject<void>();

  private readonly PLUGIN_ID = 'roll-result-chart';

  constructor(
    private pluginHelper: PluginHelperService,
    private pluginMapper: PluginMapperService,
    private chartService: RollResultChartService,
    private pluginDataTransfer: PluginDataTransferService,
    private changeDetector: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.chartService.update$
      .pipe(takeUntil(this.onDestroy$))
      .subscribe(() => {
        this.changeDetector.detectChanges();
        // 選択中のインデックスが範囲外になった場合の補正
        if (this.selectedChartIndex >= this.charts.length) {
          this.selectedChartIndex = -1;
          this.editingChart = null;
        }
      });
      
    if (this.charts.length > 0) {
      this.selectChart(0);
    }
  }

  ngOnDestroy() {
    this.onDestroy$.next();
    this.onDestroy$.complete();
  }

  selectChart(index: number) {
    if (index < 0 || index >= this.charts.length) {
      this.selectedChartIndex = -1;
      this.editingChart = null;
      return;
    }
    this.selectedChartIndex = index;
    // 即時反映のため参照渡しに変更
    this.editingChart = this.charts[index];
  }

  createNew() {
    const newChart: RollResultChart = { 
      title: '新しいチャート', 
      command: 'NEW_CHART', 
      dice: '1d6', 
      value: '' 
    };
    // サービスに追加させる（重複チェック等はサービス側で行われるべきだが、ここでは簡易的にpush）
    // ※Serviceにaddメソッドがないため、chartsに直接pushしてsaveを呼ぶ
    // 本来はServiceにaddChartメソッドを作るべき。
    this.chartService.charts.push(newChart);
    this.chartService.save();
    
    // 追加されたチャートを選択
    this.selectChart(this.charts.length - 1);
  }

  onChartChange() {
    if (this.editingChart) {
      this.chartService.save();
    }
  }

  delete() {
    if (this.selectedChartIndex < 0) return;
    if (!confirm('このチャートを削除しますか？')) return;

    this.chartService.charts.splice(this.selectedChartIndex, 1);
    this.chartService.save();

    const nextIndex = this.charts.length > 0 ? 0 : -1;
    if (nextIndex >= 0) {
      this.selectChart(nextIndex);
    } else {
      this.selectedChartIndex = -1;
      this.editingChart = null;
    }
  }

  export() {
    if (!this.editingChart) return;
    const element = this.chartService.getExportDataElement(this.editingChart);
    this.pluginDataTransfer.export(this.chartService.PLUGIN_ID, `チャート_${this.editingChart.title}`, element);
  }

  exportAll() {
    if (this.charts.length === 0) return;
    const element = this.chartService.getAllExportDataElement();
    this.pluginDataTransfer.export(this.chartService.PLUGIN_ID, 'plugin_roll-result-chart_list', element);
  }
}
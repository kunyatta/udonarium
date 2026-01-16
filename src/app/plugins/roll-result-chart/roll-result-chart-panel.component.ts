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
  // サービス側のデータを直接参照
  get charts(): RollResultChart[] {
    return this.chartService.charts;
  }
  
  selectedIdentifier: string | null = null;
  editingChart: RollResultChart | null = null;
  private onDestroy$ = new Subject<void>();

  constructor(
    private chartService: RollResultChartService,
    private pluginDataTransfer: PluginDataTransferService,
    private changeDetector: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.chartService.update$
      .pipe(takeUntil(this.onDestroy$))
      .subscribe(() => {
        // 選択中のチャートが削除されていないかチェック
        if (this.selectedIdentifier && !this.charts.find(c => c.identifier === this.selectedIdentifier)) {
          this.selectedIdentifier = null;
          this.editingChart = null;
        }
        this.changeDetector.markForCheck();
      });
      
    if (this.charts.length > 0) {
      this.selectChart(this.charts[0].identifier);
    }
  }

  ngOnDestroy() {
    this.onDestroy$.next();
    this.onDestroy$.complete();
  }

  selectChart(identifier: string) {
    this.selectedIdentifier = identifier;
    this.editingChart = this.charts.find(c => c.identifier === identifier) || null;
    this.changeDetector.markForCheck();
  }

  createNew() {
    const newChart = this.chartService.add({ 
      title: '新しいチャート', 
      command: 'NEW_CHART', 
      dice: '1d6', 
      value: '' 
    });
    this.selectChart(newChart.identifier);
  }

  onChartChange() {
    if (this.editingChart) {
      this.chartService.save();
    }
  }

  delete() {
    if (!this.selectedIdentifier) return;
    if (!confirm('このチャートを削除しますか？')) return;

    this.chartService.delete(this.selectedIdentifier);
    this.selectedIdentifier = null;
    this.editingChart = null;

    if (this.charts.length > 0) {
      this.selectChart(this.charts[0].identifier);
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
import { Component, OnInit } from '@angular/core';
import { DataElement } from '@udonarium/data-element';
import { PluginHelperService } from '../service/plugin-helper.service';
import { PluginMapperService } from '../service/plugin-mapper.service';
import { RollResultChart, ROLL_RESULT_CHART_MAPPING_OPTIONS, ROLL_RESULT_CHART_TAG_NAME } from './roll-result-chart.model';
import { RollResultChartService } from './roll-result-chart.service';

@Component({
  selector: 'roll-result-chart-panel',
  templateUrl: './roll-result-chart-panel.component.html',
  styleUrls: ['./roll-result-chart-panel.component.css']
})
export class RollResultChartPanelComponent implements OnInit {
  charts: RollResultChart[] = [];
  selectedChartIndex: number = -1;
  editingChart: RollResultChart | null = null;

  private readonly PLUGIN_ID = 'roll-result-chart';

  constructor(
    private pluginHelper: PluginHelperService,
    private pluginMapper: PluginMapperService,
    private chartService: RollResultChartService
  ) {}

  ngOnInit() {
    this.loadCharts();
    if (this.charts.length > 0) {
      this.selectChart(0);
    }
  }

  loadCharts() {
    const container = this.pluginHelper.getOrCreateContainer(this.PLUGIN_ID);
    this.charts = (container.state.children as DataElement[])
      .filter(child => child.getAttribute('name') === ROLL_RESULT_CHART_TAG_NAME)
      .map(child => this.pluginMapper.fromElement<RollResultChart>(child, ROLL_RESULT_CHART_MAPPING_OPTIONS));
  }

  selectChart(index: number) {
    this.selectedChartIndex = index;
    this.editingChart = { ...this.charts[index] };
  }

  createNew() {
    this.selectedChartIndex = -1;
    this.editingChart = { title: '新しいチャート', command: 'NEW_CHART', dice: '1d6', value: '' };
  }

  save() {
    if (!this.editingChart) return;
    
    const container = this.pluginHelper.getOrCreateContainer(this.PLUGIN_ID);
    if (this.selectedChartIndex >= 0) {
      this.charts[this.selectedChartIndex] = { ...this.editingChart };
    } else {
      this.charts.push({ ...this.editingChart });
      this.selectedChartIndex = this.charts.length - 1;
    }

    container.state.children.forEach(c => c.destroy());
    for (const chart of this.charts) {
      const element = this.pluginMapper.toElement(ROLL_RESULT_CHART_TAG_NAME, chart, ROLL_RESULT_CHART_MAPPING_OPTIONS);
      container.state.appendChild(element);
    }
    
    container.update();
    this.chartService.updateCharts();
  }

  delete() {
    if (this.selectedChartIndex < 0) return;
    if (!confirm('このチャートを削除しますか？')) return;

    this.charts.splice(this.selectedChartIndex, 1);
    const nextIndex = this.charts.length > 0 ? 0 : -1;
    this.save();
    
    if (nextIndex >= 0) {
      this.selectChart(nextIndex);
    } else {
      this.selectedChartIndex = -1;
      this.editingChart = null;
    }
  }
}

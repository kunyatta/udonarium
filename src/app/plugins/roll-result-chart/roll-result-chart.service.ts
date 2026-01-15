import { Injectable, OnDestroy } from '@angular/core';
import { StringUtil } from '@udonarium/core/system/util/string-util';
import { DiceBot } from '@udonarium/dice-bot';
import { ChatMessage } from '@udonarium/chat-message';
import { ChatTab } from '@udonarium/chat-tab';
import { ObjectStore } from '@udonarium/core/synchronize-object/object-store';
import { DataElement } from '@udonarium/data-element';
import { Subject } from 'rxjs';
import { EventSystem } from '@udonarium/core/system';

import { ChatListenerService } from '../service/chat-listener.service';
import { PluginHelperService } from '../service/plugin-helper.service';
import { PluginMapperService } from '../service/plugin-mapper.service';
import { PluginDataObserverService } from '../service/plugin-data-observer.service';
import { PluginDataContainer } from '../../class/plugin-data-container';
import { RollResultChart, ROLL_RESULT_CHART_MAPPING_OPTIONS, ROLL_RESULT_CHART_TAG_NAME } from './roll-result-chart.model';
import { RollResultChartParser } from './roll-result-chart-parser';
import { PluginDataTransferService } from '../service/plugin-data-transfer.service';

@Injectable({
  providedIn: 'root'
})
export class RollResultChartService implements OnDestroy {
  readonly PLUGIN_ID = 'roll-result-chart';
  readonly update$ = new Subject<void>();

  private _charts: RollResultChart[] = [];
  private container: PluginDataContainer | null = null;
  private isSaving = false;

  constructor(
    private chatListener: ChatListenerService,
    private pluginHelper: PluginHelperService,
    private pluginMapper: PluginMapperService,
    private observerService: PluginDataObserverService,
    private pluginDataTransfer: PluginDataTransferService
  ) {}

  get charts(): RollResultChart[] {
    return this._charts;
  }

  initialize() {
    this.observerService.observe(this, this.PLUGIN_ID, '', container => {
      if (this.isSaving) return;
      this.container = container;
      this.loadFromContainer();
    });

    this.chatListener.addRule({
      owner: this,
      name: 'RollResultChartTrigger',
      callback: (message) => this.handleChatMessage(message)
    });

    this.pluginDataTransfer.register(this.PLUGIN_ID, (data: DataElement) => {
      this.importFromDataElement(data);
    });

    // ルームロード完了時にも再ロードを試行（重い部屋でのロード漏れ対策）
    EventSystem.register(this).on('XML_LOADED', () => {
      this.loadFromContainer();
    });

    // 初期化時にコンテナを確保
    this.pluginHelper.getOrCreateContainer(this.PLUGIN_ID);
  }

  ngOnDestroy() {
    this.chatListener.removeRulesByOwner(this);
    EventSystem.unregister(this);
  }

  private loadFromContainer() {
    if (!this.container) {
      this.container = this.pluginHelper.findContainer(this.PLUGIN_ID);
    }

    if (!this.container) {
      this._charts = [];
      return;
    }

    const children = this.container.state.children as DataElement[];

    const newCharts = children
      .filter(child => child instanceof DataElement && child.getAttribute('name') === ROLL_RESULT_CHART_TAG_NAME)
      .map(child => this.pluginMapper.fromElement<RollResultChart>(child as DataElement, ROLL_RESULT_CHART_MAPPING_OPTIONS));
    
    // 参照維持のためのマージ
    for (const newItem of newCharts) {
      const existing = this._charts.find(c => c.command === newItem.command);
      if (existing) {
        Object.assign(existing, newItem);
      } else {
        this._charts.push(newItem);
      }
    }
    // 削除されたものを除去
    const newCommands = new Set(newCharts.map(c => c.command));
    for (let i = this._charts.length - 1; i >= 0; i--) {
      if (!newCommands.has(this._charts[i].command)) {
        this._charts.splice(i, 1);
      }
    }

    this.update$.next();
  }

  save() {
    this.isSaving = true;
    try {
      if (!this.container) {
        this.container = this.pluginHelper.getOrCreateContainer(this.PLUGIN_ID);
      }
      this.container.state.children.forEach(c => c.destroy());
      for (const chart of this._charts) {
        const element = this.pluginMapper.toElement(ROLL_RESULT_CHART_TAG_NAME, chart, ROLL_RESULT_CHART_MAPPING_OPTIONS);
        this.container.state.appendChild(element);
      }
      this.container.update();
    } finally {
      setTimeout(() => { this.isSaving = false; }, 200);
    }
  }

  private importFromDataElement(rootElement: DataElement) {
    let itemsToImport: RollResultChart[] = [];

    if (rootElement.name === ROLL_RESULT_CHART_TAG_NAME) {
      itemsToImport = [this.pluginMapper.fromElement<RollResultChart>(rootElement, ROLL_RESULT_CHART_MAPPING_OPTIONS)];
    } else {
      const chartElements = rootElement.children.filter(c => c instanceof DataElement && c.name === ROLL_RESULT_CHART_TAG_NAME) as DataElement[];
      if (chartElements.length > 0) {
        itemsToImport = chartElements.map(e => this.pluginMapper.fromElement<RollResultChart>(e, ROLL_RESULT_CHART_MAPPING_OPTIONS));
      }
    }

    if (itemsToImport.length === 0) return;

    for (const imported of itemsToImport) {
      const existingIdx = this._charts.findIndex(c => c.command === imported.command);
      if (existingIdx >= 0) {
        this._charts[existingIdx] = imported;
      } else {
        this._charts.push(imported);
      }
    }

    this.save();
    this.update$.next();
  }

  getExportDataElement(chart: RollResultChart): DataElement {
    return this.pluginMapper.toElement(ROLL_RESULT_CHART_TAG_NAME, chart, ROLL_RESULT_CHART_MAPPING_OPTIONS);
  }

  getAllExportDataElement(): DataElement {
    const root = DataElement.create('roll-result-chart-list', '', {});
    for (const chart of this._charts) {
      root.appendChild(this.getExportDataElement(chart));
    }
    return root;
  }

  private async handleChatMessage(message: ChatMessage) {
    if (!message || !message.isSendFromSelf || message.isSystem) return;

    const text = StringUtil.toHalfWidth(message.text).trim().toUpperCase();
    if (!text) return;

    const match = /^(([XＸ]([\d]+))[\s　]+)?([SＳ])?([^\s\+\-\\=]+)([\+\\-\\=]([\d]+))?$/i.exec(text);
    if (!match) return;

    const repeat = match[3] ? parseInt(match[3], 10) : 1;
    const isSecret = !!match[4];
    const command = match[5].toUpperCase();
    const modifierSign = match[6] ? match[6].charAt(0) : null;
    const modifierValue = match[7] ? parseInt(match[7], 10) : 0;
    const isFixedValue = modifierSign === '=';

    const chart = this._charts.find(c => c.command.toUpperCase() === command);
    if (!chart) return;

    await this.executeChartRoll(chart, message, {
      repeat: Math.min(Math.max(repeat, 1), 32),
      isSecret,
      modifier: modifierSign === '-' ? -modifierValue : modifierValue,
      fixedValue: isFixedValue ? modifierValue : null
    });
  }

  private async executeChartRoll(
    chart: RollResultChart,
    originalMessage: ChatMessage,
    options: { repeat: number, isSecret: boolean, modifier: number, fixedValue: number | null }
  ) {
    const rows = RollResultChartParser.parse(chart.value);
    const results: string[] = [];
    let finalIsSecret = options.isSecret;

    for (let i = 0; i < options.repeat; i++) {
      let rollNumber: number;
      let rollDetail = '';

      if (options.fixedValue !== null) {
        rollNumber = options.fixedValue;
        rollDetail = `指定=${rollNumber}`;
      } else {
        const diceResult = await DiceBot.diceRollAsync(chart.dice, originalMessage.tag || 'DiceBot');
        if (!diceResult || !diceResult.result) {
          results.push(`[${i + 1}] ダイスロールエラー: ${chart.dice}`);
          continue;
        }
        
        const numMatch = diceResult.result.match(/＞\s*(-?\d+)$/);
        if (!numMatch) {
          results.push(`[${i + 1}] 数値取得エラー: ${diceResult.result}`);
          continue;
        }

        rollNumber = parseInt(numMatch[1], 10) + options.modifier;
        const modStr = options.modifier !== 0 ? (options.modifier > 0 ? `+${options.modifier}` : `${options.modifier}`) : '';
        rollDetail = `${diceResult.result}${modStr}${modStr ? ` ＞ ${rollNumber}` : ''}`;
        if (diceResult.isSecret) finalIsSecret = true;
      }

      const row = rows.find(r => 
        (r.range.start === null || rollNumber >= r.range.start) &&
        (r.range.end === null || rollNumber <= r.range.end)
      );

      const resultText = row ? row.result : '(結果なし)';
      results.push(`${rollDetail} ＞ ${resultText}`);
    }

    this.sendChartMessage(chart.title, results, originalMessage, finalIsSecret);
  }

  private sendChartMessage(chartName: string, results: string[], original: ChatMessage, isSecret: boolean) {
    const tab = ObjectStore.instance.get<ChatTab>(original.tabIdentifier);
    if (!tab) return;

    const text = `【${chartName}】\n${results.join('\n')}`;
    const tag = `system dicebot${isSecret ? ' secret' : ''}`;
    
    tab.addMessage({
      identifier: '',
      tabIdentifier: original.tabIdentifier,
      originFrom: original.from,
      from: `Chart-Bot${isSecret ? ' (Secret)' : ''}`,
      timestamp: Date.now(),
      imageIdentifier: '',
      tag: tag,
      name: `${chartName} : ${original.name}`,
      text: text,
      color: original.color,
      to: isSecret ? original.from : original.to
    });
  }
}

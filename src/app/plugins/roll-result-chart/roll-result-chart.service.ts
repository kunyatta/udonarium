import { Injectable, OnDestroy } from '@angular/core';
import { StringUtil } from '@udonarium/core/system/util/string-util';
import { DiceBot } from '@udonarium/dice-bot';
import { ChatMessage } from '@udonarium/chat-message';
import { ChatTab } from '@udonarium/chat-tab';
import { ObjectStore } from '@udonarium/core/synchronize-object/object-store';
import { DataElement } from '@udonarium/data-element';

import { ChatListenerService } from '../service/chat-listener.service';
import { PluginHelperService } from '../service/plugin-helper.service';
import { PluginMapperService } from '../service/plugin-mapper.service';
import { PluginDataContainer } from '@udonarium/plugin-data-container';
import { RollResultChart, ROLL_RESULT_CHART_MAPPING_OPTIONS, ROLL_RESULT_CHART_TAG_NAME } from './roll-result-chart.model';
import { RollResultChartParser } from './roll-result-chart-parser';

@Injectable({
  providedIn: 'root'
})
export class RollResultChartService implements OnDestroy {
  private readonly PLUGIN_ID = 'roll-result-chart';
  private charts: RollResultChart[] = [];

  constructor(
    private chatListener: ChatListenerService,
    private pluginHelper: PluginHelperService,
    private pluginMapper: PluginMapperService
  ) {}

  initialize() {
    this.updateCharts();

    this.chatListener.addRule({
      owner: this,
      name: 'RollResultChartTrigger',
      callback: (message) => this.handleChatMessage(message)
    });

    this.pluginHelper.getOrCreateContainer(this.PLUGIN_ID);
  }

  ngOnDestroy() {
    this.chatListener.removeRulesByOwner(this);
  }

  updateCharts() {
    const container = this.pluginHelper.findContainer(this.PLUGIN_ID);
    if (!container) {
      this.charts = [];
      return;
    }

    this.charts = (container.state.children as DataElement[])
      .filter(child => child.getAttribute('name') === ROLL_RESULT_CHART_TAG_NAME)
      .map(child => this.pluginMapper.fromElement<RollResultChart>(child, ROLL_RESULT_CHART_MAPPING_OPTIONS));
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

    const chart = this.charts.find(c => c.command.toUpperCase() === command);
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
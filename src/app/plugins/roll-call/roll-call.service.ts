import { Injectable, NgZone } from '@angular/core';
import { EventSystem, Network } from '@udonarium/core/system';
import { ObjectStore } from '@udonarium/core/synchronize-object/object-store';
import { PeerCursor } from '@udonarium/peer-cursor';
import { Vote, VoteEntry } from './vote';
import { ChatMessageService } from 'service/chat-message.service';
import { ChatTabList } from '@udonarium/chat-tab-list';
import { PluginUiService } from '../service/plugin-ui.service';
import { PLUGIN_ID, VOTE_ID, ROLL_CALL_UI_DEFAULTS } from './roll-call.constants';
import { RollCallAnswerComponent } from './roll-call-answer.component';
import { ChatLoggerService } from '../service/chat-logger.service';

@Injectable({
  providedIn: 'root'
})
export class RollCallService {
  targetTabIdentifier: string = '';

  // VoteオブジェクトはObjectStoreで直接管理する（固定ID）
  get vote(): Vote {
    let vote = ObjectStore.instance.get<Vote>(VOTE_ID);
    if (!vote) {
      vote = new Vote(VOTE_ID);
      ObjectStore.instance.add(vote);
      vote.initialize();
    }
    return vote;
  }

  get isRunning(): boolean { return this.vote.isRunning; }
  get isOwner(): boolean { return this.vote.ownerId === PeerCursor.myCursor.peerId; }

  constructor(
    private chatMessageService: ChatMessageService,
    private pluginUiService: PluginUiService,
    private ngZone: NgZone,
    private chatLoggerService: ChatLoggerService // ChatLoggerServiceを注入
  ) {
    this.initialize();
  }

  initialize(): void {
    // ターゲットタブの初期化
    this.ensureTargetTab();

    EventSystem.register(this)
      .on('XML_LOADED', () => {
        this.ensureTargetTab();
        // ルームロード時、既存のVoteオブジェクトを破棄してリセットする
        const vote = ObjectStore.instance.get<Vote>(VOTE_ID);
        if (vote) {
          vote.destroy();
        }
        // 新しいVoteオブジェクトはget vote()で自動生成される
      })
      .on('UPDATE_GAME_OBJECT', event => {
        if (event.data.identifier === ChatTabList.instance.identifier) {
          this.ensureTargetTab();
        }
        // Voteの状態監視
        if (event.data.identifier === this.vote.identifier) {
          // isRunningの状態変化を検知してパネルを開閉
          this.checkAndTogglePanel();
          
          if (this.isRunning && this.isOwner) {
             this.checkAutoClose();
          }
        }
        // VoteEntryの更新監視（自動終了用）
        if (this.isRunning && this.isOwner && event.data.aliasName === VoteEntry.aliasName) {
           this.checkAutoClose();
        }
      });
  }

  private ensureTargetTab(): void {
    const tabs = ChatTabList.instance.chatTabs;
    const targetExists = tabs.some(tab => tab.identifier === this.targetTabIdentifier);

    if (!targetExists && tabs.length > 0) {
      this.targetTabIdentifier = tabs[0].identifier;
    }
  }

  startRollCall(title: string = '点呼', includeOwner: boolean = true): void {
    this.vote.startActivity('roll-call', title, PeerCursor.myCursor.peerId, includeOwner, ['準備完了']);
    this.sendChatMessage(`点呼を開始しました。`);
    // パネル開閉はUPDATE_GAME_OBJECT経由で行われるが、
    // 送信元（自分）は即座に開くために呼んでも良い（checkAndTogglePanelが状態を見て判断する）
    this.checkAndTogglePanel(); 
  }

  startPoll(title: string, choices: string[], includeOwner: boolean = true): void {
    this.vote.startActivity('poll', title, PeerCursor.myCursor.peerId, includeOwner, choices);
    this.sendChatMessage(`投票「${title}」を開始しました。`);
    this.checkAndTogglePanel();
  }

  stopActivity(): void {
    if (!this.isRunning) return;

    const isRollCall = this.vote.type === 'roll-call';
    const entries = this.vote.entries;
    const choices = this.vote.choices;
    
    // 対象人数の計算
    const totalMembers = Network.peers.length + 1; // 他人 + 自分
    const targetCount = this.vote.includeOwner ? totalMembers : totalMembers - 1;

    let resultMessage = '';

    if (isRollCall) {
      // 点呼の集計: state=1 (準備完了) の人数
      const readyCount = entries.filter(e => e.state === 1).length;
      resultMessage = `点呼終了 (${readyCount}/${targetCount})`;
    } else {
      // 投票の集計
      const counts = new Map<number, number>();
      entries.forEach(e => {
        if (e.state > 0) { // 棄権(-1)や未回答(0)は除外
          counts.set(e.state, (counts.get(e.state) || 0) + 1);
        }
      });

      const resultDetails = choices.map((choice, index) => {
        const count = counts.get(index + 1) || 0;
        return `${choice}:${count}`;
      }).join(' ');
      
      resultMessage = `投票終了(${this.vote.title}) ${resultDetails}`;
    }

    this.vote.stopActivity();
    this.sendChatMessage(resultMessage);
    this.checkAndTogglePanel();
  }

  private checkAutoClose(): void {
    // 現在のネットワーク上の人数 + 自分
    const totalMembers = Network.peers.length + 1;
    // 対象人数
    const targetCount = this.vote.includeOwner ? totalMembers : totalMembers - 1;
    
    // 回答済み人数 (棄権含む)
    let answeredCount = 0;
    
    const targetPeerIds = new Set(Network.peers.map(p => p.peerId));
    if (this.vote.includeOwner) {
      targetPeerIds.add(this.vote.ownerId);
    }

    const validEntries = this.vote.entries.filter(e => targetPeerIds.has(e.peerId));
    answeredCount = validEntries.length;

    if (answeredCount >= targetCount) {
      setTimeout(() => {
        if (this.isRunning && this.isOwner) { // 再チェック
          this.stopActivity();
        }
      }, 500); 
    }
  }

  private checkAndTogglePanel(): void {
    const isOpen = this.vote.isRunning;
    
    // オーナーでかつ「自分を含めない」場合は開かない
    if (this.isOwner && !this.vote.includeOwner) {
      this.pluginUiService.close(RollCallAnswerComponent);
      return;
    }

    if (isOpen) {
      // 既に開いていればopenは無視される（シングルトン）
      this.pluginUiService.open(RollCallAnswerComponent, {
        width: ROLL_CALL_UI_DEFAULTS.ANSWER.width,
        height: ROLL_CALL_UI_DEFAULTS.ANSWER.height,
        title: ROLL_CALL_UI_DEFAULTS.ANSWER.title,
        isSingleton: true,
        layout: 'full-auto'
      });
    } else {
      this.pluginUiService.close(RollCallAnswerComponent);
    }
  }

  answer(state: number): void {
    this.vote.answer(PeerCursor.myCursor.peerId, PeerCursor.myCursor.name, state);
  }

  getAnswerState(peerId: string): number {
    return this.vote.getAnswerState(peerId);
  }

  private sendChatMessage(text: string): void {
    this.chatLoggerService.sendMessage(text, {
      tabIdentifier: this.targetTabIdentifier
    });
  }
}

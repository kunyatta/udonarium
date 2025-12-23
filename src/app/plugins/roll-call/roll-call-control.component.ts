import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { EventSystem, Network } from '@udonarium/core/system';
import { PeerCursor } from '@udonarium/peer-cursor';
import { VoteEntry, VoteType } from './vote';
import { ChatTab } from '@udonarium/chat-tab';
import { ChatTabList } from '@udonarium/chat-tab-list';
import { RollCallService } from './roll-call.service';

@Component({
  selector: 'app-roll-call-control',
  templateUrl: './roll-call-control.component.html',
  styleUrls: ['./roll-call-control.component.css']
})
export class RollCallControlComponent implements OnInit, OnDestroy {

  // UI状態
  selectedTab: VoteType = 'roll-call';
  title: string = '点呼'; // 点呼モードでも変数として持つ
  pollChoices: string[] = [];
  newChoice: string = '';
  includeOwner: boolean = true; // デフォルトON

  get targetTabIdentifier(): string { return this.rollCallService.targetTabIdentifier; }
  set targetTabIdentifier(value: string) { this.rollCallService.targetTabIdentifier = value; }

  get myPeer(): PeerCursor { return PeerCursor.myCursor; }
  get isRunning(): boolean { return this.rollCallService.isRunning; }
  get isOwner(): boolean { return this.rollCallService.isOwner; }
  
  get voteType(): VoteType { return this.rollCallService.vote.type; }
  get voteTitle(): string { return this.rollCallService.vote.title; }
  get voteChoices(): string[] { return this.rollCallService.vote.choices; }

  get chatTabs(): ChatTab[] {
    return ChatTabList.instance.chatTabs;
  }

  // ネットワーク上の全Peerリスト (管理パネルでは不要かもしれないが、状況表示のために残す)
  get peers(): PeerCursor[] {
    return [this.myPeer, ...Network.peers.map(p => PeerCursor.findByPeerId(p.peerId)).filter(p => p)];
  }

  constructor(
    public rollCallService: RollCallService,
    private changeDetectorRef: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    // デフォルトの選択肢
    this.resetPollChoices();

    EventSystem.register(this)
      .on('UPDATE_GAME_OBJECT', event => {
        // 進行中の状態などを監視するため
        if (event.data.identifier === this.rollCallService.vote.identifier || event.data.aliasName === VoteEntry.aliasName) {
          this.changeDetectorRef.markForCheck();
        }
      })
      .on('ROLL_CALL_START', event => {
        this.changeDetectorRef.markForCheck();
      })
      .on('ROLL_CALL_END', event => {
        this.changeDetectorRef.markForCheck();
      });

    // 初期描画後の変更を強制的に検知させる
    this.changeDetectorRef.detectChanges();
  }

  ngOnDestroy(): void {
    EventSystem.unregister(this);
  }

  selectTab(tab: VoteType) {
    this.selectedTab = tab;
    // タイトルは点呼の場合は固定されるが、変数としては保持しておく
    if (tab === 'poll' && this.title === '点呼') {
      this.title = '';
    } else if (tab === 'roll-call') {
      this.title = '点呼';
    }
  }

  addChoice() {
    if (this.newChoice.trim()) {
      this.pollChoices.push(this.newChoice.trim());
      this.newChoice = '';
    }
  }

  removeChoice(index: number) {
    this.pollChoices.splice(index, 1);
  }

  resetPollChoices() {
    this.pollChoices = ['はい', 'いいえ'];
  }

  startActivity(): void {
    if (this.selectedTab === 'roll-call') {
      this.rollCallService.startRollCall('点呼', this.includeOwner); // 点呼モードではタイトルは固定
    } else {
      if (this.pollChoices.length === 0) return;
      this.rollCallService.startPoll(this.title || '投票', this.pollChoices, this.includeOwner);
    }
  }

  stopActivity(): void {
    this.rollCallService.stopActivity();
  }

  getAnswerText(state: number): string {
    if (state === 0) return '...';
    if (state === -1) return '棄権';
    
    if (this.voteType === 'roll-call') {
      return state === 1 ? '準備完了' : '...';
    } else {
      // 投票の場合はインデックスに対応する選択肢
      const choices = this.voteChoices;
      // stateは1始まりのインデックス
      return choices[state - 1] || '...';
    }
  }
}
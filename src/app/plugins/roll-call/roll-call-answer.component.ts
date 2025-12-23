import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { EventSystem, Network } from '@udonarium/core/system';
import { PeerCursor } from '@udonarium/peer-cursor';
import { VoteEntry, VoteType } from './vote';
import { RollCallService } from './roll-call.service';
import { PluginUiService } from '../service/plugin-ui.service'; // パネルを閉じるために必要

@Component({
  selector: 'app-roll-call-answer',
  templateUrl: './roll-call-answer.component.html',
  styleUrls: ['./roll-call-answer.component.css']
})
export class RollCallAnswerComponent implements OnInit, OnDestroy {

  get myPeer(): PeerCursor { return PeerCursor.myCursor; }
  get isRunning(): boolean { return this.rollCallService.isRunning; }
  get isOwner(): boolean { return this.rollCallService.isOwner; } // 回答パネルでは不要かもしれないが、念のため残す
  
  get voteType(): VoteType { return this.rollCallService.vote.type; }
  get voteTitle(): string { return this.rollCallService.vote.title; }
  get voteChoices(): string[] { return this.rollCallService.vote.choices; }
  get includeOwner(): boolean { return this.rollCallService.vote.includeOwner; }

  // ネットワーク上の全Peerリスト
  get peers(): PeerCursor[] {
    const allPeers = [this.myPeer, ...Network.peers.map(p => PeerCursor.findByPeerId(p.peerId)).filter(p => p)];
    if (!this.includeOwner) {
      return allPeers.filter(p => p.peerId !== this.rollCallService.vote.ownerId);
    }
    return allPeers;
  }

  constructor(
    public rollCallService: RollCallService,
    private changeDetectorRef: ChangeDetectorRef,
    private pluginUiService: PluginUiService // 自身を閉じるために必要
  ) { }

  ngOnInit(): void {
    // デバッグログは削除またはコメントアウト
    // console.log('[RollCallAnswerComponent] ngOnInit called.');
    
    EventSystem.register(this)
      .on('UPDATE_GAME_OBJECT', event => {
        if (event.data.identifier === this.rollCallService.vote.identifier || event.data.aliasName === VoteEntry.aliasName) {
          this.changeDetectorRef.markForCheck();
        }
      })
      .on('ROLL_CALL_START', event => {
        this.changeDetectorRef.markForCheck();
      })
      .on('ROLL_CALL_END', event => {
        this.changeDetectorRef.markForCheck();
        // 終了イベントを受け取ったら自身を閉じる
        this.pluginUiService.close(RollCallAnswerComponent);
      });
    
    // 初期表示時にも状態を反映させる
    this.changeDetectorRef.markForCheck();
  }

  ngOnDestroy(): void {
    // パネルが閉じられる際、進行中かつ自分が未回答なら「棄権」とする
    const myState = this.getPeerAnswerState(this.myPeer.peerId);
    // オーナーは誤って閉じてしまった場合などを考慮し、自動棄権の対象外とする
    // (管理パネルから強制終了できるため)
    
    // 進行中かつ未回答、かつオーナーでない場合のみ棄権扱い
    if (this.isRunning && myState === 0 && !this.isOwner) {
      this.rollCallService.answer(-1); // -1: 棄権
    }
    EventSystem.unregister(this);
  }

  answer(state: number): void {
    this.rollCallService.answer(state);
  }

  getPeerAnswerState(peerId: string): number {
    return this.rollCallService.getAnswerState(peerId);
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

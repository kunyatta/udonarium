import { Component, ElementRef, EventEmitter, Input, NgZone, OnDestroy, OnInit, Output, ViewChild } from '@angular/core';
import { ChatMessage } from '@udonarium/chat-message';
import { ImageFile } from '@udonarium/core/file-storage/image-file';
import { ObjectStore } from '@udonarium/core/synchronize-object/object-store';
import { EventSystem, Network } from '@udonarium/core/system';
import { PeerContext } from '@udonarium/core/system/network/peer-context';
import { ResettableTimeout } from '@udonarium/core/system/util/resettable-timeout';
import { DiceBot } from '@udonarium/dice-bot';
import { GameCharacter } from '@udonarium/game-character';
import { PeerCursor } from '@udonarium/peer-cursor';
import { TextViewComponent } from 'component/text-view/text-view.component';
import { BatchService } from 'service/batch.service';
import { ChatMessageService } from 'service/chat-message.service';
import { PanelOption, PanelService } from 'service/panel.service';
import { PointerDeviceService } from 'service/pointer-device.service';
// ----- MODIFICATION START (kunyatta) for DynamicStandPlugin -----
import { UIExtensionService, ExtensionAction } from '../../plugins/service/ui-extension.service';
// ----- MODIFICATION END (kunyatta) for DynamicStandPlugin -----

@Component({
  selector: 'chat-input',
  templateUrl: './chat-input.component.html',
  styleUrls: ['./chat-input.component.css']
})
export class ChatInputComponent implements OnInit, OnDestroy {
  @ViewChild('textArea', { static: true }) textAreaElementRef: ElementRef;
  // ----- MODIFICATION START (kunyatta) for DynamicStandPlugin -----
  ObjectStore = ObjectStore; // テンプレート参照用
  // ----- MODIFICATION END (kunyatta) for DynamicStandPlugin -----

  @Input() onlyCharacters: boolean = false;
  @Input() chatTabidentifier: string = '';
  
  // ----- MODIFICATION START (kunyatta) for ColorSupport -----
  @Input() showColorPicker: boolean = false;
  // ----- MODIFICATION END (kunyatta) for ColorSupport -----

  @Input('gameType') _gameType: string = '';
  @Output() gameTypeChange = new EventEmitter<string>();
  get gameType(): string { return this._gameType };
  set gameType(gameType: string) { this._gameType = gameType; this.gameTypeChange.emit(gameType); }

  @Input('sendFrom') _sendFrom: string = this.myPeer ? this.myPeer.identifier : '';
  @Output() sendFromChange = new EventEmitter<string>();
  get sendFrom(): string { return this._sendFrom };
  set sendFrom(sendFrom: string) { this._sendFrom = sendFrom; this.sendFromChange.emit(sendFrom); }

  @Input('sendTo') _sendTo: string = '';
  @Output() sendToChange = new EventEmitter<string>();
  get sendTo(): string { return this._sendTo };
  set sendTo(sendTo: string) { this._sendTo = sendTo; this.sendToChange.emit(sendTo); }

  @Input('text') _text: string = '';
  @Output() textChange = new EventEmitter<string>();
  get text(): string { return this._text };
  set text(text: string) { this._text = text; this.textChange.emit(text); }

  @Output() chat = new EventEmitter<{ text: string, gameType: string, sendFrom: string, sendTo: string }>();

  get isDirect(): boolean { return this.sendTo != null && this.sendTo.length ? true : false }
  gameHelp: string = '';

  get imageFile(): ImageFile {
    let object = ObjectStore.instance.get(this.sendFrom);
    let image: ImageFile = null;
    if (object instanceof GameCharacter) {
      image = object.imageFile;
    } else if (object instanceof PeerCursor) {
      image = object.image;
    }
    return image ? image : ImageFile.Empty;
  }

  // ----- MODIFICATION START (kunyatta) for ColorSupport -----
  get sendFromColor(): string {
    let object = ObjectStore.instance.get(this.sendFrom);
    if (object instanceof GameCharacter) {
      return object.chatPalette ? object.chatPalette.color : '#000000';
    } else if (object instanceof PeerCursor) {
      return object.color;
    }
    return '#000000';
  }

  set sendFromColor(color: string) {
    let object = ObjectStore.instance.get(this.sendFrom);
    if (object instanceof GameCharacter && object.chatPalette) {
      object.chatPalette.color = color;
    } else if (object instanceof PeerCursor) {
      object.color = color;
    }
  }
  // ----- MODIFICATION END (kunyatta) for ColorSupport -----

  private shouldUpdateCharacterList: boolean = true;
  private _gameCharacters: GameCharacter[] = [];
  get gameCharacters(): GameCharacter[] {
    if (this.shouldUpdateCharacterList) {
      this.shouldUpdateCharacterList = false;
      this._gameCharacters = ObjectStore.instance
        .getObjects<GameCharacter>(GameCharacter)
        .filter(character => this.allowsChat(character));
    }
    return this._gameCharacters;
  }

  private writingEventInterval: NodeJS.Timeout = null;
  private previousWritingLength: number = 0;
  writingPeers: Map<string, ResettableTimeout> = new Map();
  writingPeerNames: string[] = [];

  get diceBotInfos() { return DiceBot.diceBotInfos }
  get myPeer(): PeerCursor { return PeerCursor.myCursor; }
  get otherPeers(): PeerCursor[] { return ObjectStore.instance.getObjects(PeerCursor); }

  constructor(
    private ngZone: NgZone,
    public chatMessageService: ChatMessageService,
    private batchService: BatchService,
    private panelService: PanelService,
    private pointerDeviceService: PointerDeviceService,
    // ----- MODIFICATION START (kunyatta) for DynamicStandPlugin -----
    private uiExtensionService: UIExtensionService
    // ----- MODIFICATION END (kunyatta) for DynamicStandPlugin -----
  ) { }

  ngOnInit(): void {
    EventSystem.register(this)
      // ----- MODIFICATION START (kunyatta) for PluginSystem -----
      .on('MESSAGE_ADDED', event => {
        if (event.data.tabIdentifier !== this.chatTabidentifier) return;
        let message = ObjectStore.instance.get<ChatMessage>(event.data.messageIdentifier);
        let peerCursor = ObjectStore.instance.getObjects<PeerCursor>(PeerCursor).find(obj => obj.userId === message.from);
        let sendFrom = peerCursor ? peerCursor.peerId : '?';
        if (this.writingPeers.has(sendFrom)) {
          this.writingPeers.get(sendFrom).stop();
          this.writingPeers.delete(sendFrom);
          this.updateWritingPeerNames();
        }
      })
      // ----- MODIFICATION END (kunyatta) for PluginSystem -----
      .on(`UPDATE_GAME_OBJECT/aliasName/${GameCharacter.aliasName}`, event => {
        this.shouldUpdateCharacterList = true;
        if (event.data.identifier !== this.sendFrom) return;
        let gameCharacter = ObjectStore.instance.get<GameCharacter>(event.data.identifier);
        if (gameCharacter && !this.allowsChat(gameCharacter)) {
          if (0 < this.gameCharacters.length && this.onlyCharacters) {
            this.sendFrom = this.gameCharacters[0].identifier;
          } else {
            this.sendFrom = this.myPeer.identifier;
          }
        }
      })
      .on('DISCONNECT_PEER', event => {
        let object = ObjectStore.instance.get(this.sendTo);
        if (object instanceof PeerCursor && object.peerId === event.data.peerId) {
          this.sendTo = '';
        }
      })
      .on<string>('WRITING_A_MESSAGE', event => {
        if (event.isSendFromSelf || event.data !== this.chatTabidentifier) return;
        if (!this.writingPeers.has(event.sendFrom)) {
          this.writingPeers.set(event.sendFrom, new ResettableTimeout(() => {
            this.writingPeers.delete(event.sendFrom);
            this.updateWritingPeerNames();
            this.ngZone.run(() => { });
          }, 2000));
        }
        this.writingPeers.get(event.sendFrom).reset();
        this.updateWritingPeerNames();
        this.batchService.requireChangeDetection();
      });
  }

  ngOnDestroy() {
    EventSystem.unregister(this);
    this.batchService.remove(this);
  }

  private updateWritingPeerNames() {
    this.writingPeerNames = Array.from(this.writingPeers.keys()).map(peerId => {
      let peer = PeerCursor.findByPeerId(peerId);
      return peer ? peer.name : '';
    });
  }

  // ----- MODIFICATION START (kunyatta) for DynamicStandPlugin -----
  get chatInputExtensions(): ExtensionAction[] {
    let object = ObjectStore.instance.get(this.sendFrom);
    return this.uiExtensionService.getActions('chat-input', object);
  }

  getExtensionIcon(action: ExtensionAction): string {
    if (!action.icon) return '';
    if (typeof action.icon === 'string') return action.icon;
    
    // 関数の場合は現在の context を渡して実行
    let object = ObjectStore.instance.get(this.sendFrom);
    return action.icon(object);
  }

  readonly emoteIcons: { icon: string, label: string }[] = [
    { icon: '😊', label: '笑顔' },
    { icon: '😢', label: '悲しみ' },
    { icon: '💢', label: '怒り' },
    { icon: '😮', label: '驚き' },
    { icon: '🤔', label: '考え中' },
    { icon: '💦', label: '焦り' },
    { icon: '✨', label: '輝き' },
    { icon: '💡', label: '閃き' },
    { icon: '❗', label: '感嘆' },
    { icon: '❓', label: '疑問' }
  ];

  insertEmote(emote: string) {
    const textArea: HTMLTextAreaElement = this.textAreaElementRef.nativeElement;
    const start = textArea.selectionStart;
    const end = textArea.selectionEnd;
    const currentText = this.text;
    
    // 選択範囲またはカーソル位置に挿入
    this.text = currentText.substring(0, start) + emote + currentText.substring(end);
    
    // カーソル位置を挿入した文字の直後に移動（非同期で行う必要あり）
    setTimeout(() => {
      textArea.focus();
      textArea.setSelectionRange(start + emote.length, start + emote.length);
    }, 0);
  }
  // ----- MODIFICATION END (kunyatta) for DynamicStandPlugin -----

  onInput() {
    if (this.writingEventInterval === null && this.previousWritingLength <= this.text.length) {
      let sendTo: string = null;
      if (this.isDirect) {
        let object = ObjectStore.instance.get(this.sendTo);
        if (object instanceof PeerCursor) {
          let peer = PeerContext.parse(object.peerId);
          if (peer) sendTo = peer.peerId;
        }
      }
      EventSystem.call('WRITING_A_MESSAGE', this.chatTabidentifier, sendTo);
      this.writingEventInterval = setTimeout(() => {
        this.writingEventInterval = null;
      }, 200);
    }
    this.previousWritingLength = this.text.length;
    this.calcFitHeight();
  }

  // sendChat(event: KeyboardEvent) {
  sendChat(event: Partial<KeyboardEvent>) { // ----- MODIFICATION (kunyatta) -----
    if (event) event.preventDefault();

    if (!this.text.length) return;
    if (event && event.keyCode !== 13) return;

    if (!this.sendFrom.length) this.sendFrom = this.myPeer.identifier;
    this.chat.emit({ text: this.text, gameType: this.gameType, sendFrom: this.sendFrom, sendTo: this.sendTo });

    this.text = '';
    this.previousWritingLength = this.text.length;
    let textArea: HTMLTextAreaElement = this.textAreaElementRef.nativeElement;
    textArea.value = '';
    this.calcFitHeight();
  }

  calcFitHeight() {
    let textArea: HTMLTextAreaElement = this.textAreaElementRef.nativeElement;
    textArea.style.height = '';
    if (textArea.scrollHeight >= textArea.offsetHeight) {
      textArea.style.height = textArea.scrollHeight + 'px';
    }
  }

  loadDiceBot(gameType: string) {
    console.log('onChangeGameType ready');
    DiceBot.getHelpMessage(gameType).then(help => {
      console.log('onChangeGameType done\n' + help);
    });
  }

  showDicebotHelp() {
    DiceBot.getHelpMessage(this.gameType).then(help => {
      this.gameHelp = help;

      let gameName: string = 'ダイスボット';
      for (let diceBotInfo of DiceBot.diceBotInfos) {
        if (diceBotInfo.id === this.gameType) {
          gameName = 'ダイスボット<' + diceBotInfo.name + '＞'
        }
      }
      gameName += 'の説明';

      let coordinate = this.pointerDeviceService.pointers[0];
      let option: PanelOption = { left: coordinate.x, top: coordinate.y, width: 600, height: 500 };
      let textView = this.panelService.open(TextViewComponent, option);
      textView.title = gameName;
      textView.text =
        '【ダイスボット】チャットにダイス用の文字を入力するとダイスロールが可能\n'
        + '入力例）２ｄ６＋１　攻撃！\n'
        + '出力例）2d6+1　攻撃！\n'
        + '　　　　  diceBot: (2d6) → 7\n'
        + '上記のようにダイス文字の後ろに空白を入れて発言する事も可能。\n'
        + '以下、使用例\n'
        + '　3D6+1>=9 ：3d6+1で目標値9以上かの判定\n'
        + '　1D100<=50 ：D100で50％目標の下方ロールの例\n'
        + '　3U6[5] ：3d6のダイス目が5以上の場合に振り足しして合計する(上方無限)\n'
        + '　3B6 ：3d6のダイス目をバラバラのまま出力する（合計しない）\n'
        + '　10B6>=4 ：10d6を振り4以上のダイス目の個数を数える\n'
        + '　2R6[>3]>=5 ：2D6のダイス目が3より大きい場合に振り足して、5以上のダイス目の個数を数える\n'
        + '　(8/2)D(4+6)<=(5*3)：個数・ダイス・達成値には四則演算も使用可能\n'
        + '　c(10-4*3/2+2)：c(計算式）で計算だけの実行も可能\n'
        + '　choice[a,b,c]：列挙した要素から一つを選択表示。ランダム攻撃対象決定などに\n'
        + '　S3d6 ： 各コマンドの先頭に「S」を付けると他人結果の見えないシークレットロール\n'
        + '　3d6/2 ： ダイス出目を割り算（端数処理はゲームシステム依存）。切り上げは /2C、四捨五入は /2R、切り捨ては /2F\n'
        + '　D66 ： D66ダイス。順序はゲームに依存。D66N：そのまま、D66A：昇順、D66D：降順\n'
        + '\n'
        + '詳細は下記URLのコマンドガイドを参照\n'
        + 'https://docs.bcdice.org/\n'
        + '===================================\n'
        + this.gameHelp;
    });
  }

  private allowsChat(gameCharacter: GameCharacter): boolean {
    switch (gameCharacter.location.name) {
      case 'table':
      case this.myPeer.peerId:
        return true;
      case 'graveyard':
        return false;
      default:
        for (const peer of Network.peers) {
          if (peer.isOpen && gameCharacter.location.name === peer.peerId) {
            return false;
          }
        }
        return true;
    }
  }
}

import { GameCharacter } from '@udonarium/game-character';

/**
 * 戦闘参加者のリストと、その順序を管理するクラス。
 * 戦闘前・戦闘中を通じて利用される。
 */
export class ParticipantManager {
  private _participants: GameCharacter[] = [];

  /**
   * 現在の参加者リストを順序通りに取得する。
   */
  public get participants(): GameCharacter[] {
    return this._participants;
  }

  /**
   * 参加者リストを初期化または更新する。
   * @param characters 新しい参加者キャラクターの配列
   */
  public initialize(characters: GameCharacter[]): void {
    this._participants = [...characters];
  }

  /**
   * 参加者をリストの末尾に追加する
   * @param character 追加するキャラクター
   */
  public add(character: GameCharacter): void {
    // 重複追加はしない
    if (this._participants.some(p => p.identifier === character.identifier)) return;
    this._participants.push(character);
  }

  /**
   * 指定したIDの参加者をリストから削除する
   * @param characterId 削除するキャラクターのID
   */
  public remove(characterId: string): void {
    this._participants = this._participants.filter(p => p.identifier !== characterId);
  }

  /**
   * 指定したキャラクターをリスト内で一つ上に移動させる。
   * @param characterId 移動させるキャラクターのID
   */
  public moveUp(characterId: string): void {
    const index = this._participants.findIndex(c => c.identifier === characterId);
    if (index > 0) {
      [this._participants[index - 1], this._participants[index]] = [this._participants[index], this._participants[index - 1]];
    }
  }

  /**
   * 指定したキャラクターをリスト内で一つ下に移動させる。
   * @param characterId 移動させるキャラクターのID
   */
  public moveDown(characterId: string): void {
    const index = this._participants.findIndex(c => c.identifier === characterId);
    if (index >= 0 && index < this._participants.length - 1) {
      [this._participants[index], this._participants[index + 1]] = [this._participants[index + 1], this._participants[index]];
    }
  }

  /**
   * 現在の参加者リストのID配列を順序通りに取得する。
   * @returns キャラクターIDの配列
   */
  public getParticipantIds(): string[] {
    return this._participants.map(c => c.identifier);
  }

  /**
   * （将来の機能）敏捷度順にリストをソートする。
   */
  public sortByAgility(): void {
    // TODO: 敏捷度パラメータを取得してソートするロジックを実装
    console.log('sortByAgility is not implemented yet.');
  }
}

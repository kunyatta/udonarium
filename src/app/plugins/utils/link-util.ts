import Autolinker from 'autolinker';

/**
 * URLを自動的にリンク化するための共通ユーティリティクラス。
 */
export class LinkUtil {
  /**
   * テキスト内のURLを <a> タグに変換します。
   * 設定はシステム全体で統一されています。
   * @param text 加工対象のテキスト
   * @returns リンク化されたHTML文字列
   */
  static linkify(text: string): string {
    if (!text) return text;

    return Autolinker.link(text, {
      urls: { 
        schemeMatches: true, 
        tldMatches: false, // 誤爆防止のため厳しめに判定
        ipV4Matches: false 
      },
      email: false,
      phone: false,
      mention: false,
      hashtag: false,
      stripPrefix: false,
      stripTrailingSlash: false,
      newWindow: true,
      truncate: { length: 48, location: 'end' }, // レイアウト崩れ防止
      className: 'outer-link',
    });
  }
}

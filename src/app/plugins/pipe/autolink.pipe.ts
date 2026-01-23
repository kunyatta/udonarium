import { Pipe, PipeTransform } from '@angular/core';
import { LinkUtil } from '../utils/link-util';

@Pipe({
  name: 'autolink'
})
export class AutolinkPipe implements PipeTransform {

  transform(value: string): string {
    return LinkUtil.linkify(value);
  }

}
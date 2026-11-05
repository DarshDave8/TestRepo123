import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CKYC_ICONS, CkycIconName } from './ckyc-icons';

/**
 * Decorative outline icon, always next to text that says the same thing, so it is hidden from screen readers.
 * Inline SVG on purpose: no icon font or MatIconRegistry setup needed, and it takes the text colour (currentColor).
 * Sizes with the text (1em) unless `size` is given. Inside a CKYC button it keeps a gap before the label
 * (the button mixins set --ckyc-icon-gap).
 */
@Component({
  selector: 'app-ckyc-icon',
  standalone: true,
  template: `
    <svg
      viewBox="0 0 24 24"
      [attr.width]="size()"
      [attr.height]="size()"
      fill="none"
      stroke="currentColor"
      [attr.stroke-width]="strokeWidth()"
      stroke-linecap="round"
      stroke-linejoin="round"
      focusable="false"
    >
      @for (d of paths(); track $index) {
        <svg:path [attr.d]="d"></svg:path>
      }
    </svg>
  `,
  styles: `
    :host {
      display: inline-flex;
      flex: none;
      vertical-align: -0.125em;
      margin-inline-end: var(--ckyc-icon-gap, 0);
    }
    svg {
      display: block;
    }
  `,
  host: { 'aria-hidden': 'true' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CkycIconComponent {
  readonly name = input.required<CkycIconName>();
  readonly size = input<string | number>('1em');
  readonly strokeWidth = input<number>(2);

  protected readonly paths = computed(() => CKYC_ICONS[this.name()]);
}

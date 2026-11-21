import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatRadioModule } from '@angular/material/radio';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { backArrowIcon, sendIcon } from 'src/app/constants/icons.constants';
import {
  AUTH_FACTOR_TITLES,
  AUTH_MODE_NOTES,
  AUTH_MODE_TITLES,
  AuthenticationMode,
} from '../constants/ckyc-onboarding.constants';
import { ICkycAuthNodeConfig } from '../models/ckyc-onboarding.model';
import { CkycAuthStateService } from '../services/ckyc-auth-state.service';

// One card: a mode and its nodes (one per factor; a mode without factors, OTP, has one node).
interface MethodGroup {
  readonly mode: AuthenticationMode;
  readonly title: string;
  readonly hint: string;
  readonly note: string | null;
  readonly hasFactors: boolean;
  readonly nodes: readonly ICkycAuthNodeConfig[];
}

/**
 * Method picker (DV): every selectable mode as a radio button, with its factors as radio buttons under it.
 * Nothing is sent until the user presses Trigger consent. The auth state service then sends the picked node and
 * closes the picker, and that mode's screen takes over. Picking again needs Back and Authenticate.
 *
 * Everything shown comes from the queue (AUTH_CONFIG) and the texts in the constants file, so a new mode or factor
 * appears here without changes to this component.
 *
 * The modes are standalone radio buttons sharing one name, not a mat-radio-group: a group collects every radio
 * button inside it, so it would also take over the factor radio buttons of each card.
 */
@Component({
  selector: 'app-ckyc-auth-method-picker',
  standalone: true,
  imports: [MatButtonModule, MatRadioModule, FontAwesomeModule],
  templateUrl: './ckyc-auth-method-picker.component.html',
  styleUrl: './ckyc-auth-method-picker.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CkycAuthMethodPickerComponent {
  private readonly authStore = inject(CkycAuthStateService);
  readonly backArrowIcon = backArrowIcon;
  readonly sendIcon = sendIcon;

  readonly groups = computed<readonly MethodGroup[]>(() => {
    const byMode = new Map<AuthenticationMode, ICkycAuthNodeConfig[]>();
    for (const node of this.authStore.selectableNodes()) {
      const nodes = byMode.get(node.mode) ?? [];
      nodes.push(node);
      byMode.set(node.mode, nodes);
    }
    return [...byMode.entries()].map(([mode, nodes]) => {
      const hasFactors = nodes[0].subType !== null;
      const count = nodes.length;
      return {
        mode,
        title: AUTH_MODE_TITLES[mode] ?? nodes[0].label,
        hint: hasFactors ? `${count} ${count === 1 ? 'factor' : 'factors'} · pick one` : 'No factor to pick',
        note: hasFactors ? null : (AUTH_MODE_NOTES[mode] ?? null),
        hasFactors,
        nodes,
      };
    });
  });

  readonly selectedMode = signal<AuthenticationMode | null>(null);
  private readonly selectedNodeId = signal<string | null>(null);
  readonly selectedNode = computed(
    () => this.authStore.selectableNodes().find((node) => node.id === this.selectedNodeId()) ?? null,
  );

  // Picking a mode picks its first factor; the user can change it.
  selectMode(mode: AuthenticationMode): void {
    const group = this.groups().find((g) => g.mode === mode);
    this.selectedMode.set(mode);
    this.selectedNodeId.set(group?.nodes[0]?.id ?? null);
  }

  selectNode(nodeId: string): void {
    this.selectedNodeId.set(nodeId);
  }

  factorTitle(node: ICkycAuthNodeConfig): string {
    return node.subType ? (AUTH_FACTOR_TITLES[node.subType] ?? node.label) : node.label;
  }

  triggerConsent(): void {
    const node = this.selectedNode();
    if (node) this.authStore.triggerPickedNode(node.id);
  }

  // Back to the enquiry list (same as the Back on the auth screens).
  goBack(): void {
    this.authStore.cancelConsentFlow();
  }
}

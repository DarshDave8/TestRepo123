// Recovered from screenshot 147113 (left pane).
import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CkycFlowStateService } from '../services/ckyc-flow-state.service';
import { CkycEnquiryDetailsComponent } from './ckyc-enquiry-details/ckyc-enquiry-details.component';
import { ICkycEnquiryListResponseBody } from '../models/ckyc-search-response.model';

@Component({
  selector: 'app-ckyc-enquiry-list',
  standalone: true,
  imports: [MatButtonModule, MatExpansionModule, MatProgressSpinnerModule, CkycEnquiryDetailsComponent, CommonModule],
  templateUrl: './ckyc-enquiry-list.component.html',
  styleUrl: './ckyc-enquiry-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CkycEnquiryListComponent {
  readonly flow = inject(CkycFlowStateService);
  matchCount(enquiry: ICkycEnquiryListResponseBody): number {
    return enquiry.results.length;
  }
  enquiryLabel(enquiry: ICkycEnquiryListResponseBody): string {
    return enquiry.searchKey;
  }
  enquiryTimestamp(enquiry: ICkycEnquiryListResponseBody): string | null {
    let latest: string | null = null;
    for (const result of enquiry.results) {
      const candidate = result.enquiryTimestamp ?? result.lastUpdatedDate ?? null;
      if (!candidate) continue;
      if (!latest || Date.parse(candidate) > Date.parse(latest)) latest = candidate;
    }
    return latest;
  }
}

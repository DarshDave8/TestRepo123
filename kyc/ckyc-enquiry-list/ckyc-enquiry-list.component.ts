// Recovered from screenshot 147113 (left pane); search summary and per-enquiry Dedup Check from commit 35dc8bd9.
// Compact redesign 2026-11-04: flat list of <details> rows, no Material expansion panels.
import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { AuthService } from 'src/app/auth/auth.service';
import { UserType } from 'src/app/models/account.model';
import { CkycFlowStateService } from '../services/ckyc-flow-state.service';
import { CkycSharedStateService } from '../services/ckyc-shared-state.service';
import { CkycEnquiryDetailsComponent } from './ckyc-enquiry-details/ckyc-enquiry-details.component';
import { CkycSearchRequest, IOvdDetail } from '../models/ckyc-search-request.model';
import { CkycSearchOption, OvdType, SearchAttemptedPhase } from '../constants/ckyc-onboarding.constants';
import { DocumentTypeEnum } from '../../ckyc-flow/ckyc-flow.constants';
import { CkycGetDedupInfoDialogComponent } from '../../ckyc-flow/ckyc-get-dedup-info-dialog/ckyc-get-dedup-info-dialog.component';

interface CkycIdListSummaryItem {
  label: string;
  value: string;
}

@Component({
  selector: 'app-ckyc-enquiry-list',
  standalone: true,
  imports: [MatButtonModule, CkycEnquiryDetailsComponent],
  templateUrl: './ckyc-enquiry-list.component.html',
  styleUrl: './ckyc-enquiry-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CkycEnquiryListComponent implements OnInit {
  readonly flow = inject(CkycFlowStateService);
  readonly ckycSharedStateService = inject(CkycSharedStateService);
  phase = SearchAttemptedPhase;
  isStaff = false;
  authService = inject(AuthService);
  CkycSearchOption = CkycSearchOption;
  private readonly dialog = inject(MatDialog);

  ngOnInit(): void {
    this.isStaff = this.authService.userIdentity?.userType === UserType.STAFF;
  }
  // Staff only: dedup check for one OVD / mobile enquiry (moved here from the enquiry details card).
  openDedupDialog(enquiryId: string | undefined, request: CkycSearchRequest) {
    const uid = this.getUid(request);
    let enquiry: { enquiryId: string | undefined; idType?: DocumentTypeEnum; idNumber?: string } = {
      enquiryId: enquiryId,
    };
    if (uid) {
      enquiry = { ...enquiry, idType: DocumentTypeEnum.UID, idNumber: uid };
    }
    this.dialog.open(CkycGetDedupInfoDialogComponent, {
      data: { ...enquiry },
      disableClose: true,
    });
  }
  private getUid(request: CkycSearchRequest): string | undefined {
    if (request.searchOption !== CkycSearchOption.OVD) {
      return undefined;
    }
    return request.idList.ovdDetails.find((ovd) => ovd.ovdType === OvdType.UID)?.ovdNo;
  }

  // What the enquiry was searched with, shown in the panel header as label / value pairs.
  buildSummary(request: CkycSearchRequest): CkycIdListSummaryItem[] {
    const idList = request.idList;

    switch (request.searchOption) {
      case CkycSearchOption.CKYC:
        if ('ckycNo' in idList) return [{ label: 'CKYC number', value: idList.ckycNo }];
        break;

      case CkycSearchOption.OVD:
        if ('ovdDetails' in idList)
          return idList.ovdDetails.map((detail: IOvdDetail) => ({
            label: this.ovdLabel(detail.ovdType),
            // Aadhaar: show only the last 4 digits.
            value: detail.ovdType === OvdType.UID ? 'xxxx xxxx ' + detail.ovdNo.slice(-4) : detail.ovdNo,
          }));
        break;

      case CkycSearchOption.VC:
        if ('ckycAlias' in idList) return [{ label: 'CKYC alias', value: idList.ckycAlias }];
        break;

      case CkycSearchOption.MOBILE:
        if ('mobile' in idList) return [{ label: 'Mobile', value: idList.mobile }];
        break;

      case CkycSearchOption.DEMOGRAPHIC:
        if ('firstName' in idList && 'gender' in idList)
          return [
            { label: 'Name', value: [idList.firstName, idList.middleName, idList.lastName].filter(Boolean).join(' ') },
            { label: 'Gender', value: idList.gender },
            { label: 'Date of birth', value: idList.dob },
            { label: 'Relation', value: idList.relation },
            ...this.relatedPersonItems(idList.relativeFirstName, idList.relativeMiddleName, idList.relativeLastName),
          ];
        break;

      case CkycSearchOption.PHOTO:
        if ('photo' in idList)
          return [
            { label: 'Photo', value: 'Provided' },
            { label: 'Name', value: [idList.firstName, idList.middleName, idList.lastName].filter(Boolean).join(' ') },
          ];
        break;

      default:
        return [];
    }
    return [];
  }

  private relatedPersonItems(firstName?: string, middleName?: string, lastName?: string): CkycIdListSummaryItem[] {
    const name = [firstName, middleName, lastName].filter(Boolean).join(' ');
    return name ? [{ label: 'Related person', value: name }] : [];
  }

  private ovdLabel(type: OvdType): string {
    const labels: Record<OvdType, string> = {
      [OvdType.UID]: 'Aadhaar',
      [OvdType.DRIVING_LICENCE]: 'Driving licence',
      [OvdType.PASSPORT]: 'Passport',
      [OvdType.VOTER_ID]: 'Voter ID',
      [OvdType.NREGA_JOBCARD]: 'NREGA job card',
      [OvdType.PAN]: 'PAN',
    };
    return labels[type];
  }
}

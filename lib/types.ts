// ==============================================================================
// GENRE ATTENDANCE - TYPESCRIPT DATA MODELS & DATABASE TYPES
// Pemilihan Duta GenRe Kabupaten Buleleng
// ==============================================================================

export type SystemRole = 'admin' | 'coordinator' | 'member';
export type AccountStatus = 'active' | 'inactive' | 'suspended';
export type PeriodStatus = 'draft' | 'active' | 'completed' | 'archived';
export type FieldStatus = 'active' | 'inactive';
export type ActivityStatus = 'draft' | 'scheduled' | 'ongoing' | 'completed' | 'cancelled';
export type AssignmentType = 'attendance_required' | 'work_assignment' | 'coordinator_duty' | 'committee_support';
export type AssignmentStatus = 'active' | 'cancelled' | 'completed' | 'excused';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskStatus = 'open' | 'in_progress' | 'pending_review' | 'completed' | 'cancelled';
export type TaskAssignmentStatus = 'assigned' | 'in_progress' | 'submitted' | 'completed' | 'rejected' | 'cancelled';
export type SessionStatus = 'scheduled' | 'open' | 'closed' | 'cancelled';
export type CheckInStatus = 'on_time' | 'late' | 'absent' | 'excused' | 'pending_verification';
export type CheckOutStatus = 'normal' | 'early_departure' | 'pending_verification';
export type VerificationStatus = 'pending' | 'approved' | 'rejected';
export type ReviewStatus = 'draft' | 'submitted' | 'needs_clarification' | 'approved' | 'returned';
export type EvaluationStatus = 'calculating' | 'pending_approval' | 'approved' | 'needs_revision' | 'clarification_open';
export type CertificateEligibilityStatus = 'pending' | 'eligible' | 'ineligible';
export type CertificateStatus = 'draft' | 'issued' | 'revoked';
export type ClarificationRequestType = 'attendance_dispute' | 'task_dispute' | 'evaluation_dispute' | 'general_inquiry';
export type ClarificationStatus = 'submitted' | 'under_review' | 'resolved' | 'rejected';

export interface Profile {
  id: string;
  member_code: string;
  full_name: string;
  email: string;
  phone_number?: string | null;
  field_id?: string | null;
  system_role: SystemRole;
  organization_position: string;
  account_status: AccountStatus;
  joined_at: string;
  avatar_url?: string | null;
  created_at: string;
  updated_at: string;
  // Joins
  field?: Field | null;
}

export interface OrganizationPeriod {
  id: string;
  period_name: string;
  period_code: string;
  start_date: string;
  end_date: string;
  period_status: PeriodStatus;
  certificate_threshold: number;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Field {
  id: string;
  period_id: string;
  field_name: string;
  field_code: string;
  field_description?: string | null;
  coordinator_id?: string | null;
  field_status: FieldStatus;
  created_at: string;
  updated_at: string;
  // Joins
  coordinator?: Profile | null;
}

export interface Activity {
  id: string;
  period_id: string;
  activity_code: string;
  activity_name: string;
  activity_description?: string | null;
  activity_location: string;
  start_at: string;
  end_at: string;
  check_in_opens_at: string;
  check_in_closes_at: string;
  check_out_opens_at: string;
  check_out_closes_at: string;
  activity_status: ActivityStatus;
  attendance_required: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ActivityAssignment {
  id: string;
  activity_id: string;
  member_id: string;
  assignment_type: AssignmentType;
  assignment_description?: string | null;
  assignment_status: AssignmentStatus;
  assigned_by: string;
  assigned_at: string;
  cancelled_at?: string | null;
  cancellation_reason?: string | null;
  created_at: string;
  updated_at: string;
  // Joins
  activity?: Activity | null;
  member?: Profile | null;
  attendance?: Attendance | null;
}

export interface AttendanceSession {
  id: string;
  activity_id: string;
  session_name: string;
  session_code: string;
  session_status: SessionStatus;
  token_hash?: string | null;
  token_expires_at?: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Attendance {
  id: string;
  activity_assignment_id: string;
  attendance_session_id?: string | null;
  check_in_at?: string | null;
  check_out_at?: string | null;
  check_in_method: 'qr' | 'manual' | 'system';
  check_out_method?: 'qr' | 'manual' | 'system' | null;
  check_in_status: CheckInStatus;
  check_out_status?: CheckOutStatus | null;
  verification_status: VerificationStatus;
  verified_by?: string | null;
  verified_at?: string | null;
  attendance_note?: string | null;
  created_at: string;
  updated_at: string;
  // Joins
  activity_assignment?: ActivityAssignment | null;
}

export interface ManualAttendanceRequest {
  id: string;
  activity_assignment_id: string;
  attendance_id?: string | null;
  attendance_type: 'check_in' | 'check_out' | 'both';
  claimed_event_time: string;
  recorded_at: string;
  reason: string;
  evidence_url?: string | null;
  requested_by: string;
  review_status: VerificationStatus;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  review_note?: string | null;
  created_at: string;
  updated_at: string;
  // Joins
  member?: Profile | null;
  activity_assignment?: ActivityAssignment | null;
}

export interface Task {
  id: string;
  period_id: string;
  activity_id?: string | null;
  field_id?: string | null;
  task_title: string;
  task_description: string;
  priority: TaskPriority;
  task_status: TaskStatus;
  due_at?: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  // Joins
  field?: Field | null;
  activity?: Activity | null;
  assignments?: TaskAssignment[];
}

export interface TaskAssignment {
  id: string;
  task_id: string;
  member_id: string;
  assigned_by: string;
  assigned_at: string;
  assignment_status: TaskAssignmentStatus;
  progress_note?: string | null;
  submitted_at?: string | null;
  verified_by?: string | null;
  verified_at?: string | null;
  verification_note?: string | null;
  created_at: string;
  updated_at: string;
  // Joins
  task?: Task | null;
  member?: Profile | null;
}

export interface PerformanceReview {
  id: string;
  period_id: string;
  member_id: string;
  reviewer_id: string;
  policy_id: string;
  review_status: ReviewStatus;
  communication_score: number;
  responsibility_score: number;
  teamwork_score: number;
  initiative_score: number;
  professionalism_score: number;
  total_weighted_score: number;
  evidence_note: string;
  submitted_at?: string | null;
  reviewed_by_admin?: string | null;
  reviewed_at?: string | null;
  reviewer_feedback?: string | null;
  created_at: string;
  updated_at: string;
  // Joins
  member?: Profile | null;
  reviewer?: Profile | null;
  scores?: PerformanceScore[];
}

export interface PerformanceScore {
  id: string;
  performance_review_id: string;
  criterion_id: string;
  criterion_code: string;
  criterion_name: string;
  score: number;
  maximum_score: number;
  weight_points: number;
  weighted_points: number;
  evidence_note?: string | null;
}

export interface FinalEvaluation {
  id: string;
  period_id: string;
  member_id: string;
  policy_id: string;
  attendance_points: number;
  punctuality_points: number;
  task_completion_points: number;
  system_score: number;
  coordinator_score: number;
  final_score: number;
  evaluation_status: EvaluationStatus;
  certificate_eligibility_status: CertificateEligibilityStatus;
  calculated_at: string;
  approved_by?: string | null;
  approved_at?: string | null;
  approval_note?: string | null;
  created_at: string;
  updated_at: string;
  // Joins
  member?: Profile | null;
  certificate?: Certificate | null;
}

export interface Certificate {
  id: string;
  final_evaluation_id: string;
  certificate_number: string;
  certificate_status: CertificateStatus;
  issued_at?: string | null;
  issued_by?: string | null;
  file_path?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClarificationRequest {
  id: string;
  period_id: string;
  member_id: string;
  related_activity_id?: string | null;
  related_attendance_id?: string | null;
  related_review_id?: string | null;
  related_final_evaluation_id?: string | null;
  request_type: ClarificationRequestType;
  request_description: string;
  request_status: ClarificationStatus;
  assigned_reviewer_id?: string | null;
  resolution_note?: string | null;
  resolved_by?: string | null;
  resolved_at?: string | null;
  created_at: string;
  updated_at: string;
  // Joins
  member?: Profile | null;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  notification_type: string;
  action_url?: string | null;
  is_read: boolean;
  read_at?: string | null;
  created_at: string;
}

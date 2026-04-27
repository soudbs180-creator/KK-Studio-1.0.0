import type { RechargeSubmissionRecord } from "../domain/static-recharge.ts";

export interface RechargeSubmissionRepository {
  save(submission: RechargeSubmissionRecord): Promise<RechargeSubmissionRecord>;
  findById(submissionId: string): Promise<RechargeSubmissionRecord | undefined>;
  listByUserId(userId: string): Promise<RechargeSubmissionRecord[]>;
  listRecent(sinceIso?: string): Promise<RechargeSubmissionRecord[]>;
}

function cloneSubmission(submission: RechargeSubmissionRecord): RechargeSubmissionRecord {
  return {
    ...submission,
    expiresAt: submission.expiresAt ?? null,
    paymentMarkedAt: submission.paymentMarkedAt ?? null,
    submittedAt: submission.submittedAt ?? null,
    reviewedAt: submission.reviewedAt ?? null,
  };
}

export class InMemoryRechargeSubmissionRepository implements RechargeSubmissionRepository {
  private readonly submissions = new Map<string, RechargeSubmissionRecord>();
  private readonly submissionsByUserId = new Map<string, string[]>();

  async save(submission: RechargeSubmissionRecord): Promise<RechargeSubmissionRecord> {
    const persisted = cloneSubmission(submission);
    this.submissions.set(persisted.submissionId, persisted);

    const current = this.submissionsByUserId.get(persisted.userId) || [];
    this.submissionsByUserId.set(
      persisted.userId,
      [persisted.submissionId, ...current.filter((id) => id !== persisted.submissionId)],
    );

    return cloneSubmission(persisted);
  }

  async findById(submissionId: string): Promise<RechargeSubmissionRecord | undefined> {
    const submission = this.submissions.get(submissionId);
    return submission ? cloneSubmission(submission) : undefined;
  }

  async listByUserId(userId: string): Promise<RechargeSubmissionRecord[]> {
    const submissionIds = this.submissionsByUserId.get(userId) || [];
    return submissionIds
      .map((submissionId) => this.submissions.get(submissionId))
      .filter((submission): submission is RechargeSubmissionRecord => Boolean(submission))
      .map((submission) => cloneSubmission(submission));
  }

  async listRecent(sinceIso?: string): Promise<RechargeSubmissionRecord[]> {
    const sinceTime = sinceIso ? new Date(sinceIso).getTime() : Number.NEGATIVE_INFINITY;
    return Array.from(this.submissions.values())
      .filter((submission) => new Date(submission.createdAt).getTime() >= sinceTime)
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
      .map((submission) => cloneSubmission(submission));
  }
}

import path from "node:path";

import type { RechargeSubmissionRecord } from "../domain/static-recharge.ts";
import { FileBackedJsonStore } from "./file-backed-json-store.ts";
import type { RechargeSubmissionRepository } from "./in-memory-recharge-submission-repository.ts";

interface PersistedRechargeSubmissionState {
  version: 1;
  submissions: Record<string, RechargeSubmissionRecord>;
  submissionsByUserId: Record<string, string[]>;
}

export interface FileBackedRechargeSubmissionRepositoryOptions {
  filePath?: string;
}

function buildDefaultFilePath(): string {
  const configuredPath = String(process.env.KK_LOCAL_RECHARGE_SUBMISSIONS_FILE || "").trim();
  if (configuredPath) {
    return path.resolve(configuredPath);
  }

  return path.resolve(process.cwd(), ".kk-local", "billing", "recharge-submissions.json");
}

function isPersistedState(value: unknown): value is PersistedRechargeSubmissionState {
  return Boolean(
    value
    && typeof value === "object"
    && !Array.isArray(value)
    && (value as { version?: unknown }).version === 1
    && typeof (value as { submissions?: unknown }).submissions === "object"
    && typeof (value as { submissionsByUserId?: unknown }).submissionsByUserId === "object"
  );
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

export class FileBackedRechargeSubmissionRepository implements RechargeSubmissionRepository {
  private readonly store: FileBackedJsonStore<PersistedRechargeSubmissionState>;

  constructor(options: FileBackedRechargeSubmissionRepositoryOptions = {}) {
    this.store = new FileBackedJsonStore<PersistedRechargeSubmissionState>({
      filePath: options.filePath?.trim() ? options.filePath.trim() : buildDefaultFilePath(),
      createEmptyState: () => ({
        version: 1,
        submissions: {},
        submissionsByUserId: {},
      }),
      isState: isPersistedState,
    });
  }

  async save(submission: RechargeSubmissionRecord): Promise<RechargeSubmissionRecord> {
    return this.store.withState(async (state) => ({
      state: {
        ...state,
        submissions: {
          ...state.submissions,
          [submission.submissionId]: cloneSubmission(submission),
        },
        submissionsByUserId: {
          ...state.submissionsByUserId,
          [submission.userId]: [
            submission.submissionId,
            ...(state.submissionsByUserId[submission.userId] || []).filter((id) => id !== submission.submissionId),
          ],
        },
      },
      result: cloneSubmission(submission),
    }));
  }

  async findById(submissionId: string): Promise<RechargeSubmissionRecord | undefined> {
    const state = await this.store.readState();
    const submission = state.submissions[submissionId];
    return submission ? cloneSubmission(submission) : undefined;
  }

  async listByUserId(userId: string): Promise<RechargeSubmissionRecord[]> {
    const state = await this.store.readState();
    return (state.submissionsByUserId[userId] || [])
      .map((submissionId) => state.submissions[submissionId])
      .filter((submission): submission is RechargeSubmissionRecord => Boolean(submission))
      .map((submission) => cloneSubmission(submission));
  }

  async listRecent(sinceIso?: string): Promise<RechargeSubmissionRecord[]> {
    const state = await this.store.readState();
    const sinceTime = sinceIso ? new Date(sinceIso).getTime() : Number.NEGATIVE_INFINITY;
    return Object.values(state.submissions)
      .filter((submission) => new Date(submission.createdAt).getTime() >= sinceTime)
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
      .map((submission) => cloneSubmission(submission));
  }
}

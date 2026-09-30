export const LoadStatus = {
  PENDING: 'pending',
  UPLOADING: 'uploading',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
} as const;

export type LoadStatus = (typeof LoadStatus)[keyof typeof LoadStatus];

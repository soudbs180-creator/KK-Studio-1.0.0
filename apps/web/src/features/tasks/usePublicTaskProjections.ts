import React from 'react';
import type { PublicTaskProjectionDto } from '@kk/shared';
import {
  getPublicTaskProjections,
  subscribePublicTaskProjections,
} from './publicTaskProjectionSource.ts';

/** Keeps React surfaces subscribed to safe task DTOs rather than internal Run or Job records. */
export function usePublicTaskProjections(): PublicTaskProjectionDto[] {
  const [tasks, setTasks] = React.useState<PublicTaskProjectionDto[]>(getPublicTaskProjections);
  React.useEffect(() => subscribePublicTaskProjections(setTasks), []);
  return tasks;
}

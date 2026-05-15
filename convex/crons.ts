import { cronJobs } from 'convex/server';
import { internal } from './_generated/api';

const crons = cronJobs();

crons.interval('expire stale requests', { minutes: 15 }, internal.walkRequests.expireStale);
crons.interval('mark no-shows', { minutes: 15 }, internal.walks.markNoShows);

export default crons;


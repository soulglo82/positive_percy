// P-1's one-time owner backfill, moved out of boot (A2 M1). Uses the same
// URL rule and column list as the write guard and the delete.
import { backfillUploadOwners } from '../uploads.js';

export default async function (client) {
  await backfillUploadOwners(client);
}

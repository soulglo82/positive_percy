// V1-B: the reward save and delete used by Rewards and Children, so the
// RewardForm payload rules (V1-D F1-F4) and their toasts live in one place.
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Reward } from '@/api/entities';

// What the toasts say: a reward, or a Big Goal made in the Daily Wins & Big
// Goals pop-up (V1-F §12.6).
export const REWARD_WORDS = { created: 'Reward created.', updated: 'Reward updated.', deleted: 'Reward deleted',
  saveFailed: "Couldn't save the reward.", deleteFailed: "Couldn't delete the reward." };
export const BIG_GOAL_WORDS = { created: 'Big Goal added.', updated: 'Big Goal updated.', deleted: 'Big Goal deleted.',
  saveFailed: "Couldn't save the Big Goal.", deleteFailed: "Couldn't delete the Big Goal." };

export const REFETCH_WAIT_MS = 4000;

export function useRewardMutations() {
  const queryClient = useQueryClient();
  const done = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ['rewards'] }),
    queryClient.invalidateQueries({ queryKey: ['children'] }), // priced stacks show reward icons
  ]).catch(() => {});
  // The Rewards and Children forms close as soon as the save is answered, as
  // they always have: the refetch runs behind them. The Daily Wins & Big Goals
  // pop-up returns to a list instead, so it asks to wait for the refetch
  // (`awaitRefetch`), but never longer than REFETCH_WAIT_MS: a slow or hung
  // refresh must not hold a saved form shut (code review of decdbcf, finding 1).
  const settle = (awaitRefetch) => {
    const refetched = done();
    return awaitRefetch ? Promise.race([refetched, new Promise((resolve) => setTimeout(resolve, REFETCH_WAIT_MS))]) : undefined;
  };
  const saveMutation = useMutation({
    mutationFn: ({ id, data }) => (id ? Reward.update(id, data) : Reward.create(data)),
    onSuccess: async (_, { id, words, awaitRefetch }) => { await settle(awaitRefetch); toast.success(id ? words.updated : words.created); },
  });
  const deleteMutation = useMutation({
    mutationFn: ({ id, confirm }) => Reward.delete(id, confirm ? { confirm_end_savings: confirm } : undefined),
    onSuccess: async (_, { words, awaitRefetch }) => { await settle(awaitRefetch); toast.success(words.deleted); },
  });
  // Resolves true when saved (the form then closes), false when not, or
  // { needsConfirm: { ending, snapshot } } when the server must be shown what
  // would be released (D1 §21): the form then asks again with that list.
  const save = async (id, data, words = REWARD_WORDS, { awaitRefetch = false } = {}) => {
    try {
      await saveMutation.mutateAsync({ id, data, words, awaitRefetch });
      return true;
    } catch (err) {
      // D1 §20.9: savings changed since the page loaded. Refresh the
      // children so the form's per-child warning shows the current figures.
      if (err?.code === 'ENDS_SAVINGS') {
        done();
        // No snapshot to confirm: say so rather than ask again forever.
        if (!err.snapshot) { toast.error(err.message || words.saveFailed); return false; }
        return { needsConfirm: { ending: err.ending || [], snapshot: err.snapshot } };
      }
      toast.error(err?.message || words.saveFailed);
      return false;
    }
  };
  // Resolves true when deleted; { needsConfirm } as save (D1 §21.2).
  const remove = async (reward, confirm = null, words = REWARD_WORDS, { awaitRefetch = false } = {}) => {
    try {
      await deleteMutation.mutateAsync({ id: reward.id, confirm, words, awaitRefetch });
      return true;
    } catch (err) {
      if (err?.code === 'ENDS_SAVINGS') {
        done();
        // No snapshot to confirm: say so rather than ask again forever.
        if (!err.snapshot) { toast.error(err.message || words.deleteFailed); return false; }
        return { needsConfirm: { ending: err.ending || [], snapshot: err.snapshot } };
      }
      toast.error(err?.message || words.deleteFailed);
      return false;
    }
  };
  return { save, remove };
}

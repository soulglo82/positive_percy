// V1-B: the reward save and delete used by Rewards and Children, so the
// RewardForm payload rules (V1-D F1-F4) and their toasts live in one place.
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Reward } from '@/api/entities';

export function useRewardMutations() {
  const queryClient = useQueryClient();
  const done = () => {
    queryClient.invalidateQueries({ queryKey: ['rewards'] });
    queryClient.invalidateQueries({ queryKey: ['children'] }); // priced stacks show reward icons
  };
  const saveMutation = useMutation({
    mutationFn: ({ id, data }) => (id ? Reward.update(id, data) : Reward.create(data)),
    onSuccess: (_, { id }) => { done(); toast.success(id ? 'Reward updated.' : 'Reward created.'); },
  });
  const deleteMutation = useMutation({
    mutationFn: ({ id, confirm }) => Reward.delete(id, confirm ? { confirm_end_savings: confirm } : undefined),
    onSuccess: () => { done(); toast.success('Reward deleted'); },
  });
  // Resolves true when saved (the form then closes), false when not, or
  // { needsConfirm: { ending, snapshot } } when the server must be shown what
  // would be released (D1 §21): the form then asks again with that list.
  const save = async (id, data) => {
    try {
      await saveMutation.mutateAsync({ id, data });
      return true;
    } catch (err) {
      // D1 §20.9: savings changed since the page loaded. Refresh the
      // children so the form's per-child warning shows the current figures.
      if (err?.code === 'ENDS_SAVINGS') {
        done();
        return { needsConfirm: { ending: err.ending || [], snapshot: err.snapshot } };
      }
      toast.error(err?.message || "Couldn't save the reward.");
      return false;
    }
  };
  // Resolves true when deleted; { needsConfirm } as save (D1 §21.2).
  const remove = async (reward, confirm = null) => {
    try {
      await deleteMutation.mutateAsync({ id: reward.id, confirm });
      return true;
    } catch (err) {
      if (err?.code === 'ENDS_SAVINGS') {
        done();
        return { needsConfirm: { ending: err.ending || [], snapshot: err.snapshot } };
      }
      toast.error(err?.message || "Couldn't delete the reward.");
      return false;
    }
  };
  return { save, remove };
}

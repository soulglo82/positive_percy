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
    mutationFn: (id) => Reward.delete(id),
    onSuccess: () => { done(); toast.success('Reward deleted'); },
  });
  // Resolves true when saved (the form then closes), false when not.
  const save = async (id, data) => {
    try {
      await saveMutation.mutateAsync({ id, data });
      return true;
    } catch (err) {
      toast.error(err?.message || "Couldn't save the reward.");
      return false;
    }
  };
  // Resolves true when deleted.
  const remove = async (reward) => {
    try {
      await deleteMutation.mutateAsync(reward.id);
      return true;
    } catch (err) {
      toast.error(err?.message || "Couldn't delete the reward.");
      return false;
    }
  };
  return { save, remove };
}

// V1.1 Home sections (design/v11; owner review 23 Nov 2026). Home is the
// parent's daily action centre: choose a child, see the points they can use,
// give Quick Points, complete Today's Goals. Every figure comes from the
// server (available_points, the family streak, reward_stack_priced, goals);
// every action is V1's, passed in by ParentDashboard.
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import PercyIcon from '@/components/icons/PercyIcon';
import CategoryIcon from '@/components/CategoryIcon';
import RewardIcon from '@/components/rewards/RewardIcon';
import { leadingGoal, pointsWord as points } from '@/lib/savings';
import { ChildSelector, PercyFox, MorningArt } from './parts';


// The morning scene: child picker, the question, Percy, and the points the
// child can use now as a plain balance (no ring: it is not progress).
export function HomeHero({ children, child, streak, foxPlay, onSelect }) {
  const available = child.available_points ?? child.total_points ?? 0;
  return (
    <section className="pv-scene pv-scene--morning" aria-labelledby="home-title">
      <MorningArt />
      <div className="pv-scene__sky">
        <ChildSelector children={children} selectedId={child.id} onSelect={onSelect} />
        <div className="pv-scene__text">
          {streak > 0 && (
            <p className="pv-chip"><PercyIcon id="phosphor:sparkle:duotone" />{streak}-day family streak</p>
          )}
          <h1 id="home-title" className="pv-t-hero">What went well for {child.name} today?</h1>
        </div>
        <div className="pv-scene__fox"><PercyFox pose="waving" size="hero" play={foxPlay} /></div>
      </div>
      <div className="pv-scene__ground pv-on-dark">
        <div>
          <p className="pv-t-meta">Available now</p>
          <p className="pv-balance">
            <span className="pv-t-number" data-available>{available}</span>{' '}
            <span className="pv-t-action">{points(available)}</span>
          </p>
        </div>
      </div>
    </section>
  );
}

// Quick Points: the family's quick behaviours for the selected child. Labels
// are 15px at every width; with large text the tiles go one across.
export function HomeQuickPoints({ child, actions, awarding, onAward, onOpenAward, onOpenRewards }) {
  return (
    <section className="pv-section" aria-labelledby="quick-title">
      <div>
        <h2 id="quick-title" className="pv-t-section">Quick Points</h2>
        {/* Owner, 24 November 2026: say that a box acts at once. No boxes, no line. */}
        {actions.length > 0 && <p className="pv-t-support">Tap a box to give its points straight away.</p>}
      </div>
      {actions.length === 0 ? (
        <div className="pv-empty">
          <p className="pv-t-body">No quick points yet.</p>
          <Link to={createPageUrl('ParentProfile')} className="pv-link">Choose them in Settings</Link>
        </div>
      ) : (
        <div className="pv-quick" data-tile-grid="even">
          {actions.map((action) => (
            // The name comes before the points in the page, so what a screen
            // reader hears starts with what is shown ("Kindness +1 for Lara").
            <button key={action.id} type="button" className="pv-quick-tile" disabled={awarding} data-tile
              onClick={() => onAward(child, action)} aria-label={`${action.label} +${action.points} for ${child.name}`}>
              <span className="pv-medallion" aria-hidden="true" data-tile-part="icon"><CategoryIcon iconKey={action.icon_key} className="h-6 w-6" /></span>
              <span className="pv-quick-tile__label" data-tile-part="name">{action.label}</span>
              <span className="pv-quick-tile__points" data-tile-part="badge">+{action.points}</span>
            </button>
          ))}
        </div>
      )}
      {/* Owner, 24 November 2026: the boxes are the main thing; the form is
          "Custom points" (soft orange) beside Rewards (soft purple), neither solid. */}
      <div className="pv-quick-actions">
        <button type="button" className="pv-btn pv-btn--warm" onClick={onOpenAward}>
          <PercyIcon id="phosphor:plus-circle:duotone" />Custom points
        </button>
        <button type="button" className="pv-btn pv-btn--soft" onClick={onOpenRewards}>
          <PercyIcon id="phosphor:gift:duotone" />Rewards
        </button>
      </div>
    </section>
  );
}

// What the child is working towards: the bigger goal with the most saved and
// the rewards already chosen (the stack available_points is worked out from).
// Saving and editing stay on Children. With nothing chosen, only the link to
// Child View is shown (as in V1).
export function HomeWorkingTowards({ child }) {
  const stack = child.reward_stack_priced ?? [];
  const goal = leadingGoal(child.goals);
  const pct = goal && goal.cost > 0 ? Math.max(0, Math.min(100, Math.round((goal.saved / goal.cost) * 100))) : 0;
  return (
    <section className="pv-section" aria-labelledby="towards-title">
      <h2 id="towards-title" className="pv-t-section">What you're working towards</h2>
      <div className="pv-card">
        {goal && (
          <div className="pv-towards-goal" data-goal={goal.rewardId}>
            <div className="pv-towards-row">
              <RewardIcon reward={goal} size="md" />
              <div className="pv-towards-text">
                <p className="pv-t-meta">Saving for something bigger</p>
                <p className="pv-t-card">{goal.name}</p>
                <p className="pv-t-support">{goal.saved} of {goal.cost} points saved</p>
                <p className="pv-t-action">{goal.to_go > 0 ? `${goal.to_go} to go` : 'Saved!'}</p>
              </div>
            </div>
            <div className="pv-bar" aria-hidden="true"><i style={{ width: pct + "%" }} /></div>
            {/* Owner wording (21 Nov): the funded-goal celebration (not a redemption). */}
            {goal.to_go === 0 && <p className="pv-t-body">{child.name} has saved enough for {goal.name}!</p>}
          </div>
        )}
        {stack.map((item, i) => (
          <div key={item.rewardId + '-' + i} className="pv-towards-row">
            <RewardIcon reward={item} size="md" />
            <div className="pv-towards-text">
              <p className="pv-t-card">{item.name}</p>
              <p className="pv-t-support">{item.cost} {points(item.cost)} · Ready when a parent agrees</p>
            </div>
          </div>
        ))}
        <Link to={createPageUrl('ChildView') + '?child=' + encodeURIComponent(child.id)} className="pv-link">
          View all goals and rewards
        </Link>
      </div>
    </section>
  );
}

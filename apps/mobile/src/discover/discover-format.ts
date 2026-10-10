import { formatCount } from '@/offers/money';
import { discoverMessages } from './discover-messages';

/** The minimum-followers condition as shown to the influencer. */
export function followerCondition(minFollowers: number): string {
  return minFollowers > 0
    ? `Minimum ${formatCount(minFollowers)} takipçi`
    : discoverMessages.noFollowerLimit;
}

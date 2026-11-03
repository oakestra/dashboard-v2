// The account query is shared with addon packages (they need the user's `_id` too), so it lives
// in the SDK with its key, `platformQueryKeys.user(username)`.
export { profileQuery } from '@oakestra/dashboard-sdk';

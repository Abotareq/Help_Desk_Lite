import type { Message } from './messages'

/**
 * English is the source of truth for what keys exist. `ar.ts` is typed against
 * it, so a translation that is missing — or a key that no longer exists — is a
 * compile error rather than a string that silently renders as its own key in
 * front of a user.
 *
 * Keys are grouped by where they appear, not by what they say, because the
 * question being asked is always "what goes here" rather than "where else does
 * this word appear".
 */
export const en = {
  'app.name': 'HelpDesk Lite',

  'nav.myRequests': 'My requests',
  'nav.queue': 'Queue',
  'nav.allRequests': 'All requests',
  'nav.dashboard': 'Dashboard',
  'nav.people': 'People',
  'nav.open': 'Open navigation',
  'nav.close': 'Close navigation',
  'nav.signOut': 'Sign out',

  'theme.label': 'Colour theme',
  'theme.light': 'Light',
  'theme.dark': 'Dark',
  'theme.system': 'Auto',

  'language.label': 'Language',
  'language.en': 'English',
  'language.ar': 'العربية',

  'signIn.title': 'Sign in to submit and track requests',
  'signIn.email': 'Email',
  'signIn.emailPlaceholder': 'you@company.com',
  'signIn.password': 'Password',
  'signIn.submit': 'Sign in',
  'signIn.noSelfSignUp': 'Accounts are created by a manager — there is no self sign-up.',

  'status.NEW': 'New',
  'status.IN_PROGRESS': 'In progress',
  'status.WAITING': 'Waiting',
  'status.RESOLVED': 'Resolved',
  'status.CLOSED': 'Closed',

  'priority.LOW': 'Low',
  'priority.MEDIUM': 'Medium',
  'priority.HIGH': 'High',

  'category.IT': 'IT',
  'category.HR': 'HR',
  'category.FACILITIES': 'Facilities',
  'category.OTHER': 'Other',

  'role.EMPLOYEE': 'employee',
  'role.AGENT': 'agent',
  'role.MANAGER': 'manager',

  'requests.newRequest': 'New request',
  'requests.total': { one: '{count} total', other: '{count} total' },
  'requests.colRef': 'Ref',
  'requests.colSubject': 'Subject',
  'requests.colStatus': 'Status',
  'requests.colPriority': 'Priority',
  'requests.colCategory': 'Category',
  'requests.colAge': 'Age',
  'requests.colRequester': 'Requester',
  'requests.colAssignee': 'Assigned to',

  'detail.activity': 'Activity',
  'detail.entries': { one: '{count} entry', other: '{count} entries' },
  'detail.actions': 'Actions',
  'detail.details': 'Details',
  'detail.status': 'Status',
  'detail.priority': 'Priority',
  'detail.category': 'Category',
  'detail.assignedTo': 'Assigned to',
  'detail.submitted': 'Submitted',
  'detail.resolved': 'Resolved',
  'detail.closed': 'Closed',
  'detail.unclaimed': 'Unclaimed',
  'detail.assigned': 'Assigned',
  'detail.claim': 'Claim this request',
  'detail.backToMine': 'Back to my requests',
  'detail.request': 'Request',
  'detail.notFound': 'That request does not exist, or you do not have access to it.',
  'detail.loadFailed': 'Could not load this request.',

  'timeline.empty': 'Nothing has happened yet.',
  'timeline.created': '{actor} submitted this request',
  'timeline.assigned': '{actor} assigned it',
  'timeline.unassigned': '{actor} returned it to the queue',
  'timeline.reopened': '{actor} reopened it',
  'timeline.statusChanged': '{actor} moved it from {from} to {to}',
  'timeline.statusSet': '{actor} set it to {to}',
  'timeline.categoryChanged': '{actor} recategorised it from {from} to {to}',
  'timeline.categoryChangedPlain': '{actor} recategorised it',
  'timeline.updated': '{actor} updated it',
  'timeline.commented': '{actor} commented',
  'timeline.internalNote': 'Internal note',
  'timeline.someone': 'Someone',

  'comment.add': 'Add a comment',
  'comment.placeholder': 'Reply to this request…',
  'comment.internalPlaceholder': 'A note for whoever handles this. The requester will not see it.',
  'comment.submit': 'Comment',
  'comment.submitInternal': 'Add internal note',
  'comment.failed': 'Could not post that comment.',

  'workflow.startWork': 'Start work',
  'workflow.withdraw': 'Withdraw',
  'workflow.wait': 'Wait on requester',
  'workflow.resolve': 'Resolve',
  'workflow.resume': 'Resume',
  'workflow.reopen': 'Reopen',
  'workflow.close': 'Close',
  'workflow.confirm': 'Confirm',
  'workflow.cancel': 'Cancel',
  'workflow.none': 'You have no actions on this request.',
  'workflow.closedFinal': 'This request is closed. Nothing moves out of it.',
  'workflow.notePlaceholder': 'Add a note (optional)',
  'workflow.waitPlaceholder': 'What do you need from the requester?',
  'workflow.waitHint':
    'This goes to the requester as a comment they can answer. A request on hold without a reason is the ambiguity this tool exists to remove.',

  'category.changeFailed': 'Could not change the category.',
  'assign.failed': 'Could not reassign it.',


  'assign.to': 'Assign to',

  'filters.status': 'Filter by status',
  'filters.owner': 'Filter by owner',
  'filters.category': 'Filter by category',
  'filters.priority': 'Filter by priority',
  'filters.anyStatus': 'Any status',
  'filters.anyOwner': 'Any owner',
  'filters.anyCategory': 'Any category',
  'filters.anyPriority': 'Any priority',
  'filters.noMatch': 'Nothing matches those filters',

  'allRequests.title': 'All requests',
  'allRequests.matching': { one: '{count} matching', other: '{count} matching' },

  'myRequests.title': 'My requests',
  'myRequests.empty': 'You have not submitted anything yet',

  'queue.title': 'Queue',
  'queue.subtitle': 'Highest priority first',

  'dashboard.title': 'Dashboard',
  'dashboard.subtitle': 'Where the work is right now',
  'dashboard.open': 'Open',
  'dashboard.unclaimed': 'Unclaimed',
  'dashboard.total': 'Total',
  'dashboard.byStatus': 'By status',
  'dashboard.workload': 'Workload by owner',
  'dashboard.whoCarries': 'Who is carrying what',
  'dashboard.empty': 'Nothing has been raised yet.',

  'people.title': 'People',
  'people.noAccounts': 'No accounts yet',
  'people.active': 'Active',
  'people.deactivated': 'Deactivated',
  'people.name': 'Name',
  'people.email': 'Email',
  'people.role': 'Role',
  'people.tempPassword': 'Temporary password',
  'people.newPassword': 'New password',

  'newRequest.title': 'New request',
  'newRequest.subtitle': 'Tell support what you need',
  'newRequest.what': 'What do you need?',
  'newRequest.details': 'Details',

  'common.loading': 'Loading',
  'common.retry': 'Try again',
} as const satisfies Record<string, Message>

export type MessageKey = keyof typeof en

/** Every catalogue must cover exactly these keys. */
export type Catalogue = Record<MessageKey, Message>

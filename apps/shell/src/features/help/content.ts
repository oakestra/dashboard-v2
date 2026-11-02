export interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

export const FAQ_ITEMS: readonly FaqItem[] = [
  {
    id: 'deploy',
    question: 'How do I deploy an application?',
    answer:
      'Open Applications, create an application and add a service with its image, resources and constraints. To change a service later, use Duplicate on it: the backend cannot edit services, so the copy is created as a new one. Then use the deploy action on the service to start an instance on a matching cluster.',
  },
  {
    id: 'clusters',
    question: 'How do I add a cluster or a worker node?',
    answer:
      'Clusters register themselves with the root orchestrator, and worker nodes register with their cluster. Follow the setup guides in the Oakestra documentation; once registered, they appear under Infrastructure.',
  },
  {
    id: 'roles',
    question: 'Why can I not see some pages?',
    answer:
      'Pages depend on your roles in the organization you logged in to. Application Providers manage applications, Infrastructure Providers see clusters and Admins manage everything, including the Users and Organizations pages (the user endpoints of the backend are Admin only). Ask an admin to change your roles if you need more access.',
  },
  {
    id: 'organization',
    question: 'What is an organization?',
    answer:
      'An organization groups users and gives each of them roles. Choose one when you log in; leave it empty to use the root organization. Admins create organizations and manage their members under Organizations.',
  },
  {
    id: 'password',
    question: 'How do I change or reset my password?',
    answer:
      'Open your profile from the user menu and choose Change password. If you forgot it, use the reset link on the login page and follow the email.',
  },
  {
    id: 'instance-status',
    question: 'Why is my instance not running?',
    answer:
      'Open the service and check the status and details of its instances. Typical causes are constraints no cluster can satisfy, an unreachable image registry or too few free resources. A service cannot be edited yet, so fix the definition with Duplicate on the service, create the copy and deploy that.',
  },
];

export interface HelpLink {
  id: string;
  label: string;
  description: string;
  href: string;
}

export const HELP_LINKS: readonly HelpLink[] = [
  {
    id: 'docs',
    label: 'Documentation',
    description: 'Guides for setting up and operating Oakestra.',
    href: 'https://www.oakestra.io/docs/',
  },
  {
    id: 'website',
    label: 'Oakestra Team',
    description: 'Get in touch with the team behind Oakestra.',
    href: 'https://www.oakestra.io/',
  },
  {
    id: 'github',
    label: 'GitHub',
    description: 'Report a bug or follow the development.',
    href: 'https://github.com/oakestra/oakestra',
  },
];

export const CONTACT_TEXT = 'Found a bug or have a question? Reach us here.';

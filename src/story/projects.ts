/**
 * Portfolio content. This is the only file to edit when projects change:
 * quests point at projects by `id`, and every UI panel reads from here.
 *
 * TODO: replace the placeholder text, links and media with the real content.
 */

export type Project = {
  id: string
  title: string
  /** One-line pitch shown under the title. */
  pitch: string
  /** A few sentences for the full card. */
  details?: string
  stack: string[]
  links: { github?: string; live?: string }
  /** Screenshot or GIF path (put files in /public), or omit for a placeholder tile. */
  media?: string
  /** Short tag such as a year or role, shown as a badge. */
  tag?: string
}

export type Contact = {
  name: string
  role: string
  /** One line shown over the island on load: who you are and what you do. */
  pitch: string
  /** Degree / education line. */
  education: string
  blurb: string
  email?: string
  linkedin?: string
  github?: string
  cv?: string
}

export const PROJECTS: Project[] = [
  {
    id: 'breathing-monitor',
    title: 'Breathing Monitor',
    pitch: 'TODO: Embedded breathing monitor built for the senior design project.',
    details: 'TODO: What it does, what you built, and the result.',
    stack: ['C', 'Embedded', 'Sensors'],
    links: { github: 'https://github.com/TODO' },
    tag: 'Hardware',
  },
  {
    id: 'gitpulse',
    title: 'GitPulse',
    pitch: 'TODO: Notifications for the GitHub activity you care about.',
    details: 'TODO: What it does, what you built, and the result.',
    stack: ['TypeScript', 'Node', 'GitHub API'],
    links: { github: 'https://github.com/TODO', live: 'https://TODO' },
    tag: 'App',
  },
  {
    id: 'cue',
    title: 'Cue',
    pitch: 'TODO: Music recognition, turning sound waves into a signal.',
    details: 'TODO: What it does, what you built, and the result.',
    stack: ['Python', 'DSP'],
    links: { github: 'https://github.com/TODO' },
    tag: 'Audio',
  },
  {
    id: 'remote-job-globe',
    title: 'Remote Job Globe',
    pitch: 'TODO: Remote jobs around the world on an interactive globe.',
    details: 'TODO: What it does, what you built, and the result.',
    stack: ['React', 'Three.js'],
    links: { github: 'https://github.com/TODO', live: 'https://TODO' },
    tag: 'Web',
  },
  {
    id: 'sabah-hub',
    title: 'SABAH.HUB',
    pitch: 'TODO: Grew from intern to full-time engineer.',
    details: 'TODO: Team, scope and what you shipped.',
    stack: ['TODO'],
    links: {},
    tag: 'Work',
  },
]

export const CONTACT: Contact = {
  name: 'TODO Your Name',
  role: 'TODO Software Engineer',
  pitch: 'TODO: I build full-stack products and embedded systems that ship.',
  education: 'TODO Degree, ADA University',
  blurb: 'TODO: One or two sentences about what you are looking for.',
  email: 'TODO@example.com',
  linkedin: 'https://linkedin.com/in/TODO',
  github: 'https://github.com/TODO',
}

export const projectById = (id: string) => PROJECTS.find((p) => p.id === id)

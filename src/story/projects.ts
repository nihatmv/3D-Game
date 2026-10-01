/**
 * Portfolio content. This is the only file to edit when projects change:
 * quests point at projects by `id`, and every UI panel (the island cards and
 * the /portfolio page) reads from here.
 *
 * TODO: replace the placeholder text, links and media with the real content.
 */

/** Site-wide settings. */
export const CONFIG = {
  /** Public GitHub username: the lighthouse shows its latest pushed commit (GitPulse demo). */
  githubUser: 'TODO-github-username',
}

/**
 * A small live demo on the project's landmark (and in its card):
 * - `commit`: the lighthouse shows your latest public commit, with `fallback` when GitHub can't be reached.
 * - `breathing`: the lighthouse base glows at the breathing rhythm; the card draws `samples` (JSON in /public).
 * - `song`: clicking the pond plays `audio` (or a built-in jingle when omitted), then shows "Recognized: <song>".
 * - `milestone`: the tree grows from a sapling; the card shows `from → to`.
 */
export type Demo =
  | { kind: 'commit'; fallback: { repo: string; message: string } }
  | { kind: 'breathing'; samples: string }
  | { kind: 'song'; song: string; audio?: string }
  | { kind: 'milestone'; from: string; to: string }

export type Project = {
  id: string
  title: string
  /** One-line pitch shown under the title. */
  pitch: string
  /** One concrete result, ideally a number ("1,200 users", "40% faster"). Shown big on the card. */
  result?: string
  /** A few sentences for the full card. */
  details?: string
  stack: string[]
  links: { github?: string; live?: string }
  /**
   * Screenshot, GIF or short video (.mp4/.webm, played muted on loop). Put files in
   * /public and use a path like '/media/gitpulse.mp4'; omit for a placeholder tile.
   */
  media?: string
  /** Short tag such as a year or role, shown as a badge. */
  tag?: string
  demo?: Demo
}

export type Contact = {
  name: string
  role: string
  /** One line shown over the island on load: who you are and what you do. */
  pitch: string
  blurb: string
  email?: string
  linkedin?: string
  github?: string
  /** CV file in /public, e.g. '/cv.pdf'. Every project card links to it. */
  cv?: string
  /** Portrait photo in /public, e.g. '/photo.jpg'. */
  photo?: string
}

export const PROJECTS: Project[] = [
  {
    id: 'breathing-monitor',
    title: 'Breathing Monitor',
    pitch: 'TODO: Embedded breathing monitor built for the senior design project.',
    result: 'TODO: 98% detection accuracy',
    details: 'TODO: What it does, what you built, and the result.',
    stack: ['C', 'Embedded', 'Sensors'],
    links: { github: 'https://github.com/TODO' },
    tag: 'Hardware',
    demo: { kind: 'breathing', samples: '/data/breathing.json' },
  },
  {
    id: 'gitpulse',
    title: 'GitPulse',
    pitch: 'TODO: Notifications for the GitHub activity you care about.',
    result: 'TODO: 300+ users',
    details: 'TODO: What it does, what you built, and the result.',
    stack: ['TypeScript', 'Node', 'GitHub API'],
    links: { github: 'https://github.com/TODO', live: 'https://TODO' },
    tag: 'App',
    demo: { kind: 'commit', fallback: { repo: 'TODO/gitpulse', message: 'TODO: a recent commit message' } },
  },
  {
    id: 'cue',
    title: 'Cue',
    pitch: 'TODO: Music recognition, turning sound waves into a signal.',
    result: 'TODO: Recognizes a song in 3 seconds',
    details: 'TODO: What it does, what you built, and the result.',
    stack: ['Python', 'DSP'],
    links: { github: 'https://github.com/TODO' },
    tag: 'Audio',
    // Add a short clip (e.g. '/audio/cue-sample.mp3') to play instead of the built-in jingle.
    demo: { kind: 'song', song: 'TODO Song Title — Artist' },
  },
  {
    id: 'remote-job-globe',
    title: 'Remote Job Globe',
    pitch: 'TODO: Remote jobs around the world on an interactive globe.',
    result: 'TODO: 5,000 jobs mapped',
    details: 'TODO: What it does, what you built, and the result.',
    stack: ['React', 'Three.js'],
    links: { github: 'https://github.com/TODO', live: 'https://TODO' },
    tag: 'Web',
  },
  {
    id: 'sabah-hub',
    title: 'SABAH.HUB',
    pitch: 'TODO: Grew from intern to full-time engineer.',
    result: 'TODO: Shipped 12 features to production',
    details: 'TODO: Team, scope and what you shipped.',
    stack: ['TODO'],
    links: {},
    tag: 'Work',
    demo: { kind: 'milestone', from: 'Intern', to: 'Full-time' },
  },
]

export const CONTACT: Contact = {
  name: 'TODO Your Name',
  role: 'TODO Software Engineer',
  pitch: 'TODO: I build full-stack products and embedded systems that ship.',
  blurb: 'TODO: One or two sentences about what you are looking for.',
  email: 'TODO@example.com',
  linkedin: 'https://linkedin.com/in/TODO',
  github: 'https://github.com/TODO',
  cv: '/cv.pdf',
}

export type Experience = {
  role: string
  org: string
  /** e.g. '2024 – now'. */
  when: string
  /** One or two lines on what you did and the result. */
  summary: string
}

/** Newest first. Shown on the /portfolio page. */
export const EXPERIENCE: Experience[] = [
  {
    role: 'TODO Software Engineer',
    org: 'SABAH.HUB',
    when: 'TODO 2025 – now',
    summary: 'TODO: Joined as an intern, went full-time. What you own and one result.',
  },
  {
    role: 'TODO Software Engineering Intern',
    org: 'SABAH.HUB',
    when: 'TODO 2024 – 2025',
    summary: 'TODO: What you built as an intern.',
  },
]

export type Education = { degree: string; school: string; when: string; note?: string }

/** Newest first. The first entry also appears on the contact card. */
export const EDUCATION: Education[] = [
  {
    degree: 'TODO B.Sc. Computer Engineering',
    school: 'ADA University',
    when: 'TODO 2021 – 2025',
    note: 'TODO: Senior design project: the Breathing Monitor.',
  },
]

export const projectById = (id: string) => PROJECTS.find((p) => p.id === id)

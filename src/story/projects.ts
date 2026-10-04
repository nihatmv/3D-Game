/**
 * Portfolio content. This is the only file to edit when projects change:
 * quests point at projects by `id`, and every island card reads from here.
 *
 * TODO: replace the placeholder text, links and media with the real content.
 */

/**
 * A small live demo on the project's landmark (and in its card):
 * - `song`: clicking the pond plays `audio` (or a built-in jingle when omitted), then shows "Recognized: <song>".
 * - `milestone`: the tree grows from a sapling; the card shows `from → to`.
 */
export type Demo =
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
  /** `video` is a walkthrough recording (e.g. a Loom share link), opened in a new tab. */
  links: { github?: string; live?: string; video?: string }
  /**
   * Screenshot, GIF or short video (.mp4/.webm, played muted on loop). Put files in
   * /public and use a path like '/media/gitpulse.mp4'; omit for a placeholder tile.
   */
  media?: string
  /**
   * Live products worked on (e.g. at a job), shown on the card as a grid of linked screenshots
   * in place of `media`. `note` is a few words on what it is; `image` is a file in /public.
   */
  shipped?: { name: string; url: string; note?: string; image?: string }[]
  /** More screenshots (files in /public): the card shows them as a swipeable row in place of `media`. */
  gallery?: string[]
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
    id: 'reddit-scraper',
    title: 'Reddit Scraper',
    pitch: 'Scrapes a subreddit and uses GPT-4 to turn every post into a short insight.',
    result: 'Every post becomes a summary of 100 words or less',
    details:
      'A Puppeteer script scrolls a subreddit, collects the unique post links and reads each post. GPT-4 summarizes what people are building and where they are stuck, the results are saved to Supabase without duplicates, and a React page lists them with category filters.',
    stack: ['TypeScript', 'Puppeteer', 'OpenAI API', 'Supabase', 'React'],
    links: {
      github: 'https://github.com/nihatmv/reddit-scraping',
      video: 'https://www.loom.com/share/ed5555ee6e26411a81e67430b36278aa',
    },
    media: '/media/reddit-scraper.gif',
    tag: 'Automation',
  },
  {
    id: 'shiplog',
    title: 'ShipLog',
    pitch: 'Every GitHub push and pull request, posted to a shared Telegram group as it happens.',
    result: 'One clear message per push or pull request, noise filtered out',
    details:
      'GitHub webhooks hit a Cloudflare Worker that verifies the HMAC signature, drops redeliveries, filters out noise like bot commits and label changes, and posts one formatted message per event to Telegram. Built so my brother and I can see what each other is shipping.',
    stack: ['TypeScript', 'Cloudflare Workers', 'GitHub Webhooks', 'Telegram Bot API', 'Vitest'],
    links: { github: 'https://github.com/nihatmv/ShipLog' },
    tag: 'Automation',
  },
  {
    id: 'remote-job-globe',
    title: 'Remote Job Globe',
    pitch: 'Remote tech jobs I scraped, placed on a 3D globe at each company’s headquarters.',
    result: '539 remote jobs from 344 companies on one globe',
    details:
      'A scraper pulls remote tech postings, Claude reads each one to find the company’s headquarters and hiring regions, and OpenStreetMap turns the place names into coordinates. The globe stacks the jobs into bars per city: click one to see its postings and their tech stack.',
    stack: ['TypeScript', 'Three.js', 'globe.gl', 'Python', 'Claude API', 'OpenStreetMap'],
    links: { github: 'https://github.com/nihatmv/3D-Globe' },
    media: '/media/globe-1.jpg',
    gallery: ['/media/globe-1.jpg', '/media/globe-3.jpg', '/media/globe-2.jpg'],
    tag: 'Data · 3D',
  },
  {
    id: 'sabah-hub',
    title: 'SABAH.HUB',
    pitch: 'Front-end developer on SABAH.HUB’s web products, from intern to full-time.',
    result: '4 products live in production',
    details:
      'At SABAH.HUB Innovation Center I build the web front ends of the products below, from first screen to launch.',
    stack: ['Next.js', 'React'],
    links: {},
    shipped: [
      { name: 'Push30', url: 'https://push30.app/', note: 'Every gym in one subscription', image: '/media/push30.jpg' },
      { name: 'Baku ID', url: 'https://bakuid.com/', note: 'Azerbaijan’s main startup event', image: '/media/bakuid.jpg' },
      { name: 'Canscreen', url: 'https://canscreen.io/', note: 'AI CV screening and video interviews', image: '/media/canscreen.jpg' },
      { name: 'Popeyes Azerbaijan', url: 'https://popeyes.az/az', note: 'Menu and restaurants', image: '/media/popeyes.jpg' },
    ],
    // The island's hover preview uses this; the card shows the grid above instead.
    media: '/media/bakuid.jpg',
    tag: 'Work',
    demo: { kind: 'milestone', from: 'Intern', to: 'Full-time' },
  },
  {
    id: 'cozy-island',
    title: 'This Island',
    pitch: 'The portfolio you are standing on: a 3D island a crew builds while you watch.',
    result: 'Every shape is built in code, with no 3D model files',
    details:
      'A low-poly island that runs in the browser. Terrain, ship, crew, lighthouse and waterfall are all generated from primitives, the tour is a small state machine, and frames are only drawn when something moves so it stays smooth on weak laptops and phones.',
    stack: ['TypeScript', 'React', 'Three.js', 'React Three Fiber', 'Zustand', 'Vite'],
    links: { github: 'https://github.com/nihatmv/3D-Game' },
    media: '/og.png',
    tag: 'Web · 3D',
  },
]

export const CONTACT: Contact = {
  name: 'Nihat Mammadli',
  role: 'Full-Stack & Automation Engineer',
  pitch: 'Full-stack and automation engineer at SABAH.HUB, building web products end to end.',
  blurb:
    'I build full-stack products and the automations behind them, from the UI people click to the scripts that quietly do the boring work.',
  email: 'nmammadli05@gmail.com',
  linkedin: 'https://www.linkedin.com/in/nihat-mammadli-917268257/',
  github: 'https://github.com/nihatmv',
  photo: '/photo.jpg',
}

export type Education = { degree: string; school: string; when: string; note?: string }

/** Newest first. The first entry appears on the contact card. */
export const EDUCATION: Education[] = [
  {
    degree: 'B.Sc. Computer Engineering',
    school: 'ADA University',
    when: '2022 – 2026',
    note: 'TODO: Senior design project: the Breathing Monitor.',
  },
]

export const projectById = (id: string) => PROJECTS.find((p) => p.id === id)
